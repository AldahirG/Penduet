import { describe, expect, it } from 'vitest'
import type { ClientMessage } from '@penduet/protocol'
import { LIMITS, allowMessage, applyClientMessage, newLesson, newRoomData, type Outcome, type RateWindow } from './roomLog'

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

  it('moves to the next step and remembers where its strokes begin', () => {
    const data = lessonRoom()
    draw(data, A, 'a-stroke-1')
    draw(data, B, 'b-stroke-1')
    const out = applyClientMessage(data, A, { type: 'lesson_set', slug: 'straight-lines', step: 1 })
    expect(data.lesson).toMatchObject({ step: 1, from: 2, result: null })
    expect(out.event?.body.type).toBe('lesson_set')
    expect(out.storage?.put?.lesson).toMatchObject({ step: 1, from: 2 })
    expect(data.strokes).toHaveLength(2) // moving on keeps the drawing
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

  it('starting the same step again removes its strokes, and only those, from the log and storage', () => {
    const data = lessonRoom()
    draw(data, A, 'a-before-1')
    applyClientMessage(data, A, { type: 'lesson_set', slug: 'straight-lines', step: 1 })
    draw(data, A, 'a-step1-1')
    draw(data, B, 'b-step1-1')
    applyClientMessage(data, A, { type: 'step_result', step: 1, result: result() })
    const out = applyClientMessage(data, B, { type: 'lesson_set', slug: 'straight-lines', step: 1, restart: true })
    expect(data.strokes.map((s) => s.id)).toEqual(['a-before-1'])
    expect(out.storage?.del).toHaveLength(2)
    expect(data.lesson).toMatchObject({ step: 1, from: 1, result: null })
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
