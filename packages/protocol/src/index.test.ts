import { describe, expect, it } from 'vitest'
import {
  CANVAS_SIZE,
  MAX_POINTS_PER_MESSAGE,
  clientMessageSchema,
  createRoomRequestSchema,
  lessonStateSchema,
  joinRoomRequestSchema,
  normalizeRoomCode,
  roomCodeSchema,
  serverMessageSchema,
} from './index'

describe('normalizeRoomCode', () => {
  it('uppercases and strips separators', () => {
    expect(normalizeRoomCode('k7q-2m9')).toBe('K7Q2M9')
    expect(normalizeRoomCode(' k7q 2m9 ')).toBe('K7Q2M9')
  })
  it('drops characters that are never in a code', () => {
    expect(normalizeRoomCode('0O1I')).toBe('')
    expect(normalizeRoomCode('A0B1C')).toBe('ABC')
  })
  it('caps at 6 characters', () => {
    expect(normalizeRoomCode('ABCDEFGHJK')).toBe('ABCDEF')
  })
  it('output of a full code is always valid', () => {
    expect(roomCodeSchema.safeParse(normalizeRoomCode('k7q2m9zzz')).success).toBe(true)
  })
})

describe('clientMessageSchema', () => {
  const start = { type: 'stroke_start', id: 'stroke-0001', tool: 'pen', color: '#4f46e5', size: 8 }

  it('accepts a valid stroke start', () => {
    expect(clientMessageSchema.safeParse(start).success).toBe(true)
  })
  it('rejects a bad colour and an unknown type', () => {
    expect(clientMessageSchema.safeParse({ ...start, color: 'red' }).success).toBe(false)
    expect(clientMessageSchema.safeParse({ type: 'nope' }).success).toBe(false)
  })
  it('rejects points outside the logical canvas', () => {
    const bad = { type: 'stroke_pts', id: 'stroke-0001', pts: [[CANVAS_SIZE + 1, 0, 0.5]] }
    expect(clientMessageSchema.safeParse(bad).success).toBe(false)
  })
  it('caps points per message', () => {
    const pts = Array.from({ length: MAX_POINTS_PER_MESSAGE + 1 }, () => [10, 10, 0.5])
    expect(clientMessageSchema.safeParse({ type: 'stroke_pts', id: 'stroke-0001', pts }).success).toBe(false)
  })
})

describe('serverMessageSchema', () => {
  it('accepts a relayed event with a sequence number', () => {
    const msg = { type: 'event', seq: 3, from: 'u1', body: { type: 'undo' } }
    expect(serverMessageSchema.safeParse(msg).success).toBe(true)
  })
  it('accepts a welcome with no peer yet', () => {
    const msg = {
      type: 'welcome',
      you: { id: 'u1', name: 'Mia', slot: 1 },
      peer: null,
      strokes: [],
      lesson: null,
      lastSeq: 0,
    }
    expect(serverMessageSchema.safeParse(msg).success).toBe(true)
  })
})

describe('room HTTP requests', () => {
  it('normalises a typed code on join', () => {
    expect(joinRoomRequestSchema.parse({ code: 'q3v-qvn' }).code).toBe('Q3VQVN')
  })
  it('rejects a code that is too short once cleaned', () => {
    expect(joinRoomRequestSchema.safeParse({ code: '0O1I' }).success).toBe(false)
    expect(joinRoomRequestSchema.safeParse({ code: 'x'.repeat(100) }).success).toBe(false)
  })
  it('validates the lesson slug and ignores nothing else', () => {
    expect(createRoomRequestSchema.safeParse({ lessonSlug: 'straight-lines' }).success).toBe(true)
    expect(createRoomRequestSchema.safeParse({ lessonSlug: 'Bad Slug' }).success).toBe(false)
    expect(createRoomRequestSchema.safeParse({}).success).toBe(true)
  })
  it('knows the room_ended message', () => {
    expect(serverMessageSchema.safeParse({ type: 'room_ended' }).success).toBe(true)
  })
})

describe('lessons in a room', () => {
  const result = { accuracy: 90, smoothness: 80, stars: 3, passed: true, hint: 'great', guideCoverage: [1, 0.5] }

  it('accepts a step result with its summary and coverage', () => {
    expect(clientMessageSchema.safeParse({ type: 'step_result', step: 1, result }).success).toBe(true)
  })

  it('rejects scores outside 0-100, stars outside 0-3, and coverage outside 0-1', () => {
    for (const bad of [{ accuracy: 101 }, { stars: 4 }, { guideCoverage: [1.5] }, { smoothness: -1 }, { hint: '' }]) {
      expect(clientMessageSchema.safeParse({ type: 'step_result', step: 0, result: { ...result, ...bad } }).success).toBe(false)
    }
  })

  it('describes the lesson state a room keeps, with skipped steps as null', () => {
    const state = { slug: 'straight-lines', step: 2, from: 5, result: null, results: [null, { accuracy: 90, smoothness: 80, stars: 3 }] }
    expect(lessonStateSchema.safeParse(state).success).toBe(true)
    expect(lessonStateSchema.safeParse({ ...state, from: -1 }).success).toBe(false)
  })
})
