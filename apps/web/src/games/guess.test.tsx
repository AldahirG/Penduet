import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { words } from '@penduet/lessons'
import { GuessCanvasOverlay, GuessPanel, type GuessControls } from './GuessPanel'
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
  deadline: Date.now() + 5000,
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
    render(<GuessPanel wide g={controls({ last: { text: 'dog', correct: false } })} />)
    expect(screen.getByTestId('secret-word')).toHaveTextContent('cat')
    expect(screen.getByText(/Teo tried “dog”/)).toBeInTheDocument()
  })

  it('tells the guesser who is drawing, and never shows the word', () => {
    render(<GuessPanel wide g={controls({ amDrawer: false, drawerSeat: 2, word: null, canDraw: false })} />)
    expect(screen.getByText(/Teo is drawing/)).toBeInTheDocument()
    expect(screen.queryByTestId('secret-word')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('gives the guesser one try in an answer window', () => {
    const submit = vi.fn()
    render(<GuessPanel wide g={controls({ phase: 'answer', amDrawer: false, word: null, canDraw: false, submit })} />)
    const box = screen.getByLabelText('One try: what is it?')
    const send = screen.getByRole('button', { name: 'Guess' })
    expect(send).toBeDisabled() // nothing typed yet
    fireEvent.change(box, { target: { value: '  cat ' } })
    fireEvent.click(send)
    expect(submit).toHaveBeenCalledTimes(1)
    expect(submit).toHaveBeenCalledWith('cat')
    expect(box).toBeDisabled() // the one try is spent
    fireEvent.submit(box.closest('form')!)
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('does not offer the drawer an answer box', () => {
    render(<GuessPanel wide g={controls({ phase: 'answer', canDraw: false })} />)
    expect(screen.getByText('Teo is guessing…')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('shows the result to both, with the points', () => {
    render(<GuessPanel wide g={controls({ phase: 'result', amDrawer: false, canDraw: false, result: { won: true, interval: 1, points: 3 }, score: 3, played: 1, won: 1 })} />)
    expect(screen.getByTestId('secret-word')).toHaveTextContent('cat')
    expect(screen.getByText('Got it! +3 points')).toBeInTheDocument()
    expect(screen.getByText('Score 3. 1 of 1 rounds guessed.')).toBeInTheDocument()
  })

  it('says so when nobody guessed it', () => {
    render(<GuessPanel wide g={controls({ phase: 'result', result: { won: false, interval: null, points: 0 }, played: 1 })} />)
    expect(screen.getByText(/No luck this time/)).toBeInTheDocument()
  })

  it('waits for a partner', () => {
    render(<GuessPanel wide g={controls({ phase: 'waiting', hasPartner: false, word: null, deadline: null })} />)
    expect(screen.getByText(/Waiting for your partner/)).toBeInTheDocument()
  })

  it('counts down in seconds', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(0)
      render(<GuessPanel wide g={controls({ deadline: 4200 })} />)
      expect(screen.getByText('Drawing 1 of 4 · 5s')).toBeInTheDocument()
      act(() => void vi.advanceTimersByTime(2000))
      expect(screen.getByText('Drawing 1 of 4 · 3s')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
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

  it('says the canvas is locked while the answer is open, and shows nothing while drawing after the start', () => {
    const locked = render(<GuessCanvasOverlay wide g={controls({ phase: 'answer', canDraw: false })} />)
    expect(locked.container.textContent).toContain('Canvas locked')
    const drawing = render(<GuessCanvasOverlay wide g={controls({ interval: 2 })} />)
    expect(drawing.container.textContent).toBe('')
  })
})

describe('on a phone', () => {
  it('puts the answer box on the canvas for the guesser, and keeps it out of the panel', () => {
    const submit = vi.fn()
    const g = controls({ phase: 'answer', amDrawer: false, word: null, canDraw: false, submit })
    render(
      <>
        <GuessPanel g={g} wide={false} />
        <GuessCanvasOverlay g={g} wide={false} />
      </>,
    )
    const boxes = screen.getAllByLabelText('One try: what is it?')
    expect(boxes).toHaveLength(1)
    fireEvent.change(boxes[0]!, { target: { value: 'cat' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guess' }))
    expect(submit).toHaveBeenCalledWith('cat')
    expect(screen.getByText('Guess · 5s')).toBeInTheDocument()
  })

  it('shows the drawer the word and the clock on the canvas', () => {
    render(<GuessCanvasOverlay g={controls()} wide={false} />)
    expect(screen.getByText('cat')).toBeInTheDocument()
    expect(screen.getByText('Draw · 5s')).toBeInTheDocument()
  })

  it('shows the guesser the clock, but never the word', () => {
    render(<GuessCanvasOverlay g={controls({ amDrawer: false, word: null, canDraw: false })} wide={false} />)
    expect(screen.queryByText('cat')).not.toBeInTheDocument()
    expect(screen.getByText('Draw · 5s')).toBeInTheDocument()
  })
})
