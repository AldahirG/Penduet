import { describe, expect, it } from 'vitest'
import { words } from '@penduet/lessons'
import { GUESS } from '@penduet/protocol'
import { answer, canDraw, newGuessGame, nextWake, seatLeft, seatsFilled, tick, timingFor, visibleTo, type GuessGame } from './guessGame'
import { applyClientMessage, newGame, newRoomData, stamp } from './roomLog'

const T = timingFor(1)
// The word is always "cat" in these tests, whatever the draw picks.
const CAT = words.findIndex((w) => w.word === 'cat')
const alwaysCat = (id: number, text: string) => id === CAT && text.toLowerCase() === 'cat'

/** A game already past the wheel, with seat 1 drawing the word cat, at time 0. */
function running(phase: 'countdown' | 'draw' | 'answer' = 'draw', interval = 0): GuessGame {
  const g = newGuessGame()
  g.round = 1
  g.drawer = 1
  g.prev = 1
  g.wordId = CAT
  g.interval = interval
  g.phase = phase
  g.deadline = 1000
  return g
}

describe('draw and guess: a round', () => {
  it('waits for two people, then runs the wheel with the drawer and the word already chosen', () => {
    const g = newGuessGame()
    expect(g.phase).toBe('waiting')
    expect(tick(g, 99999, T, false)).toEqual({ changed: false, clear: false, lock: false })
    const step = seatsFilled(g, 0, T, () => 0.9)
    expect(step).toEqual({ changed: true, clear: true, lock: false })
    expect(g).toMatchObject({ phase: 'roulette', round: 1, drawer: 2, deadline: T.rouletteMs })
    expect(g.wordId).not.toBeNull()
    // nothing happens when seats fill again mid-round
    expect(seatsFilled(g, 1, T).changed).toBe(false)
  })

  it('goes wheel, countdown, then alternates drawing and one answer window, four times', () => {
    const g = newGuessGame()
    seatsFilled(g, 0, T, () => 0)
    const seen: string[] = []
    let now = 0
    while (g.phase !== 'result') {
      now = g.deadline!
      tick(g, now, T, true)
      seen.push(`${g.phase}${g.phase === 'draw' || g.phase === 'answer' ? g.interval : ''}`)
    }
    expect(seen).toEqual(['countdown', 'draw0', 'answer0', 'draw1', 'answer1', 'draw2', 'answer2', 'draw3', 'answer3', 'result'])
    // a minute of drawing in all (four bursts), and nobody scored
    expect(now).toBe(T.rouletteMs + T.countdownMs + GUESS.intervals * (T.drawMs + T.answerMs))
    expect(g.result).toEqual({ won: false, interval: null, points: 0 })
    expect(g).toMatchObject({ played: 1, won: 0, score: 0 })
  })

  it('closes the canvas at the end of each burst and opens it again after the window', () => {
    const g = running('draw')
    expect(canDraw(g, 1)).toBe(true)
    expect(canDraw(g, 2)).toBe(false) // the guesser never draws
    expect(tick(g, 1000, T, true).lock).toBe(true)
    expect(g.phase).toBe('answer')
    expect(canDraw(g, 1)).toBe(false)
    tick(g, g.deadline!, T, true)
    expect(g).toMatchObject({ phase: 'draw', interval: 1 })
    expect(canDraw(g, 1)).toBe(true)
  })

  it('does not tick before the deadline, and does not drift when the alarm is a little late', () => {
    const g = running('draw')
    expect(tick(g, 999, T, true).changed).toBe(false)
    tick(g, 1040, T, true) // 40 ms late
    expect(g.deadline).toBe(1000 + T.answerMs)
  })

  it('catches up after a long sleep without running a round from the start', () => {
    const g = running('draw')
    tick(g, 1000 + 60_000, T, true) // a minute late: counts from now
    expect(g.phase).toBe('answer')
    expect(g.deadline).toBe(1000 + 60_000 + T.answerMs)
  })

  it('after the result starts the next round with the other person drawing, or waits if someone left', () => {
    const g = running('answer', 3)
    tick(g, 1000, T, true, () => 0) // nobody answered: the round ends
    expect(g.phase).toBe('result')
    const next = structuredClone(g)
    tick(next, next.deadline!, T, true, () => 0)
    expect(next).toMatchObject({ phase: 'roulette', round: 2, drawer: 2, result: null, last: null })
    tick(g, g.deadline!, T, false)
    expect(g).toMatchObject({ phase: 'waiting', deadline: null, drawer: null })
  })

  it('does not repeat a word for a good while', () => {
    const g = newGuessGame()
    seatsFilled(g, 0, T, () => 0)
    const picked = [g.wordId]
    for (let r = 0; r < 40; r++) {
      g.phase = 'result'
      g.deadline = 0
      tick(g, 0, T, true, Math.random)
      picked.push(g.wordId)
    }
    expect(new Set(picked.slice(-30)).size).toBe(30)
  })
})

describe('draw and guess: answers', () => {
  it('a right answer ends the round at once and pays more the sooner it comes', () => {
    for (const [interval, points] of [[0, 4], [1, 3], [2, 2], [3, 1]] as const) {
      const g = running('answer', interval)
      const step = answer(g, 2, 'cat', 500, T, alwaysCat)
      expect(step).toEqual({ changed: true, clear: false, lock: true })
      expect(g).toMatchObject({ phase: 'result', result: { won: true, interval, points }, last: { text: 'cat', correct: true, at: interval }, score: points, won: 1, played: 1 })
    }
  })

  it('a wrong answer opens the canvas again straight away, and the word stays secret', () => {
    const g = running('answer', 0)
    answer(g, 2, 'dog', 500, T, alwaysCat)
    expect(g).toMatchObject({ phase: 'draw', interval: 1, last: { text: 'dog', correct: false, at: 0 }, deadline: 500 + T.drawMs })
    expect(visibleTo(g, 2).wordId).toBeNull()
    expect(visibleTo(g, 1).wordId).toBe(CAT)
  })

  it('a wrong answer in the last window ends the round as lost', () => {
    const g = running('answer', 3)
    answer(g, 2, 'dog', 500, T, alwaysCat)
    expect(g).toMatchObject({ phase: 'result', result: { won: false, points: 0 }, played: 1, won: 0 })
    expect(visibleTo(g, 2).wordId).toBe(CAT) // now both may see it
  })

  it('refuses answers outside a window, from the drawer, after the deadline, or empty', () => {
    expect(answer(running('draw'), 2, 'cat', 500, T, alwaysCat)).toEqual({ refused: 'not_open' })
    expect(answer(running('countdown'), 2, 'cat', 500, T, alwaysCat)).toEqual({ refused: 'not_open' })
    expect(answer(running('answer'), 1, 'cat', 500, T, alwaysCat)).toEqual({ refused: 'not_open' })
    expect(answer(running('answer'), 2, 'cat', 1001, T, alwaysCat)).toEqual({ refused: 'not_open' })
    expect(answer(running('answer'), 2, '   ', 500, T, alwaysCat)).toEqual({ refused: 'bad_message' })
    expect(answer(newGuessGame(), 2, 'cat', 500, T, alwaysCat)).toEqual({ refused: 'not_open' })
  })

  it('takes one answer per window: a second one is refused', () => {
    const g = running('answer', 0)
    answer(g, 2, 'dog', 500, T, alwaysCat) // now back to drawing
    expect(answer(g, 2, 'cat', 600, T, alwaysCat)).toEqual({ refused: 'not_open' })
  })

  it('a finished round takes no more answers', () => {
    const g = running('answer')
    answer(g, 2, 'cat', 500, T, alwaysCat)
    expect(answer(g, 2, 'cat', 501, T, alwaysCat)).toEqual({ refused: 'not_open' })
    expect(g.played).toBe(1)
  })
})

describe('draw and guess: who sees what', () => {
  it('hides the word from the guesser, and from everyone during the wheel', () => {
    const g = running('draw')
    expect(visibleTo(g, 1).wordId).toBe(CAT)
    expect(visibleTo(g, 2).wordId).toBeNull()
    g.phase = 'roulette'
    expect(visibleTo(g, 1).wordId).toBeNull()
    expect(JSON.stringify(visibleTo(g, 2))).not.toContain('used')
  })
})

describe('draw and guess: someone leaves', () => {
  it('waits a few seconds for them, and carries on if they come back', () => {
    const g = running('draw')
    seatLeft(g, 500, T)
    expect(g.away).toBe(500 + T.graceMs)
    expect(nextWake(g)).toBe(1000) // the phase still ends first
    expect(tick(g, 600, T, true).changed).toBe(false) // back: no break
    expect(g).toMatchObject({ phase: 'draw', away: null, wordId: CAT })
  })

  it('calls the round off, without counting it, when they are not back in time; the same person draws next', () => {
    const g = running('draw')
    g.deadline = 1_000_000 // a long way off, so only the missing person matters
    seatLeft(g, 500, T)
    expect(nextWake(g)).toBe(500 + T.graceMs)
    expect(tick(g, 500 + T.graceMs - 1, T, false).changed).toBe(false)
    const step = tick(g, 500 + T.graceMs, T, false)
    expect(step).toEqual({ changed: true, clear: false, lock: true })
    expect(g).toMatchObject({ phase: 'waiting', deadline: null, drawer: null, wordId: null, round: 0, played: 0, away: null })
    seatsFilled(g, 20_000, T)
    expect(g).toMatchObject({ phase: 'roulette', round: 1, drawer: 1 })
  })

  it('does not start the clock twice, and forgets it when the seats fill again', () => {
    const g = running('draw')
    seatLeft(g, 500, T)
    seatLeft(g, 900, T)
    expect(g.away).toBe(500 + T.graceMs)
    seatsFilled(g, 1000, T)
    expect(g.away).toBeNull()
  })

  it('leaves a waiting game and a finished round alone', () => {
    const waiting = newGuessGame()
    seatLeft(waiting, 500, T)
    expect(waiting.away).toBeNull()
    const g = running('answer')
    answer(g, 2, 'cat', 100, T, alwaysCat)
    seatLeft(g, 200, T)
    expect(g.away).toBeNull()
    expect(g.phase).toBe('result')
  })

  it('a finished round with someone missing goes back to waiting instead of starting another', () => {
    const g = running('answer', 3)
    tick(g, 1000, T, false) // nobody answered: result
    tick(g, g.deadline!, T, false)
    expect(g).toMatchObject({ phase: 'waiting', deadline: null })
  })
})

describe('draw and guess: the canvas in the room log', () => {
  const ctx = (slot: 1 | 2) => ({ slot, present: () => true })
  const start = { type: 'stroke_start', id: 'stroke-aaaa', tool: 'pen', color: '#112233', size: 4 } as const

  it('lets only the drawer start a stroke, and only while the canvas is open', () => {
    const data = newRoomData()
    data.game = running('draw')
    expect(applyClientMessage(data, 'b', start, ctx(2)).refused).toBe('not_open')
    expect(applyClientMessage(data, 'a', start, ctx(1)).refused).toBeUndefined()
    data.game = running('answer')
    expect(applyClientMessage(data, 'a', { ...start, id: 'stroke-bbbb' }, ctx(1)).refused).toBe('not_open')
  })

  it('refuses undo and clear while the canvas is closed or from the guesser', () => {
    const data = newRoomData()
    data.game = running('answer')
    for (const type of ['undo', 'clear'] as const) expect(applyClientMessage(data, 'a', { type }, ctx(1)).refused).toBe('not_open')
    data.game = running('draw')
    expect(applyClientMessage(data, 'b', { type: 'clear' }, ctx(2)).refused).toBe('not_open')
    expect(applyClientMessage(data, 'a', { type: 'clear' }, ctx(1)).refused).toBeUndefined()
  })

  it('treats an answer sent as a plain message as nothing for the log to do, and starts a room waiting', () => {
    const data = newRoomData()
    data.game = newGame('guess')
    expect(data.game).toMatchObject({ kind: 'guess', phase: 'waiting' })
    expect(applyClientMessage(data, 'b', { type: 'guess', text: 'cat' }, ctx(2)).refused).toBe('bad_message')
    expect(stamp(data, 'server', { type: 'clear' }).seq).toBe(1)
  })
})
