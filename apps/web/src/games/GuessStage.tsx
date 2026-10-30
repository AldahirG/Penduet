import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { Clock, Hourglass, Pencil, Send, Sparkles, Star, Trophy } from 'lucide-react'
import { wordIn } from '@penduet/lessons'
import { useT } from '../i18n'
import { sfx, stopAll } from '../sound/sfx'
import { cn } from '../ui'
import { MuteButton, WordCard, type GuessControls } from './GuessPanel'
import { seconds, usePhaseLength, useRemaining, usePrefersReducedMotion, useTickSound } from './guessHooks'

type G = GuessControls

/** The room is on a moment that gets a window of its own: the canvas locked and an answer is due, or the round just ended. */
export const stageIsOpen = (phase: G['phase']): boolean => phase === 'answer' || phase === 'result'

/** A ring that empties as the time runs out, with the seconds inside. It turns red and pulses at the end. */
function Ring({ remaining, total, size = 72 }: { remaining: number; total: number; size?: number }) {
  const r = 30
  const c = 2 * Math.PI * r
  const left = Math.max(0, Math.min(1, remaining / total))
  const hot = seconds(remaining) <= 3
  return (
    <div className={cn('relative shrink-0', hot && 'ring-hot')} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--color-surface)" strokeWidth="7" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke={hot ? 'var(--color-danger)' : left < 0.5 ? 'var(--color-paint-yellow)' : 'var(--color-accent)'}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - left)}
          style={{ transition: 'stroke-dashoffset 100ms linear, stroke 200ms' }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-2xl font-extrabold tabular-nums">{seconds(remaining)}</span>
    </div>
  )
}

/**
 * Where the window sits: under the app bar on a phone (above the canvas), and beside the canvas on a laptop, where the two are
 * centred on the screen as a pair (useCentredPair sets --stage-left and --stage-top; the fallback is the right edge).
 */
const place =
  'pointer-events-none fixed inset-x-3 top-[3.75rem] z-[60] mx-auto max-w-md lg:inset-x-auto lg:left-[var(--stage-left,calc(100vw_-_25.5rem))] lg:top-[var(--stage-top,50%)] lg:-translate-y-1/2 lg:mx-0 lg:w-[24rem]'

const CARD_REM = 24
const PAIR_GAP = 24

/**
 * On a laptop, while a window is open the board slides sideways until the board and the window, side by side, are centred on the
 * screen. The board itself is moved with a transform (--stage-dx), so nothing else on the page changes size.
 */
function useCentredPair(open: boolean) {
  useLayoutEffect(() => {
    if (!open) return
    const root = document.documentElement
    const board = document.querySelector<HTMLElement>('[data-stage-board]')
    const laptop = window.matchMedia?.('(min-width: 1024px)')
    const names = ['--stage-dx', '--stage-left', '--stage-top']
    const clear = () => names.forEach((n) => root.style.removeProperty(n))
    const centre = () => {
      if (!board || !laptop?.matches) return clear()
      const rem = parseFloat(getComputedStyle(root).fontSize) || 16
      const card = CARD_REM * rem
      // Where the board is now includes however far it has already slid, so take that off to find where the page puts it.
      const shifted = new DOMMatrixReadOnly(getComputedStyle(board).transform).m41
      const r = board.getBoundingClientRect()
      const width = root.clientWidth
      const target = Math.max(8, (width - (r.width + PAIR_GAP + card)) / 2)
      root.style.setProperty('--stage-dx', `${Math.round(target - (r.left - shifted))}px`)
      root.style.setProperty('--stage-left', `${Math.round(Math.min(target + r.width + PAIR_GAP, width - card - 8))}px`)
      root.style.setProperty('--stage-top', `${Math.round(r.top + r.height / 2)}px`)
    }
    centre()
    window.addEventListener('resize', centre)
    window.addEventListener('scroll', centre, { passive: true })
    return () => {
      window.removeEventListener('resize', centre)
      window.removeEventListener('scroll', centre)
      clear()
    }
  }, [open])
}

function AnswerStage({ g }: { g: G }) {
  const { t } = useT()
  const remaining = useRemaining(g.deadline)
  const total = usePhaseLength(`answer-${g.round}-${g.interval}`, remaining)
  useTickSound(remaining, true, 5)

  return (
    <div className={place}>
      <div
        role="dialog"
        aria-labelledby="stage-title"
        data-testid="guess-modal"
        data-kind={g.amDrawer ? 'waiting' : 'answer'}
        className="stage-card pointer-events-auto relative overflow-hidden rounded-xl border border-line bg-raised p-3.5 shadow-pop sm:p-4"
      >
        <span aria-hidden="true" className={cn('absolute inset-x-0 top-0 h-1.5', g.amDrawer ? 'bg-paint-yellow' : 'bg-accent')} />
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-bold text-muted">
            {g.amDrawer ? <Hourglass aria-hidden="true" className="spin-flip h-4 w-4" /> : <Pencil aria-hidden="true" className="wiggle h-4 w-4" />}
            {t('guess.title')}
          </p>
          <MuteButton className="-mr-2 -mt-2" />
        </div>
        <h2 id="stage-title" className="font-display text-2xl font-extrabold leading-tight">
          {g.amDrawer ? t('guess.modal.waitTitle') : t('guess.modal.guessTitle')}
        </h2>
        {g.amDrawer ? (
          <div className="mt-3 flex items-center gap-3" aria-live="polite">
            <Ring remaining={remaining} total={total} />
            <div className="flex min-w-0 flex-col gap-1.5">
              <p className="text-base">{t('guess.modal.waitText', { name: g.peerName })}</p>
              <p className="flex items-center gap-2 text-sm text-muted">
                <span aria-hidden="true" className="inline-flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="dot-bounce h-2 w-2 rounded-pill bg-fg" style={{ ['--i' as string]: i } as CSSProperties} />
                  ))}
                </span>
                {t('guess.modal.canvasLocked')}
              </p>
              <p role="status" className="sr-only">
                {t('guess.modal.secondsLeft', { n: seconds(remaining) })}
              </p>
            </div>
          </div>
        ) : (
          <AnswerForm g={g} remaining={remaining} total={total} />
        )}
      </div>
    </div>
  )
}

function AnswerForm({ g, remaining, total }: { g: G; remaining: number; total: number }) {
  const { t } = useT()
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)
  useEffect(() => {
    // A new window is a new try: clear the box, and put the cursor in it.
    setText('')
    setSent(false)
    input.current?.focus({ preventScroll: true })
  }, [g.round, g.interval])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = text.trim()
    if (!v || sent) return
    setSent(true)
    sfx.chime()
    g.submit(v)
  }
  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Ring remaining={remaining} total={total} />
        <label htmlFor={id} className="text-base font-semibold">
          {t('guess.modal.guessHint')}
        </label>
      </div>
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
          aria-label={t('guess.modal.label')}
          className="min-h-touch min-w-0 flex-1 rounded-md border-2 border-input bg-bg px-3 text-lg font-semibold text-fg focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={sent || text.trim() === ''}
          className="inline-flex min-h-touch items-center gap-2 rounded-pill bg-accent px-5 font-bold text-on-accent shadow-card transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Send aria-hidden="true" className="h-4 w-4" />
          {t('guess.modal.send')}
        </button>
      </div>
      <p role="status" className="min-h-5 text-sm font-semibold text-muted">
        {sent ? t('guess.modal.sending') : ''}
      </p>
    </form>
  )
}

// ---- the end of a round ----------------------------------------------------------------

const confettiColours = ['--color-paint-red', '--color-paint-yellow', '--color-paint-green', '--color-paint-pink', '--color-accent', '--color-player-2']

/** Paper confetti raining over the screen. Seeded by the round, so every render draws the same pieces. */
function Confetti({ seed, count = 44 }: { seed: number; count?: number }) {
  const pieces = useMemo(() => {
    let s = seed * 9301 + 49297
    const rand = () => {
      s = (s * 9301 + 49297) % 233280
      return s / 233280
    }
    return Array.from({ length: count }, (_, i) => ({
      left: rand() * 100,
      delay: rand() * 0.9,
      dur: 2.2 + rand() * 1.8,
      drift: (rand() - 0.5) * 160,
      spin: 360 + rand() * 540,
      w: 7 + rand() * 7,
      h: 10 + rand() * 10,
      colour: confettiColours[i % confettiColours.length]!,
    }))
  }, [seed, count])
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti absolute top-0 block rounded-[2px]"
          style={
            {
              left: `${p.left}%`,
              width: p.w,
              height: p.h,
              background: `var(${p.colour})`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
              ['--drift' as string]: `${p.drift}px`,
              ['--spin' as string]: `${p.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

/** Two sticks on a drum, for the moment before the word is shown. */
function Drum() {
  return (
    <div aria-hidden="true" className="relative mx-auto h-28 w-40">
      <span className="drum-ring absolute left-1/2 top-[58%] h-16 w-28 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-4 border-paint-yellow" />
      <svg viewBox="0 0 160 112" className="absolute inset-0 h-full w-full">
        <ellipse cx="80" cy="58" rx="52" ry="18" fill="var(--color-canvas)" stroke="var(--color-ink)" strokeWidth="4" />
        <path d="M28 58 V88 C28 100 132 100 132 88 V58" fill="var(--color-player-1)" stroke="var(--color-ink)" strokeWidth="4" />
        <path d="M44 66 L58 96 M72 70 L80 100 M100 70 L102 100 M118 66 L108 96" stroke="var(--color-canvas)" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
        <g className="stick stick-l" style={{ transformOrigin: '30px 14px' }}>
          <line x1="30" y1="14" x2="66" y2="52" stroke="var(--color-ink)" strokeWidth="6" strokeLinecap="round" />
          <circle cx="30" cy="14" r="5" fill="var(--color-paint-yellow)" stroke="var(--color-ink)" strokeWidth="3" />
        </g>
        <g className="stick stick-r" style={{ transformOrigin: '130px 14px' }}>
          <line x1="130" y1="14" x2="94" y2="52" stroke="var(--color-ink)" strokeWidth="6" strokeLinecap="round" />
          <circle cx="130" cy="14" r="5" fill="var(--color-paint-yellow)" stroke="var(--color-ink)" strokeWidth="3" />
        </g>
      </svg>
    </div>
  )
}

function ResultStage({ g }: { g: G }) {
  const { t, tn, lang } = useT()
  const reduced = usePrefersReducedMotion()
  const remaining = useRemaining(g.deadline)
  const total = usePhaseLength(`result-${g.round}`, remaining)
  const won = g.result?.won === true
  // The drums last about a quarter of the result, never long enough to be annoying, never so short they are missed.
  const drumMs = Math.round(Math.min(2800, Math.max(700, total * 0.24)))
  const [stage, setStage] = useState<'drum' | 'reveal'>('drum')

  useEffect(() => {
    setStage('drum')
    sfx.drumroll(drumMs)
    const id = window.setTimeout(() => {
      setStage('reveal')
      if (won) sfx.celebrate()
      else sfx.sad()
    }, drumMs)
    return () => {
      window.clearTimeout(id)
      stopAll()
    }
    // once per round
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.round])

  const word = g.word ? wordIn(g.word, lang) : ''
  const nextIn = seconds(remaining)

  return (
    <>
      {stage === 'reveal' && won && !reduced ? <Confetti seed={g.round} /> : null}
      <div className={place}>
        <div
          role="dialog"
          aria-labelledby="stage-title"
          data-testid="guess-modal"
          data-kind="result"
          data-stage={stage}
          className="stage-card pointer-events-auto relative overflow-hidden rounded-xl border border-line bg-raised p-5 text-center shadow-pop"
        >
          <span aria-hidden="true" className={cn('absolute inset-x-0 top-0 h-1.5', stage === 'drum' ? 'bg-paint-yellow' : won ? 'bg-success' : 'bg-muted')} />
          <div className="absolute right-1 top-1">
            <MuteButton />
          </div>
          {stage === 'drum' ? (
            <div className="flex flex-col items-center gap-2 pt-2">
              <Drum />
              <h2 id="stage-title" className="font-display text-2xl font-extrabold leading-tight">
                {t('guess.result.drum')}
              </h2>
              <p role="status" className="sr-only">
                {t('guess.result.drumSr')}
              </p>
              <span aria-hidden="true" className="inline-flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="dot-bounce h-2.5 w-2.5 rounded-pill bg-fg" style={{ ['--i' as string]: i } as CSSProperties} />
                ))}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 pt-1">
              {g.word ? <RevealWord g={g} won={won} word={word} /> : null}
              <h2 id="stage-title" className={cn('zoom-bounce font-display text-3xl font-extrabold leading-tight', won ? 'text-success' : 'text-fg')}>
                {won ? t('guess.result.won') : t('guess.result.lost')}
              </h2>
              <p role="status" className="text-base font-semibold">
                {won ? tn('guess.result.points', g.result?.points ?? 0) : t('guess.result.lostText')}
              </p>
              {won ? (
                <p className="flex items-center gap-1.5 text-sm text-muted">
                  <span aria-hidden="true" className="flex">
                    {[1, 2, 3, 4].map((i) => (
                      <Star key={i} style={{ ['--i' as string]: i - 1 } as CSSProperties} className={cn('h-5 w-5', i <= (g.result?.points ?? 0) ? 'star-pop fill-paint-yellow text-paint-yellow' : 'text-input')} />
                    ))}
                  </span>
                  {t('guess.result.guessedOn', { n: (g.result?.interval ?? 0) + 1 })}
                </p>
              ) : null}
              <p className="mt-1 flex items-center gap-2 rounded-pill bg-surface px-3 py-1 text-sm font-bold">
                <Trophy aria-hidden="true" className="h-4 w-4 text-paint-yellow" />
                {t('guess.result.score')}: {g.score} · {t('guess.result.rounds', { won: g.won, played: g.played })}
              </p>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-muted">
                <Clock aria-hidden="true" className="h-4 w-4" />
                {t('guess.result.next', { n: nextIn })}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function RevealWord({ g, won, word }: { g: G; won: boolean; word: string }) {
  return (
    <div className={cn('zoom-bounce flex flex-col items-center gap-1', !won && 'opacity-95')}>
      <div className="flex items-center gap-2">
        {won ? <Sparkles aria-hidden="true" className="h-6 w-6 text-paint-yellow" /> : null}
        <WordCard word={g.word!} tone={won ? 'won' : 'lost'} />
      </div>
      <span className="sr-only">{word}</span>
    </div>
  )
}

/** The glass behind the windows, and the windows: the answer (or the wait for it) and the end of a round. */
export function GuessStage({ g }: { g: G }) {
  const open = stageIsOpen(g.phase)
  useCentredPair(open)

  // The first sound after a click lets the browser start audio; and on a phone the window sits above the canvas, so be at the top.
  useEffect(() => {
    if (!open) return
    sfx.unlock()
    if (g.phase === 'answer') {
      sfx.lock()
      if (window.matchMedia?.('(max-width: 1023px)').matches) window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [open, g.phase, g.round, g.interval])

  if (!open) return null
  return (
    <>
      <div aria-hidden="true" className="stage-backdrop fixed inset-0 z-50" />
      {g.phase === 'answer' ? <AnswerStage g={g} key={`a-${g.round}-${g.interval}`} /> : <ResultStage g={g} key={`r-${g.round}`} />}
    </>
  )
}
