import type { ClientMessage, LessonState, Point, Stroke } from '@penduet/protocol'

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

export interface RoomData {
  /** Last sequence number handed out. */
  seq: number
  lesson: LessonState | null
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
  /** Refused: send this error code to the sender only. */
  refused?: 'bad_message' | 'rate_limited'
}

export const strokeKey = (authorId: string, id: string) => `${authorId}:${id}`
/** Storage key of a committed stroke. Sorts by commit order. */
export const committedKey = (seq: number, authorId: string, id: string) =>
  `s:${String(seq).padStart(12, '0')}:${strokeKey(authorId, id)}`

/** A room that was made for a lesson starts on its first step. */
export const newLesson = (slug: string): LessonState => ({ slug, step: 0, from: 0, result: null, results: [] })

export function newRoomData(): RoomData {
  return { seq: 0, lesson: null, strokes: [], open: new Map() }
}

/**
 * Applies one validated client message from `from`. Mutates `data` and says what to do about it.
 * A stroke has exactly one author, so there is nothing to merge: the room only orders events.
 */
export function applyClientMessage(data: RoomData, from: string, msg: ClientMessage): Outcome {
  switch (msg.type) {
    case 'hello':
      return {} // the name comes from the signed ticket, never from the client

    case 'stroke_start': {
      if (data.strokes.length >= LIMITS.maxStrokes) return { refused: 'rate_limited' }
      const key = strokeKey(from, msg.id)
      if (data.open.has(key)) return { refused: 'bad_message' }
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
      for (const p of msg.pts as Point[]) stroke.points.push(p)
      return { event: stamp(data, from, msg) }
    }

    case 'stroke_end': {
      const key = strokeKey(from, msg.id)
      const stroke = data.open.get(key)
      if (!stroke) return { refused: 'bad_message' }
      data.open.delete(key)
      const event = stamp(data, from, msg)
      stroke.seq = event.seq
      data.strokes.push(stroke)
      return { event, storage: { put: { [committedKey(event.seq, from, stroke.id)]: stroke, meta_seq: data.seq } } }
    }

    case 'undo': {
      // Removes the sender's own latest stroke. Everyone applies the same rule, so views agree.
      let i = data.strokes.length - 1
      while (i >= 0 && data.strokes[i]!.authorId !== from) i--
      if (i < 0) return {} // nothing to undo: no event
      const [removed] = data.strokes.splice(i, 1)
      const event = stamp(data, from, msg)
      return { event, storage: { del: [committedKey(removed!.seq, from, removed!.id)], put: { meta_seq: data.seq } } }
    }

    case 'clear': {
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
        lesson.from = data.strokes.length
      }
      lesson.result = null
      const event = stamp(data, from, msg)
      storage.put = { lesson, meta_seq: data.seq }
      return { event, storage }
    }

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

function stamp(data: RoomData, from: string, body: ClientMessage) {
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
