import type { GuidePoint } from './score'

// Small drawing helpers for building guides: lines, shapes and curves in the 1000 x 1000 canvas.

export const line = (x1: number, y1: number, x2: number, y2: number): GuidePoint[] => [[x1, y1], [x2, y2]]

export const polygon = (pts: GuidePoint[], closed = true): GuidePoint[] => (closed ? [...pts, pts[0]!] : pts)

export const rect = (x: number, y: number, w: number, h: number): GuidePoint[] =>
  polygon([[x, y], [x + w, y], [x + w, y + h], [x, y + h]])

/** Points on an arc, angles in degrees (0 = right, 90 = down). */
export const arc = (cx: number, cy: number, r: number, from: number, to: number, n = 48): GuidePoint[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = ((from + ((to - from) * i) / n) * Math.PI) / 180
    return [Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))] as GuidePoint
  })

export const circle = (cx: number, cy: number, r: number): GuidePoint[] => arc(cx, cy, r, 0, 360)

export const ellipse = (cx: number, cy: number, rx: number, ry: number, n = 56): GuidePoint[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = (2 * Math.PI * i) / n
    return [Math.round(cx + rx * Math.cos(a)), Math.round(cy + ry * Math.sin(a))] as GuidePoint
  })

/** A smooth curve from `a` to `b`, bent towards `control`. */
export const curve = (a: GuidePoint, control: GuidePoint, b: GuidePoint, n = 24): GuidePoint[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const u = 1 - t
    return [Math.round(u * u * a[0] + 2 * u * t * control[0] + t * t * b[0]), Math.round(u * u * a[1] + 2 * u * t * control[1] + t * t * b[1])] as GuidePoint
  })

/** A leaf or petal: two curves that leave `a` and meet again at `b`, bulging to either side. */
export const leaf = (a: GuidePoint, b: GuidePoint, bulgeA: GuidePoint, bulgeB: GuidePoint): GuidePoint[] => [...curve(a, bulgeA, b), ...curve(b, bulgeB, a).slice(1)]

/** A sideways wave from x1 to x2 with `periods` full swings. */
export const wave = (x1: number, x2: number, y: number, amplitude: number, periods: number, n = 72): GuidePoint[] =>
  Array.from({ length: n + 1 }, (_, i) => [Math.round(x1 + ((x2 - x1) * i) / n), Math.round(y + amplitude * Math.sin((2 * Math.PI * periods * i) / n))] as GuidePoint)

/** A spiral winding out from the centre. */
export const spiral = (cx: number, cy: number, r1: number, r2: number, turns: number, n = 120): GuidePoint[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const a = 2 * Math.PI * turns * t - Math.PI / 2
    const r = r1 + (r2 - r1) * t
    return [Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))] as GuidePoint
  })

/** A row of loops, like cursive "e"s: `cycles` loops of width `pitch`, `size` high. */
export const loops = (x0: number, y: number, pitch: number, size: number, cycles: number, n = 40): GuidePoint[] =>
  Array.from({ length: cycles * n + 1 }, (_, i) => {
    const u = i / n
    return [Math.round(x0 + pitch * u - size * Math.sin(2 * Math.PI * u)), Math.round(y - size * Math.cos(2 * Math.PI * u))] as GuidePoint
  })


/**
 * A smooth line through the given points (Catmull-Rom), so an organic outline needs a handful of points, not a hundred.
 * `closed` joins the last point back to the first without a corner.
 */
export const spline = (pts: GuidePoint[], closed = false, per = 10): GuidePoint[] => {
  const n = pts.length
  const at = (i: number) => (closed ? pts[((i % n) + n) % n]! : pts[Math.min(n - 1, Math.max(0, i))]!)
  const out: GuidePoint[] = []
  const segments = closed ? n : n - 1
  for (let i = 0; i < segments; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    for (let k = 0; k < per; k++) {
      const t = k / per
      const t2 = t * t
      const t3 = t2 * t
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push([Math.round(f(p0[0], p1[0], p2[0], p3[0])), Math.round(f(p0[1], p1[1], p2[1], p3[1]))])
    }
  }
  out.push(closed ? out[0]! : pts[n - 1]!)
  return out
}

/** The same lines moved by (dx, dy). */
export const shift = (lines: GuidePoint[][], dx: number, dy: number): GuidePoint[][] => lines.map((l) => l.map(([x, y]) => [x + dx, y + dy] as GuidePoint))

/** The left half of an ellipse, from its top, round the left side, to its bottom. Joins the centre line at both ends. */
export const halfEllipseLeft = (cx: number, cy: number, rx: number, ry: number, n = 32): GuidePoint[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = ((270 - (180 * i) / n) * Math.PI) / 180
    return [Math.round(cx + rx * Math.cos(a)), Math.round(cy + ry * Math.sin(a))] as GuidePoint
  })

/** The same picture flipped left to right across the middle of the canvas. */
export const mirror = (lines: GuidePoint[][]): GuidePoint[][] => lines.map((l) => l.map(([x, y]) => [1000 - x, y] as GuidePoint))
