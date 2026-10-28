import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { words } from '@penduet/lessons'
import { WrongBurst } from './GuessBurst'
import { GuessCanvasOverlay, GuessPanel, type GuessControls } from './GuessPanel'
import { GuessStage, stageIsOpen } from './GuessStage'
import { knownWordIcons } from './wordIcons'

const CAT = words.findIndex((w) => w.word === 'cat')

const controls = (over: Partial<GuessControls> = {}): GuessControls => ({
  kind: 'guess',
  phase: 'draw',
  round: 1,
  interval: 0,
  intervals: 4,
  amDrawer: true,
  seat: 1,
  drawerSeat: 1,
  myName: 'Mara',
  peerName: 'Teo',
  hasPartner: true,
  word: words[CAT]!,
  deadline: Date.now() + 15_000,
  canDraw: true,
  drawUntil: null,
  last: null,
  result: null,
  score: 0,
  played: 0,
  won: 0,
  submit: () => undefined,
  ...over,
})

describe('word pictures', () => {
  it('has a picture for every word', () => {
    for (const w of words) expect(knownWordIcons, `${w.word} needs ${w.icon}`).toContain(w.icon)
  })
})

describe('draw and guess panel', () => {
  it('shows the drawer the word and what the partner tried', () => {
    render(<GuessPanel g={controls({ last: { text: 'dog', correct: false, at: 0 } })} />)
    expect(screen.getByTestId('secret-word')).toHaveTextContent('cat')
    expect(screen.getByText(/Teo tried “dog”/)).toBeInTheDocument()
  })

  it('tells the guesser who is drawing, and never shows the word', () => {
    render(<GuessPanel g={controls({ amDrawer: false, drawerSeat: 2, word: null, canDraw: false })} />)
    expect(screen.getByText(/Teo is drawing/)).toBeInTheDocument()
    expect(screen.queryByTestId('secret-word')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('leaves the answer box to the window, in the panel only says it is time', () => {
    render(<GuessPanel g={controls({ phase: 'answer', amDrawer: false, word: null, canDraw: false })} />)
    expect(screen.getByText(/Time to guess/)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('tells the drawer the partner is guessing', () => {
    render(<GuessPanel g={controls({ phase: 'answer', canDraw: false })} />)
    expect(screen.getByText('Teo is guessing…')).toBeInTheDocument()
  })

  it('shows the result to both, with the points', () => {
    render(<GuessPanel g={controls({ phase: 'result', amDrawer: false, canDraw: false, result: { won: true, interval: 1, points: 3 }, score: 3, played: 1, won: 1 })} />)
    expect(screen.getByTestId('secret-word')).toHaveTextContent('cat')
    expect(screen.getByText('Got it! +3 points')).toBeInTheDocument()
    expect(screen.getByText('Score 3. 1 of 1 rounds guessed.')).toBeInTheDocument()
  })

  it('says so when nobody guessed it', () => {
    render(<GuessPanel g={controls({ phase: 'result', result: { won: false, interval: null, points: 0 }, played: 1 })} />)
    expect(screen.getByText(/No luck this time/)).toBeInTheDocument()
  })

  it('waits for a partner', () => {
    render(<GuessPanel g={controls({ phase: 'waiting', hasPartner: false, word: null, deadline: null })} />)
    expect(screen.getByText(/Waiting for your partner/)).toBeInTheDocument()
  })

  it('counts down in seconds', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(0)
      render(<GuessPanel g={controls({ deadline: 14_200 })} />)
      expect(screen.getByText('Drawing 1 of 4 · 15s')).toBeInTheDocument()
      act(() => void vi.advanceTimersByTime(2000))
      expect(screen.getByText('Drawing 1 of 4 · 13s')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('has a button to turn the sound off and on', () => {
    render(<GuessPanel g={controls()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Turn sound off' }))
    expect(screen.getByRole('button', { name: 'Turn sound on' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Turn sound on' }))
  })
})

describe('over the canvas', () => {
  it('shows the countdown number while the round is about to start', () => {
    const { container } = render(<GuessCanvasOverlay wide g={controls({ phase: 'countdown', deadline: Date.now() + 3200 })} />)
    expect(container.textContent).toBe('4')
  })

  it('names who draws on the wheel', () => {
    const { container } = render(<GuessCanvasOverlay wide g={controls({ phase: 'roulette', deadline: Date.now() + 3000, drawerSeat: 2 })} />)
    expect(container.textContent).toContain('Teo draws!')
  })

  it('shows nothing while drawing after the start', () => {
    const drawing = render(<GuessCanvasOverlay wide g={controls({ interval: 2 })} />)
    expect(drawing.container.textContent).toBe('')
  })

  it('on a phone shows the drawer the word and the clock, the guesser only the clock', () => {
    const drawer = render(<GuessCanvasOverlay g={controls()} wide={false} />)
    expect(screen.getByText('cat')).toBeInTheDocument()
    expect(screen.getByText('Draw · 15s')).toBeInTheDocument()
    drawer.unmount()
    render(<GuessCanvasOverlay g={controls({ amDrawer: false, word: null, canDraw: false })} wide={false} />)
    expect(screen.queryByText('cat')).not.toBeInTheDocument()
    expect(screen.getByText('Draw · 15s')).toBeInTheDocument()
  })
})

describe('the window when the canvas locks', () => {
  const answering = (over: Partial<GuessControls> = {}) => controls({ phase: 'answer', amDrawer: false, word: null, canDraw: false, deadline: Date.now() + 12_000, ...over })

  it('opens only for an answer window and for the end of a round', () => {
    expect(stageIsOpen('answer')).toBe(true)
    expect(stageIsOpen('result')).toBe(true)
    for (const p of ['waiting', 'roulette', 'countdown', 'draw'] as const) expect(stageIsOpen(p)).toBe(false)
    const { container } = render(<GuessStage g={controls()} />)
    expect(container.textContent).toBe('')
  })

  it('asks the guesser for one answer, with the time left', () => {
    const submit = vi.fn()
    render(<GuessStage g={answering({ submit })} />)
    expect(screen.getByRole('dialog', { name: 'Guess the drawing!' })).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    const box = screen.getByLabelText('Your answer')
    const send = screen.getByRole('button', { name: 'Send' })
    expect(send).toBeDisabled() // nothing typed yet
    fireEvent.change(box, { target: { value: '  cat ' } })
    fireEvent.click(send)
    expect(submit).toHaveBeenCalledTimes(1)
    expect(submit).toHaveBeenCalledWith('cat')
    expect(box).toBeDisabled() // the one try is spent
    expect(screen.getByText('Sending your answer…')).toBeInTheDocument()
    fireEvent.submit(box.closest('form')!)
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('tells the drawer to wait for the other player, without an answer box', () => {
    render(<GuessStage g={controls({ phase: 'answer', canDraw: false, deadline: Date.now() + 12_000 })} />)
    expect(screen.getByRole('dialog', { name: 'Waiting for the other player’s answer' })).toBeInTheDocument()
    expect(screen.getByText(/Teo is looking at your drawing/)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('opens a fresh box for the next window', () => {
    const { rerender } = render(<GuessStage g={answering()} />)
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'dog' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.getByLabelText('Your answer')).toBeDisabled()
    rerender(<GuessStage g={answering({ interval: 1 })} />)
    expect(screen.getByLabelText('Your answer')).toBeEnabled()
    expect(screen.getByLabelText('Your answer')).toHaveValue('')
  })
})

describe('the end of a round', () => {
  const result = (over: Partial<GuessControls> = {}) =>
    controls({ phase: 'result', amDrawer: false, canDraw: false, deadline: Date.now() + 13_000, result: { won: true, interval: 1, points: 3 }, score: 3, played: 1, won: 1, ...over })

  it('drums first, then shows the word and the points', () => {
    vi.useFakeTimers()
    try {
      render(<GuessStage g={result()} />)
      const dialog = screen.getByTestId('guess-modal')
      expect(dialog).toHaveAttribute('data-stage', 'drum')
      expect(screen.getByText('…and the word was…')).toBeInTheDocument()
      expect(screen.queryByTestId('secret-word')).not.toBeInTheDocument()
      act(() => void vi.advanceTimersByTime(3000))
      expect(dialog).toHaveAttribute('data-stage', 'reveal')
      expect(screen.getByText('Correct!')).toBeInTheDocument()
      expect(screen.getByText('+3 points')).toBeInTheDocument()
      expect(screen.getByTestId('secret-word')).toHaveTextContent('cat')
      expect(screen.getByText('Guessed on try 2')).toBeInTheDocument()
      expect(document.querySelectorAll('.confetti').length).toBeGreaterThan(10)
    } finally {
      vi.useRealTimers()
    }
  })

  it('is kind when nobody guessed it, and throws no confetti', () => {
    vi.useFakeTimers()
    try {
      render(<GuessStage g={result({ result: { won: false, interval: null, points: 0 }, won: 0 })} />)
      act(() => void vi.advanceTimersByTime(3000))
      expect(screen.getByText('Nobody guessed it')).toBeInTheDocument()
      expect(screen.getByTestId('secret-word')).toHaveTextContent('cat')
      expect(document.querySelectorAll('.confetti')).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('a wrong answer', () => {
  const answerWindow = controls({ phase: 'answer', amDrawer: false, interval: 0 })
  const next = (over: Partial<GuessControls>) => controls({ phase: 'draw', amDrawer: false, interval: 1, ...over })

  it('shows the guesser what was not it', () => {
    const { rerender } = render(<WrongBurst g={answerWindow} />)
    expect(screen.queryByText('Not quite!')).not.toBeInTheDocument()
    rerender(<WrongBurst g={next({ last: { text: 'dog', correct: false, at: 0 } })} />)
    expect(screen.getByText('Not quite!')).toBeInTheDocument()
    expect(screen.getByText('It was not “dog”')).toBeInTheDocument()
  })

  it('tells the drawer what the partner said', () => {
    const { rerender } = render(<WrongBurst g={{ ...answerWindow, amDrawer: true }} />)
    rerender(<WrongBurst g={next({ amDrawer: true, last: { text: 'dog', correct: false, at: 0 } })} />)
    expect(screen.getByText('Teo said “dog”')).toBeInTheDocument()
    expect(screen.getByText('Add more details!')).toBeInTheDocument()
  })

  it('says the time is up when nobody answered the window', () => {
    const { rerender } = render(<WrongBurst g={answerWindow} />)
    rerender(<WrongBurst g={next({ last: null })} />)
    expect(screen.getByText('Time is up!')).toBeInTheDocument()
    expect(screen.getByText('You ran out of time to answer.')).toBeInTheDocument()
  })

  it('does not fire again for an old answer when a later window passes unanswered', () => {
    const old = { text: 'dog', correct: false, at: 0 }
    const { rerender } = render(<WrongBurst g={controls({ phase: 'answer', interval: 1, last: old })} />)
    rerender(<WrongBurst g={controls({ phase: 'draw', interval: 2, last: old })} />)
    expect(screen.queryByText('Not quite!')).not.toBeInTheDocument()
    expect(screen.getByText('Time is up!')).toBeInTheDocument()
  })

  it('goes away by itself', () => {
    vi.useFakeTimers()
    try {
      const { rerender } = render(<WrongBurst g={answerWindow} />)
      rerender(<WrongBurst g={next({ last: { text: 'dog', correct: false, at: 0 } })} />)
      expect(screen.getByText('Not quite!')).toBeInTheDocument()
      act(() => void vi.advanceTimersByTime(3000))
      expect(screen.queryByText('Not quite!')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
