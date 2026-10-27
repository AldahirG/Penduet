import { describe, expect, it } from 'vitest'
import { findLesson, lessons, resample, scoreStep, strokeSmoothness, closeness, type GuidePoint } from './index'

// Deterministic noise, so a threshold test never flakes.
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

/** Points along a polyline every `step` units, with optional hand jitter and offset. */
function trace(line: GuidePoint[], opts: { step?: number; jitter?: number; dx?: number; dy?: number; seed?: number } = {}) {
  const { step = 5, jitter = 0, dx = 0, dy = 0, seed = 1 } = opts
  const rand = rng(seed)
  return resample([line], step)[0]!.map((p) => [p.x + dx + (rand() - 0.5) * 2 * jitter, p.y + dy + (rand() - 0.5) * 2 * jitter, 0.5])
}

/** A sideways wave of the given amplitude (wavelength 40 units): the shake of a nervous hand. */
const wobble = (pts: number[][], amplitude: number) =>
  pts.map((p, i) => [p[0]!, p[1]! + amplitude * Math.sin((i * 5 * 2 * Math.PI) / 40), 0.5])

describe('lesson content', () => {
  it('has three starter lessons with unique, valid slugs', () => {
    expect(lessons).toHaveLength(3)
    expect(new Set(lessons.map((l) => l.slug)).size).toBe(3)
    for (const l of lessons) expect(l.slug).toMatch(/^[a-z0-9-]{1,64}$/)
    expect(findLesson('straight-lines')?.title).toBe('Straight lines')
    expect(findLesson('nope')).toBeUndefined()
  })

  it.each(lessons.map((l) => [l.slug, l] as const))('%s: every step is well formed and inside the canvas', (_slug, lesson) => {
    expect(lesson.steps.length).toBeGreaterThan(0)
    expect(lesson.difficulty).toBeGreaterThanOrEqual(1)
    expect(lesson.difficulty).toBeLessThanOrEqual(5)
    for (const step of lesson.steps) {
      expect(step.prompt.length).toBeGreaterThan(5)
      expect(step.tolerance).toBeGreaterThan(0)
      expect(step.guide.length).toBeGreaterThan(0)
      for (const polyline of step.guide) {
        expect(polyline.length).toBeGreaterThanOrEqual(2)
        for (const [x, y] of polyline) {
          expect(x).toBeGreaterThanOrEqual(0)
          expect(x).toBeLessThanOrEqual(1000)
          expect(y).toBeGreaterThanOrEqual(0)
          expect(y).toBeLessThanOrEqual(1000)
        }
      }
    }
  })
})

describe('scoring the lesson steps', () => {
  const steps = lessons.flatMap((l) => l.steps.map((s, i) => [`${l.slug} step ${i + 1}`, s] as const))

  it.each(steps)('%s: a clean trace gets full marks', (_name, step) => {
    const strokes = step.guide.map((g) => ({ points: trace(g) }))
    const score = scoreStep({ ...step, strokes })
    expect(score.accuracy).toBeGreaterThanOrEqual(95)
    expect(score.passed).toBe(true)
    expect(score.stars).toBe(3)
    expect(score.hint).toBe('great')
  })

  it.each(steps)('%s: a shaky but honest hand still passes', (_name, step) => {
    const strokes = step.guide.map((g, i) => ({ points: trace(g, { jitter: step.tolerance / 5, seed: i + 7 }) }))
    const score = scoreStep({ ...step, strokes })
    expect(score.passed).toBe(true)
    expect(score.accuracy).toBeGreaterThanOrEqual(80)
  })

  it.each(steps)('%s: nothing drawn, or drawn in the wrong place, does not pass', (_name, step) => {
    expect(scoreStep({ ...step, strokes: [] })).toMatchObject({ accuracy: 0, stars: 0, passed: false, hint: 'empty' })
    const wrong = scoreStep({ ...step, strokes: [{ points: trace([[20, 960], [980, 975]]) }] })
    expect(wrong.passed).toBe(false)
  })
})

describe('what moves the score', () => {
  const guide: GuidePoint[][] = [[[100, 500], [900, 500]]]
  const base = { guide, tolerance: 30 }

  it('stays full while within the tolerance and falls to zero when far away', () => {
    expect(scoreStep({ ...base, strokes: [{ points: trace(guide[0]!, { dy: 25 }) }] }).accuracy).toBeGreaterThanOrEqual(98)
    const mid = scoreStep({ ...base, strokes: [{ points: trace(guide[0]!, { dy: 50 }) }] }).accuracy
    expect(mid).toBeGreaterThan(20)
    expect(mid).toBeLessThan(80)
    expect(scoreStep({ ...base, strokes: [{ points: trace(guide[0]!, { dy: 80 }) }] }).accuracy).toBe(0)
  })

  it('does not care about direction or how many strokes make the line', () => {
    const forward = trace(guide[0]!)
    const reversed = [...forward].reverse()
    const split = [{ points: forward.slice(0, 60) }, { points: forward.slice(60) }]
    const a = scoreStep({ ...base, strokes: [{ points: forward }] }).accuracy
    expect(scoreStep({ ...base, strokes: [{ points: reversed }] }).accuracy).toBe(a)
    expect(scoreStep({ ...base, strokes: split }).accuracy).toBe(a)
  })

  it('reports an incomplete trace and marks the missed line', () => {
    const two: GuidePoint[][] = [[[100, 300], [900, 300]], [[100, 700], [900, 700]]]
    const score = scoreStep({ guide: two, tolerance: 30, strokes: [{ points: trace(two[0]!) }] })
    expect(score.coverage).toBeCloseTo(0.5, 1)
    expect(score.hint).toBe('incomplete')
    expect(score.passed).toBe(false)
    expect(score.guideCoverage[0]).toBeGreaterThan(0.95)
    expect(score.guideCoverage[1]).toBeLessThan(0.05)
  })

  it('penalises extra scribbles that are off the guide', () => {
    const clean = scoreStep({ ...base, strokes: [{ points: trace(guide[0]!) }] })
    const messy = scoreStep({ ...base, strokes: [{ points: trace(guide[0]!) }, { points: trace([[100, 800], [900, 850]]) }] })
    expect(messy.precision).toBeLessThan(clean.precision)
    expect(messy.accuracy).toBeLessThan(clean.accuracy)
    expect(messy.coverage).toBeCloseTo(clean.coverage, 2)
  })

  it('treats a single dot or a one-point stroke without crashing', () => {
    const s = scoreStep({ ...base, strokes: [{ points: [[500, 500, 0.5]] }] })
    expect(s.passed).toBe(false)
    expect(Number.isFinite(s.accuracy)).toBe(true)
  })

  it('stars need accuracy and steadiness together', () => {
    const precise = trace(guide[0]!)
    const wobbly = wobble(precise, 12)
    const steady = scoreStep({ ...base, strokes: [{ points: precise }] })
    const shaky = scoreStep({ ...base, strokes: [{ points: wobbly }] })
    expect(steady.stars).toBe(3)
    expect(shaky.accuracy).toBeGreaterThanOrEqual(90)
    expect(shaky.smoothness).toBeLessThan(steady.smoothness)
    expect(shaky.stars).toBeLessThan(3)
    expect(shaky.hint).toBe('shaky')
  })

  it('uses the lesson pass mark when given', () => {
    const off = trace(guide[0]!, { dy: 45 })
    const strict = scoreStep({ ...base, strokes: [{ points: off }], passAccuracy: 90 })
    const lenient = scoreStep({ ...base, strokes: [{ points: off }], passAccuracy: 30 })
    expect(strict.accuracy).toBe(lenient.accuracy)
    expect(strict.passed).toBe(false)
    expect(lenient.passed).toBe(true)
  })
})

describe('smoothness', () => {
  it('is 100 for straight lines and circles, low for zigzags, and null when too short', () => {
    expect(strokeSmoothness(trace([[100, 500], [900, 500]]))).toBe(100)
    const ring = lessons[1]!.steps[0]!.guide[0]!
    expect(strokeSmoothness(trace(ring))).toBeGreaterThanOrEqual(85)
    expect(strokeSmoothness(wobble(trace([[100, 500], [900, 500]]), 12))).toBeLessThan(45)
    expect(strokeSmoothness(wobble(trace([[100, 500], [900, 500]]), 2))).toBeGreaterThan(75) // a steady hand
    expect(strokeSmoothness([[1, 1], [5, 5]])).toBeNull()
  })

  it('does not punish the sharp corners of a square', () => {
    const square = lessons[1]!.steps[1]!.guide[0]!
    expect(strokeSmoothness(trace(square))).toBeGreaterThanOrEqual(85)
  })
})

describe('helpers', () => {
  it('resamples a polyline at even spacing, keeping both ends', () => {
    const pts = resample([[[0, 0], [100, 0]]], 10)[0]!
    expect(pts).toHaveLength(11)
    expect(pts[0]).toEqual({ x: 0, y: 0 })
    expect(pts[10]).toEqual({ x: 100, y: 0 })
  })

  it('closeness is 1 inside the tolerance, 0 far away, and linear between', () => {
    expect(closeness(10, 20)).toBe(1)
    expect(closeness(100, 20)).toBe(0)
    expect(closeness(20 * 1.75, 20)).toBeCloseTo(0.5, 5)
  })
})
