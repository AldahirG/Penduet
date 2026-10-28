import { useEffect, useRef, useState } from 'react'
import { Hourglass, X } from 'lucide-react'
import { useT } from '../i18n'
import { sfx } from '../sound/sfx'
import { cn } from '../ui'
import type { GuessControls } from './GuessPanel'

interface Burst {
  kind: 'wrong' | 'timeout'
  text: string
  key: number
}

const SHOWN_MS = 2400

/**
 * A short, loud "not that" over the canvas, for both people, when an answer window ends without a right answer and the
 * drawing goes on: a wrong answer (shows what was tried) or a window nobody used. It does not block drawing.
 */
export function WrongBurst({ g }: { g: Pick<GuessControls, 'round' | 'interval' | 'phase' | 'last' | 'amDrawer' | 'peerName'> }) {
  const { t } = useT()
  const [burst, setBurst] = useState<Burst | null>(null)
  const prev = useRef({ round: g.round, interval: g.interval, phase: g.phase })
  const counter = useRef(0)

  useEffect(() => {
    const p = prev.current
    prev.current = { round: g.round, interval: g.interval, phase: g.phase }
    // The answer window of the last burst just closed and the next burst of drawing began.
    if (g.round !== p.round || p.phase !== 'answer' || g.phase !== 'draw' || g.interval !== p.interval + 1) return
    const answered = g.last !== null && !g.last.correct && g.last.at === p.interval
    counter.current += 1
    setBurst({ kind: answered ? 'wrong' : 'timeout', text: answered ? g.last!.text : '', key: counter.current })
    if (answered) sfx.wrong()
    else sfx.lock()
    const id = window.setTimeout(() => setBurst(null), SHOWN_MS)
    return () => window.clearTimeout(id)
  }, [g.round, g.interval, g.phase, g.last, g.amDrawer])

  if (!burst) return null
  const wrong = burst.kind === 'wrong'
  const Icon = wrong ? X : Hourglass
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center px-4">
      <div key={burst.key} className={cn('burst-in flex max-w-[18rem] flex-col items-center gap-2 rounded-xl border bg-raised px-6 py-5 text-center shadow-pop', wrong ? 'border-danger' : 'border-line')}>
        <span className={cn('shake grid h-16 w-16 place-items-center rounded-pill text-white', wrong ? 'bg-danger' : 'bg-muted')}>
          <Icon className="h-9 w-9" strokeWidth={3} />
        </span>
        <p className="font-display text-2xl font-extrabold leading-tight">{wrong ? t('guess.wrong.title') : t('guess.timeUp')}</p>
        <p className="text-base font-semibold">
          {wrong
            ? g.amDrawer
              ? t('guess.wrong.peer', { name: g.peerName, text: burst.text })
              : t('guess.wrong.you', { text: burst.text })
            : g.amDrawer
              ? t('guess.timeUp.peer', { name: g.peerName })
              : t('guess.timeUp.you')}
        </p>
        <p className="text-sm text-muted">{wrong ? (g.amDrawer ? t('guess.wrong.peerHint') : t('guess.wrong.youHint')) : ''}</p>
      </div>
    </div>
  )
}
