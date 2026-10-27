import type { Point, Stroke } from '@penduet/protocol'
import type { CanvasEngine } from './render'

export interface StrokeMeta {
  id: string
  tool: Stroke['tool']
  color: string
  size: number
}

const keyOf = (author: string, id: string) => `${author}:${id}`

/**
 * The drawing as data, plus the canvas it is painted on. The same class serves a solo canvas and a
 * shared one: local actions and the partner's events both go through these methods. A stroke has one
 * author, so nothing here needs merging, only ordering.
 */
export class Board {
  private done: Stroke[] = []
  private open = new Map<string, Stroke>()
  private engine: CanvasEngine | null = null
  private listeners = new Set<() => void>()
  private version = 0

  /** Attach (or detach with null) the canvas. Paints what is already here. */
  attach(engine: CanvasEngine | null): void {
    this.engine = engine
    this.repaint()
  }

  repaint(): void {
    this.engine?.redraw(this.done, this.open.values())
  }

  /** Replace everything, for example with the snapshot a room sends on connect (finished strokes, then ones still being drawn). */
  load(strokes: Stroke[], open: Stroke[] = []): void {
    this.done = strokes.map((s) => ({ ...s, points: [...s.points] }))
    this.open.clear()
    // Strokes someone is in the middle of: their later points and their end will arrive as events.
    for (const s of open) this.open.set(keyOf(s.authorId, s.id), { ...s, points: [...s.points] })
    this.repaint()
    this.changed()
  }

  start(author: string, meta: StrokeMeta, first?: Point[]): void {
    const key = keyOf(author, meta.id)
    if (this.open.has(key)) return
    const stroke: Stroke = { ...meta, authorId: author, points: [], seq: 0 }
    this.open.set(key, stroke)
    if (first?.length) this.points(author, meta.id, first)
  }

  /** Returns false for a stroke that is not open (never started, or already ended): ignored. */
  points(author: string, id: string, pts: Point[]): boolean {
    const stroke = this.open.get(keyOf(author, id))
    if (!stroke) return false
    const from = stroke.points.length
    stroke.points.push(...pts)
    this.engine?.extend(stroke, from)
    return true
  }

  end(author: string, id: string): boolean {
    const key = keyOf(author, id)
    const stroke = this.open.get(key)
    if (!stroke) return false
    this.open.delete(key)
    this.engine?.finish(stroke)
    this.done.push(stroke)
    this.changed()
    return true
  }

  /** Removes the author's latest finished stroke and repaints. Returns it, or undefined if there was none. */
  undoLast(author: string): Stroke | undefined {
    for (let i = this.done.length - 1; i >= 0; i--) {
      if (this.done[i]!.authorId === author) {
        const [removed] = this.done.splice(i, 1)
        this.repaint()
        this.changed()
        return removed
      }
    }
    return undefined
  }

  /** Finished strokes after the first `count`. A lesson step scores the strokes added since it began. */
  strokesSince(count: number): Stroke[] {
    return this.done.slice(count)
  }

  /** Drops finished strokes after the first `count` and repaints. Used to retry a lesson step. */
  truncate(count: number): void {
    if (count >= this.done.length) return
    this.done.length = Math.max(0, count)
    this.repaint()
    this.changed()
  }

  clear(): void {
    this.done = []
    this.open.clear()
    this.repaint()
    this.changed()
  }

  /** A copy of the finished strokes, for saving. */
  snapshot(): Stroke[] {
    return this.done.map((s) => ({ ...s, points: [...s.points] }))
  }

  hasStrokesBy(author: string): boolean {
    return this.done.some((s) => s.authorId === author)
  }

  get strokeCount(): number {
    return this.done.length
  }

  /** Increases whenever finished strokes change. Handy as a React dependency. */
  get revision(): number {
    return this.version
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private changed(): void {
    this.version += 1
    for (const fn of this.listeners) fn()
  }
}
