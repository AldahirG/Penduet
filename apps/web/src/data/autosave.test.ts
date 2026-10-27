import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Stroke } from '@penduet/protocol'
import { loadDrawing, saveDrawing } from './autosave'

const stroke = (id: string): Stroke => ({ id, authorId: 'me', tool: 'pen', color: '#112233', size: 8, points: [[1, 2, 0.5], [3, 4, 0.5]], seq: 0 })

beforeEach(() => window.localStorage.clear())
afterEach(() => window.localStorage.clear())

describe('free draw autosave', () => {
  it('keeps and restores strokes', () => {
    saveDrawing([stroke('stroke-aaaa'), stroke('stroke-bbbb')])
    expect(loadDrawing().map((s) => s.id)).toEqual(['stroke-aaaa', 'stroke-bbbb'])
  })

  it('forgets the picture when it is empty', () => {
    saveDrawing([stroke('stroke-aaaa')])
    saveDrawing([])
    expect(window.localStorage.getItem('penduet.free-draw.v1')).toBeNull()
    expect(loadDrawing()).toEqual([])
  })

  it('ignores damaged or foreign data instead of failing', () => {
    window.localStorage.setItem('penduet.free-draw.v1', '{not json')
    expect(loadDrawing()).toEqual([])
    window.localStorage.setItem('penduet.free-draw.v1', JSON.stringify([{ id: 'x', points: 'no' }]))
    expect(loadDrawing()).toEqual([])
  })

  it('does not save a picture that is far too big', () => {
    const big: Stroke = { ...stroke('stroke-big0'), points: Array.from({ length: 250_000 }, (_, i) => [i % 1000, i % 997, 0.5] as [number, number, number]) }
    saveDrawing([big])
    expect(window.localStorage.getItem('penduet.free-draw.v1')).toBeNull()
  })
})
