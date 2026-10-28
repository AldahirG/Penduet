import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Star, Volume2, VolumeX } from 'lucide-react'
import { wordIn, type Word } from '@penduet/lessons'
import { useMediaQuery } from '../drawing/hooks'
import { useT } from '../i18n'
import { sfx, useMuted } from '../sound/sfx'
import { cn } from '../ui'
import { WrongBurst } from './GuessBurst'
import { seconds, usePhaseLength, useRemaining, useTickSound } from './guessHooks'
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
  last: { text: string; correct: boolean; at: number } | null
  result: { won: boolean; interval: number | null; points: number } | null
  score: number
  played: number
  won: number
  submit: (text: string) => void
}

/** The side column exists from this width up. Below it the panel sits under the canvas, so what you need while playing goes on the canvas. */
export const WIDE = '(min-width: 1024px)'

export function MuteButton({ className }: { className?: string }) {
  const { t } = useT()
  const [muted, setMuted] = useMuted()
  const Icon = muted ? VolumeX : Volume2
  return (
    <button
      type="button"
      aria-pressed={muted}
      aria-label={muted ? t('sound.unmute') : t('sound.mute')}
      title={muted ? t('sound.unmute') : t('sound.mute')}
      onClick={() => {
        setMuted(!muted)
        if (muted) window.setTimeout(() => sfx.chime(), 30)
      }}
      className={cn('inline-grid h-touch w-touch place-items-center rounded-pill text-muted transition hover:bg-surface hover:text-fg active:scale-90', className)}
    >
      <Icon aria-hidden="true" className="h-5 w-5" />
    </button>
  )
}

const categories: Record<Word['category'], [string, string]> = {
  Animals: ['Animals', 'Animales'],
  Food: ['Food', 'Comida'],
  Objects: ['Objects', 'Objetos'],
  Places: ['Places', 'Lugares'],
  Nature: ['Nature', 'Naturaleza'],
  Vehicles: ['Vehicles', 'Vehículos'],
  Characters: ['Characters', 'Personajes'],
  Activities: ['Activities', 'Actividades'],
  Ideas: ['Ideas', 'Ideas'],
}
export const categoryLabel = (c: Word['category'], lang: 'en' | 'es'): string => categories[c][lang === 'es' ? 1 : 0]

/** The reference picture and the word, for the drawer (and for both people at the end). */
export function WordCard({ word, tone = 'plain' }: { word: Word; tone?: 'plain' | 'won' | 'lost' }) {
  const { lang } = useT()
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
        <p className="text-xs font-bold uppercase tracking-wide text-muted">{categoryLabel(word.category, lang)}</p>
        <p data-testid="secret-word" className="truncate font-display text-2xl font-bold leading-tight">
          {wordIn(word, lang)}
        </p>
      </div>
    </div>
  )
}

/** The part of the panel whose content changes with the phase. */
function Main({ g }: { g: GuessControls }) {
  const { t, tn, lang } = useT()
  const wrong = g.last && !g.last.correct ? g.last.text : null
  const word = g.word ? wordIn(g.word, lang) : ''
  switch (g.phase) {
    case 'waiting':
      return (
        <p role="status" className="text-lg">
          {g.hasPartner ? t('guess.gettingReady') : t('guess.waitingPartner')}
        </p>
      )
    case 'roulette':
      return (
        <p role="status" className="text-lg">
          {t('guess.choosing')}
        </p>
      )
    case 'countdown':
      return g.amDrawer && g.word ? (
        <div className="flex flex-col gap-1">
          <WordCard word={g.word} />
          <p role="status" className="sr-only">
            {t('guess.youDrawSr', { word })}
          </p>
        </div>
      ) : (
        <p role="status" className="text-lg">
          {t('guess.peerDrawsGetReady', { name: g.peerName })}
        </p>
      )
    case 'draw':
      return g.amDrawer && g.word ? (
        <div className="flex flex-col gap-1">
          <WordCard word={g.word} />
          {wrong ? <p className="text-sm text-muted">{t('guess.peerTried', { name: g.peerName, text: wrong })}</p> : null}
          <p role="status" className="sr-only">
            {t('guess.drawSr', { word })} {wrong ? t('guess.peerTriedSr', { name: g.peerName, text: wrong }) : ''}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <p role="status" className="text-lg">
            {t('guess.peerDrawing', { name: g.peerName })}
          </p>
          {wrong ? <p className="text-sm text-muted">{t('guess.notThat', { text: wrong })}</p> : null}
        </div>
      )
    case 'answer':
      return (
        <p role="status" className="text-lg">
          {g.amDrawer ? t('guess.peerGuessing', { name: g.peerName }) : t('guess.timeToGuessPanel')}
        </p>
      )
    case 'result':
      return (
        <div className="flex flex-col gap-1">
          {g.word ? <WordCard word={g.word} tone={g.result?.won ? 'won' : 'lost'} /> : null}
          <p role="status" className={cn('text-sm font-bold', g.result?.won ? 'text-success' : 'text-muted')}>
            {g.result?.won ? tn('guess.gotIt', g.result.points) : t('guess.noLuck')}
          </p>
        </div>
      )
  }
}

/** Four bars, one per burst of drawing, and the time left in the current phase. */
function Timer({ g }: { g: GuessControls }) {
  const { t } = useT()
  const remaining = useRemaining(g.deadline)
  const total = usePhaseLength(`${g.phase}-${g.round}-${g.interval}`, remaining)
  useTickSound(remaining, g.phase === 'draw', 3)
  if (g.phase === 'waiting' || g.phase === 'roulette') return <div className="h-6" aria-hidden="true" />
  const label =
    g.phase === 'countdown'
      ? t('guess.timer.starting')
      : g.phase === 'draw'
        ? t('guess.timer.drawing', { n: g.interval + 1, total: g.intervals })
        : g.phase === 'answer'
          ? t('guess.timer.guessNow')
          : t('guess.timer.next')
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

export function GuessPanel({ g }: { g: GuessControls }) {
  const { t, tn } = useT()
  const heading =
    g.phase === 'waiting'
      ? t('guess.waiting')
      : g.phase === 'roulette' || g.phase === 'result'
        ? t('guess.round', { n: g.round })
        : g.amDrawer
          ? t('guess.roundYouDraw', { n: g.round })
          : t('guess.roundPeerDraws', { n: g.round, name: g.peerName })
  return (
    <div className="paper flex min-h-[11rem] flex-col gap-3 p-4" data-testid="guess-panel" data-phase={g.phase}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted">{t('guess.title')}</p>
          <h2 className="font-display text-lg font-bold leading-tight">{heading}</h2>
        </div>
        <div className="flex items-center gap-1">
          {g.played > 0 ? (
            <p className="flex items-center gap-1.5 rounded-pill border border-line bg-surface px-3 py-1 text-sm font-bold">
              <Star aria-hidden="true" className="h-4 w-4 fill-paint-yellow text-paint-yellow" />
              <span className="sr-only">{t('guess.scoreSr', { score: g.score, won: g.won, played: g.played })}</span>
              <span aria-hidden="true">
                {tn('guess.scoreShort', g.score)} · {g.won}/{g.played}
              </span>
            </p>
          ) : null}
          <MuteButton />
        </div>
      </div>
      <div className="min-h-[4.75rem]">
        <Main g={g} />
      </div>
      <Timer g={g} />
    </div>
  )
}

// ---- over the canvas -----------------------------------------------------------------

const SECTORS = 8

/** The wheel: eight slices in the two seat colours. It spins and stops on the seat the room already picked. */
function Wheel({ g, remaining }: { g: GuessControls; remaining: number }) {
  const { t } = useT()
  const [angle, setAngle] = useState(0)
  const [spinMs, setSpinMs] = useState(0)
  useEffect(() => {
    // Land the pointer (at the top) on the middle of a slice of the drawer's colour.
    const k = g.drawerSeat === 1 ? 2 : 3
    const target = 360 * 3 - (k * (360 / SECTORS) + 360 / SECTORS / 2)
    const ms = Math.max(300, remaining - 350)
    setSpinMs(ms)
    sfx.spin(ms)
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
      <p className="rise font-display text-xl font-bold text-ink" style={{ animationDelay: `${Math.max(0, remaining - 600)}ms` } as CSSProperties}>
        {t('guess.drawsBang', { name: drawerName })}
      </p>
    </div>
  )
}

/** The countdown numbers, with a beep for each. */
function Countdown({ remaining }: { remaining: number }) {
  const n = Math.max(1, seconds(remaining))
  const last = useRef(0)
  useEffect(() => {
    if (n !== last.current) sfx.beep(n === 1)
    last.current = n
  }, [n])
  return (
    <p key={n} className="pop-in font-display text-[9rem] font-extrabold leading-none text-ink sm:text-[11rem]">
      {n}
    </p>
  )
}

/** "Go!" flashes once at the start of the first burst. */
function GoFlash({ round }: { round: number }) {
  const { t } = useT()
  useEffect(() => {
    sfx.go()
  }, [round])
  return (
    <p key={round} className="start-flash font-display text-6xl font-extrabold text-ink sm:text-7xl">
      {t('guess.start')}
    </p>
  )
}

/** The cover over the canvas: the wheel, the countdown and the "Go!". */
function CanvasCover({ g }: { g: GuessControls }) {
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
    return (
      <div aria-hidden="true" className={cover} style={veil}>
        <Countdown remaining={remaining} />
      </div>
    )
  }
  if (g.phase === 'draw' && g.interval === 0 && remaining > total - 900) {
    return (
      <div aria-hidden="true" className={cn(cover, 'pointer-events-none')}>
        <GoFlash round={g.round} />
      </div>
    )
  }
  return null
}

/** Phone: the word and the clock ride on the canvas, so nothing important is below the fold. */
function PhoneHud({ g }: { g: GuessControls }) {
  const { t, lang } = useT()
  const remaining = useRemaining(g.deadline)
  const live = g.phase === 'countdown' || g.phase === 'draw'
  if (!live) return null
  const Icon = g.word ? wordIcon(g.word.icon) : null
  const clock = g.phase === 'draw' ? t('guess.hud.draw') : t('guess.hud.ready')
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
      {g.word && Icon ? (
        <p className="glass-raised flex min-w-0 items-center gap-2 rounded-pill border border-line py-1 pl-2 pr-3 text-sm font-bold shadow-card">
          <Icon className="h-5 w-5 shrink-0" />
          <span className="truncate">{wordIn(g.word, lang)}</span>
        </p>
      ) : (
        <span />
      )}
      <p className="glass-raised shrink-0 rounded-pill border border-line px-3 py-1 text-sm font-bold tabular-nums shadow-card">
        {clock} · {seconds(remaining)}s
      </p>
    </div>
  )
}

/** Sits on the canvas: the wheel, the countdown, the "Go!" and (on a phone) the word and the clock. */
export function GuessCanvasOverlay({ g, wide }: { g: GuessControls; wide?: boolean }) {
  const media = useMediaQuery(WIDE)
  return (
    <>
      <CanvasCover g={g} />
      <WrongBurst g={g} />
      {(wide ?? media) ? null : <PhoneHud g={g} />}
    </>
  )
}
