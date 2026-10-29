import { describe, expect, it } from 'vitest'
import { lessons } from '@penduet/lessons'
import { handLine, handStroke } from './handDrawn'

const numbers = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)

describe('hand-drawn lines', () => {
  const line = [
    [100, 500],
    [900, 500],
  ] as const

  it('draws the same stroke for the same seed, and a different one for another', () => {
    expect(handStroke(line, { seed: 'a' })).toBe(handStroke(line, { seed: 'a' }))
    expect(handStroke(line, { seed: 'a' })).not.toBe(handStroke(line, { seed: 'b' }))
  })

  it('makes a closed outline with no broken numbers, for every line of every lesson', () => {
    for (const lesson of lessons) {
      for (const step of lesson.steps) {
        for (const l of step.guide) {
          const d = handStroke(l, { seed: lesson.slug })
          expect(d.startsWith('M'), lesson.slug).toBe(true)
          expect(d.endsWith('Z'), lesson.slug).toBe(true)
          expect(d).not.toMatch(/NaN|Infinity/)
        }
      }
    }
  })

  it('stays near the line it follows, well inside what a lesson allows', () => {
    const ys = numbers(handStroke(line, { seed: 'wander', wobble: 4, width: 16 })).filter((_, i) => i % 2 === 1)
    expect(Math.max(...ys)).toBeLessThan(500 + 4 * 1.8 + 10)
    expect(Math.min(...ys)).toBeGreaterThan(500 - 4 * 1.8 - 10)
  })

  it('keeps the two ends of a guide where the lesson puts them', () => {
    const d = handLine(line, { seed: 'g', wobble: 3 })
    expect(d.startsWith('M100 500')).toBe(true)
    expect(d.endsWith('L900 500')).toBe(true)
  })

  it('has nothing to draw for a single point', () => {
    expect(handStroke([[1, 1]], { seed: 'x' })).toBe('')
    expect(handLine([[1, 1]], { seed: 'x' })).toBe('')
  })
})
