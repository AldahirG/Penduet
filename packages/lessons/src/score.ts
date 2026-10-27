// Scoring for a guided step. Written from scratch for this project: it measures how much of the guide
// the learner covered, how much of what they drew was on the guide, and how steady the lines were.
// All numbers are on this project's own 0-100 scale. Thresholds that need tuning by playtesting live
// in the lesson data (`tolerance`, `passAccuracy`) or in the constants below, never in the UI.

/** [x, y] in the 1000 x 1000 logical canvas. */
export type GuidePoint = [number, number]

/** A drawn line. Pressure (third value) is ignored here. */
export interface DrawnStroke {
  points: ReadonlyArray<readonly number[]>
}

export const DEFAULT_PASS_ACCURACY = 65

/** Stars: 3 needs both a precise and a steady drawing; 2 a precise one; 1 is just passing. */
export const STAR_RULES = { three: { accuracy: 88, smoothness: 70 }, two: { accuracy: 78 } } as const

export type HintKey = 'empty' | 'incomplete' | 'wandering' | 'shaky' | 'close' | 'good' | 'great'

export interface StepScore {
  /** 0-100: coverage times precision, so missing part of the guide or straying both lower it. */
  accuracy: number
  /** 0-100: how steady the lines are. Does not decide pass or fail. */
  smoothness: number
  /** 0-1: share of the guide that was traced. */
  coverage: number
  /** 0-1: share of the drawing that stayed on the guide. */
  precision: number
  passed: boolean
  stars: 0 | 1 | 2 | 3
  hint: HintKey
  /** Per guide line, 0-1: how much of that line was traced. Lets the overlay mark hit and missed lines. */
  guideCoverage: number[]
}

const SAMPLE_SPACING = 8
/** Distance beyond which a point earns nothing, as a multiple of the tolerance. */
const FALLOFF_END = 2.5

type Pt = { x: number; y: number }
const toPt = (p: readonly number[]): Pt => ({ x: p[0] ?? 0, y: p[1] ?? 0 })

/** Points along the polylines at equal spacing, ends included. */
export function resample(lines: ReadonlyArray<ReadonlyArray<readonly number[]>>, spacing = SAMPLE_SPACING): Pt[][] {
  return lines.map((line) => {
    const pts = line.map(toPt)
    if (pts.length < 2) return pts
    const out: Pt[] = [pts[0]!]
    let carry = 0
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!
      const b = pts[i]!
      const len = Math.hypot(b.x - a.x, b.y - a.y)
      if (len === 0) continue
      let at = spacing - carry
      while (at <= len) {
        out.push({ x: a.x + ((b.x - a.x) * at) / len, y: a.y + ((b.y - a.y) * at) / len })
        at += spacing
      }
      carry = len - (at - spacing)
    }
    const last = pts[pts.length - 1]!
    const end = out[out.length - 1]!
    if (Math.hypot(last.x - end.x, last.y - end.y) > spacing / 4) out.push(last)
    return out
  })
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Shortest distance from p to any of the polylines. Infinity when there are none. */
function distToLines(p: Pt, lines: Pt[][]): number {
  let best = Infinity
  for (const line of lines) {
    if (line.length === 1) best = Math.min(best, Math.hypot(p.x - line[0]!.x, p.y - line[0]!.y))
    for (let i = 1; i < line.length; i++) best = Math.min(best, distToSegment(p, line[i - 1]!, line[i]!))
  }
  return best
}

/** Full credit within the tolerance, fading to nothing at 2.5 times it. */
export function closeness(distance: number, tolerance: number): number {
  if (distance <= tolerance) return 1
  if (distance >= tolerance * FALLOFF_END) return 0
  return 1 - (distance - tolerance) / (tolerance * (FALLOFF_END - 1))
}

const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length)

/** How far a point may stray from its smoothed self and still count as hand wobble (not a corner). */
const WOBBLE_CEILING = 20
/** Average wobble at which smoothness reaches zero, in logical units (about 5 px on a phone). */
const WOBBLE_ZERO = 10

/**
 * Steadiness of one line: how far its points sit from a lightly smoothed copy of the line. A straight
 * line and a round curve stay close to their smoothed selves; a shaky or jagged line does not. Points
 * that deviate a lot are corners, not shakiness, so they are left out.
 */
export function strokeSmoothness(points: ReadonlyArray<readonly number[]>): number | null {
  const [line] = resample([points], 6)
  if (!line || line.length < 8) return null // too short to judge
  // A longer line is smoothed over a longer stretch. Short curves (an eye, a corner of a shape) use a
  // shorter one, or the curve itself would count as wobble.
  const HALF = Math.max(2, Math.min(5, Math.round(line.length / 8)))
  const deviations: number[] = []
  for (let i = 0; i < line.length; i++) {
    const w = Math.min(HALF, i, line.length - 1 - i) // the window shrinks at the ends
    if (w === 0) continue
    let sx = 0
    let sy = 0
    for (let k = i - w; k <= i + w; k++) {
      sx += line[k]!.x
      sy += line[k]!.y
    }
    const n = 2 * w + 1
    const d = Math.hypot(line[i]!.x - sx / n, line[i]!.y - sy / n)
    if (d <= WOBBLE_CEILING) deviations.push(d)
  }
  return Math.round(100 * Math.max(0, 1 - mean(deviations) / WOBBLE_ZERO))
}

export function scoreStep(input: {
  guide: GuidePoint[][]
  tolerance: number
  strokes: ReadonlyArray<DrawnStroke>
  passAccuracy?: number
}): StepScore {
  const { guide, tolerance, strokes, passAccuracy = DEFAULT_PASS_ACCURACY } = input
  const drawn = strokes.filter((s) => s.points.length > 0).map((s) => s.points)
  const guideSamples = resample(guide)
  const drawnPolys = drawn.map((pts) => pts.map(toPt))

  if (drawn.length === 0) {
    return {
      accuracy: 0, smoothness: 0, coverage: 0, precision: 0, passed: false, stars: 0, hint: 'empty',
      guideCoverage: guide.map(() => 0),
    }
  }

  const guideCoverage = guideSamples.map((line) => mean(line.map((g) => closeness(distToLines(g, drawnPolys), tolerance))))
  const allGuide = guideSamples.flat()
  const coverage = mean(allGuide.map((g) => closeness(distToLines(g, drawnPolys), tolerance)))

  const drawnSamples = resample(drawn).flat()
  const precision = mean(drawnSamples.map((p) => closeness(distToLines(p, guideSamples), tolerance)))

  // A product, not an average: tracing half of the guide perfectly is not a pass.
  const accuracy = Math.round(100 * coverage * precision)

  // Length-weighted, so a long steady line outweighs a short twitch.
  let weighted = 0
  let total = 0
  for (const pts of drawn) {
    const s = strokeSmoothness(pts)
    if (s === null) continue
    const len = Math.max(1, (resample([pts])[0]?.length ?? 1) - 1)
    weighted += s * len
    total += len
  }
  const smoothness = total === 0 ? 100 : Math.round(weighted / total)

  const passed = accuracy >= passAccuracy
  const stars: 0 | 1 | 2 | 3 = !passed
    ? 0
    : accuracy >= STAR_RULES.three.accuracy && smoothness >= STAR_RULES.three.smoothness
      ? 3
      : accuracy >= STAR_RULES.two.accuracy
        ? 2
        : 1

  const hint: HintKey =
    coverage < 0.6 ? 'incomplete' : precision < 0.6 ? 'wandering' : smoothness < 50 ? 'shaky' : stars === 3 ? 'great' : passed ? 'good' : 'close'

  return { accuracy, smoothness, coverage, precision, passed, stars, hint, guideCoverage }
}
