import type { Lesson } from './content'
import type { GuidePoint } from './score'
import { arc, circle, curve, ellipse, leaf, line, mirror, polygon, rect, spiral, spline, wave } from './shapes'

// More pictures, on three rungs: beginner (a few big shapes), intermediate (more parts, curves that need a steady hand) and
// expert (a detailed picture with many small lines). Written for this project, in the same 1000 x 1000 canvas as content.ts.

type P = GuidePoint

const rad = (deg: number) => (deg * Math.PI) / 180
const polar = (cx: number, cy: number, r: number, deg: number): P => [Math.round(cx + r * Math.cos(rad(deg))), Math.round(cy + r * Math.sin(rad(deg)))]
const radial = (cx: number, cy: number, r1: number, r2: number, deg: number): P[] => [polar(cx, cy, r1, deg), polar(cx, cy, r2, deg)]

/** A pointed petal pointing out from the centre: starts at radius r1, ends at r2, `w` wide on each side at its fullest. */
const petal = (cx: number, cy: number, r1: number, r2: number, deg: number, w: number): P[] => {
  const mid = polar(cx, cy, (r1 + r2) / 2, deg)
  const dx = Math.cos(rad(deg + 90)) * w * 2
  const dy = Math.sin(rad(deg + 90)) * w * 2
  return leaf(polar(cx, cy, r1, deg), polar(cx, cy, r2, deg), [Math.round(mid[0] + dx), Math.round(mid[1] + dy)], [Math.round(mid[0] - dx), Math.round(mid[1] - dy)])
}

/** A closed edge of `n` round bumps around a centre, like a cloud or a lion's mane. */
const scallop = (cx: number, cy: number, r: number, amp: number, n: number, per = 10): P[] =>
  Array.from({ length: n * per + 1 }, (_, i) => {
    const t = (2 * Math.PI * i) / (n * per)
    const rr = r + amp * Math.abs(Math.sin((n * t) / 2))
    return [Math.round(cx + rr * Math.cos(t)), Math.round(cy + rr * Math.sin(t))] as P
  })

/** Merlons along the top of a wall: `n` raised blocks `h` high, from x1 to x2 at height y. */
const battlement = (x1: number, x2: number, y: number, n: number, h: number): P[][] => {
  const w = (x2 - x1) / (2 * n - 1)
  return Array.from({ length: n }, (_, i) => {
    const x = Math.round(x1 + 2 * i * w)
    const xe = Math.round(x + w)
    return [[x, y], [x, y - h], [xe, y - h], [xe, y]] as P[]
  })
}

/** A sail on a ship: a straight top (its yard), sides that draw in, and a bottom that sags with the wind. */
const sail = (tl: P, tr: P, bl: P, br: P, belly = 26): P[] => {
  const side = (a: P, b: P, push: number): P => [Math.round((a[0] + b[0]) / 2 + push), Math.round((a[1] + b[1]) / 2)]
  return [
    ...curve(tl, side(tl, bl, 24), bl),
    ...curve(bl, [Math.round((bl[0] + br[0]) / 2), Math.round((bl[1] + br[1]) / 2 + belly * 2)], br).slice(1),
    ...curve(br, side(br, tr, -24), tr).slice(1),
    tl,
  ]
}

/** A cloud: a flat bottom and a soft, bumpy top, as a closed curve. */
const cloud = (cx: number, cy: number): P[] =>
  spline(
    [[cx - 100, cy + 30], [cx - 125, cy], [cx - 92, cy - 34], [cx - 46, cy - 40], [cx - 18, cy - 80], [cx + 36, cy - 88], [cx + 76, cy - 44], [cx + 122, cy - 30], [cx + 138, cy + 4], [cx + 112, cy + 30]],
    true,
  )

const star = (cx: number, cy: number, outer: number, inner: number): P[] =>
  polygon(Array.from({ length: 10 }, (_, i) => polar(cx, cy, i % 2 === 0 ? outer : inner, -90 + i * 36)))

const cross = (x: number, y: number, s: number): P[][] => [line(x - s, y, x + s, y), line(x, y - s, x, y + s)]

// ---- beginner -------------------------------------------------------------------

const appleBody = spline([[500, 345], [600, 305], [720, 335], [790, 455], [770, 625], [690, 765], [590, 805], [500, 780], [410, 805], [310, 765], [230, 625], [210, 455], [280, 335], [400, 305]], true)

const beginner: Lesson[] = [
  {
    slug: 'red-apple',
    title: 'Red apple',
    theme: 'Nature',
    summary: 'A round apple with a stem, a leaf and a little shine. The curves are soft and there are only a few of them.',
    level: 'beginner',
    difficulty: 1,
    estMinutes: 5,
    steps: [
      { stage: 'shapes', prompt: 'Draw the apple: a wide, round shape with a small dip at the top.', guide: [appleBody], tolerance: 38 },
      { stage: 'lines', prompt: 'Add the stem: a short curve going up from the dip.', guide: [curve([500, 345], [485, 265], [530, 195])], tolerance: 28 },
      { stage: 'shapes', prompt: 'A leaf beside the stem: a pointed oval.', guide: [leaf([525, 255], [705, 185], [590, 160], [665, 275])], tolerance: 28 },
      { stage: 'details', prompt: 'Finish with a shine on the left side: a short curve and a tiny circle.', guide: [curve([305, 480], [310, 410], [365, 380]), circle(300, 545, 12)], tolerance: 22, passAccuracy: 60 },
    ],
  },
  {
    slug: 'ice-cream',
    title: 'Ice cream',
    theme: 'Objects',
    summary: 'A cone, a big scoop and a cherry on top. Triangles and circles, just like the first shapes.',
    level: 'beginner',
    difficulty: 1,
    estMinutes: 5,
    steps: [
      { stage: 'shapes', prompt: 'Draw the cone: a triangle pointing down.', guide: [polygon([[340, 520], [660, 520], [500, 900]])], tolerance: 30 },
      { stage: 'shapes', prompt: 'The scoop sits on top: one big round circle.', guide: [circle(500, 380, 165)], tolerance: 34 },
      {
        stage: 'lines',
        prompt: 'Criss-cross lines on the cone, like a waffle.',
        guide: [line(355, 545, 505, 775), line(440, 520, 545, 675), line(645, 545, 495, 775), line(560, 520, 455, 675)],
        tolerance: 24,
        passAccuracy: 60,
      },
      { stage: 'details', prompt: 'A cherry on top, with a curly stem.', guide: [circle(500, 172, 30), curve([505, 145], [535, 85], [590, 75])], tolerance: 20, passAccuracy: 60 },
    ],
  },
  {
    slug: 'party-balloon',
    title: 'Party balloon',
    theme: 'Objects',
    summary: 'An egg-shaped balloon with a knot, a wiggly string and a shine.',
    level: 'beginner',
    difficulty: 1,
    estMinutes: 5,
    steps: [
      {
        stage: 'shapes',
        prompt: 'Draw the balloon: an egg shape, rounder at the top and narrower at the bottom.',
        guide: [spline([[500, 160], [640, 200], [700, 340], [650, 500], [540, 610], [500, 625], [460, 610], [350, 500], [300, 340], [360, 200]], true)],
        tolerance: 36,
      },
      { stage: 'shapes', prompt: 'A small triangle for the knot, right under the balloon.', guide: [polygon([[500, 625], [468, 680], [532, 680]])], tolerance: 22 },
      { stage: 'lines', prompt: 'The string: one lazy, wiggly line down.', guide: [spline([[500, 680], [545, 745], [455, 815], [510, 890]])], tolerance: 26 },
      { stage: 'details', prompt: 'A shine on the balloon: one short curve.', guide: [curve([385, 300], [395, 235], [455, 212])], tolerance: 22 },
    ],
  },
  {
    slug: 'rainbow',
    title: 'Rainbow',
    theme: 'Nature',
    summary: 'Three bands of colour, two fluffy clouds and a sun in the corner.',
    level: 'beginner',
    difficulty: 2,
    estMinutes: 6,
    steps: [
      {
        stage: 'lines',
        prompt: 'Three arches, one inside the other. Start with the biggest.',
        guide: [arc(500, 700, 400, 180, 360, 60), arc(500, 700, 320, 180, 360, 60), arc(500, 700, 240, 180, 360, 60)],
        tolerance: 28,
      },
      { stage: 'shapes', prompt: 'A fluffy cloud at each end of the rainbow. Bumpy on top, flat underneath.', guide: [cloud(175, 790), cloud(825, 790)], tolerance: 28, passAccuracy: 60 },
      {
        stage: 'details',
        prompt: 'A little sun in the corner: a circle with short rays.',
        guide: [circle(850, 150, 50), ...Array.from({ length: 8 }, (_, i) => radial(850, 150, 75, 115, i * 45))],
        tolerance: 20,
        passAccuracy: 55,
      },
    ],
  },
  {
    slug: 'happy-star',
    title: 'Happy star',
    theme: 'Shapes',
    summary: 'A five-pointed star with a smile. Draw it with straight, quick lines.',
    level: 'beginner',
    difficulty: 1,
    estMinutes: 4,
    steps: [
      { stage: 'shapes', prompt: 'Draw the star: go point to point, in one outline.', guide: [star(500, 520, 340, 150)], tolerance: 30 },
      { stage: 'details', prompt: 'Give it two round eyes.', guide: [circle(430, 500, 24), circle(570, 500, 24)], tolerance: 20, passAccuracy: 60 },
      { stage: 'details', prompt: 'And a big smile in the middle.', guide: [arc(500, 535, 75, 25, 155, 36)], tolerance: 22 },
    ],
  },
]

// ---- intermediate ---------------------------------------------------------------

const butterflyLeft: P[][] = [
  spline([[478, 430], [420, 330], [330, 235], [220, 190], [130, 230], [100, 320], [140, 420], [240, 490], [350, 520], [478, 520]]),
  spline([[478, 545], [380, 545], [270, 565], [190, 640], [190, 740], [260, 800], [350, 780], [420, 700], [478, 640]]),
]
const butterflyPatterns: P[][] = [
  spline([[425, 385], [345, 305], [255, 275], [190, 305], [185, 375], [240, 435], [340, 462], [430, 470]]),
  circle(290, 685, 46),
]
const butterflyAntennae: P[][] = [curve([490, 300], [470, 205], [415, 170]), circle(406, 164, 12)]

const owlEyes = (): P[][] => [circle(400, 400, 80), circle(600, 400, 80), circle(410, 405, 28), circle(590, 405, 28)]

const intermediate: Lesson[] = [
  {
    slug: 'butterfly',
    title: 'Butterfly',
    theme: 'Animals',
    summary: 'Two pairs of wings with patterns inside, a slim body and curly antennae. Both sides match.',
    level: 'intermediate',
    difficulty: 3,
    estMinutes: 9,
    steps: [
      { stage: 'shapes', prompt: 'Start with the body: a tall oval, and a small round head above it.', guide: [ellipse(500, 505, 24, 150), circle(500, 322, 28)], tolerance: 22 },
      {
        stage: 'shapes',
        prompt: 'The big upper wings: one on each side, like rounded hills leaning away from the body.',
        guide: [butterflyLeft[0]!, ...mirror([butterflyLeft[0]!])],
        tolerance: 26,
      },
      {
        stage: 'shapes',
        prompt: 'Now the smaller lower wings, hanging below the big ones.',
        guide: [butterflyLeft[1]!, ...mirror([butterflyLeft[1]!])],
        tolerance: 26,
      },
      {
        stage: 'details',
        prompt: 'Patterns inside the wings: a long curve in each upper wing and a circle in each lower one.',
        guide: [...butterflyPatterns, ...mirror(butterflyPatterns)],
        tolerance: 22,
        passAccuracy: 60,
      },
      { stage: 'details', prompt: 'Finish with the two antennae, each ending in a little ball.', guide: [...butterflyAntennae, ...mirror(butterflyAntennae)], tolerance: 20, passAccuracy: 60 },
    ],
  },
  {
    slug: 'wise-owl',
    title: 'Wise owl',
    theme: 'Animals',
    summary: 'A round owl with ear tufts, huge eyes, a beak and feathers, sitting on a branch.',
    level: 'intermediate',
    difficulty: 3,
    estMinutes: 10,
    steps: [
      {
        stage: 'shapes',
        prompt: 'Draw the body: a big egg, wide at the top and rounded at the bottom.',
        guide: [spline([[500, 230], [650, 260], [740, 420], [730, 640], [650, 810], [500, 865], [350, 810], [270, 640], [260, 420], [350, 260]], true)],
        tolerance: 34,
      },
      { stage: 'lines', prompt: 'Two pointy ear tufts on top of the head.', guide: [[[352, 265], [330, 170], [425, 238]], [[648, 265], [670, 170], [575, 238]]], tolerance: 24 },
      { stage: 'shapes', prompt: 'The big eyes: two large circles, each with a small circle inside.', guide: owlEyes(), tolerance: 22, passAccuracy: 60 },
      { stage: 'shapes', prompt: 'A small beak between the eyes: a triangle pointing down.', guide: [polygon([[470, 470], [530, 470], [500, 535]])], tolerance: 18 },
      {
        stage: 'details',
        prompt: 'Feathers on its belly: rows of little curves, like smiles.',
        guide: [...[420, 500, 580].map((x) => arc(x, 610, 38, 20, 160, 14)), ...[380, 460, 540, 620].map((x) => arc(x, 705, 38, 20, 160, 14))],
        tolerance: 20,
        passAccuracy: 60,
      },
      {
        stage: 'details',
        prompt: 'A wing on each side, and the branch it sits on.',
        guide: [curve([320, 500], [262, 640], [330, 770]), curve([680, 500], [738, 640], [670, 770]), line(170, 888, 830, 888)],
        tolerance: 22,
      },
    ],
  },
  {
    slug: 'rocket',
    title: 'Rocket',
    theme: 'Objects',
    summary: 'A rocket with a window, fins, a flame and stars around it.',
    level: 'intermediate',
    difficulty: 3,
    estMinutes: 9,
    steps: [
      {
        stage: 'shapes',
        prompt: 'Draw the body: pointed at the top, straight on the sides, flat at the bottom.',
        guide: [[...curve([360, 330], [385, 180], [500, 90]), ...curve([500, 90], [615, 180], [640, 330]).slice(1), [640, 650], [360, 650], [360, 330]]],
        tolerance: 26,
      },
      { stage: 'shapes', prompt: 'A round window, with a smaller circle inside it.', guide: [circle(500, 330, 70), circle(500, 330, 44)], tolerance: 22, passAccuracy: 60 },
      {
        stage: 'shapes',
        prompt: 'Two fins at the bottom, one on each side.',
        guide: [polygon([[360, 520], [235, 705], [360, 650]]), polygon([[640, 520], [765, 705], [640, 650]])],
        tolerance: 24,
      },
      {
        stage: 'details',
        prompt: 'The nozzle under the rocket, and the flame coming out of it.',
        guide: [polygon([[430, 650], [570, 650], [542, 712], [458, 712]]), [[465, 718], [435, 805], [500, 905], [565, 805], [535, 718]]],
        tolerance: 22,
      },
      {
        stage: 'details',
        prompt: 'A stripe across the body, and three little stars in the sky.',
        guide: [line(360, 540, 640, 540), ...cross(185, 230, 28), ...cross(820, 330, 24), ...cross(800, 800, 22)],
        tolerance: 20,
        passAccuracy: 60,
      },
    ],
  },
  {
    slug: 'cupcake',
    title: 'Cupcake',
    theme: 'Objects',
    summary: 'A paper cup with pleats, three tiers of frosting, sprinkles and a cherry.',
    level: 'intermediate',
    difficulty: 3,
    estMinutes: 9,
    steps: [
      { stage: 'shapes', prompt: 'Draw the paper cup: wider at the top than the bottom.', guide: [polygon([[270, 560], [730, 560], [660, 880], [340, 880]])], tolerance: 26 },
      {
        stage: 'lines',
        prompt: 'Five pleats in the cup, fanning out from the bottom.',
        guide: [line(350, 565, 396, 876), line(425, 565, 448, 876), line(500, 565, 500, 876), line(575, 565, 552, 876), line(650, 565, 604, 876)],
        tolerance: 22,
        passAccuracy: 60,
      },
      {
        stage: 'shapes',
        prompt: 'The frosting in three tiers: a wide one, a smaller one, and a swirl on top.',
        guide: [
          spline([[240, 560], [250, 470], [350, 430], [650, 430], [750, 470], [760, 560]]),
          spline([[310, 430], [330, 340], [420, 300], [580, 300], [670, 340], [690, 430]]),
          spline([[400, 300], [430, 220], [500, 150], [570, 220], [600, 300]]),
        ],
        tolerance: 24,
      },
      { stage: 'details', prompt: 'A cherry on the very top, with a short stem.', guide: [circle(500, 118, 30), curve([505, 90], [540, 45], [590, 42])], tolerance: 20, passAccuracy: 60 },
      {
        stage: 'details',
        prompt: 'Sprinkles: short slanted dashes scattered over the frosting.',
        guide: [line(370, 485, 395, 470), line(470, 490, 495, 505), line(590, 480, 612, 465), line(700, 500, 722, 488), line(430, 380, 455, 365), line(560, 375, 585, 390), line(500, 250, 520, 235)],
        tolerance: 16,
        passAccuracy: 55,
      },
    ],
  },
  {
    slug: 'sea-turtle',
    title: 'Sea turtle',
    theme: 'Animals',
    summary: 'A turtle seen from the side: a domed shell with plates, a smiling head, stubby legs and a tail.',
    level: 'intermediate',
    difficulty: 3,
    estMinutes: 10,
    steps: [
      {
        stage: 'shapes',
        prompt: 'Draw the shell: a tall dome, flat along the bottom.',
        guide: [[...spline([[230, 600], [270, 440], [400, 330], [550, 320], [690, 400], [760, 520], [780, 600]]), [230, 600]]],
        tolerance: 28,
      },
      {
        stage: 'shapes',
        prompt: 'Plates on the shell: a hexagon in the middle, with lines running out from its corners.',
        guide: [
          polygon([[590, 480], [547, 554], [463, 554], [420, 480], [463, 406], [547, 406]]),
          line(547, 406, 555, 335),
          line(463, 406, 445, 345),
          line(590, 480, 715, 485),
          line(420, 480, 292, 490),
          line(547, 554, 568, 598),
          line(463, 554, 442, 598),
        ],
        tolerance: 20,
        passAccuracy: 60,
      },
      { stage: 'shapes', prompt: 'The head, sticking out on the right: a soft oval.', guide: [ellipse(850, 540, 72, 60)], tolerance: 26 },
      { stage: 'details', prompt: 'A round eye and a small smile.', guide: [circle(872, 518, 10), arc(862, 558, 28, 20, 100, 12)], tolerance: 16, passAccuracy: 55 },
      {
        stage: 'details',
        prompt: 'Two stubby legs under the shell, and a small pointed tail at the back.',
        guide: [[[310, 600], [298, 705], [392, 705], [402, 600]], [[610, 600], [598, 705], [692, 705], [702, 600]], polygon([[232, 585], [150, 622], [236, 628]])],
        tolerance: 22,
      },
    ],
  },
  {
    slug: 'lighthouse',
    title: 'Lighthouse',
    theme: 'Scenes',
    summary: 'A striped lighthouse on the rocks, with its lamp, a door, rays of light and the sea.',
    level: 'intermediate',
    difficulty: 3,
    estMinutes: 10,
    steps: [
      { stage: 'shapes', prompt: 'The tower: narrow at the top, wide at the bottom.', guide: [polygon([[400, 330], [600, 330], [640, 820], [360, 820]])], tolerance: 24 },
      {
        stage: 'shapes',
        prompt: 'The lamp room on top: a small box, a pointed roof and a little ball.',
        guide: [rect(440, 250, 120, 80), polygon([[420, 250], [500, 175], [580, 250]], false), circle(500, 155, 16)],
        tolerance: 20,
        passAccuracy: 60,
      },
      { stage: 'lines', prompt: 'Two stripes across the tower.', guide: [line(389, 470, 611, 470), line(375, 640, 625, 640)], tolerance: 22 },
      {
        stage: 'details',
        prompt: 'A round window and an arched door.',
        guide: [circle(500, 555, 24), [[470, 820], [470, 752], ...arc(500, 752, 30, 180, 360, 12), [530, 820]]],
        tolerance: 18,
        passAccuracy: 60,
      },
      {
        stage: 'details',
        prompt: 'Rays of light on both sides, and the sea along the bottom.',
        guide: [line(575, 272, 880, 190), line(575, 305, 880, 340), line(425, 272, 120, 190), line(425, 305, 120, 340), wave(90, 910, 885, 14, 5)],
        tolerance: 22,
        passAccuracy: 60,
      },
    ],
  },
]

// ---- expert ---------------------------------------------------------------------

const shipSails = {
  a1: sail([165, 250], [335, 250], [140, 420], [360, 420]),
  a2: sail([140, 430], [360, 430], [130, 570], [370, 570]),
  b1: sail([405, 200], [595, 200], [385, 380], [615, 380]),
  b2: sail([385, 390], [615, 390], [380, 545], [620, 545]),
}

const mane = scallop(500, 500, 330, 50, 14)
const earCentres: P[] = [[345, 300], [655, 300]]
const maneStrands: P[][] = Array.from({ length: 14 }, (_, k) => radial(500, 500, 300, 350, ((2 * k + 1) * 180) / 14)).filter((l) =>
  earCentres.every((e) => Math.hypot(l[1]![0] - e[0], l[1]![1] - e[1]) > 90),
)
const lionFace = spline([[500, 290], [640, 330], [705, 470], [690, 640], [600, 760], [500, 790], [400, 760], [310, 640], [295, 470], [360, 330]], true)
const lionBrowL = curve([380, 415], [425, 388], [470, 420])

const expert: Lesson[] = [
  {
    slug: 'tall-ship',
    title: 'Tall ship',
    theme: 'Scenes',
    summary: 'A sailing ship with two masts, four sails, a jib, flags and rigging, rolling on the waves. Take it one part at a time.',
    level: 'expert',
    difficulty: 5,
    estMinutes: 14,
    steps: [
      {
        stage: 'shapes',
        prompt: 'The hull: a long curve underneath, and a straight line across the top from the back to the front.',
        guide: [spline([[160, 640], [200, 760], [320, 830], [500, 850], [680, 835], [790, 760], [850, 600]]), line(160, 640, 850, 600)],
        tolerance: 20,
      },
      {
        stage: 'details',
        prompt: 'A plank line along the hull, and five round portholes under it.',
        guide: [line(175, 690, 835, 652), ...[300, 400, 500, 600, 700].map((x) => circle(x, 745, 13))],
        tolerance: 16,
        passAccuracy: 60,
      },
      {
        stage: 'lines',
        prompt: 'Two tall masts, and a small flag on top of each.',
        guide: [line(250, 645, 250, 140), line(500, 640, 500, 90), polygon([[250, 140], [250, 85], [330, 112]]), polygon([[500, 90], [500, 32], [585, 60]])],
        tolerance: 18,
      },
      {
        stage: 'lines',
        prompt: 'The yards: six crossbars that hold the sails.',
        guide: [line(165, 250, 335, 250), line(140, 430, 360, 430), line(130, 570, 370, 570), line(405, 200, 595, 200), line(385, 390, 615, 390), line(380, 545, 620, 545)],
        tolerance: 16,
        passAccuracy: 60,
      },
      { stage: 'shapes', prompt: 'The two sails on the back mast. The bottom edges sag a little with the wind.', guide: [shipSails.a1, shipSails.a2], tolerance: 18 },
      { stage: 'shapes', prompt: 'The two sails on the front mast.', guide: [shipSails.b1, shipSails.b2], tolerance: 18 },
      {
        stage: 'details',
        prompt: 'A triangle sail at the front, and the ropes that hold it.',
        guide: [polygon([[650, 225], [915, 530], [660, 555]]), line(500, 95, 650, 225), line(840, 604, 918, 528)],
        tolerance: 18,
        passAccuracy: 60,
      },
      {
        stage: 'details',
        prompt: 'Waves under the ship, and a few drops of foam by the bow.',
        guide: [wave(90, 910, 885, 14, 6), circle(885, 775, 12), circle(915, 735, 10), circle(860, 825, 10)],
        tolerance: 18,
        passAccuracy: 60,
      },
    ],
  },
  {
    slug: 'stone-castle',
    title: 'Stone castle',
    theme: 'Scenes',
    summary: 'A castle with a tall keep, two towers, battlements, flags, windows and a gate with a portcullis.',
    level: 'expert',
    difficulty: 4,
    estMinutes: 13,
    steps: [
      {
        stage: 'shapes',
        prompt: 'The ground, and the tall middle keep standing on it.',
        guide: [line(80, 860, 920, 860), [[390, 860], [390, 270], [610, 270], [610, 860]]],
        tolerance: 20,
      },
      {
        stage: 'shapes',
        prompt: 'The two towers, one on each side of the keep.',
        guide: [[[170, 860], [170, 330], [330, 330], [330, 860]], [[670, 860], [670, 330], [830, 330], [830, 860]]],
        tolerance: 20,
      },
      {
        stage: 'shapes',
        prompt: 'A pointed roof on the keep, with a flagpole and a flag.',
        guide: [polygon([[360, 275], [500, 110], [640, 275]]), line(500, 110, 500, 40), polygon([[500, 40], [590, 65], [500, 90]])],
        tolerance: 18,
        passAccuracy: 60,
      },
      {
        stage: 'details',
        prompt: 'Battlements: raised blocks along the top of each tower and the two wall pieces between.',
        guide: [...battlement(170, 330, 330, 3, 40), ...battlement(670, 830, 330, 3, 40), ...battlement(330, 390, 560, 2, 28), ...battlement(610, 670, 560, 2, 28), line(330, 560, 390, 560), line(610, 560, 670, 560)],
        tolerance: 16,
        passAccuracy: 60,
      },
      {
        stage: 'details',
        prompt: 'A small flag on top of each tower.',
        guide: [line(250, 290, 250, 215), polygon([[250, 215], [325, 235], [250, 255]]), line(750, 290, 750, 215), polygon([[750, 215], [825, 235], [750, 255]])],
        tolerance: 16,
        passAccuracy: 60,
      },
      {
        stage: 'shapes',
        prompt: 'The gate: an arch in the middle of the keep, with a grid of bars inside it.',
        guide: [
          [[440, 860], [440, 700], ...arc(500, 700, 60, 180, 360, 16), [560, 860]],
          line(470, 655, 470, 860),
          line(500, 645, 500, 860),
          line(530, 655, 530, 860),
          line(440, 745, 560, 745),
          line(440, 805, 560, 805),
        ],
        tolerance: 16,
        passAccuracy: 60,
      },
      {
        stage: 'details',
        prompt: 'Windows: an arched one in the keep, and a thin slit in each tower.',
        guide: [[[470, 440], [470, 390], ...arc(500, 390, 30, 180, 360, 12), [530, 440], [470, 440]], line(250, 450, 250, 540), line(750, 450, 750, 540)],
        tolerance: 14,
        passAccuracy: 55,
      },
    ],
  },
  {
    slug: 'lion-king',
    title: 'Lion',
    theme: 'Animals',
    summary: 'A lion face with a big scalloped mane, ears, eyes, a muzzle and a smile. Lots of small curves.',
    level: 'expert',
    difficulty: 4,
    estMinutes: 14,
    steps: [
      { stage: 'shapes', prompt: 'The mane: a big round edge made of fourteen soft bumps. Go all the way around.', guide: [mane], tolerance: 22 },
      { stage: 'shapes', prompt: 'The face inside it: a wide shape that narrows towards the chin.', guide: [lionFace], tolerance: 24 },
      { stage: 'shapes', prompt: 'Two round ears at the top, each with a small curve inside.', guide: [circle(345, 300, 50), circle(655, 300, 50), arc(345, 312, 26, 200, 340, 14), arc(655, 312, 26, 200, 340, 14)], tolerance: 18, passAccuracy: 60 },
      {
        stage: 'details',
        prompt: 'Two round eyes, with an eyebrow arching over each one.',
        guide: [circle(425, 470, 24), circle(575, 470, 24), lionBrowL, ...mirror([lionBrowL])],
        tolerance: 16,
        passAccuracy: 60,
      },
      {
        stage: 'shapes',
        prompt: 'The muzzle: a soft shape below the eyes, with a triangle nose in the middle.',
        guide: [spline([[500, 540], [570, 560], [605, 620], [570, 690], [500, 710], [430, 690], [395, 620], [430, 560]], true), polygon([[465, 562], [535, 562], [500, 606]])],
        tolerance: 18,
      },
      {
        stage: 'details',
        prompt: 'A line down from the nose, and the mouth: two little smiles side by side.',
        guide: [line(500, 606, 500, 645), arc(460, 645, 40, 0, 160, 16), arc(540, 645, 40, 20, 180, 16)],
        tolerance: 14,
        passAccuracy: 60,
      },
      { stage: 'details', prompt: 'Little strands of hair, one in every bump of the mane. Draw each as a short line from the face outwards.', guide: maneStrands, tolerance: 16, passAccuracy: 55 },
    ],
  },
  {
    slug: 'sunflower',
    title: 'Sunflower',
    theme: 'Nature',
    summary: 'A sunflower with sixteen petals, a seed spiral, a stem, two big leaves and a bee.',
    level: 'expert',
    difficulty: 4,
    estMinutes: 13,
    steps: [
      { stage: 'shapes', prompt: 'The middle of the flower: a big circle with a smaller one inside it.', guide: [circle(500, 360, 128), circle(500, 360, 92)], tolerance: 22, passAccuracy: 60 },
      {
        stage: 'shapes',
        prompt: 'Sixteen pointed petals all around. Draw each as a long, pointed oval.',
        guide: Array.from({ length: 16 }, (_, i) => petal(500, 360, 138, 268, i * 22.5, 32)),
        tolerance: 20,
        passAccuracy: 55,
      },
      { stage: 'shapes', prompt: 'The seeds: a spiral that winds out from the very centre.', guide: [spiral(500, 360, 28, 84, 2)], tolerance: 16, passAccuracy: 60 },
      {
        stage: 'lines',
        prompt: 'The stem: two long curved lines, side by side, going down.',
        guide: [spline([[485, 618], [465, 705], [505, 795], [485, 905]]), spline([[515, 618], [495, 705], [535, 795], [515, 905]])],
        tolerance: 18,
      },
      {
        stage: 'shapes',
        prompt: 'A big leaf on each side of the stem, each with a line down its middle.',
        guide: [
          leaf([520, 765], [770, 690], [640, 640], [700, 790]),
          line(520, 765, 740, 700),
          leaf([482, 815], [240, 745], [360, 700], [310, 830]),
          line(482, 815, 270, 755),
        ],
        tolerance: 20,
        passAccuracy: 60,
      },
      {
        stage: 'details',
        prompt: 'A bee in the corner: an oval body with two stripes and two wings.',
        guide: [ellipse(820, 175, 44, 28), line(805, 150, 805, 200), line(832, 150, 832, 200), ellipse(800, 128, 24, 14), ellipse(842, 125, 24, 14)],
        tolerance: 12,
        passAccuracy: 55,
      },
    ],
  },
  {
    slug: 'mandala',
    title: 'Mandala',
    theme: 'Shapes',
    summary: 'A circular pattern, built ring by ring from the middle outwards. Calm, careful and very satisfying.',
    level: 'expert',
    difficulty: 5,
    estMinutes: 15,
    steps: [
      { stage: 'shapes', prompt: 'The centre: a small circle with a bigger one around it.', guide: [circle(500, 500, 38), circle(500, 500, 70)], tolerance: 16, passAccuracy: 60 },
      {
        stage: 'shapes',
        prompt: 'Eight petals around the centre. Draw each as a pointed oval pointing outwards.',
        guide: Array.from({ length: 8 }, (_, i) => petal(500, 500, 80, 205, i * 45, 34)),
        tolerance: 18,
        passAccuracy: 55,
      },
      { stage: 'shapes', prompt: 'Two rings around the petals, close together.', guide: [circle(500, 500, 222), circle(500, 500, 244)], tolerance: 14, passAccuracy: 60 },
      {
        stage: 'shapes',
        prompt: 'Sixteen small petals in between the petals of the ring.',
        guide: Array.from({ length: 16 }, (_, i) => petal(500, 500, 252, 322, 11.25 + i * 22.5, 18)),
        tolerance: 14,
        passAccuracy: 55,
      },
      { stage: 'shapes', prompt: 'A scalloped border, with sixteen round bumps. Go all the way around.', guide: [scallop(500, 500, 338, 30, 16)], tolerance: 16 },
      {
        stage: 'details',
        prompt: 'A ring of 24 tiny dots outside the border. Each one is a little circle.',
        guide: Array.from({ length: 24 }, (_, i) => circle(...polar(500, 500, 402, i * 15), 9)),
        tolerance: 11,
        passAccuracy: 50,
      },
      {
        stage: 'lines',
        prompt: 'The last ring: sixteen short rays pointing outwards.',
        guide: Array.from({ length: 16 }, (_, i) => radial(500, 500, 425, 460, i * 22.5)),
        tolerance: 12,
        passAccuracy: 55,
      },
    ],
  },
]

export const gallery: Lesson[] = [...beginner, ...intermediate, ...expert]
