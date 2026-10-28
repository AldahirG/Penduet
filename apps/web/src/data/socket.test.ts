import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { findLesson } from '@penduet/lessons'
import type { ServerMessage } from '@penduet/protocol'
import { Board } from '../drawing/board'
import { RoomError } from './rooms'
import { RoomSocket, type RoomState } from './socket'

class FakeSocket {
  static all: FakeSocket[] = []
  readyState = 0
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((e: { data: unknown }) => void) | null = null
  onclose: ((e: { code: number }) => void) | null = null
  constructor(readonly url: string, readonly protocols: string[]) {
    FakeSocket.all.push(this)
  }
  send(data: string) {
    this.sent.push(data)
  }
  close(code = 1000) {
    this.readyState = 3
    this.onclose?.({ code })
  }
  // test helpers
  open() {
    this.readyState = 1
    this.onopen?.()
  }
  push(msg: ServerMessage | string) {
    this.onmessage?.({ data: typeof msg === 'string' ? msg : JSON.stringify(msg) })
  }
  drop(code: number) {
    this.readyState = 3
    this.onclose?.({ code })
  }
  frames() {
    return this.sent.map((s) => (s.startsWith('{') ? JSON.parse(s) : s))
  }
}

const ME = { id: 'me', name: 'Mara', slot: 1 as const }
const PEER = { id: 'peer', name: 'Teo', slot: 2 as const }
const welcome = (over: Partial<Extract<ServerMessage, { type: 'welcome' }>> = {}): ServerMessage => ({
  type: 'welcome', you: ME, peer: null, strokes: [], lesson: null, lastSeq: 0, ...over,
})
const meta = { id: 'stroke-0001', tool: 'pen' as const, color: '#112233', size: 6 }
const flush = () => new Promise((r) => queueMicrotask(() => r(undefined)))

let board: Board
let states: RoomState[]
let getTicket: ReturnType<typeof vi.fn<() => Promise<string>>>
let sock: RoomSocket

const last = () => states[states.length - 1]!
const current = () => FakeSocket.all[FakeSocket.all.length - 1]!

async function connected(msg: ServerMessage = welcome()) {
  sock.connect()
  await flush()
  await flush()
  current().open()
  current().push(msg)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.5) // no jitter: backoff waits are exactly 500, 1000, 2000 ms
  FakeSocket.all = []
  states = []
  board = new Board()
  getTicket = vi.fn(async () => 'the-ticket')
  sock = new RoomSocket({
    code: 'ABCD23',
    wsBase: 'wss://rt.example.com',
    getTicket,
    board,
    onState: (s) => states.push(s),
    WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
  })
})
afterEach(() => {
  sock.close()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('connecting', () => {
  it('opens the room socket with the ticket in the subprotocol, never in the URL', async () => {
    await connected()
    expect(current().url).toBe('wss://rt.example.com/rooms/ABCD23/ws')
    expect(current().protocols).toEqual(['penduet.v1', 'the-ticket'])
    expect(current().url).not.toContain('the-ticket')
  })

  it('goes live on welcome and replaces the board with the snapshot', async () => {
    board.start('me', meta, [[1, 1, 0.5]])
    board.end('me', meta.id)
    const stroke = { id: 'peer-stroke-1', authorId: 'peer', tool: 'pen' as const, color: '#000000', size: 4, points: [[1, 1, 0.5] as [number, number, number]], seq: 3 }
    await connected(welcome({ peer: PEER, strokes: [stroke] }))
    expect(last()).toMatchObject({ status: 'live', you: ME, peer: PEER })
    expect(board.hasStrokesBy('me')).toBe(false)
    expect(board.hasStrokesBy('peer')).toBe(true)
  })

  it('says the room is gone when the ticket call says not found, and full when it says full', async () => {
    getTicket.mockRejectedValueOnce(new RoomError('room_not_found'))
    sock.connect()
    await flush()
    await flush()
    expect(last().status).toBe('gone')
    expect(FakeSocket.all).toHaveLength(0)

    getTicket.mockRejectedValueOnce(new RoomError('room_full'))
    sock.connect()
    await flush()
    await flush()
    expect(last().status).toBe('full')
  })
})

describe('the partner', () => {
  it('shows joining, drawing and leaving', async () => {
    await connected()
    current().push({ type: 'peer_joined', peer: PEER })
    expect(last()).toMatchObject({ peer: PEER, peerLeft: false })
    current().push({ type: 'event', seq: 1, from: 'peer', body: { type: 'stroke_start', ...meta, id: 'peer-stroke-1' } })
    expect(last().peerDrawing).toBe(true)
    vi.advanceTimersByTime(800)
    expect(last().peerDrawing).toBe(false)
    current().push({ type: 'peer_left', peerId: 'peer' })
    expect(last().peerLeft).toBe(true)
  })

  it('applies the partner strokes, undo and clear to the board', async () => {
    await connected(welcome({ peer: PEER }))
    const ev = (seq: number, body: unknown) => current().push({ type: 'event', seq, from: 'peer', body } as ServerMessage)
    ev(1, { type: 'stroke_start', ...meta, id: 'peer-stroke-1' })
    ev(2, { type: 'stroke_pts', id: 'peer-stroke-1', pts: [[5, 5, 0.5], [9, 9, 0.5]] })
    ev(3, { type: 'stroke_end', id: 'peer-stroke-1' })
    expect(board.strokeCount).toBe(1)
    ev(4, { type: 'undo' })
    expect(board.strokeCount).toBe(0)
    ev(5, { type: 'stroke_start', ...meta, id: 'peer-stroke-2' })
    ev(6, { type: 'stroke_end', id: 'peer-stroke-2' })
    ev(7, { type: 'clear' })
    expect(board.strokeCount).toBe(0)
  })

  it('ignores echoes of its own events and anything it cannot parse', async () => {
    await connected()
    current().push({ type: 'event', seq: 1, from: 'me', body: { type: 'clear' } })
    board.start('me', meta, [[1, 1, 0.5]])
    board.end('me', meta.id)
    current().push({ type: 'event', seq: 2, from: 'me', body: { type: 'clear' } })
    expect(board.strokeCount).toBe(1)
    const before = states.length
    current().push('not json')
    current().push(JSON.stringify({ type: 'nonsense' }))
    current().push('pong')
    expect(states.length).toBe(before)
  })
})

describe('sending', () => {
  it('batches points into messages of at most 64 and sends the end after them', async () => {
    await connected()
    sock.sendStart(meta)
    const pts = Array.from({ length: 150 }, (_, i) => [i, i, 0.5] as [number, number, number])
    sock.sendPoints(meta.id, pts.slice(0, 100))
    sock.sendPoints(meta.id, pts.slice(100))
    expect(current().frames().filter((f) => f.type === 'stroke_pts')).toHaveLength(0) // still buffered
    sock.sendEnd(meta.id)
    const frames = current().frames()
    expect(frames.map((f) => f.type)).toEqual(['stroke_start', 'stroke_pts', 'stroke_pts', 'stroke_pts', 'stroke_end'])
    expect(frames.filter((f) => f.type === 'stroke_pts').map((f) => f.pts.length)).toEqual([64, 64, 22])
  })

  it('flushes by itself after a moment', async () => {
    await connected()
    sock.sendStart(meta)
    sock.sendPoints(meta.id, [[1, 1, 0.5]])
    vi.advanceTimersByTime(40)
    expect(current().frames().some((f) => f.type === 'stroke_pts')).toBe(true)
  })

  it('sends undo and clear, and sends nothing while not live', async () => {
    await connected()
    sock.sendUndo()
    sock.sendClear()
    expect(current().frames().map((f) => f.type)).toEqual(['undo', 'clear'])
    current().drop(1006)
    const sent = current().sent.length
    sock.sendStart(meta)
    sock.sendPoints(meta.id, [[1, 1, 0.5]])
    sock.sendUndo()
    vi.advanceTimersByTime(100)
    expect(current().sent.length).toBe(sent)
  })

  it('pings every 25 seconds to keep the connection alive', async () => {
    await connected()
    vi.advanceTimersByTime(25_000)
    expect(current().sent).toContain('ping')
  })
})

describe('a stroke in progress when you connect', () => {
  it('is in the snapshot, and finishes on your screen when its author finishes it', async () => {
    const halfway = { id: 'peer-stroke-1', authorId: 'peer', tool: 'pen' as const, color: '#000000', size: 4, points: [[1, 1, 0.5] as [number, number, number]], seq: 0 }
    await connected(welcome({ peer: PEER, open: [halfway] }))
    expect(board.strokeCount).toBe(0)
    current().push({ type: 'event', seq: 5, from: 'peer', body: { type: 'stroke_pts', id: 'peer-stroke-1', pts: [[9, 9, 0.5]] } })
    current().push({ type: 'event', seq: 6, from: 'peer', body: { type: 'stroke_end', id: 'peer-stroke-1' } })
    expect(board.strokeCount).toBe(1)
    expect(board.undoLast('peer')?.points).toHaveLength(2)
  })
})

describe('a lesson in the room', () => {
  const result = { accuracy: 91, smoothness: 80, stars: 3 as const, passed: true, hint: 'great', guideCoverage: [1] }
  const lesson = { slug: 'straight-lines', step: 0, from: 0, result: null, results: [] }
  const ev = (seq: number, from: string, body: unknown) => current().push({ type: 'event', seq, from, body } as ServerMessage)
  const finished = (who: string, id: string) => {
    ev(1, who, { type: 'stroke_start', ...meta, id })
    ev(2, who, { type: 'stroke_end', id })
  }

  it('takes the lesson from the welcome', async () => {
    await connected(welcome({ lesson }))
    expect(last().lesson).toEqual(lesson)
  })

  it('applies a check from the partner and from yourself, so both screens end up the same', async () => {
    await connected(welcome({ peer: PEER, lesson }))
    ev(3, 'peer', { type: 'step_result', step: 0, result })
    expect(last().lesson?.result).toEqual(result)
    expect(last().lesson?.results[0]).toEqual({ accuracy: 91, smoothness: 80, stars: 3 })
    ev(4, 'me', { type: 'step_result', step: 0, result: { ...result, accuracy: 70, stars: 1 as const } }) // your own comes back too
    expect(last().lesson?.result?.accuracy).toBe(70)
  })

  it('ignores a check for a step the room is not on', async () => {
    await connected(welcome({ lesson }))
    ev(3, 'peer', { type: 'step_result', step: 2, result })
    expect(last().lesson?.result).toBeNull()
  })

  it('moves to the next step on a clean canvas', async () => {
    await connected(welcome({ peer: PEER, lesson }))
    finished('peer', 'peer-stroke-1')
    finished('peer', 'peer-stroke-2')
    ev(3, 'me', { type: 'lesson_set', slug: 'straight-lines', step: 1 })
    expect(last().lesson).toMatchObject({ step: 1, from: 0, result: null })
    expect(board.strokeCount).toBe(0) // the last step's drawing is gone from this screen too
  })

  it('keeps the drawing when the lesson is finished', async () => {
    const total = findLesson('straight-lines')!.steps.length
    await connected(welcome({ peer: PEER, lesson: { ...lesson, step: total - 1 } }))
    finished('peer', 'peer-last-1')
    ev(3, 'me', { type: 'lesson_set', slug: 'straight-lines', step: total })
    expect(last().lesson).toMatchObject({ step: total, from: 1 })
    expect(board.strokeCount).toBe(1)
  })

  it('starting the same step again removes the strokes drawn in it, for the partner and for you', async () => {
    await connected(welcome({ peer: PEER, lesson: { ...lesson, step: 1, from: 1 } }))
    board.load([{ id: 'before-0001', authorId: 'peer', tool: 'pen', color: '#000000', size: 4, points: [[1, 1, 0.5]], seq: 1 }])
    finished('peer', 'peer-step1-1')
    board.start('me', { ...meta, id: 'my-step1-0001' }, [[2, 2, 0.5]]) // your own stroke is already on your canvas
    board.end('me', 'my-step1-0001')
    expect(board.strokeCount).toBe(3)
    ev(8, 'peer', { type: 'lesson_set', slug: 'straight-lines', step: 1 }) // not a restart: nothing happens
    expect(board.strokeCount).toBe(3)
    ev(9, 'peer', { type: 'lesson_set', slug: 'straight-lines', step: 1, restart: true })
    expect(board.strokeCount).toBe(1)
    expect(last().lesson).toMatchObject({ step: 1, from: 1, result: null })
    expect(last().lesson?.results[1]).toBeNull()
  })

  it('ignores lesson messages for another lesson or in a room with none', async () => {
    await connected(welcome({ lesson }))
    ev(3, 'peer', { type: 'lesson_set', slug: 'first-shapes', step: 1 })
    expect(last().lesson?.step).toBe(0)
    sock.close()
    await connected(welcome({ lesson: null }))
    ev(3, 'peer', { type: 'lesson_set', slug: 'straight-lines', step: 1 })
    expect(last().lesson).toBeNull()
  })

  it('sends lesson steps and results', async () => {
    await connected(welcome({ lesson }))
    sock.sendLessonSet('straight-lines', 1)
    sock.sendStepResult(0, result)
    expect(current().frames().map((f) => f.type)).toEqual(['lesson_set', 'step_result'])
  })
})

describe('losing the connection', () => {
  it('reconnects with a fresh ticket and backs off', async () => {
    await connected()
    current().drop(1006)
    expect(last().status).toBe('reconnecting')
    await vi.advanceTimersByTimeAsync(800)
    expect(getTicket).toHaveBeenCalledTimes(2)
    expect(FakeSocket.all).toHaveLength(2)
    current().drop(1006) // fails again before welcome: the wait doubles
    await vi.advanceTimersByTimeAsync(800)
    expect(FakeSocket.all).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(800)
    expect(FakeSocket.all).toHaveLength(3)
  })

  it('resets the backoff and reloads the board once it is back', async () => {
    await connected()
    board.start('me', meta, [[1, 1, 0.5]])
    board.end('me', meta.id)
    current().drop(1006)
    await vi.advanceTimersByTimeAsync(800)
    current().open()
    current().push(welcome())
    expect(last().status).toBe('live')
    expect(board.strokeCount).toBe(0) // the room's snapshot is the truth
  })

  it.each([
    [4004, 'ended'],
    [4002, 'full'],
    [4001, 'replaced'],
    [4003, 'gone'],
  ] as const)('stops for close code %s with status %s, and does not retry', async (code, status) => {
    await connected()
    current().drop(code)
    expect(last().status).toBe(status)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(FakeSocket.all).toHaveLength(1)
  })

  it('stops on room_ended and can take the room back after being replaced', async () => {
    await connected()
    current().push({ type: 'room_ended' })
    expect(last().status).toBe('ended')

    current().drop(4001)
    sock.connect()
    await vi.advanceTimersByTimeAsync(0)
    expect(FakeSocket.all.length).toBeGreaterThanOrEqual(2)
  })

  it('does nothing after close() even if a late ticket arrives', async () => {
    getTicket.mockImplementation(() => new Promise((r) => setTimeout(() => r('late'), 100)))
    sock.connect()
    sock.close()
    await vi.advanceTimersByTimeAsync(200)
    expect(FakeSocket.all).toHaveLength(0)
  })
})

describe('games', () => {
  const ev = (seq: number, from: string, body: Extract<ServerMessage, { type: 'event' }>['body']) =>
    current().push({ type: 'event', seq, from, body })
  const turns = (turn: 1 | 2) => welcome({ peer: PEER, game: { kind: 'turns', turn } })
  const topic = (n: number) => welcome({ peer: PEER, game: { kind: 'topic', topic: n } })

  it('takes the game from the welcome, and has none in a free room', async () => {
    await connected(topic(4))
    expect(last().game).toEqual({ kind: 'topic', topic: 4 })
    sock.close()
    await connected(welcome())
    expect(last().game).toBeNull()
  })

  it('follows the room about whose turn it is', async () => {
    await connected(turns(1))
    current().push({ type: 'turn', slot: 2 })
    expect(last().game).toEqual({ kind: 'turns', turn: 2 })
    sock.close()
    await connected(topic(1))
    current().push({ type: 'turn', slot: 2 }) // not a pass-the-pen room: nothing to change
    expect(last().game).toEqual({ kind: 'topic', topic: 1 })
  })

  it('hands the pen over as soon as you lift yours, before the room has said so', async () => {
    await connected(turns(1))
    sock.sendStart(meta)
    expect(last().game).toEqual({ kind: 'turns', turn: 1 })
    sock.sendEnd(meta.id)
    expect(last().game).toEqual({ kind: 'turns', turn: 2 })
    expect(current().frames().map((f) => f.type)).toEqual(['stroke_start', 'stroke_end'])
    current().push({ type: 'turn', slot: 2 }) // the room agrees
    expect(last().game).toEqual({ kind: 'turns', turn: 2 })
  })

  it('passes the pen, and takes it back with an undo', async () => {
    await connected(turns(1))
    sock.sendPass()
    expect(current().frames().at(-1)).toEqual({ type: 'pass' })
    expect(last().game).toEqual({ kind: 'turns', turn: 2 })
    sock.sendUndo()
    expect(last().game).toEqual({ kind: 'turns', turn: 1 })
  })

  it('does not touch turns in other rooms', async () => {
    await connected(topic(2))
    sock.sendStart(meta)
    sock.sendEnd(meta.id)
    expect(last().game).toEqual({ kind: 'topic', topic: 2 })
  })

  it('shows what the other person drew, even when it is their turn to have drawn it', async () => {
    await connected(turns(2))
    ev(1, 'peer', { type: 'stroke_start', ...meta, id: 'peer-stroke-1' })
    ev(2, 'peer', { type: 'stroke_pts', id: 'peer-stroke-1', pts: [[5, 5, 0.5], [9, 9, 0.5]] })
    ev(3, 'peer', { type: 'stroke_end', id: 'peer-stroke-1' })
    expect(board.strokeCount).toBe(1)
  })

  it('asks for a new topic, and the room answers with it for both people: the canvas is cleared', async () => {
    await connected(topic(4))
    board.start('me', meta, [[1, 1, 0.5]])
    board.end('me', meta.id)
    sock.sendTopicSet(9, 4)
    expect(current().frames().at(-1)).toEqual({ type: 'topic_set', topic: 9, after: 4 })
    expect(last().game).toEqual({ kind: 'topic', topic: 4 }) // not until the room says so
    ev(1, 'me', { type: 'topic_set', topic: 9, after: 4 }) // the room's order, even for your own request
    expect(last().game).toEqual({ kind: 'topic', topic: 9 })
    expect(board.strokeCount).toBe(0)
  })

  it('ignores a topic change that was made for a topic you are no longer on', async () => {
    await connected(topic(9))
    board.start('me', meta, [[1, 1, 0.5]])
    board.end('me', meta.id)
    ev(1, 'peer', { type: 'topic_set', topic: 3, after: 4 })
    expect(last().game).toEqual({ kind: 'topic', topic: 9 })
    expect(board.strokeCount).toBe(1)
  })

  it('reloads the room when it refuses a stroke because it was not your turn', async () => {
    await connected(turns(2))
    const before = FakeSocket.all.length
    current().push({ type: 'error', code: 'not_your_turn' })
    await flush()
    await flush()
    expect(FakeSocket.all.length).toBe(before + 1)
  })
})

describe('two halves', () => {
  const halves = (subject: number) => welcome({ peer: PEER, game: { kind: 'halves', subject } })
  const ev = (seq: number, from: string, body: Extract<ServerMessage, { type: 'event' }>['body']) =>
    current().push({ type: 'event', seq, from, body })

  it('takes the picture from the welcome', async () => {
    await connected(halves(3))
    expect(last().game).toEqual({ kind: 'halves', subject: 3 })
  })

  it('asks for a new picture, and the room answers for both: the canvas is cleared', async () => {
    await connected(halves(3))
    board.start('me', meta, [[1, 1, 0.5]])
    board.end('me', meta.id)
    sock.sendSubjectSet(6, 3)
    expect(current().frames().at(-1)).toEqual({ type: 'subject_set', subject: 6, after: 3 })
    expect(last().game).toEqual({ kind: 'halves', subject: 3 }) // not until the room says so
    ev(1, 'me', { type: 'subject_set', subject: 6, after: 3 })
    expect(last().game).toEqual({ kind: 'halves', subject: 6 })
    expect(board.strokeCount).toBe(0)
  })

  it('ignores a change made for a picture you have already left', async () => {
    await connected(halves(6))
    board.start('me', meta, [[1, 1, 0.5]])
    board.end('me', meta.id)
    ev(1, 'peer', { type: 'subject_set', subject: 2, after: 3 })
    expect(last().game).toEqual({ kind: 'halves', subject: 6 })
    expect(board.strokeCount).toBe(1)
  })

  it('does not treat a topic message as a picture change', async () => {
    await connected(halves(6))
    ev(1, 'peer', { type: 'topic_set', topic: 2, after: 6 })
    expect(last().game).toEqual({ kind: 'halves', subject: 6 })
  })

  it('draws what the room sends, clamped or not, exactly as it arrives', async () => {
    await connected(halves(1))
    ev(1, 'peer', { type: 'stroke_start', ...meta, id: 'peer-stroke-1' })
    ev(2, 'peer', { type: 'stroke_pts', id: 'peer-stroke-1', pts: [[500, 5, 0.5], [700, 9, 0.5]] })
    ev(3, 'peer', { type: 'stroke_end', id: 'peer-stroke-1' })
    expect(board.snapshot()[0]!.points.map((p) => p[0])).toEqual([500, 700])
  })
})
