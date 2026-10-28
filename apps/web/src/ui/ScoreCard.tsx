import { useEffect, useRef, useState } from 'react'
import { Star } from 'lucide-react'
import { useT } from '../i18n'
import { Button } from './Button'
import { cn } from './cn'

export interface ScoreCardProps {
  title: string
  /** 0 to 100, this project's own scale. */
  accuracy: number
  smoothness: number
  /** 0 to 3. */
  stars: 0 | 1 | 2 | 3
  passed: boolean
  hint?: string
  onRetry?: () => void
  onNext?: () => void
}

const COUNT_UP_MS = 600

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/** Counts up from 0 to the target. Jumps straight to it when the user prefers reduced motion. */
function useCountUp(target: number): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0))
  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target)
      return
    }
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_UP_MS)
      setValue(Math.round(target * t))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return value
}

function Stat({ label, value, good }: { label: string; value: number; good: boolean }) {
  return (
    <div>
      <p className={cn('font-display text-display font-extrabold', good ? 'text-accent-text' : 'text-fg')}>{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  )
}

export function ScoreCard({ title, accuracy, smoothness, stars, passed, hint, onRetry, onNext }: ScoreCardProps) {
  const { t } = useT()
  const heading = useRef<HTMLHeadingElement>(null)
  const shownAccuracy = useCountUp(accuracy)
  const shownSmoothness = useCountUp(smoothness)

  // Moves focus to the result when it appears, so screen reader users hear it.
  useEffect(() => heading.current?.focus(), [])

  return (
    <section aria-labelledby="score-title" className="flex max-w-md flex-col gap-4 rounded-lg bg-raised p-6 shadow-card">
      <h2 id="score-title" ref={heading} tabIndex={-1} className="font-display text-lg font-semibold focus:outline-none">
        {title}
      </h2>
      <p role="img" className="flex items-center gap-1" aria-label={t('score.stars', { n: stars })}>
        {[1, 2, 3].map((n) => (
          <Star
            key={n}
            aria-hidden="true"
            className={cn('h-6 w-6', n <= stars ? 'fill-accent text-accent' : 'text-input')}
          />
        ))}
      </p>
      <div className="flex gap-6">
        <Stat label={t('score.accuracy')} value={shownAccuracy} good={passed} />
        <Stat label={t('score.smoothness')} value={shownSmoothness} good={false} />
      </div>
      {hint ? <p className="text-muted">{hint}</p> : null}
      <div className="flex flex-wrap gap-2">
        {onRetry ? (
          <Button variant={passed ? 'secondary' : 'primary'} onClick={onRetry}>
            {t('score.tryAgain')}
          </Button>
        ) : null}
        {onNext && passed ? <Button onClick={onNext}>{t('score.nextStep')}</Button> : null}
      </div>
    </section>
  )
}
