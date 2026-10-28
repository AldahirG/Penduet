import type { GuidePoint } from './score'
import { arc, circle, curve, halfEllipseLeft, line, mirror, polygon, rect } from './shapes'

// Pictures for the "two halves" game. Each one is a symmetric picture, written as its LEFT half only
// (every x is 500 or less). The right half is the same thing flipped across the middle, so the person
// on the left draws these lines and the person on the right draws their mirror image. Lines that reach
// x = 500 are where the two halves must meet.
//
// A room keeps the index of its picture, so only ever add to the end of the list.

export interface HalfSubject {
  slug: string
  /** What the picture is, for the heading. */
  title: string
  /** One line of what to do, shown with the picture. */
  prompt: string
  /** The left half, as polylines in the 1000 x 1000 canvas. */
  left: GuidePoint[][]
}

const join = (...parts: GuidePoint[][]): GuidePoint[] => parts.reduce((all, p) => (all.length ? [...all, ...p.slice(1)] : [...p]), [] as GuidePoint[])

export const halfSubjects: readonly HalfSubject[] = [
  {
    slug: 'butterfly',
    title: 'A butterfly',
    prompt: 'One of you draws the left wings, the other the right ones. Meet at the body.',
    left: [
      join(curve([500, 440], [200, 80], [110, 300]), curve([110, 300], [260, 500], [500, 520])),
      join(curve([500, 545], [110, 520], [180, 760]), curve([180, 760], [330, 900], [500, 700])),
      join(curve([500, 370], [455, 420], [470, 560]), curve([470, 560], [480, 700], [500, 750])),
      curve([495, 372], [470, 300], [430, 250]),
      circle(300, 330, 34),
      circle(290, 650, 28),
    ],
  },
  {
    slug: 'face',
    title: 'A face',
    prompt: 'Each of you draws one side of the face. The nose and mouth meet in the middle.',
    left: [
      halfEllipseLeft(500, 500, 250, 320),
      circle(390, 450, 40),
      curve([320, 380], [390, 340], [460, 375]),
      [[500, 470], [480, 570], [500, 585]],
      curve([500, 690], [440, 730], [380, 660]),
      arc(250, 500, 55, 90, 270, 24),
      curve([500, 185], [400, 140], [300, 215]),
    ],
  },
  {
    slug: 'house',
    title: 'A house',
    prompt: 'The roof, the wall and the door are split down the middle. Make the lines meet.',
    left: [
      line(500, 200, 130, 470),
      line(190, 470, 190, 820),
      line(190, 820, 500, 820),
      [[500, 820], [390, 820], [390, 600], [500, 600]],
      rect(230, 560, 100, 100),
      [[300, 345], [300, 250], [360, 250], [360, 310]],
    ],
  },
  {
    slug: 'rocket',
    title: 'A rocket',
    prompt: 'One side of the rocket each, with a window and a flame in the middle.',
    left: [
      join(curve([500, 130], [330, 260], [350, 520]), [[350, 520], [350, 720]]),
      [[350, 600], [220, 780], [350, 740]],
      [[350, 720], [500, 720]],
      arc(500, 400, 70, 90, 270, 24),
      [[470, 720], [440, 850], [500, 790]],
    ],
  },
  {
    slug: 'heart',
    title: 'A big heart',
    prompt: 'Each of you draws half of the heart, from the bottom point up to the top dip.',
    left: [
      curve([500, 840], [130, 600], [170, 330]),
      join(curve([170, 330], [230, 160], [390, 200]), curve([390, 200], [470, 230], [500, 330])),
      curve([260, 300], [240, 350], [270, 420]),
      curve([300, 520], [330, 600], [400, 650]),
    ],
  },
  {
    slug: 'pine-tree',
    title: 'A pine tree',
    prompt: 'Three layers of branches, a trunk and two baubles, split down the middle.',
    left: [
      [[500, 130], [350, 330], [420, 330], [270, 540], [350, 540], [180, 760], [500, 760]],
      [[450, 760], [450, 870], [500, 870]],
      circle(395, 440, 22),
      circle(330, 650, 24),
    ],
  },
  {
    slug: 'robot',
    title: 'A robot',
    prompt: 'Head, body, arm and leg: each of you builds one side of the robot.',
    left: [
      [[500, 200], [300, 200], [300, 430], [500, 430]],
      circle(390, 310, 30),
      [[500, 200], [500, 130]],
      arc(500, 100, 30, 90, 270, 20),
      [[500, 470], [260, 470], [260, 790], [500, 790]],
      [[260, 520], [140, 600], [140, 700]],
      polygon([[320, 540], [400, 540], [400, 620], [320, 620]]),
      [[400, 790], [400, 880], [330, 880]],
    ],
  },
  {
    slug: 'mushroom',
    title: 'A mushroom',
    prompt: 'A cap with spots on a stem. Each of you draws one half and joins the top and the bottom.',
    left: [
      curve([170, 470], [170, 230], [500, 200]),
      curve([170, 470], [330, 520], [500, 500]),
      [[440, 500], [410, 800], [500, 820]],
      circle(290, 360, 45),
      circle(410, 300, 28),
    ],
  },
]

/** The whole picture: the left half and its mirror image. */
export const halfGuide = (subject: HalfSubject): GuidePoint[][] => [...subject.left, ...mirror(subject.left)]
