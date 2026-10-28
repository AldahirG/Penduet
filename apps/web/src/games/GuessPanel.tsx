import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { Lock, Star } from 'lucide-react'
import type { Word } from '@penduet/lessons'
import { useMediaQuery } from '../drawing/hooks'
import { Button, cn } from '../ui'
import { wordIcon } from './wordIcons'

/** What a room made for draw and guess needs from the page. The room runs the clock and judges answers; this only shows them. */
export interface GuessControls {
  kind: 'guess'
  phase: 'waiting' | 'roulette' | 'countdown' | 'draw' | 'answer' | 'result'
  round: number
  /** Which burst of drawing the round is in (0 to intervals - 1). */
  interval: number
  intervals: number
  /** You draw this round. */
  amDrawer: boolean
  /** Your seat and the other one, for the wheel. */
  seat: 1 | 2
  drawerSeat: 1 | 2 | null
  /** Your name and your partner's. */
  myName: string
  peerName: string
  /** Someone is in the other seat. */
  hasPartner: boolean
  /** The word: for the drawer once the wheel has stopped, and for both at the end. */
  word: Word | null
  /** When the phase ends, on this device's clock (ms since the epoch). Null while waiting. */
  deadline: number | null
  /** The canvas is open for you. */
  canDraw: boolean
  /**
   * When to stop taking strokes, on this device's clock: a little before the room closes the canvas, so the last points of a stroke
   * get there in time and both screens show the same drawing.
   */
  drawUntil: number | null
  /** The latest answer of this round. */
  last: { text: string; correct: boolean } | null
  result: { won: boolean; interval: number | null; points: number } | null
  score: number
  played: number
  won: number
  submit: (text: string) => void
}

/** Milliseconds left until `deadline`, refreshed ten times a second while there is one. */
function useRemaining(deadline: number | null): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (deadline === null) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(id)
  }, [deadline])
  return deadline === null ? 0 : Math.max(0, deadline - now)
}

/** How long the current phase lasts, learned from the first time it is seen (the room may be running at any pace). */
function usePhaseLength(key: string, remaining: number): number {
  const seen = useRef({ key: '', total: 1 })
  if (seen.current.key !== key) seen.current = { key, total: Math.max(1, remaining) }
  return seen.current.total
}

const seconds = (ms: number) => Math.ceil(ms / 1000)

/** The reference picture and the word, for the drawer (and for both people at the end). */
function WordCard({ word, tone = 'plain' }: { word: Word; tone?: 'plain' | 'won' | 'lost' }) {
  const Icon = wordIcon(word.icon)
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className={cn(
          'pop-in grid h-16 w-16 shrink-0 place-items-center rounded-md border border-line bg-canvas text-ink shadow-card',
          tone === 'won' && 'ring-2 ring-success',
        )}
      >
        <Icon className="h-10 w-10" strokeWidth={1.5} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">{word.category}</p>
        <p data-testid="secret-word" className="truncate font-display text-2xl font-bold leading-tight">
          {word.word}
        </p>
      </div>
    </div>
  )
}

/** The side column exists from this width up. Below it the panel sits under the canvas, so what you need while playing goes on the canvas. */
const WIDE = '(min-width: 1024px)'

function AnswerForm({ g, overlay = false }: { g: GuessControls; overlay?: boolean }) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)
  // A new window is a new try: clear the box, and put the cursor in it.
  useEffect(() => {
    setText('')
    setSent(false)
    input.current?.focus({ preventScroll: true })
  }, [g.round, g.interval])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const t = text.trim()
    if (!t || sent) return
    setSent(true)
    g.submit(t)
  }
  return (
    <form onSubmit={submit} className={cn('flex flex-col gap-1', overlay && 'glass-raised pointer-events-auto rounded-xl border border-line p-3 shadow-pop')}>
      <label htmlFor={id} className="text-sm font-semibold">
        One try: what is it?
      </label>
      <div className="flex gap-2">
        <input
          ref={input}
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={40}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          disabled={sent}
          className="min-h-touch min-w-0 flex-1 rounded-md border border-input bg-bg px-3 text-base text-fg disabled:cursor-not-allowed disabled:opacity-45"
        />
        <Button type="submit" disabled={sent || text.trim() === ''}>
          Guess
        </Button>
      </div>
    </form>
  )
}

/** The part of the panel whose content changes with the phase. It keeps one height, so the canvas never moves. */
function Main({ g, wide }: { g: GuessControls; wide: boolean }) {
  const wrong = g.last && !g.last.correct ? g.last.text : null
  switch (g.phase) {
    case 'waiting':
      return (
        <p role="status" className="text-lg">
          {g.hasPartner ? 'Getting the round ready…' : 'Waiting for your partner. The game starts when you are both here.'}
        </p>
      )
    case 'roulette':
      return (
        <p role="status" className="text-lg">
          Choosing who draws…
        </p>
      )
    case 'countdown':
      return g.amDrawer && g.word ? (
        <div className="flex flex-col gap-1">
          <WordCard word={g.word} />
          <p role="status" className="sr-only">
            You draw this round. Your word is {g.word.word}.
          </p>
        </div>
      ) : (
        <p role="status" className="text-lg">
          {g.peerName} draws this round. Get ready to guess.
        </p>
      )
    case 'draw':
      return g.amDrawer && g.word ? (
        <div className="flex flex-col gap-1">
          <WordCard word={g.word} />
          {wrong ? <p className="text-sm text-muted">{g.peerName} tried “{wrong}”. Add more detail.</p> : null}
          <p role="status" className="sr-only">
            Draw {g.word.word}. {wrong ? `${g.peerName} tried ${wrong}.` : ''}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <p role="status" className="text-lg">
            {g.peerName} is drawing. Watch closely.
          </p>
          {wrong ? <p className="text-sm text-muted">Not “{wrong}”.</p> : null}
        </div>
      )
    case 'answer':
      return g.amDrawer ? (
        <p role="status" className="text-lg">
          {g.peerName} is guessing…
        </p>
      ) : wide ? (
        <AnswerForm g={g} />
      ) : (
        <p role="status" className="text-lg">
          Time to guess. Type it in the box on the canvas.
        </p>
      )
    case 'result':
      return (
        <div className="flex flex-col gap-1">
          {g.word ? <WordCard word={g.word} tone={g.result?.won ? 'won' : 'lost'} /> : null}
          <p role="status" className={cn('text-sm font-bold', g.result?.won ? 'text-success' : 'text-muted')}>
            {g.result?.won
              ? `Got it! +${g.result.points} ${g.result.points === 1 ? 'point' : 'points'}`
              : 'No luck this time. The word was above.'}
          </p>
        </div>
      )
  }
}

/** Four bars, one per burst of drawing, and the time left in the current phase. */
function Timer({ g }: { g: GuessControls }) {
  const remaining = useRemaining(g.deadline)
  const total = usePhaseLength(`${g.phase}-${g.round}-${g.interval}`, remaining)
  if (g.phase === 'waiting' || g.phase === 'roulette') return <div className="h-6" aria-hidden="true" />
  const label =
    g.phase === 'countdown'
      ? 'Starting'
      : g.phase === 'draw'
        ? `Drawing ${g.interval + 1} of ${g.intervals}`
        : g.phase === 'answer'
          ? 'Guess now'
          : 'Next round'
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 gap-1.5" aria-hidden="true">
        {Array.from({ length: g.intervals }, (_, i) => {
          const done = g.phase === 'result' || (g.phase !== 'countdown' && i < g.interval)
          const current = i === g.interval && (g.phase === 'draw' || g.phase === 'answer')
          return (
            <span key={i} className="h-2.5 flex-1 overflow-hidden rounded-pill bg-surface ring-1 ring-inset ring-[color:var(--color-border)]">
              <span
                className={cn('block h-full origin-left rounded-pill transition-transform duration-100 ease-linear', current && g.phase === 'answer' ? 'bg-paint-yellow' : 'bg-accent')}
                style={{ transform: `scaleX(${done ? 1 : current ? remaining / total : 0})` }}
              />
            </span>
          )
        })}
      </div>
      <p className="shrink-0 whitespace-nowrap text-right text-sm font-bold tabular-nums text-muted">
        {label}
        {g.deadline !== null ? ` · ${seconds(remaining)}s` : ''}
      </p>
    </div>
  )
}

export function GuessPanel({ g, wide }: { g: GuessControls; wide?: boolean }) {
  const media = useMediaQuery(WIDE)
  return (
    <div className="paper flex min-h-[11rem] flex-col gap-3 p-4" data-testid="guess-panel" data-phase={g.phase}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted">Draw and guess</p>
          <h2 className="font-display text-lg font-bold leading-tight">
            {g.phase === 'waiting' ? 'Waiting' : `Round ${g.round}`}
            {g.phase !== 'waiting' && g.phase !== 'roulette' && g.phase !== 'result' ? (g.amDrawer ? ': you draw' : `: ${g.peerName} draws`) : ''}
          </h2>
        </div>
        {g.played > 0 ? (
          <p className="flex items-center gap-1.5 rounded-pill border border-line bg-surface px-3 py-1 text-sm font-bold">
            <Star aria-hidden="true" className="h-4 w-4 fill-paint-yellow text-paint-yellow" />
            <span className="sr-only">{`Score ${g.score}. ${g.won} of ${g.played} rounds guessed.`}</span>
            <span aria-hidden="true">
              {g.score} {g.score === 1 ? 'pt' : 'pts'} · {g.won}/{g.played}
            </span>
          </p>
        ) : null}
      </div>
      <div className="min-h-[4.75rem]">
        <Main g={g} wide={wide ?? media} />
      </div>
      <Timer g={g} />
    </div>
  )
}

// ---- over the canvas -----------------------------------------------------------------

const SECTORS = 8

/** The wheel: eight slices in the two seat colours. It spins and stops on the seat the room already picked. */
function Wheel({ g, remaining }: { g: GuessControls; remaining: number }) {
  const [angle, setAngle] = useState(0)
  const [spinMs, setSpinMs] = useState(0)
  useEffect(() => {
    // Land the pointer (at the top) on the middle of a slice of the drawer's colour.
    const k = g.drawerSeat === 1 ? 2 : 3
    const target = 360 * 3 - (k * (360 / SECTORS) + 360 / SECTORS / 2)
    const ms = Math.max(300, remaining - 350)
    setSpinMs(ms)
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setAngle(target)))
    return () => cancelAnimationFrame(frame)
    // once per round: the wheel is for show and the room has already decided
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.round, g.drawerSeat])

  const slice = (i: number) => {
    const a0 = ((i * 360) / SECTORS - 90) * (Math.PI / 180)
    const a1 = (((i + 1) * 360) / SECTORS - 90) * (Math.PI / 180)
    const [x0, y0, x1, y1] = [100 + 92 * Math.cos(a0), 100 + 92 * Math.sin(a0), 100 + 92 * Math.cos(a1), 100 + 92 * Math.sin(a1)]
    return `M100 100 L${x0.toFixed(2)} ${y0.toFixed(2)} A92 92 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`
  }
  const drawerName = g.drawerSeat === g.seat ? g.myName : g.peerName
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-44 w-44 sm:h-52 sm:w-52">
        {/* the pointer */}
        <svg viewBox="0 0 24 24" aria-hidden="true" className="absolute -top-3 left-1/2 z-10 h-7 w-7 -translate-x-1/2 text-ink drop-shadow">
          <path d="M12 22 L3 4 H21 Z" fill="currentColor" />
        </svg>
        <svg
          viewBox="0 0 200 200"
          aria-hidden="true"
          className="h-full w-full"
          style={{ transform: `rotate(${angle}deg)`, transition: `transform ${spinMs}ms cubic-bezier(0.17, 0.67, 0.21, 1)` }}
        >
          {Array.from({ length: SECTORS }, (_, i) => (
            <path key={i} d={slice(i)} fill={i % 2 === 0 ? 'var(--color-player-1)' : 'var(--color-player-2)'} stroke="var(--color-canvas)" strokeWidth="3" />
          ))}
          <circle cx="100" cy="100" r="14" fill="var(--color-canvas)" stroke="var(--color-ink)" strokeWidth="3" />
        </svg>
      </div>
      <p
        className="rise font-display text-xl font-bold text-ink"
        style={{ animationDelay: `${Math.max(0, remaining - 600)}ms` } as CSSProperties}
      >
        {drawerName} draws!
      </p>
    </div>
  )
}

/** Sits on the canvas: the wheel, the countdown, the "Start!" and the "canvas locked" badge. Decorative: the panel says it all in words. */
function CanvasCover({ g, wide: isWide }: { g: GuessControls; wide: boolean }) {
  const remaining = useRemaining(g.deadline)
  const total = usePhaseLength(`${g.phase}-${g.round}-${g.interval}`, remaining)
  const cover = 'absolute inset-0 grid place-items-center rounded-lg'
  const veil = { background: 'color-mix(in srgb, var(--color-canvas) 86%, transparent)' }

  if (g.phase === 'roulette') {
    return (
      <div aria-hidden="true" className={cover} style={veil}>
        <Wheel g={g} remaining={remaining} />
      </div>
    )
  }
  if (g.phase === 'countdown') {
    const n = Math.max(1, seconds(remaining))
    return (
      <div aria-hidden="true" className={cover} style={veil}>
        <p key={n} className="pop-in font-display text-[9rem] font-extrabold leading-none text-ink sm:text-[11rem]">
          {n}
        </p>
      </div>
    )
  }
  if (g.phase === 'draw' && g.interval === 0 && remaining > total - 900) {
    return (
      <div aria-hidden="true" className={cn(cover, 'pointer-events-none')}>
        <p key={g.round} className="start-flash font-display text-6xl font-extrabold text-ink sm:text-7xl">
          Start!
        </p>
      </div>
    )
  }
  if (g.phase === 'answer' && !isWide) return null // the badges and the answer box below take its place
  if (g.phase === 'answer') {
    return (
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
        <p className="rise glass-raised flex items-center gap-2 rounded-pill border border-line px-4 py-1.5 text-sm font-bold shadow-card">
          <Lock className="h-4 w-4" />
          {g.amDrawer ? 'Canvas locked. Waiting for the answer' : 'Time to guess'}
        </p>
      </div>
    )
  }
  return null
}

/** Phone: the word, the clock and (for the guesser) the answer box ride on the canvas, so nothing important is below the fold. */
function PhoneHud({ g }: { g: GuessControls }) {
  const remaining = useRemaining(g.deadline)
  const live = g.phase === 'countdown' || g.phase === 'draw' || g.phase === 'answer' || g.phase === 'result'
  if (!live) return null
  const Icon = g.word ? wordIcon(g.word.icon) : null
  const clock = g.phase === 'draw' ? 'Draw' : g.phase === 'answer' ? 'Guess' : g.phase === 'countdown' ? 'Ready' : 'Next'
  return (
    <>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
        {g.word && Icon ? (
          <p className="glass-raised flex min-w-0 items-center gap-2 rounded-pill border border-line py-1 pl-2 pr-3 text-sm font-bold shadow-card">
            <Icon className="h-5 w-5 shrink-0" />
            <span className="truncate">{g.word.word}</span>
          </p>
        ) : (
          <span />
        )}
        <p className="glass-raised shrink-0 rounded-pill border border-line px-3 py-1 text-sm font-bold tabular-nums shadow-card">
          {clock} · {seconds(remaining)}s
        </p>
      </div>
      {g.phase === 'answer' && !g.amDrawer ? (
        <div className="absolute inset-x-3 bottom-3">
          <AnswerForm g={g} overlay />
        </div>
      ) : null}
    </>
  )
}

/** Sits on the canvas: the wheel, the countdown, the "Start!" and the "canvas locked" badge, plus the phone's HUD. */
export function GuessCanvasOverlay({ g, wide }: { g: GuessControls; wide?: boolean }) {
  const media = useMediaQuery(WIDE)
  const isWide = wide ?? media
  return (
    <>
      <CanvasCover g={g} wide={isWide} />
      {isWide ? null : <PhoneHud g={g} />}
    </>
  )
}
