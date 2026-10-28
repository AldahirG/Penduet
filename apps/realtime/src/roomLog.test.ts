import { describe, expect, it } from 'vitest'
import { findLesson, halfSubjects, topics } from '@penduet/lessons'
import type { ClientMessage } from '@penduet/protocol'
import { LIMITS, allowMessage, applyClientMessage, clampToHalf, newGame, newLesson, newRoomData, type Outcome, type RateWindow, type TurnContext } from './roomLog'

const A = 'user-a'
const B = 'user-b'
const start = (id: string): ClientMessage => ({ type: 'stroke_start', id, tool: 'pen', color: '#112233', size: 4 })
const pts = (id: string, n = 2): ClientMessage => ({
  type: 'stroke_pts',
  id,
  pts: Array.from({ length: n }, (_, i) => [i, i, 0.5] as [number, number, number]),
})
const end = (id: string): ClientMessage => ({ type: 'stroke_end', id })

function draw(data: ReturnType<typeof newRoomData>, who: string, id: string) {
  applyClientMessage(data, who, start(id))
  applyClientMessage(data, who, pts(id))
  return applyClientMessage(data, who, end(id))
}

describe('room log', () => {
  it('numbers every accepted event in order and ignores hello', () => {
    const data = newRoomData()
    expect(applyClientMessage(data, A, { type: 'hello', name: 'Mara' })).toEqual({})
    const seqs = [start('aaaaaaaa'), pts('aaaaaaaa'), end('aaaaaaaa')].map((m) => applyClientMessage(data, A, m).event!.seq)
    expect(seqs).toEqual([1, 2, 3])
  })

  it('commits a stroke on stroke_end with its points and its end sequence', () => {
    const data = newRoomData()
    const out = draw(data, A, 'aaaaaaaa')
    expect(data.strokes).toHaveLength(1)
    expect(data.strokes[0]).toMatchObject({ id: 'aaaaaaaa', authorId: A, seq: 3 })
    expect(data.strokes[0]!.points).toHaveLength(2)
    expect(Object.keys(out.storage!.put!).some((k) => k.startsWith('s:'))).toBe(true)
  })

  it('refuses points for a stroke that was never started, or that belongs to someone else', () => {
    const data = newRoomData()
    expect(applyClientMessage(data, A, pts('nope0000')).refused).toBe('bad_message')
    applyClientMessage(data, A, start('aaaaaaaa'))
    expect(applyClientMessage(data, B, pts('aaaaaaaa')).refused).toBe('bad_message')
    expect(applyClientMessage(data, B, end('aaaaaaaa')).refused).toBe('bad_message')
  })

  it('lets two people use the same stroke id without touching each other', () => {
    const data = newRoomData()
    draw(data, A, 'sameid-1')
    draw(data, B, 'sameid-1')
    expect(data.strokes.map((s) => s.authorId)).toEqual([A, B])
  })

  it('refuses a duplicate stroke_start while one is open', () => {
    const data = newRoomData()
    applyClientMessage(data, A, start('aaaaaaaa'))
    expect(applyClientMessage(data, A, start('aaaaaaaa')).refused).toBe('bad_message')
  })

  it('caps points per stroke and strokes per room', () => {
    const data = newRoomData()
    applyClientMessage(data, A, start('aaaaaaaa'))
    for (let i = 0; i < LIMITS.maxPointsPerStroke / 50; i++) applyClientMessage(data, A, pts('aaaaaaaa', 50))
    expect(applyClientMessage(data, A, pts('aaaaaaaa', 50)).refused).toBe('rate_limited')

    const full = newRoomData()
    full.strokes = Array.from({ length: LIMITS.maxStrokes }, (_, i) => ({
      id: `s${i}`.padEnd(8, '0'), authorId: A, tool: 'pen' as const, color: '#000000', size: 1, points: [], seq: i,
    }))
    expect(applyClientMessage(full, A, start('bbbbbbbb')).refused).toBe('rate_limited')
  })

  it('undo removes only the sender latest stroke and says which key to delete', () => {
    const data = newRoomData()
    draw(data, A, 'a-stroke1')
    draw(data, B, 'b-stroke1')
    draw(data, A, 'a-stroke2')
    const out: Outcome = applyClientMessage(data, A, { type: 'undo' })
    expect(data.strokes.map((s) => s.id)).toEqual(['a-stroke1', 'b-stroke1'])
    expect(out.event?.body.type).toBe('undo')
    expect(out.storage?.del).toHaveLength(1)
    expect(out.storage!.del![0]).toContain('a-stroke2')
  })

  it('undo with nothing to undo makes no event and does not use a sequence number', () => {
    const data = newRoomData()
    draw(data, B, 'b-stroke1')
    const before = data.seq
    expect(applyClientMessage(data, A, { type: 'undo' })).toEqual({})
    expect(data.seq).toBe(before)
  })

  it('clear wipes strokes and open strokes and asks storage to do the same', () => {
    const data = newRoomData()
    draw(data, A, 'a-stroke1')
    applyClientMessage(data, B, start('b-stroke1'))
    const out = applyClientMessage(data, B, { type: 'clear' })
    expect(data.strokes).toEqual([])
    expect(data.open.size).toBe(0)
    expect(out.storage?.clearStrokes).toBe(true)
  })

})

describe('lessons in a room', () => {
  const result = (over = {}) => ({ accuracy: 90, smoothness: 80, stars: 3 as const, passed: true, hint: 'great', guideCoverage: [1], ...over })
  const lessonRoom = () => {
    const data = newRoomData()
    data.lesson = newLesson('straight-lines')
    return data
  }

  it('refuses lesson messages in a room that was not made for that lesson', () => {
    expect(applyClientMessage(newRoomData(), A, { type: 'lesson_set', slug: 'straight-lines', step: 1 }).refused).toBe('bad_message')
    expect(applyClientMessage(lessonRoom(), A, { type: 'lesson_set', slug: 'first-shapes', step: 1 }).refused).toBe('bad_message')
    expect(applyClientMessage(newRoomData(), A, { type: 'step_result', step: 0, result: result() }).refused).toBe('bad_message')
  })

  it('moves to the next step on a clean canvas, with the old strokes gone from the log and storage', () => {
    const data = lessonRoom()
    draw(data, A, 'a-stroke-1')
    draw(data, B, 'b-stroke-1')
    const out = applyClientMessage(data, A, { type: 'lesson_set', slug: 'straight-lines', step: 1 })
    expect(data.lesson).toMatchObject({ step: 1, from: 0, result: null })
    expect(out.event?.body.type).toBe('lesson_set')
    expect(out.storage?.put?.lesson).toMatchObject({ step: 1, from: 0 })
    expect(data.strokes).toHaveLength(0)
    expect(out.storage?.del).toHaveLength(2)
  })

  it('keeps the drawing of the last step once the lesson is finished', () => {
    const data = lessonRoom()
    const total = findLesson('straight-lines')!.steps.length
    applyClientMessage(data, A, { type: 'lesson_set', slug: 'straight-lines', step: total - 1 })
    draw(data, A, 'a-last-1')
    const out = applyClientMessage(data, A, { type: 'lesson_set', slug: 'straight-lines', step: total })
    expect(data.lesson).toMatchObject({ step: total, from: 1 })
    expect(data.strokes.map((s) => s.id)).toEqual(['a-last-1'])
    expect(out.storage?.del).toBeUndefined()
  })

  it('stores a check for the current step only, with its summary', () => {
    const data = lessonRoom()
    expect(applyClientMessage(data, A, { type: 'step_result', step: 3, result: result() }).refused).toBe('bad_message')
    const out = applyClientMessage(data, B, { type: 'step_result', step: 0, result: result() })
    expect(out.event?.from).toBe(B)
    expect(data.lesson?.result).toMatchObject({ accuracy: 90, hint: 'great' })
    expect(data.lesson?.results[0]).toEqual({ accuracy: 90, smoothness: 80, stars: 3 })
  })

  it('a later check replaces an earlier one', () => {
    const data = lessonRoom()
    applyClientMessage(data, A, { type: 'step_result', step: 0, result: result({ accuracy: 40, stars: 0, passed: false }) })
    applyClientMessage(data, B, { type: 'step_result', step: 0, result: result() })
    expect(data.lesson?.results[0]?.accuracy).toBe(90)
  })

  it('starting the same step again removes its strokes from the log and storage', () => {
    const data = lessonRoom()
    applyClientMessage(data, A, { type: 'lesson_set', slug: 'straight-lines', step: 1 })
    draw(data, A, 'a-step1-1')
    draw(data, B, 'b-step1-1')
    applyClientMessage(data, A, { type: 'step_result', step: 1, result: result() })
    const out = applyClientMessage(data, B, { type: 'lesson_set', slug: 'straight-lines', step: 1, restart: true })
    expect(data.strokes).toEqual([])
    expect(out.storage?.del).toHaveLength(2)
    expect(data.lesson).toMatchObject({ step: 1, from: 0, result: null })
    expect(data.lesson?.results[1]).toBeNull()
  })

  it('treats a second request for the step the room is already on as nothing, not a restart', () => {
    const data = lessonRoom()
    applyClientMessage(data, A, { type: 'lesson_set', slug: 'straight-lines', step: 1 })
    draw(data, A, 'a-step1-1')
    const seq = data.seq
    expect(applyClientMessage(data, B, { type: 'lesson_set', slug: 'straight-lines', step: 1 })).toEqual({})
    expect(data.strokes).toHaveLength(1)
    expect(data.seq).toBe(seq)
  })

  it('keeps the results array dense when a step is checked after skipping earlier ones', () => {
    const data = lessonRoom()
    applyClientMessage(data, A, { type: 'lesson_set', slug: 'straight-lines', step: 2 })
    applyClientMessage(data, A, { type: 'step_result', step: 2, result: result() })
    expect(data.lesson?.results).toEqual([null, null, { accuracy: 90, smoothness: 80, stars: 3 }])
  })
})

describe('topic rooms', () => {
  const topicRoom = (topic = 3) => {
    const data = newRoomData()
    data.game = { kind: 'topic', topic }
    return data
  }
  const set = (topic: number, after: number): ClientMessage => ({ type: 'topic_set', topic, after })

  it('starts on a topic chosen from the list', () => {
    expect(newGame('topic', () => 0)).toEqual({ kind: 'topic', topic: 0 })
    expect(newGame('topic', () => 0.999999)).toEqual({ kind: 'topic', topic: topics.length - 1 })
    expect(newGame('free')).toBeNull()
  })

  it('changes the topic, clears the canvas and tells everyone', () => {
    const data = topicRoom(3)
    draw(data, A, 'a-stroke-1')
    draw(data, B, 'b-stroke-1')
    const out = applyClientMessage(data, B, set(7, 3))
    expect(data.game).toEqual({ kind: 'topic', topic: 7 })
    expect(data.strokes).toEqual([])
    expect(out.event?.body).toMatchObject({ type: 'topic_set', topic: 7 })
    expect(out.storage).toMatchObject({ clearStrokes: true, put: { game: { kind: 'topic', topic: 7 } } })
  })

  it('treats a second press for the topic everyone has already left as nothing', () => {
    const data = topicRoom(3)
    applyClientMessage(data, A, set(7, 3))
    draw(data, A, 'a-stroke-1')
    expect(applyClientMessage(data, B, set(12, 3))).toEqual({})
    expect(data.game).toEqual({ kind: 'topic', topic: 7 })
    expect(data.strokes).toHaveLength(1)
  })

  it('refuses a topic that is not on the list, and any topic message outside a topic room', () => {
    expect(applyClientMessage(topicRoom(3), A, set(topics.length, 3)).refused).toBe('bad_message')
    expect(applyClientMessage(newRoomData(), A, set(1, 0)).refused).toBe('bad_message')
    const turns = newRoomData()
    turns.game = { kind: 'turns', turn: 1 }
    expect(applyClientMessage(turns, A, set(1, 0)).refused).toBe('bad_message')
  })
})

describe('pass the pen', () => {
  const both = new Set<1 | 2>([1, 2])
  const ctx = (slot: 1 | 2, present: Set<1 | 2> = both): TurnContext => ({ slot, present: (s) => present.has(s) })
  const turnsRoom = () => {
    const data = newRoomData()
    data.game = newGame('turns')
    return data
  }
  /** One whole stroke as `slot`, through the rules. */
  const turnStroke = (data: ReturnType<typeof newRoomData>, who: string, slot: 1 | 2, id: string, present = both) => {
    const c = ctx(slot, present)
    const started = applyClientMessage(data, who, start(id), c)
    if (started.refused) return started
    applyClientMessage(data, who, pts(id), c)
    return applyClientMessage(data, who, end(id), c)
  }

  it('starts with seat 1', () => {
    expect(newGame('turns')).toEqual({ kind: 'turns', turn: 1 })
  })

  it('lets the person whose turn it is draw, and gives the pen to the other seat after one stroke', () => {
    const data = turnsRoom()
    const out = turnStroke(data, A, 1, 'a-stroke-1')
    expect(out.turn).toBe(2)
    expect(data.game).toEqual({ kind: 'turns', turn: 2 })
    expect(out.storage?.put?.game).toEqual({ kind: 'turns', turn: 2 })
    expect(data.strokes).toHaveLength(1)
  })

  it('refuses a stroke out of turn, and leaves nothing open', () => {
    const data = turnsRoom()
    expect(applyClientMessage(data, B, start('b-stroke-1'), ctx(2)).refused).toBe('not_your_turn')
    expect(data.open.size).toBe(0)
    expect(data.seq).toBe(0)
  })

  it('alternates stroke after stroke', () => {
    const data = turnsRoom()
    turnStroke(data, A, 1, 'a-stroke-1')
    turnStroke(data, B, 2, 'b-stroke-1')
    expect(data.game).toEqual({ kind: 'turns', turn: 1 })
    expect(turnStroke(data, B, 2, 'b-stroke-2').refused).toBe('not_your_turn')
    turnStroke(data, A, 1, 'a-stroke-2')
    expect(data.strokes.map((s) => s.id)).toEqual(['a-stroke-1', 'b-stroke-1', 'a-stroke-2'])
  })

  it('does not hold the other person back when the turn is in an empty seat', () => {
    const data = turnsRoom()
    const alone = new Set<1 | 2>([2])
    const out = turnStroke(data, B, 2, 'b-stroke-1', alone)
    expect(out.refused).toBeUndefined()
    expect(data.strokes).toHaveLength(1)
    expect(data.game).toEqual({ kind: 'turns', turn: 1 }) // the pen waits for the one who is away
  })

  it('passes the pen only for the person who has it', () => {
    const data = turnsRoom()
    expect(applyClientMessage(data, B, { type: 'pass' }, ctx(2)).refused).toBe('not_your_turn')
    const out = applyClientMessage(data, A, { type: 'pass' }, ctx(1))
    expect(out.turn).toBe(2)
    expect(out.event?.body.type).toBe('pass')
    expect(data.game).toEqual({ kind: 'turns', turn: 2 })
  })

  it('refuses pass outside a pass-the-pen room', () => {
    expect(applyClientMessage(newRoomData(), A, { type: 'pass' }, ctx(1)).refused).toBe('bad_message')
  })

  it('lets you take back your stroke while it is the latest, and gives you the pen again', () => {
    const data = turnsRoom()
    turnStroke(data, A, 1, 'a-stroke-1')
    const out = applyClientMessage(data, A, { type: 'undo' }, ctx(1))
    expect(data.strokes).toEqual([])
    expect(out.turn).toBe(1)
    expect(data.game).toEqual({ kind: 'turns', turn: 1 })
  })

  it('refuses to take back a stroke once the other person has drawn on top of it', () => {
    const data = turnsRoom()
    turnStroke(data, A, 1, 'a-stroke-1')
    turnStroke(data, B, 2, 'b-stroke-1')
    expect(applyClientMessage(data, A, { type: 'undo' }, ctx(1)).refused).toBe('not_your_turn')
    expect(data.strokes).toHaveLength(2)
  })

  it('a person who drops mid-stroke still passes the pen when their stroke is finished for them', () => {
    const data = turnsRoom()
    applyClientMessage(data, A, start('a-stroke-1'), ctx(1))
    const out = applyClientMessage(data, A, end('a-stroke-1'), ctx(1))
    expect(out.turn).toBe(2)
  })

  it('does nothing special without turn context, as in a free room', () => {
    const data = newRoomData()
    const out = draw(data, A, 'a-stroke-1')
    expect(out.turn).toBeUndefined()
    expect(data.game).toBeNull()
  })
})

describe('per-socket rate window', () => {
  const fresh = (): RateWindow => ({ start: 0, messages: 0, points: 0 })

  it('allows normal drawing: batches of 64 points at 33 per second', () => {
    const w = fresh()
    const ok = Array.from({ length: 33 }, () => allowMessage(w, 100, pts('aaaaaaaa', 60)))
    expect(ok.every(Boolean)).toBe(true)
  })

  it('stops a flood of messages and a flood of points within a second', () => {
    const w = fresh()
    const results = Array.from({ length: LIMITS.maxMessagesPerSecond + 5 }, () => allowMessage(w, 100, { type: 'undo' }))
    expect(results.slice(0, LIMITS.maxMessagesPerSecond).every(Boolean)).toBe(true)
    expect(results.slice(LIMITS.maxMessagesPerSecond).some(Boolean)).toBe(false)

    const p = fresh()
    let blocked = false
    for (let i = 0; i < 60; i++) if (!allowMessage(p, 100, pts('aaaaaaaa', 64))) blocked = true
    expect(blocked).toBe(true)
  })

  it('starts a fresh window after a second', () => {
    const w = fresh()
    for (let i = 0; i < LIMITS.maxMessagesPerSecond + 1; i++) allowMessage(w, 100, { type: 'undo' })
    expect(allowMessage(w, 1200, { type: 'undo' })).toBe(true)
  })
})

describe('two halves', () => {
  const both = new Set<1 | 2>([1, 2])
  const ctx = (slot: 1 | 2): TurnContext => ({ slot, present: (s) => both.has(s) })
  const halvesRoom = (subject = 2) => {
    const data = newRoomData()
    data.game = { kind: 'halves', subject }
    return data
  }
  const points = (id: string, xs: number[]): ClientMessage => ({ type: 'stroke_pts', id, pts: xs.map((x) => [x, 100, 0.5] as [number, number, number]) })
  const lineAs = (data: ReturnType<typeof newRoomData>, who: string, slot: 1 | 2, id: string, xs: number[]) => {
    applyClientMessage(data, who, start(id), ctx(slot))
    const out = applyClientMessage(data, who, points(id, xs), ctx(slot))
    applyClientMessage(data, who, end(id), ctx(slot))
    return out
  }

  it('starts on a picture chosen from the list', () => {
    expect(newGame('halves', () => 0)).toEqual({ kind: 'halves', subject: 0 })
    expect(newGame('halves', () => 0.999999)).toEqual({ kind: 'halves', subject: halfSubjects.length - 1 })
  })

  it('keeps the first seat on the left half and the second seat on the right half', () => {
    expect(clampToHalf(700, 1)).toBe(500)
    expect(clampToHalf(300, 1)).toBe(300)
    expect(clampToHalf(0, 1)).toBe(0)
    expect(clampToHalf(300, 2)).toBe(500)
    expect(clampToHalf(700, 2)).toBe(700)
    expect(clampToHalf(1000, 2)).toBe(1000)
  })

  it('stops a line at the middle, in the log and in what everyone is sent', () => {
    const data = halvesRoom()
    const out = lineAs(data, A, 1, 'a-stroke-1', [100, 400, 650, 900])
    expect(data.strokes[0]!.points.map((p) => p[0])).toEqual([100, 400, 500, 500])
    expect(out.event?.body).toMatchObject({ type: 'stroke_pts', pts: [[100, 100, 0.5], [400, 100, 0.5], [500, 100, 0.5], [500, 100, 0.5]] })
    const back = lineAs(data, B, 2, 'b-stroke-1', [900, 600, 300, 0])
    expect(data.strokes[1]!.points.map((p) => p[0])).toEqual([900, 600, 500, 500])
    expect((back.event?.body as { pts: number[][] }).pts.map((p) => p[0])).toEqual([900, 600, 500, 500])
  })

  it('does not touch the points of a line that stays on its own side', () => {
    const data = halvesRoom()
    const msg = points('a-stroke-1', [10, 200, 499])
    applyClientMessage(data, A, start('a-stroke-1'), ctx(1))
    const out = applyClientMessage(data, A, msg, ctx(1))
    expect(out.event?.body).toEqual(msg)
  })

  it('clamps nothing without seat context, and in other rooms', () => {
    const data = halvesRoom()
    lineAs(data, A, 1, 'a-stroke-1', [100]) // warm-up so the log is not empty
    applyClientMessage(data, A, start('a-stroke-2'))
    applyClientMessage(data, A, points('a-stroke-2', [900]))
    expect(data.open.get(`${A}:a-stroke-2`)!.points[0]![0]).toBe(900)
    const free = newRoomData()
    lineAs(free, A, 1, 'a-stroke-3', [900])
    expect(free.strokes[0]!.points[0]![0]).toBe(900)
  })

  it('changes the picture, clears the canvas, and ignores a second request for the old one', () => {
    const data = halvesRoom(2)
    lineAs(data, A, 1, 'a-stroke-1', [100, 200])
    const out = applyClientMessage(data, B, { type: 'subject_set', subject: 5, after: 2 })
    expect(data.game).toEqual({ kind: 'halves', subject: 5 })
    expect(data.strokes).toEqual([])
    expect(out.storage).toMatchObject({ clearStrokes: true, put: { game: { kind: 'halves', subject: 5 } } })
    lineAs(data, A, 1, 'a-stroke-2', [100, 200])
    expect(applyClientMessage(data, A, { type: 'subject_set', subject: 6, after: 2 })).toEqual({})
    expect(data.strokes).toHaveLength(1)
  })

  it('refuses a picture that is not on the list, and subject messages in other rooms', () => {
    expect(applyClientMessage(halvesRoom(), A, { type: 'subject_set', subject: halfSubjects.length, after: 2 }).refused).toBe('bad_message')
    expect(applyClientMessage(newRoomData(), A, { type: 'subject_set', subject: 1, after: 0 }).refused).toBe('bad_message')
    const topic = newRoomData()
    topic.game = { kind: 'topic', topic: 1 }
    expect(applyClientMessage(topic, A, { type: 'subject_set', subject: 1, after: 1 }).refused).toBe('bad_message')
    expect(applyClientMessage(halvesRoom(), A, { type: 'topic_set', topic: 1, after: 2 }).refused).toBe('bad_message')
  })

  it('lets both people draw at once: there is no turn in this game', () => {
    const data = halvesRoom()
    expect(applyClientMessage(data, A, start('a-stroke-1'), ctx(1)).refused).toBeUndefined()
    expect(applyClientMessage(data, B, start('b-stroke-1'), ctx(2)).refused).toBeUndefined()
    expect(data.open.size).toBe(2)
  })
})
