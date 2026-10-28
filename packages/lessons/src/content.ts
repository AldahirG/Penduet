import type { GuidePoint } from './score'
import { arc, circle, curve, ellipse, leaf, line, loops, polygon, rect, spiral, wave } from './shapes'

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
  /** What the lesson is about, shown on its card: Warm-up, Shapes, Nature, Animals, Objects, Faces, Scenes. */
  theme: string
  summary: string
  /** 1 (easiest) to 5. */
  difficulty: number
  estMinutes: number
  steps: LessonStep[]
}

// ---- lessons ------------------------------------------------------------------

export const lessons: Lesson[] = [
  {
    slug: 'straight-lines',
    title: 'Straight lines',
    theme: 'Warm-up',
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
    theme: 'Shapes',
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
    theme: 'Nature',
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
  {
    slug: 'happy-cat',
    title: 'Happy cat',
    theme: 'Animals',
    summary: 'A round cat face with pointy ears, big eyes, a little nose and whiskers.',
    difficulty: 2,
    estMinutes: 7,
    steps: [
      { stage: 'shapes', prompt: "Draw the cat's head: one big round circle.", guide: [circle(500, 540, 230)], tolerance: 36 },
      {
        stage: 'shapes',
        prompt: 'Add two pointy ears on top. Draw each one as a single line going up and back down.',
        guide: [[[302, 420], [300, 180], [438, 322]], [[562, 322], [700, 180], [698, 420]]],
        tolerance: 28,
      },
      {
        stage: 'details',
        prompt: 'Two round eyes, and a small triangle for the nose.',
        guide: [circle(420, 520, 26), circle(580, 520, 26), polygon([[470, 590], [530, 590], [500, 628]])],
        tolerance: 20,
        passAccuracy: 60,
      },
      {
        stage: 'details',
        prompt: 'The mouth is two little smiles side by side, like a sideways "w".',
        guide: [arc(473, 640, 28, 0, 180, 24), arc(527, 640, 28, 0, 180, 24)],
        tolerance: 20,
        passAccuracy: 60,
      },
      {
        stage: 'details',
        prompt: 'Finish with whiskers: three on each side, fanning outwards.',
        guide: [
          line(360, 600, 210, 560),
          line(360, 630, 200, 630),
          line(360, 660, 210, 700),
          line(640, 600, 790, 560),
          line(640, 630, 800, 630),
          line(640, 660, 790, 700),
        ],
        tolerance: 24,
      },
    ],
  },
  {
    slug: 'little-fish',
    title: 'Little fish',
    theme: 'Animals',
    summary: 'A fish with a tail, an eye, a fin, scales and a few bubbles.',
    difficulty: 2,
    estMinutes: 7,
    steps: [
      { stage: 'shapes', prompt: 'Draw the body: a wide oval, closed where you started.', guide: [ellipse(450, 500, 260, 150)], tolerance: 36 },
      {
        stage: 'shapes',
        prompt: 'Add the tail on the right: a triangle that starts at the body.',
        guide: [polygon([[705, 500], [870, 360], [870, 640]])],
        tolerance: 30,
      },
      {
        stage: 'details',
        prompt: 'A round eye near the front, and a pointed fin on top.',
        guide: [circle(330, 460, 22), [[400, 360], [450, 250], [520, 352]]],
        tolerance: 22,
        passAccuracy: 60,
      },
      {
        stage: 'details',
        prompt: 'Three curved scales, like brackets, one after another.',
        guide: [arc(430, 500, 70, 135, 225, 20), arc(500, 500, 70, 135, 225, 20), arc(570, 500, 70, 135, 225, 20)],
        tolerance: 22,
      },
      {
        stage: 'details',
        prompt: 'Three bubbles drifting up from its mouth. Make each one a small circle.',
        guide: [circle(170, 380, 30), circle(130, 270, 24), circle(190, 170, 20)],
        tolerance: 20,
        passAccuracy: 60,
      },
    ],
  },
  {
    slug: 'simple-flower',
    title: 'Simple flower',
    theme: 'Nature',
    summary: 'A five-petal flower on a curved stem, with two leaves.',
    difficulty: 2,
    estMinutes: 6,
    steps: [
      { stage: 'shapes', prompt: 'Start in the middle of the flower with a small circle.', guide: [circle(500, 380, 58)], tolerance: 26 },
      {
        stage: 'shapes',
        prompt: 'Draw five round petals around the middle. Each one is its own loop.',
        guide: Array.from({ length: 5 }, (_, i) => {
          const a = ((-90 + i * 72) * Math.PI) / 180
          return circle(Math.round(500 + 135 * Math.cos(a)), Math.round(380 + 135 * Math.sin(a)), 66)
        }),
        tolerance: 28,
        passAccuracy: 60,
      },
      { stage: 'lines', prompt: 'Draw the stem: one calm curve from the flower down.', guide: [curve([500, 560], [545, 720], [480, 880])], tolerance: 30 },
      {
        stage: 'details',
        prompt: 'Two leaves, one on each side of the stem. Draw each as a pointed oval.',
        guide: [leaf([512, 770], [690, 690], [610, 650], [640, 780]), leaf([492, 810], [310, 730], [390, 690], [370, 820])],
        tolerance: 26,
      },
    ],
  },
  {
    slug: 'big-tree',
    title: 'Big tree',
    theme: 'Nature',
    summary: 'A round tree with a trunk, branches, the ground and two birds.',
    difficulty: 2,
    estMinutes: 6,
    steps: [
      { stage: 'shapes', prompt: 'Draw the leafy top: a big round circle.', guide: [circle(500, 360, 200)], tolerance: 36 },
      { stage: 'shapes', prompt: 'Add the trunk below: a tall rectangle.', guide: [rect(440, 560, 120, 300)], tolerance: 28 },
      {
        stage: 'lines',
        prompt: 'Two branches from the top of the trunk into the leaves, and a line for the ground.',
        guide: [line(500, 560, 420, 440), line(500, 560, 580, 440), line(160, 860, 840, 860)],
        tolerance: 26,
      },
      {
        stage: 'details',
        prompt: 'Two birds in the sky: each one is a wide, flat "v".',
        guide: [[[720, 190], [775, 235], [830, 185]], [[790, 300], [835, 340], [885, 295]]],
        tolerance: 24,
        passAccuracy: 60,
      },
    ],
  },
  {
    slug: 'sailboat',
    title: 'Sailboat',
    theme: 'Objects',
    summary: 'A boat with two sails and a flag, rocking on the waves.',
    difficulty: 3,
    estMinutes: 8,
    steps: [
      { stage: 'shapes', prompt: 'Draw the hull: it is wide at the top and narrower at the bottom.', guide: [polygon([[200, 600], [800, 600], [680, 780], [320, 780]])], tolerance: 28 },
      { stage: 'lines', prompt: 'A tall mast from the middle of the boat, with a small flag at the top.', guide: [line(500, 600, 500, 200), polygon([[500, 200], [500, 140], [590, 170]])], tolerance: 26 },
      {
        stage: 'shapes',
        prompt: 'Two sails: a big triangle on the right and a smaller one on the left.',
        guide: [polygon([[515, 230], [515, 570], [750, 570]]), polygon([[485, 320], [485, 570], [300, 570]])],
        tolerance: 26,
      },
      {
        stage: 'details',
        prompt: 'Finish with two wavy lines of water under the boat.',
        guide: [wave(140, 860, 830, 14, 4), wave(140, 860, 875, 14, 4)],
        tolerance: 24,
      },
    ],
  },
  {
    slug: 'friendly-face',
    title: 'Friendly face',
    theme: 'Faces',
    summary: 'A whole face: head, eyes, eyebrows, nose, smile and ears.',
    difficulty: 3,
    estMinutes: 8,
    steps: [
      { stage: 'shapes', prompt: 'Draw the head: a tall oval, a little longer than it is wide.', guide: [ellipse(500, 500, 250, 310)], tolerance: 38 },
      {
        stage: 'details',
        prompt: 'Two almond eyes, with an eyebrow arching over each one.',
        guide: [
          ellipse(400, 450, 48, 26),
          ellipse(600, 450, 48, 26),
          curve([335, 385], [400, 345], [465, 380]),
          curve([535, 380], [600, 345], [665, 385]),
        ],
        tolerance: 20,
        passAccuracy: 60,
      },
      {
        stage: 'details',
        prompt: 'The nose is one line down and a small hook, and then a wide smile below it.',
        guide: [[[500, 480], [470, 580], [525, 585]], arc(500, 600, 130, 30, 150)],
        tolerance: 22,
      },
      {
        stage: 'details',
        prompt: 'Finally the ears: a half circle on each side of the head.',
        guide: [arc(250, 500, 55, 90, 270, 24), arc(750, 500, 55, -90, 90, 24)],
        tolerance: 22,
      },
    ],
  },
  {
    slug: 'wavy-patterns',
    title: 'Wavy patterns',
    theme: 'Warm-up',
    summary: 'Waves, scallops, loops and a spiral. Curves are the next step after straight lines.',
    difficulty: 2,
    estMinutes: 6,
    steps: [
      {
        stage: 'lines',
        prompt: 'Three long waves, one under the other. Keep your hand moving evenly.',
        guide: [wave(150, 850, 300, 45, 3), wave(150, 850, 500, 45, 3), wave(150, 850, 700, 45, 3)],
        tolerance: 30,
      },
      {
        stage: 'lines',
        prompt: 'Two rows of scallops: small bumps joined together, like a row of hills.',
        guide: [
          ...[230, 350, 470, 590, 710].map((x) => arc(x, 420, 60, 180, 360, 20)),
          ...[230, 350, 470, 590, 710].map((x) => arc(x, 680, 60, 180, 360, 20)),
        ],
        tolerance: 24,
        passAccuracy: 60,
      },
      { stage: 'lines', prompt: 'A line of loops, like cursive "e"s. Keep them round and the same size.', guide: [loops(150, 500, 140, 60, 5)], tolerance: 28, passAccuracy: 60 },
      { stage: 'shapes', prompt: 'A spiral: start in the middle and wind outwards.', guide: [spiral(500, 500, 30, 330, 3)], tolerance: 34, passAccuracy: 60 },
    ],
  },
  {
    slug: 'night-sky',
    title: 'Night sky',
    theme: 'Scenes',
    summary: 'A crescent moon, a ringed planet, shooting stars and the hills below.',
    difficulty: 3,
    estMinutes: 7,
    steps: [
      {
        stage: 'shapes',
        prompt: 'Draw a crescent moon: a long curve around, then a shorter curve back to the start.',
        guide: [[...arc(300, 320, 130, 50, 310, 40), ...curve([384, 220], [345, 320], [384, 420]).slice(1)]],
        tolerance: 30,
      },
      {
        stage: 'shapes',
        prompt: 'A planet: a big round circle, then a long flat oval for its ring.',
        guide: [circle(690, 300, 100), ellipse(690, 300, 170, 38)],
        tolerance: 30,
        passAccuracy: 60,
      },
      {
        stage: 'lines',
        prompt: 'Three shooting stars: long slanted lines, drawn from top right to bottom left.',
        guide: [line(900, 560, 640, 760), line(780, 540, 520, 740), line(620, 520, 380, 700)],
        tolerance: 28,
      },
      { stage: 'lines', prompt: 'Draw the hills along the bottom: one long, rolling line.', guide: [wave(100, 900, 790, 40, 2)], tolerance: 30 },
    ],
  },
]
