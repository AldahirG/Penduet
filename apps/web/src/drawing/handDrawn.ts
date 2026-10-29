import type { GuidePoint } from '@penduet/lessons'

// Turns the clean, machine-made lines of a lesson into something that looks drawn by a hand: the line wanders a little, the
// pressure changes along it, it starts and ends thin, and a corner is a corner a pen went round, not a vertex.
// Pure and seeded, so a picture looks the same on every render and in every test.

export type Pt = readonly [number, number]

const mulberry = (seed: number) => () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export const hashSeed = (s: string): number => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Points along the polyline every `step` units, keeping every corner. */
const resample = (line: readonly Pt[], step: number): Pt[] => {
  const out: Pt[] = [line[0]!]
  for (let i = 1; i < line.length; i++) {
    const [x0, y0] = line[i - 1]!
    const [x1, y1] = line[i]!
    const d = Math.hypot(x1 - x0, y1 - y0)
    const n = Math.max(1, Math.round(d / step))
    for (let k = 1; k <= n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n])
  }
  return out
}

/** A few sines at different pitches: a line that wanders, not one that jitters. */
const wander = (rand: () => number, wobble: number) => {
  const waves = [
    { f: 1 / 190, a: wobble, p: rand() * 6.28 },
    { f: 1 / 83, a: wobble * 0.55, p: rand() * 6.28 },
    { f: 1 / 37, a: wobble * 0.22, p: rand() * 6.28 },
  ]
  return (s: number) => waves.reduce((sum, w) => sum + w.a * Math.sin(s * w.f * 6.283 + w.p), 0)
}

export interface HandOptions {
  /** Makes two strokes of the same line differ. */
  seed: string | number
  /** How far the line may wander from where it should be, in the canvas's 1000-unit space. */
  wobble?: number
  /** The thickest the line gets. */
  width?: number
  /** Stroke shape: 1 keeps full width to the end, lower values taper harder. */
  taper?: number
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/**
 * The outline of one pen stroke, as the `d` of a filled SVG path. Wider in the middle, thin at both ends, with a slow swell
 * as if the hand pressed harder in places.
 */
export function handStroke(line: readonly Pt[], { seed, wobble = 4, width = 16, taper = 0.7 }: HandOptions): string {
  if (line.length < 2) return ''
  const rand = mulberry(typeof seed === 'number' ? seed : hashSeed(seed))
  const dense = resample(line, 11)
  const sway = wander(rand, wobble)
  const swell = wander(rand, 1)

  // Arc length of every point, then the point moved sideways by the wander.
  const along: number[] = [0]
  for (let i = 1; i < dense.length; i++) along.push(along[i - 1]! + Math.hypot(dense[i]![0] - dense[i - 1]![0], dense[i]![1] - dense[i - 1]![1]))
  const total = along[along.length - 1]! || 1

  const centre = dense.map(([x, y], i) => {
    const a = dense[Math.max(0, i - 1)]!
    const b = dense[Math.min(dense.length - 1, i + 1)]!
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len = Math.hypot(dx, dy) || 1
    const off = sway(along[i]!)
    return { x: x - (dy / len) * off, y: y + (dx / len) * off, nx: -dy / len, ny: dx / len }
  })

  const left: Pt[] = []
  const right: Pt[] = []
  centre.forEach((c, i) => {
    const t = along[i]! / total
    // 0 at both ends, 1 through the middle: sqrt keeps the body full and only the last bit thin.
    const ends = Math.sqrt(Math.sin(Math.PI * clamp(t, 0, 1)))
    const press = 1 + 0.16 * swell(along[i]!)
    const w = (width / 2) * (1 - taper + taper * ends) * press * (0.35 + 0.65 * Math.min(1, ends * 3 + 0.25))
    left.push([c.x + c.nx * w, c.y + c.ny * w])
    right.push([c.x - c.nx * w, c.y - c.ny * w])
  })

  return smoothClosed([...left, ...right.reverse()])
}

/** A closed shape through the midpoints of its edges, so the outline has no corners at the sample points. */
const smoothClosed = (pts: Pt[]): string => {
  const n = pts.length
  const f = (v: number) => Math.round(v * 10) / 10
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const start = mid(pts[n - 1]!, pts[0]!)
  let d = `M${f(start[0])} ${f(start[1])}`
  for (let i = 0; i < n; i++) {
    const p = pts[i]!
    const m = mid(p, pts[(i + 1) % n]!)
    d += `Q${f(p[0])} ${f(p[1])} ${f(m[0])} ${f(m[1])}`
  }
  return `${d}Z`
}

/**
 * A line, as a centre line the pen followed (stroke it, dashed or not). For the dashed guide in a room, where the shape
 * has to stay a line so it can have gaps.
 */
export function handLine(line: readonly Pt[], { seed, wobble = 3 }: Pick<HandOptions, 'seed' | 'wobble'>): string {
  if (line.length < 2) return ''
  const rand = mulberry(typeof seed === 'number' ? seed : hashSeed(seed))
  const dense = resample(line, 14)
  const sway = wander(rand, wobble)
  let s = 0
  const total = dense.reduce((sum, p, i) => (i === 0 ? 0 : sum + Math.hypot(p[0] - dense[i - 1]![0], p[1] - dense[i - 1]![1])), 0)
  const moved = dense.map(([x, y], i) => {
    if (i > 0) s += Math.hypot(x - dense[i - 1]![0], y - dense[i - 1]![1])
    const a = dense[Math.max(0, i - 1)]!
    const b = dense[Math.min(dense.length - 1, i + 1)]!
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len = Math.hypot(dx, dy) || 1
    // The ends stay where they are, so a guide still starts and stops where the lesson says.
    const ease = Math.min(1, s / 30, (total - s) / 30)
    return [x - (dy / len) * sway(s) * ease, y + (dx / len) * sway(s) * ease] as Pt
  })
  const f = (v: number) => Math.round(v * 10) / 10
  let d = `M${f(moved[0]![0])} ${f(moved[0]![1])}`
  for (let i = 1; i < moved.length - 1; i++) {
    const m: Pt = [(moved[i]![0] + moved[i + 1]![0]) / 2, (moved[i]![1] + moved[i + 1]![1]) / 2]
    d += `Q${f(moved[i]![0])} ${f(moved[i]![1])} ${f(m[0])} ${f(m[1])}`
  }
  const last = moved[moved.length - 1]!
  return `${d}L${f(last[0])} ${f(last[1])}`
}

export type { GuidePoint }
