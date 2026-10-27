import { describe, expect, it, vi } from 'vitest'
import type { Point, Stroke } from '@penduet/protocol'
import { Board } from './board'
import { closingSegment, segmentsFor, widthFor } from './render'

const meta = (id: string) => ({ id, tool: 'pen' as const, color: '#112233', size: 8 })
const pts = (n: number, pressure = 0.5): Point[] => Array.from({ length: n }, (_, i) => [i * 10, i * 5, pressure])

describe('segmentsFor', () => {
  it('makes a dot for the first point and a line to the first midpoint for the second', () => {
    const [dot, line] = segmentsFor([[0, 0, 0.5], [10, 0, 0.5]], 0)
    expect(dot).toMatchObject({ kind: 'dot', at: { x: 0, y: 0 } })
    expect(line).toMatchObject({ kind: 'line', from: { x: 0, y: 0 }, to: { x: 5, y: 0 } })
  })

  it('chains curves through midpoints, each joined to the one before', () => {
    const p: Point[] = [[0, 0, 0.5], [10, 0, 0.5], [10, 10, 0.5], [20, 10, 0.5]]
    const segs = segmentsFor(p, 0)
    expect(segs).toHaveLength(4)
    const [, line, c1, c2] = segs
    expect(line).toMatchObject({ to: { x: 5, y: 0 } })
    expect(c1).toMatchObject({ kind: 'curve', from: { x: 5, y: 0 }, control: { x: 10, y: 0 }, to: { x: 10, y: 5 } })
    expect(c2).toMatchObject({ kind: 'curve', from: { x: 10, y: 5 }, control: { x: 10, y: 10 }, to: { x: 15, y: 10 } })
  })

  it('gives the same picture live (in pieces) as in one redraw', () => {
    const p = pts(12)
    const live = [...segmentsFor(p.slice(0, 5), 0), ...segmentsFor(p.slice(0, 9), 5), ...segmentsFor(p, 9)]
    expect(live).toEqual(segmentsFor(p, 0))
  })

  it('closes a stroke with a line from the last midpoint to the last point, and not a dot', () => {
    expect(closingSegment([[0, 0, 0.5]])).toBeNull()
    expect(closingSegment([[0, 0, 0.5], [10, 0, 0.5], [20, 0, 1]])).toMatchObject({ from: { x: 15, y: 0 }, to: { x: 20, y: 0 }, p: 1 })
  })
})

describe('widthFor', () => {
  it('uses the nominal size for a mouse and follows pressure for a pen', () => {
    expect(widthFor({ tool: 'pen', size: 10 }, 0.5)).toBeCloseTo(10)
    expect(widthFor({ tool: 'pen', size: 10 }, 1)).toBeGreaterThan(widthFor({ tool: 'pen', size: 10 }, 0.2))
    expect(widthFor({ tool: 'pen', size: 10 }, 5)).toBe(widthFor({ tool: 'pen', size: 10 }, 1)) // clamped
  })
  it('makes the eraser twice the size whatever the pressure', () => {
    expect(widthFor({ tool: 'eraser', size: 10 }, 0.1)).toBe(20)
  })
})

describe('Board', () => {
  const draw = (b: Board, who: string, id: string) => {
    b.start(who, meta(id), [[1, 1, 0.5]])
    b.points(who, id, pts(3))
    return b.end(who, id)
  }

  it('commits a stroke on end with its points and author', () => {
    const b = new Board()
    expect(draw(b, 'a', 'stroke-aaaa')).toBe(true)
    expect(b.strokeCount).toBe(1)
    expect(b.hasStrokesBy('a')).toBe(true)
    expect(b.hasStrokesBy('b')).toBe(false)
  })

  it('ignores points and ends for strokes that are not open', () => {
    const b = new Board()
    expect(b.points('a', 'nope-0000', pts(2))).toBe(false)
    expect(b.end('a', 'nope-0000')).toBe(false)
    draw(b, 'a', 'stroke-aaaa')
    expect(b.points('a', 'stroke-aaaa', pts(1))).toBe(false) // already ended
    b.start('a', meta('stroke-bbbb'))
    expect(b.points('someone-else', 'stroke-bbbb', pts(1))).toBe(false)
  })

  it('keeps two people with the same stroke id apart', () => {
    const b = new Board()
    draw(b, 'a', 'same-id-00')
    draw(b, 'b', 'same-id-00')
    expect(b.strokeCount).toBe(2)
  })

  it('undo removes only the author latest stroke', () => {
    const b = new Board()
    draw(b, 'a', 'a-stroke-1')
    draw(b, 'b', 'b-stroke-1')
    draw(b, 'a', 'a-stroke-2')
    expect(b.undoLast('a')?.id).toBe('a-stroke-2')
    expect(b.undoLast('a')?.id).toBe('a-stroke-1')
    expect(b.undoLast('a')).toBeUndefined()
    expect(b.strokeCount).toBe(1)
    expect(b.hasStrokesBy('b')).toBe(true)
  })

  it('clear removes everything, including strokes still open', () => {
    const b = new Board()
    draw(b, 'a', 'a-stroke-1')
    b.start('b', meta('b-stroke-1'))
    b.clear()
    expect(b.strokeCount).toBe(0)
    expect(b.points('b', 'b-stroke-1', pts(1))).toBe(false)
  })

  it('load replaces the drawing and copies the points', () => {
    const b = new Board()
    draw(b, 'a', 'a-stroke-1')
    const snapshot: Stroke[] = [{ ...meta('x-stroke-01'), authorId: 'x', points: pts(2), seq: 7 }]
    b.load(snapshot)
    expect(b.strokeCount).toBe(1)
    expect(b.hasStrokesBy('a')).toBe(false)
    snapshot[0]!.points.push([9, 9, 0.5])
    expect(b.undoLast('x')?.points).toHaveLength(2)
  })

  it('load can include strokes that are still being drawn, and later points and the end complete them', () => {
    const b = new Board()
    const halfway: Stroke = { ...meta('p-stroke-001'), authorId: 'p', points: pts(2), seq: 0 }
    b.load([], [halfway])
    expect(b.strokeCount).toBe(0)
    expect(b.points('p', 'p-stroke-001', pts(3))).toBe(true)
    expect(b.end('p', 'p-stroke-001')).toBe(true)
    expect(b.strokeCount).toBe(1)
    expect(b.undoLast('p')?.points).toHaveLength(5) // what came with the snapshot plus what came after
  })

  it('tells subscribers when finished strokes change, not on every point', () => {
    const b = new Board()
    const fn = vi.fn()
    b.subscribe(fn)
    b.start('a', meta('a-stroke-1'), [[1, 1, 0.5]])
    b.points('a', 'a-stroke-1', pts(5))
    expect(fn).not.toHaveBeenCalled()
    b.end('a', 'a-stroke-1')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(b.revision).toBe(1)
  })
})
