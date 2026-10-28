import { isCorrectAnswer, words } from '@penduet/lessons'
import { GUESS, type GuessState, type Slot } from '@penduet/protocol'

// The rules of draw and guess, with no I/O and no clock of its own, so they can be tested without a
// Durable Object. The room passes in `now`, calls `tick` when a deadline passes, and carries out what
// each function reports: tell both people, persist the state, set the next alarm.

/** A GuessState as the room stores it: the word is always here, and a little memory for picking the next one. */
export interface GuessGame extends GuessState {
  /** Words used lately, so the next round is a new one. */
  used: number[]
  /** Who drew last round, so the next round is the other person's. Null before the first round. */
  prev: Slot | null
  /** Someone dropped out mid-round: when the round is called off if they are not back (ms on the room's clock). */
  away: number | null
}

export interface Timing {
  rouletteMs: number
  countdownMs: number
  drawMs: number
  answerMs: number
  resultMs: number
  graceMs: number
}

/** Timings at `speed` times the normal pace: 1 for a real room, less for tests. */
export function timingFor(speed = 1): Timing {
  const k = Number.isFinite(speed) ? Math.min(1, Math.max(0.02, speed)) : 1
  const scale = (ms: number) => Math.max(20, Math.round(ms * k))
  return {
    rouletteMs: scale(GUESS.rouletteMs),
    countdownMs: scale(GUESS.countdownMs),
    drawMs: scale(GUESS.drawMs),
    answerMs: scale(GUESS.answerMs),
    resultMs: scale(GUESS.resultMs),
    graceMs: scale(GUESS.graceMs),
  }
}

/** What changed, for the room to act on. */
export interface Step {
  /** The state is different: send it to both people and store it. */
  changed: boolean
  /** The canvas starts again: remove every stroke. */
  clear: boolean
  /** The drawer's canvas just closed: finish any stroke they have open. */
  lock: boolean
}

const NONE: Step = { changed: false, clear: false, lock: false }
const other = (slot: Slot): Slot => (slot === 1 ? 2 : 1)
/** How many recent words are kept out of the draw. Fewer than the list, or nothing would be left to pick. */
const MEMORY = 30

export function newGuessGame(): GuessGame {
  return {
    kind: 'guess',
    phase: 'waiting',
    round: 0,
    drawer: null,
    interval: 0,
    deadline: null,
    wordId: null,
    score: 0,
    played: 0,
    won: 0,
    last: null,
    result: null,
    used: [],
    prev: null,
    away: null,
  }
}

/** The next moment the room has to look at the game again: a phase ending, or a missing person's time running out. */
export function nextWake(g: GuessGame): number | null {
  const times = [g.deadline, g.away].filter((t): t is number => t !== null && t !== undefined)
  return times.length > 0 ? Math.min(...times) : null
}

/** Whether the room is in the middle of a round (anything between the wheel and the result). */
export const isRunning = (g: GuessGame): boolean => g.phase === 'roulette' || g.phase === 'countdown' || g.phase === 'draw' || g.phase === 'answer'

/** Only the drawer, and only while the canvas is open. */
export const canDraw = (g: GuessGame, slot: Slot): boolean => g.phase === 'draw' && g.drawer === slot

/** The state one seat may see: the word goes to the drawer once the wheel has stopped, and to everyone at the end. */
export function visibleTo(g: GuessGame, slot: Slot): GuessState {
  const { used: _used, prev: _prev, wordId, ...pub } = g
  const knows = g.phase === 'result' || (g.drawer === slot && (g.phase === 'countdown' || g.phase === 'draw' || g.phase === 'answer'))
  return { ...pub, wordId: knows ? wordId : null }
}

function pickWord(g: GuessGame, random: () => number): number {
  const recent = new Set(g.used.slice(-Math.min(MEMORY, words.length - 1)))
  const pool: number[] = []
  for (let i = 0; i < words.length; i++) if (!recent.has(i)) pool.push(i)
  return pool[Math.floor(random() * pool.length)] ?? 0
}

/** Start a round: the wheel, with the drawer and the word already decided. The canvas is wiped. */
function begin(g: GuessGame, now: number, t: Timing, random: () => number): Step {
  const wordId = pickWord(g, random)
  g.round += 1
  // The first round is a toss-up. After that the pen alternates, so nobody draws twice in a row.
  g.drawer = g.prev === null ? (random() < 0.5 ? 1 : 2) : other(g.prev)
  g.prev = g.drawer
  g.wordId = wordId
  g.used = [...g.used, wordId].slice(-MEMORY)
  g.interval = 0
  g.last = null
  g.result = null
  g.phase = 'roulette'
  g.deadline = now + t.rouletteMs
  return { changed: true, clear: true, lock: false }
}

function finish(g: GuessGame, now: number, t: Timing, won: boolean): Step {
  const points = won ? GUESS.intervals - g.interval : 0
  g.result = { won, interval: won ? g.interval : null, points }
  g.played += 1
  if (won) g.won += 1
  g.score += points
  g.phase = 'result'
  g.deadline = now + t.resultMs
  return { changed: true, clear: false, lock: true }
}

/** Where the next deadline counts from: the last one, so timers do not drift, unless the room was late by a lot. */
const base = (g: GuessGame, now: number): number => (g.deadline !== null && now - g.deadline <= 1500 ? g.deadline : now)

/**
 * Moves the game on if its deadline has passed. `bothHere` says whether both seats have someone in them,
 * which decides whether a new round can follow the result.
 */
export function tick(g: GuessGame, now: number, t: Timing, bothHere: boolean, random: () => number = Math.random): Step {
  let step = NONE
  if (g.away != null) {
    if (bothHere) g.away = null // they are back: the round went on without a break
    else if (g.away <= now) return callOff(g)
  }
  for (let i = 0; i < 8 && g.deadline !== null && g.deadline <= now; i++) {
    const at = base(g, now)
    let next: Step
    switch (g.phase) {
      case 'roulette':
        g.phase = 'countdown'
        g.deadline = at + t.countdownMs
        next = { changed: true, clear: false, lock: false }
        break
      case 'countdown':
        g.phase = 'draw'
        g.deadline = at + t.drawMs
        next = { changed: true, clear: false, lock: false }
        break
      case 'draw':
        g.phase = 'answer'
        g.deadline = at + t.answerMs
        next = { changed: true, clear: false, lock: true }
        break
      case 'answer':
        // Nobody answered in time: that window is spent.
        if (g.interval + 1 >= GUESS.intervals) next = finish(g, at, t, false)
        else {
          g.interval += 1
          g.phase = 'draw'
          g.deadline = at + t.drawMs
          next = { changed: true, clear: false, lock: false }
        }
        break
      case 'result':
        if (bothHere) next = begin(g, at, t, random)
        else {
          g.phase = 'waiting'
          g.deadline = null
          g.drawer = null
          g.wordId = null
          next = { changed: true, clear: false, lock: false }
        }
        break
      default:
        g.deadline = null
        next = NONE
    }
    step = merge(step, next)
  }
  return step
}

/** The one answer of the open window. Right: the round ends now. Wrong: the next burst of drawing starts at once. */
export function answer(g: GuessGame, slot: Slot, text: string, now: number, t: Timing, correct: (id: number, text: string) => boolean = isCorrectAnswer): Step | { refused: 'not_open' | 'bad_message' } {
  const trimmed = text.trim()
  if (trimmed.length === 0) return { refused: 'bad_message' }
  // Only the guesser, only in an answer window, and only before its time is up: the clock is the room's, not the browser's.
  if (g.phase !== 'answer' || g.drawer === null || slot === g.drawer || g.deadline === null || now > g.deadline) return { refused: 'not_open' }
  const right = g.wordId !== null && correct(g.wordId, trimmed)
  g.last = { text: trimmed.slice(0, GUESS.maxAnswerLength), correct: right, at: g.interval }
  if (right) return finish(g, now, t, true)
  if (g.interval + 1 >= GUESS.intervals) return finish(g, now, t, false)
  g.interval += 1
  g.phase = 'draw'
  g.deadline = now + t.drawMs
  return { changed: true, clear: false, lock: false }
}

/**
 * Someone left. The round carries on for a short grace (a page reload is over in seconds). If they are not back by then, `tick`
 * calls it off, so nobody waits on a game that cannot go on.
 */
export function seatLeft(g: GuessGame, now: number, t: Timing): void {
  if (isRunning(g) && g.away == null) g.away = now + t.graceMs
}

/** A round with a missing person, called off: it does not count, and the same person draws when it starts again. */
function callOff(g: GuessGame): Step {
  g.away = null
  if (!isRunning(g)) return NONE // already over, or never started: nothing to call off
  g.phase = 'waiting'
  g.deadline = null
  g.drawer = null
  g.wordId = null
  g.last = null
  g.interval = 0
  g.round = Math.max(0, g.round - 1)
  // The call-off does not use up the round, and the same person is up next, not the other one.
  g.prev = g.prev === null ? null : other(g.prev)
  return { changed: true, clear: false, lock: true }
}

/** Both seats are full: a waiting game starts its next round. */
export function seatsFilled(g: GuessGame, now: number, t: Timing, random: () => number = Math.random): Step {
  g.away = null
  if (g.phase !== 'waiting') return NONE
  return begin(g, now, t, random)
}

function merge(a: Step, b: Step): Step {
  return { changed: a.changed || b.changed, clear: a.clear || b.clear, lock: a.lock || b.lock }
}
