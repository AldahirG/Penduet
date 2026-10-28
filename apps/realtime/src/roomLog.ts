import { findLesson, halfSubjects, topics } from '@penduet/lessons'
import { CANVAS_SIZE } from '@penduet/protocol'
import type { ClientMessage, GameKind, GameState, LessonState, Point, Slot, Stroke } from '@penduet/protocol'
import { canDraw, newGuessGame, type GuessGame } from './guessGame'

// The rules of a room's stroke log, with no I/O so they can be tested without a Durable Object.
// room.ts feeds messages in and carries out the result: broadcast, persist, reply.

export const LIMITS = {
  /** Committed strokes kept per room. Past this, new strokes are refused until someone clears. */
  maxStrokes: 2000,
  maxPointsPerStroke: 5000,
  /** Per socket, per one-second window. A batched pen sends about 33 messages and 2000 points a second. */
  maxMessagesPerSecond: 80,
  maxPointsPerSecond: 3000,
}

/** A room's game as the room keeps it: draw and guess carries its secret word and a little memory. */
export type StoredGame = Exclude<GameState, { kind: 'guess' }> | GuessGame

export interface RoomData {
  /** Last sequence number handed out. */
  seq: number
  lesson: LessonState | null
  /** What a topic or pass-the-pen room is playing. Null in a free room or a lesson. */
  game: StoredGame | null
  /** Committed strokes in the order they ended. */
  strokes: Stroke[]
  /** Strokes between stroke_start and stroke_end, keyed by `${authorId}:${id}`. Not persisted. */
  open: Map<string, Stroke>
}

export interface StorageOps {
  put?: Record<string, unknown>
  del?: string[]
  /** True when every stored stroke should go (clear). */
  clearStrokes?: boolean
}

export interface Outcome {
  /** To send to every socket in the room, stamped with its sequence number. */
  event?: { seq: number; from: string; body: ClientMessage }
  storage?: StorageOps
  /** Pass-the-pen: whose turn it is now, to tell everyone after the event. Only set when it may have changed. */
  turn?: Slot
  /** Refused: send this error code to the sender only. */
  refused?: 'bad_message' | 'rate_limited' | 'not_your_turn' | 'not_open'
}

/** What the rules of pass-the-pen need to know about the room around a message. */
export interface TurnContext {
  /** The sender's seat. */
  slot: Slot
  /** Whether someone is connected in that seat. A turn held by an empty seat does not block the other person. */
  present: (slot: Slot) => boolean
}

const other = (slot: Slot): Slot => (slot === 1 ? 2 : 1)

/** Seat 1 owns the left half of the canvas and seat 2 the right half. */
export const clampToHalf = (x: number, slot: Slot): number => (slot === 1 ? Math.min(x, CANVAS_SIZE / 2) : Math.max(x, CANVAS_SIZE / 2))

export const strokeKey = (authorId: string, id: string) => `${authorId}:${id}`
/** Storage key of a committed stroke. Sorts by commit order. */
export const committedKey = (seq: number, authorId: string, id: string) =>
  `s:${String(seq).padStart(12, '0')}:${strokeKey(authorId, id)}`

/** A room that was made for a lesson starts on its first step. */
export const newLesson = (slug: string): LessonState => ({ slug, step: 0, from: 0, result: null, results: [] })

/** A room made for a game starts in its first state: a topic picked at random, or the host to draw first. */
export function newGame(kind: GameKind, random: () => number = Math.random): StoredGame | null {
  if (kind === 'topic') return { kind: 'topic', topic: Math.floor(random() * topics.length) }
  if (kind === 'turns') return { kind: 'turns', turn: 1 }
  if (kind === 'halves') return { kind: 'halves', subject: Math.floor(random() * halfSubjects.length) }
  if (kind === 'guess') return newGuessGame()
  return null
}

export function newRoomData(): RoomData {
  return { seq: 0, lesson: null, game: null, strokes: [], open: new Map() }
}

/**
 * Applies one validated client message from `from`. Mutates `data` and says what to do about it.
 * A stroke has exactly one author, so there is nothing to merge: the room only orders events.
 */
export function applyClientMessage(data: RoomData, from: string, msg: ClientMessage, ctx?: TurnContext): Outcome {
  switch (msg.type) {
    case 'hello':
      return {} // the name comes from the signed ticket, never from the client

    case 'stroke_start': {
      if (data.strokes.length >= LIMITS.maxStrokes) return { refused: 'rate_limited' }
      const key = strokeKey(from, msg.id)
      if (data.open.has(key)) return { refused: 'bad_message' }
      // Pass the pen: only the person whose turn it is may start a stroke, unless that seat is empty.
      if (data.game?.kind === 'turns' && ctx && data.game.turn !== ctx.slot && ctx.present(data.game.turn)) return { refused: 'not_your_turn' }
      // Draw and guess: only the drawer, and only while the canvas is open.
      if (data.game?.kind === 'guess' && !(ctx && canDraw(data.game, ctx.slot))) return { refused: 'not_open' }
      data.open.set(key, {
        id: msg.id,
        authorId: from,
        tool: msg.tool,
        color: msg.color,
        size: msg.size,
        points: [],
        seq: 0,
      })
      return { event: stamp(data, from, msg) }
    }

    case 'stroke_pts': {
      const stroke = data.open.get(strokeKey(from, msg.id))
      // Unknown or someone else's stroke (or the room woke from hibernation mid-stroke): drop it.
      if (!stroke) return { refused: 'bad_message' }
      if (stroke.points.length + msg.pts.length > LIMITS.maxPointsPerStroke) return { refused: 'rate_limited' }
      // Two halves: a line can reach the middle but not cross it. Everyone gets the clamped points, the sender's own screen included.
      const pts = data.game?.kind === 'halves' && ctx ? msg.pts.map(([x, y, p]) => [clampToHalf(x, ctx.slot), y, p] as Point) : (msg.pts as Point[])
      for (const p of pts) stroke.points.push(p)
      return { event: stamp(data, from, pts === msg.pts ? msg : { ...msg, pts }) }
    }

    case 'stroke_end': {
      const key = strokeKey(from, msg.id)
      const stroke = data.open.get(key)
      if (!stroke) return { refused: 'bad_message' }
      data.open.delete(key)
      const event = stamp(data, from, msg)
      stroke.seq = event.seq
      data.strokes.push(stroke)
      const put: Record<string, unknown> = { [committedKey(event.seq, from, stroke.id)]: stroke, meta_seq: data.seq }
      if (data.game?.kind === 'turns' && ctx) {
        // One stroke per turn: the pen goes to the other seat.
        data.game.turn = other(ctx.slot)
        put.game = data.game
        return { event, storage: { put }, turn: data.game.turn }
      }
      return { event, storage: { put } }
    }

    case 'undo': {
      if (data.game?.kind === 'guess' && !(ctx && canDraw(data.game, ctx.slot))) return { refused: 'not_open' }
      // Removes the sender's own latest stroke. Everyone applies the same rule, so views agree.
      let i = data.strokes.length - 1
      while (i >= 0 && data.strokes[i]!.authorId !== from) i--
      if (i < 0) return {} // nothing to undo: no event
      const turns = data.game?.kind === 'turns' && ctx ? data.game : null
      // Pass the pen: you can take back your stroke only while it is the latest one, which also gives you the pen again.
      if (turns && i !== data.strokes.length - 1) return { refused: 'not_your_turn' }
      const [removed] = data.strokes.splice(i, 1)
      const event = stamp(data, from, msg)
      const put: Record<string, unknown> = { meta_seq: data.seq }
      if (turns && ctx) {
        turns.turn = ctx.slot
        put.game = turns
        return { event, storage: { del: [committedKey(removed!.seq, from, removed!.id)], put }, turn: turns.turn }
      }
      return { event, storage: { del: [committedKey(removed!.seq, from, removed!.id)], put } }
    }

    case 'clear': {
      if (data.game?.kind === 'guess' && !(ctx && canDraw(data.game, ctx.slot))) return { refused: 'not_open' }
      data.strokes = []
      data.open.clear()
      return { event: stamp(data, from, msg), storage: { clearStrokes: true, put: { meta_seq: data.seq } } }
    }

    case 'lesson_set': {
      // Only a room made for this lesson can run it: nobody can swap the lesson from inside.
      const lesson = data.lesson
      if (!lesson || lesson.slug !== msg.slug) return { refused: 'bad_message' }
      const storage: StorageOps = { put: {} }
      if (msg.step === lesson.step && !msg.restart) return {} // already there: two "next" presses make one move
      if (msg.step === lesson.step) {
        // Starting the same step again: its strokes go, on the server as well as on both screens.
        const removed = data.strokes.splice(lesson.from)
        storage.del = removed.map((s) => committedKey(s.seq, s.authorId, s.id))
        data.open.clear()
        lesson.results[msg.step] = null
      } else {
        lesson.step = msg.step
        // Each step starts on a clean canvas, or the last step's drawing would sit on top of the next guide.
        // Past the final step the lesson is done, and the finished drawing stays to look at and save.
        const total = findLesson(lesson.slug)?.steps.length ?? 0
        if (msg.step < total && data.strokes.length > 0) {
          storage.del = data.strokes.map((s) => committedKey(s.seq, s.authorId, s.id))
          data.strokes = []
          data.open.clear()
        }
        lesson.from = data.strokes.length
      }
      lesson.result = null
      const event = stamp(data, from, msg)
      storage.put = { lesson, meta_seq: data.seq }
      return { event, storage }
    }

    case 'pass': {
      const game = data.game
      if (!game || game.kind !== 'turns' || !ctx) return { refused: 'bad_message' }
      if (game.turn !== ctx.slot) return { refused: 'not_your_turn' }
      game.turn = other(ctx.slot)
      return { event: stamp(data, from, msg), storage: { put: { game, meta_seq: data.seq } }, turn: game.turn }
    }

    case 'subject_set': {
      const game = data.game
      if (!game || game.kind !== 'halves' || msg.subject >= halfSubjects.length) return { refused: 'bad_message' }
      if (msg.after !== game.subject) return {} // someone already changed it: two presses make one change
      game.subject = msg.subject
      data.strokes = []
      data.open.clear()
      return { event: stamp(data, from, msg), storage: { clearStrokes: true, put: { game, meta_seq: data.seq } } }
    }

    case 'topic_set': {
      const game = data.game
      if (!game || game.kind !== 'topic' || msg.topic >= topics.length) return { refused: 'bad_message' }
      if (msg.after !== game.topic) return {} // someone already changed it: two presses make one change
      game.topic = msg.topic
      data.strokes = []
      data.open.clear()
      return { event: stamp(data, from, msg), storage: { clearStrokes: true, put: { game, meta_seq: data.seq } } }
    }

    case 'guess':
      return { refused: 'bad_message' } // answers are judged against the clock, so the room handles them itself (room.ts)

    case 'step_result': {
      // A check only counts for the step the room is on. The result is kept so a reconnect sees it.
      const lesson = data.lesson
      if (!lesson || msg.step !== lesson.step) return { refused: 'bad_message' }
      lesson.result = msg.result
      lesson.results[msg.step] = { accuracy: msg.result.accuracy, smoothness: msg.result.smoothness, stars: msg.result.stars }
      for (let i = 0; i < msg.step; i++) lesson.results[i] ??= null // keep the array dense
      return { event: stamp(data, from, msg), storage: { put: { lesson, meta_seq: data.seq } } }
    }
  }
}

export function stamp(data: RoomData, from: string, body: ClientMessage) {
  data.seq += 1
  return { seq: data.seq, from, body }
}

// ---- per-socket rate limit ---------------------------------------------------

export interface RateWindow {
  start: number
  messages: number
  points: number
}

/** Counts a message in a one-second window. False means over the limit: drop it. */
export function allowMessage(w: RateWindow, now: number, msg: ClientMessage): boolean {
  if (now - w.start >= 1000) {
    w.start = now
    w.messages = 0
    w.points = 0
  }
  w.messages += 1
  if (msg.type === 'stroke_pts') w.points += msg.pts.length
  return w.messages <= LIMITS.maxMessagesPerSecond && w.points <= LIMITS.maxPointsPerSecond
}
