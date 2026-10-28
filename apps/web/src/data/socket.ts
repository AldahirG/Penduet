import { findLesson } from '@penduet/lessons'
import {
  MAX_POINTS_PER_MESSAGE,
  PING_FRAME,
  PONG_FRAME,
  WS_SUBPROTOCOL,
  serverMessageSchema,
  type ClientMessage,
  type GameState,
  type LessonState,
  type Player,
  type Point,
  type StepResult,
} from '@penduet/protocol'
import type { Board, StrokeMeta } from '../drawing/board'
import { RoomError } from './rooms'

export type SocketStatus =
  | 'connecting' // first connection
  | 'live'
  | 'reconnecting' // dropped, trying again
  | 'ended' // the host closed the room
  | 'full' // two people are already in
  | 'replaced' // the same person opened the room somewhere else
  | 'gone' // the room no longer exists, or you are not in it

export interface RoomState {
  status: SocketStatus
  you: Player | null
  peer: Player | null
  /** The peer was here and has left (peer keeps their name and seat). */
  peerLeft: boolean
  /** The peer has drawn within the last moment. */
  peerDrawing: boolean
  /** The lesson both people are drawing, with its current step and what has been checked. Null in a free room. */
  lesson: LessonState | null
  /** The game this room is playing (a topic, or pass the pen) and where it stands. Null in a free room or a lesson. */
  game: GameState | null
}

export interface RoomSocketDeps {
  code: string
  /** Worker origin as ws:// or wss://, no trailing slash. */
  wsBase: string
  /** A fresh ticket. Called for the first connection and for every reconnect. */
  getTicket: () => Promise<string>
  board: Board
  onState: (state: RoomState) => void
  WebSocketImpl?: typeof WebSocket
}

const PING_EVERY_MS = 25_000
/** Points are sent in batches this often. A pen produces many points per frame, and one message is cheaper. */
const FLUSH_MS = 30
const PEER_DRAWING_MS = 700
const BACKOFF_BASE_MS = 500
const BACKOFF_MAX_MS = 10_000

const initial: RoomState = { status: 'connecting', you: null, peer: null, peerLeft: false, peerDrawing: false, lesson: null, game: null }

/**
 * One person's connection to one room. Drawing is optimistic: the canvas updates at once and the
 * strokes are sent in the background. What the room sends back is the partner's drawing and, on every
 * (re)connect, a full snapshot that replaces the local board. Own events echoed by the room are ignored.
 * While the socket is not live nothing is sent, and the page should not let the person draw.
 */
export class RoomSocket {
  private state: RoomState = initial
  private ws: WebSocket | null = null
  private generation = 0
  private disposed = false
  private attempts = 0
  private retryTimer: ReturnType<typeof setTimeout> | undefined
  private pingTimer: ReturnType<typeof setInterval> | undefined
  private flushTimer: ReturnType<typeof setTimeout> | undefined
  private drawingTimer: ReturnType<typeof setTimeout> | undefined
  private pending = new Map<string, Point[]>()
  private readonly WS: typeof WebSocket

  constructor(private deps: RoomSocketDeps) {
    this.WS = deps.WebSocketImpl ?? WebSocket
  }

  get current(): RoomState {
    return this.state
  }

  /** Start connecting. Call it again to reconnect now, or after `replaced` to take the room back. */
  connect(): void {
    this.disposed = false // also revives a socket that was closed, as React StrictMode does on mount
    this.stopTimers()
    const gen = ++this.generation
    const old = this.ws
    this.ws = null
    try {
      old?.close(1000)
    } catch {
      // already closed
    }
    this.set({ status: this.state.you ? 'reconnecting' : 'connecting' })
    this.deps
      .getTicket()
      .then((ticket) => {
        if (gen !== this.generation || this.disposed) return
        this.open(ticket, gen)
      })
      .catch((err: unknown) => {
        if (gen !== this.generation || this.disposed) return
        const code = err instanceof RoomError ? err.code : 'network'
        if (code === 'room_not_found') return this.set({ status: 'gone' })
        if (code === 'room_full') return this.set({ status: 'full' })
        this.retry()
      })
  }

  close(): void {
    this.disposed = true
    this.generation++
    this.stopTimers()
    const ws = this.ws
    this.ws = null
    try {
      ws?.close(1000)
    } catch {
      // already closed
    }
  }

  private open(ticket: string, gen: number): void {
    let ws: WebSocket
    try {
      ws = new this.WS(`${this.deps.wsBase}/rooms/${this.deps.code}/ws`, [WS_SUBPROTOCOL, ticket])
    } catch {
      return this.retry()
    }
    this.ws = ws
    ws.onopen = () => {
      if (gen !== this.generation) return
      this.pingTimer = setInterval(() => this.rawSend(PING_FRAME), PING_EVERY_MS)
    }
    ws.onmessage = (e) => {
      if (gen === this.generation && typeof e.data === 'string') this.receive(e.data)
    }
    ws.onclose = (e) => {
      if (gen !== this.generation || this.disposed) return
      this.ws = null
      clearInterval(this.pingTimer)
      this.flushNow()
      switch (e.code) {
        case 4004:
          return this.set({ status: 'ended' })
        case 4002:
          return this.set({ status: 'full' })
        case 4001:
          return this.set({ status: 'replaced' })
        case 4003:
          return this.set({ status: 'gone' })
        default:
          this.retry()
      }
    }
  }

  private retry(): void {
    if (this.disposed) return
    this.set({ status: 'reconnecting', peerDrawing: false })
    const base = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** this.attempts)
    this.attempts += 1
    clearTimeout(this.retryTimer)
    // A little jitter, so two people who dropped together do not retry in lockstep.
    this.retryTimer = setTimeout(() => this.connect(), base * (0.75 + Math.random() * 0.5))
  }

  // ---- receiving -------------------------------------------------------------

  private receive(raw: string): void {
    if (raw === PONG_FRAME) return
    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch {
      return
    }
    const parsed = serverMessageSchema.safeParse(json)
    if (!parsed.success) return
    const msg = parsed.data
    switch (msg.type) {
      case 'welcome':
        this.attempts = 0
        this.deps.board.load(msg.strokes, msg.open)
        this.set({ status: 'live', you: msg.you, peer: msg.peer, peerLeft: false, lesson: msg.lesson, game: msg.game ?? null })
        return
      case 'turn':
        if (this.state.game?.kind === 'turns') this.set({ game: { kind: 'turns', turn: msg.slot } })
        return
      case 'peer_joined':
        return this.set({ peer: msg.peer, peerLeft: false })
      case 'peer_left':
        return this.set({ peerLeft: true, peerDrawing: false })
      case 'room_ended':
        return this.set({ status: 'ended' })
      case 'error':
        if (msg.code === 'room_full') this.set({ status: 'full' })
        // Out of turn: what is on this screen no longer matches the room. Take its snapshot again.
        if (msg.code === 'not_your_turn') this.connect()
        return // rate_limited, bad_message: nothing useful to show
      case 'event': {
        const b = msg.body
        // Lesson steps and topics are decided by the room's order, so even your own are applied when they come back.
        // Everything else you did is already on your canvas.
        if (msg.from === this.state.you?.id && b.type !== 'lesson_set' && b.type !== 'step_result' && b.type !== 'topic_set' && b.type !== 'subject_set') return
        if (b.type === 'stroke_start') {
          this.deps.board.start(msg.from, { id: b.id, tool: b.tool, color: b.color, size: b.size })
          this.sawPeerDraw()
        } else if (b.type === 'stroke_pts') {
          this.deps.board.points(msg.from, b.id, b.pts)
          this.sawPeerDraw()
        } else if (b.type === 'stroke_end') this.deps.board.end(msg.from, b.id)
        else if (b.type === 'undo') this.deps.board.undoLast(msg.from)
        else if (b.type === 'clear') this.deps.board.clear()
        else if (b.type === 'lesson_set') this.applyLessonSet(b.slug, b.step, b.restart === true)
        else if (b.type === 'step_result') this.applyStepResult(b.step, b.result)
        else if (b.type === 'topic_set') this.applyTopicSet(b.topic, b.after)
        else if (b.type === 'subject_set') this.applySubjectSet(b.subject, b.after)
        return
      }
    }
  }

  private applyLessonSet(slug: string, step: number, restart: boolean): void {
    const l = this.state.lesson
    if (!l || l.slug !== slug) return
    if (step === l.step && !restart) return
    if (step === l.step) {
      // The same step again: its strokes go from this screen too.
      this.deps.board.truncate(l.from)
      const results = [...l.results]
      results[step] = null
      this.set({ lesson: { ...l, result: null, results } })
    } else {
      // A new step starts on a clean canvas, like the room does; after the last step the drawing stays.
      if (step < (findLesson(slug)?.steps.length ?? 0)) this.deps.board.clear()
      this.set({ lesson: { ...l, step, from: this.deps.board.strokeCount, result: null } })
    }
  }

  private applyTopicSet(topic: number, after: number): void {
    const g = this.state.game
    if (!g || g.kind !== 'topic' || g.topic !== after) return
    this.deps.board.clear()
    this.set({ game: { kind: 'topic', topic } })
  }

  private applySubjectSet(subject: number, after: number): void {
    const g = this.state.game
    if (!g || g.kind !== 'halves' || g.subject !== after) return
    this.deps.board.clear()
    this.set({ game: { kind: 'halves', subject } })
  }

  private applyStepResult(step: number, result: StepResult): void {
    const l = this.state.lesson
    if (!l || l.step !== step) return
    const results = [...l.results]
    for (let i = 0; i < step; i++) results[i] ??= null
    results[step] = { accuracy: result.accuracy, smoothness: result.smoothness, stars: result.stars }
    this.set({ lesson: { ...l, result, results } })
  }

  private sawPeerDraw(): void {
    if (!this.state.peerDrawing) this.set({ peerDrawing: true })
    clearTimeout(this.drawingTimer)
    this.drawingTimer = setTimeout(() => this.set({ peerDrawing: false }), PEER_DRAWING_MS)
  }

  // ---- sending ---------------------------------------------------------------

  sendStart(meta: StrokeMeta): void {
    this.send({ type: 'stroke_start', ...meta })
  }

  /** Buffered, then sent in batches of at most 64 points. */
  sendPoints(id: string, pts: Point[]): void {
    if (!this.isLive()) return
    const list = this.pending.get(id) ?? []
    list.push(...pts)
    this.pending.set(id, list)
    this.flushTimer ??= setTimeout(() => this.flushNow(), FLUSH_MS)
  }

  sendEnd(id: string): void {
    this.flushNow()
    this.send({ type: 'stroke_end', id })
    this.giveTurn('away') // one stroke per turn: the pen goes to the other person, as the room will confirm
  }

  sendUndo(): void {
    this.send({ type: 'undo' })
    this.giveTurn('me') // taking your stroke back gives you the pen again
  }

  /** Pass the pen without drawing. */
  sendPass(): void {
    this.send({ type: 'pass' })
    this.giveTurn('away')
  }

  /** Ask for another topic. `after` is the one you are looking at, so two people asking at once change it once. */
  sendTopicSet(topic: number, after: number): void {
    this.send({ type: 'topic_set', topic, after })
  }

  /** Ask for another two-halves picture. `after` is the one you are looking at. */
  sendSubjectSet(subject: number, after: number): void {
    this.send({ type: 'subject_set', subject, after })
  }

  /** Pass the pen, here and now. The room's `turn` message confirms it, or corrects it. */
  private giveTurn(to: 'me' | 'away'): void {
    const g = this.state.game
    const slot = this.state.you?.slot
    if (!g || g.kind !== 'turns' || !slot) return
    this.set({ game: { kind: 'turns', turn: to === 'me' ? slot : slot === 1 ? 2 : 1 } })
  }

  /** Go to step `step` of the room's lesson. With `restart`, start the current step over (clears its strokes). */
  sendLessonSet(slug: string, step: number, restart = false): void {
    this.send({ type: 'lesson_set', slug, step, ...(restart ? { restart: true } : {}) })
  }

  /** Share what a check of the current step found. */
  sendStepResult(step: number, result: StepResult): void {
    this.send({ type: 'step_result', step, result })
  }

  sendClear(): void {
    this.send({ type: 'clear' })
  }

  private flushNow(): void {
    clearTimeout(this.flushTimer)
    this.flushTimer = undefined
    const batches = [...this.pending]
    this.pending.clear()
    if (!this.isLive()) return
    for (const [id, pts] of batches) {
      for (let i = 0; i < pts.length; i += MAX_POINTS_PER_MESSAGE) {
        this.send({ type: 'stroke_pts', id, pts: pts.slice(i, i + MAX_POINTS_PER_MESSAGE) })
      }
    }
  }

  private isLive(): boolean {
    return this.state.status === 'live' && this.ws?.readyState === 1
  }

  private send(msg: ClientMessage): void {
    if (this.isLive()) this.rawSend(JSON.stringify(msg))
  }

  private rawSend(frame: string): void {
    if (this.ws?.readyState === 1) this.ws.send(frame)
  }

  // ---- state -----------------------------------------------------------------

  private set(patch: Partial<RoomState>): void {
    this.state = { ...this.state, ...patch }
    this.deps.onState(this.state)
  }

  private stopTimers(): void {
    clearTimeout(this.retryTimer)
    clearTimeout(this.flushTimer)
    clearTimeout(this.drawingTimer)
    clearInterval(this.pingTimer)
    this.flushTimer = undefined
  }
}
