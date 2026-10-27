import type { GuidePoint } from './score'

// Starter lessons, written for this project. A guide is a list of polylines in the 1000 x 1000 canvas,
// one per stroke the learner should draw. Tolerance (in the same units) is how far a line may stray.

export type LessonStage = 'lines' | 'shapes' | 'details' | 'colour'

export interface LessonStep {
  stage: LessonStage
  prompt: string
  guide: GuidePoint[][]
  /** Full credit within this distance of the guide. Tuned by playtesting, so it lives in data. */
  tolerance: number
  /** Accuracy needed to pass. Falls back to DEFAULT_PASS_ACCURACY. */
  passAccuracy?: number
}

export interface Lesson {
  slug: string
  title: string
  summary: string
  /** 1 (easiest) to 5. */
  difficulty: number
  estMinutes: number
  steps: LessonStep[]
}

// ---- shape helpers (guide building only) ------------------------------------------

const line = (x1: number, y1: number, x2: number, y2: number): GuidePoint[] => [[x1, y1], [x2, y2]]

const polygon = (pts: GuidePoint[], closed = true): GuidePoint[] => (closed ? [...pts, pts[0]!] : pts)

const rect = (x: number, y: number, w: number, h: number): GuidePoint[] =>
  polygon([[x, y], [x + w, y], [x + w, y + h], [x, y + h]])

/** Points on an arc, angles in degrees (0 = right, 90 = down). */
const arc = (cx: number, cy: number, r: number, from: number, to: number, n = 48): GuidePoint[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = ((from + ((to - from) * i) / n) * Math.PI) / 180
    return [Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))] as GuidePoint
  })

const circle = (cx: number, cy: number, r: number): GuidePoint[] => arc(cx, cy, r, 0, 360)

// ---- lessons ------------------------------------------------------------------

export const lessons: Lesson[] = [
  {
    slug: 'straight-lines',
    title: 'Straight lines',
    summary: 'Warm up your hand: flat, upright and slanted lines, drawn in one calm movement.',
    difficulty: 1,
    estMinutes: 4,
    steps: [
      { stage: 'lines', prompt: 'Draw a straight line from left to right along the dashed guide.', guide: [line(150, 500, 850, 500)], tolerance: 32 },
      { stage: 'lines', prompt: 'Now a line from top to bottom.', guide: [line(500, 150, 500, 850)], tolerance: 32 },
      { stage: 'lines', prompt: 'Draw the slanted line from the bottom left to the top right.', guide: [line(200, 800, 800, 200)], tolerance: 32 },
      {
        stage: 'lines',
        prompt: 'Three stripes. Lift your pen between lines.',
        guide: [line(200, 300, 800, 300), line(200, 500, 800, 500), line(200, 700, 800, 700)],
        tolerance: 30,
      },
    ],
  },
  {
    slug: 'first-shapes',
    title: 'First shapes',
    summary: 'Circle, square and triangle, then put them together into a small house.',
    difficulty: 1,
    estMinutes: 6,
    steps: [
      { stage: 'shapes', prompt: 'Trace the circle in one go. Close it where you started.', guide: [circle(500, 500, 250)], tolerance: 36 },
      { stage: 'shapes', prompt: 'Draw the square. Turn at each corner without lifting.', guide: [rect(300, 300, 400, 400)], tolerance: 34 },
      {
        stage: 'shapes',
        prompt: 'Draw the triangle.',
        guide: [polygon([[500, 220], [780, 740], [220, 740]])],
        tolerance: 34,
      },
      {
        stage: 'details',
        prompt: 'Build the house: walls, roof and door, as three separate lines.',
        guide: [rect(250, 460, 500, 370), polygon([[200, 460], [500, 190], [800, 460]], false), rect(430, 620, 140, 210)],
        tolerance: 28,
      },
    ],
  },
  {
    slug: 'happy-sun',
    title: 'Happy sun',
    summary: 'A round sun with rays and a face. Small details need a steady, slow hand.',
    difficulty: 2,
    estMinutes: 6,
    steps: [
      { stage: 'shapes', prompt: 'Draw the sun: one round circle.', guide: [circle(500, 500, 160)], tolerance: 30 },
      {
        stage: 'lines',
        prompt: 'Add eight short rays around it. Start each ray near the circle.',
        guide: Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4
          return line(Math.round(500 + 215 * Math.cos(a)), Math.round(500 + 215 * Math.sin(a)), Math.round(500 + 320 * Math.cos(a)), Math.round(500 + 320 * Math.sin(a)))
        }),
        tolerance: 26,
        passAccuracy: 60,
      },
      {
        stage: 'details',
        prompt: 'Give it two small round eyes.',
        guide: [circle(440, 470, 24), circle(560, 470, 24)],
        tolerance: 20,
        passAccuracy: 60,
      },
      { stage: 'details', prompt: 'Finish with a smile: one curve from the left cheek to the right.', guide: [arc(500, 520, 95, 25, 155, 40)], tolerance: 24 },
    ],
  },
]
