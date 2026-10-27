import { CANVAS_SIZE, type Point, type Stroke } from '@penduet/protocol'

// How a stroke becomes pixels. Points arrive in the 1000 x 1000 logical space and are drawn through a
// transform, so every screen size shows the same picture. The path is a chain of quadratic curves
// through the midpoints of the points, which looks smooth even from sparse touch samples.

type Pt = { x: number; y: number; p: number }
export type Segment =
  | { kind: 'dot'; at: Pt }
  | { kind: 'line'; from: { x: number; y: number }; to: { x: number; y: number }; p: number }
  | { kind: 'curve'; from: { x: number; y: number }; control: { x: number; y: number }; to: { x: number; y: number }; p: number }

const pt = (q: Point): Pt => ({ x: q[0], y: q[1], p: q[2] })
const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/**
 * The segments that the points at index `from` and later add to a stroke. The same function serves
 * live drawing (`from` = first new point) and a full redraw (`from` = 0), so both give the same picture.
 * The last half-segment up to the final point is added by `closingSegment` when the stroke ends.
 */
export function segmentsFor(points: Point[], from: number): Segment[] {
  const out: Segment[] = []
  for (let k = Math.max(from, 0); k < points.length; k++) {
    const cur = pt(points[k]!)
    if (k === 0) {
      out.push({ kind: 'dot', at: cur })
    } else if (k === 1) {
      const p0 = pt(points[0]!)
      out.push({ kind: 'line', from: p0, to: mid(p0, cur), p: p0.p })
    } else {
      const a = pt(points[k - 2]!)
      const b = pt(points[k - 1]!)
      out.push({ kind: 'curve', from: mid(a, b), control: b, to: mid(b, cur), p: b.p })
    }
  }
  return out
}

/** From the last midpoint to the final point. Nothing for a single-point stroke (it is a dot). */
export function closingSegment(points: Point[]): Segment | null {
  if (points.length < 2) return null
  const a = pt(points[points.length - 2]!)
  const b = pt(points[points.length - 1]!)
  return { kind: 'line', from: mid(a, b), to: b, p: b.p }
}

/** Pen width follows pressure: a mouse reports 0.5, which gives the nominal size. Eraser is fixed and wider. */
export function widthFor(stroke: Pick<Stroke, 'tool' | 'size'>, pressure: number): number {
  if (stroke.tool === 'eraser') return stroke.size * 2
  return stroke.size * (0.4 + 1.2 * Math.min(1, Math.max(0, pressure)))
}

type Style = Pick<Stroke, 'tool' | 'color' | 'size'>

function paint(ctx: CanvasRenderingContext2D, style: Style, seg: Segment): void {
  ctx.globalCompositeOperation = style.tool === 'eraser' ? 'destination-out' : 'source-over'
  ctx.strokeStyle = style.color
  ctx.fillStyle = style.color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = widthFor(style, seg.kind === 'dot' ? seg.at.p : seg.p)
  ctx.beginPath()
  if (seg.kind === 'dot') {
    ctx.arc(seg.at.x, seg.at.y, ctx.lineWidth / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  ctx.moveTo(seg.from.x, seg.from.y)
  if (seg.kind === 'line') ctx.lineTo(seg.to.x, seg.to.y)
  else ctx.quadraticCurveTo(seg.control.x, seg.control.y, seg.to.x, seg.to.y)
  ctx.stroke()
}

/** Owns one canvas. Everything it draws is in logical units; `resize` sets the scale. */
export class CanvasEngine {
  private ctx: CanvasRenderingContext2D | null
  private cssSize = CANVAS_SIZE

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')
    this.applyTransform()
  }

  /** Square canvas of `cssSize` CSS pixels. The caller redraws afterwards (resizing clears it). */
  resize(cssSize: number, dpr: number): void {
    this.cssSize = cssSize
    this.canvas.width = Math.max(1, Math.round(cssSize * dpr))
    this.canvas.height = this.canvas.width
    this.applyTransform()
  }

  private applyTransform(): void {
    if (!this.ctx) return
    const scale = this.canvas.width / CANVAS_SIZE
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0)
  }

  /** CSS pixels (relative to the canvas box) to logical units, clamped to the canvas. */
  toLogical(x: number, y: number): [number, number] {
    const k = CANVAS_SIZE / this.cssSize
    return [Math.min(CANVAS_SIZE, Math.max(0, x * k)), Math.min(CANVAS_SIZE, Math.max(0, y * k))]
  }

  clear(): void {
    if (!this.ctx) return
    this.ctx.save()
    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.restore()
  }

  /** Draws what points `from..` add to the stroke. */
  extend(stroke: Stroke, from: number): void {
    if (!this.ctx) return
    for (const seg of segmentsFor(stroke.points, from)) paint(this.ctx, stroke, seg)
  }

  finish(stroke: Stroke): void {
    if (!this.ctx) return
    const seg = closingSegment(stroke.points)
    if (seg) paint(this.ctx, stroke, seg)
  }

  /** Clears and repaints in order: finished strokes, then the ones still being drawn. */
  redraw(done: readonly Stroke[], open: Iterable<Stroke>): void {
    this.clear()
    for (const s of done) {
      this.extend(s, 0)
      this.finish(s)
    }
    for (const s of open) this.extend(s, 0)
  }

  /** The drawing on a solid background, as a PNG. The canvas itself is transparent. */
  toBlob(background: string): Promise<Blob | null> {
    const out = document.createElement('canvas')
    out.width = this.canvas.width
    out.height = this.canvas.height
    const c = out.getContext('2d')
    if (!c) return Promise.resolve(null)
    c.fillStyle = background
    c.fillRect(0, 0, out.width, out.height)
    c.drawImage(this.canvas, 0, 0)
    return new Promise((resolve) => out.toBlob(resolve, 'image/png'))
  }
}
