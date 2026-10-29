import { useMemo, useState, type CSSProperties } from 'react'
import { Star } from 'lucide-react'
import { lessonText, lessons, type Lesson } from '@penduet/lessons'
import { getProgress } from '../data/progress'
import { HandSketch } from '../drawing/HandSketch'
import { tDyn, useT } from '../i18n'
import { ButtonLink, cn } from '../ui'
import { usePageTitle } from '../usePageTitle'

// One paint colour per theme. Decoration only: the theme is always also written out as text.
const tones: Record<string, string> = {
  'Warm-up': '--color-paint-yellow',
  Shapes: '--color-accent',
  Nature: '--color-paint-green',
  Animals: '--color-paint-red',
  Objects: '--color-paint-pink',
  Faces: '--color-player-2',
  Scenes: '--color-player-1',
}
const toneOf = (theme: string) => `var(${tones[theme] ?? '--color-accent'})`

const themes = [...new Set(lessons.map((l) => l.theme))]

/** The whole lesson as a small pencil drawing: every step's guide, step by step in different colours. */
function Sketch({ lesson, tone }: { lesson: Lesson; tone: string }) {
  const lines = useMemo(() => {
    const inks = ['var(--color-ink)', tone, 'var(--color-player-1)', 'var(--color-player-2)']
    return lesson.steps.flatMap((step, si) => step.guide.map((points) => ({ points, colour: inks[si % inks.length]! })))
  }, [lesson, tone])
  return <HandSketch lines={lines} seed={lesson.slug} />
}

function Dots({ level }: { level: number }) {
  return (
    <span aria-hidden="true" className="inline-flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={cn('h-2 w-2 rounded-pill', i <= level ? 'bg-fg' : 'border border-input')} />
      ))}
    </span>
  )
}

// The lessons, each with its theme, and the best result on this device.
export function Lessons() {
  const { t, lang } = useT()
  usePageTitle(t('title.lessons'))
  const progress = getProgress()
  const [theme, setTheme] = useState<string>('All')
  const shown = useMemo(() => (theme === 'All' ? lessons : lessons.filter((l) => l.theme === theme)), [theme])
  const drawn = lessons.filter((l) => progress[l.slug]).length

  return (
    <section aria-labelledby="lessons-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <h1 id="lessons-title" className="text-xl font-bold sm:text-display">
            {t('lessons.title')}
          </h1>
          <p className="text-muted">{t('lessons.lead')}</p>
        </div>
        <div className="flex min-w-48 flex-col gap-1.5 text-sm font-bold text-muted">
          <span>
            {t('lessons.drawn', { drawn, total: lessons.length })}
          </span>
          <span aria-hidden="true" className="h-2.5 overflow-hidden rounded-pill bg-surface ring-1 ring-inset ring-[color:var(--color-border)]">
            <span
              className="block h-full origin-left rounded-pill bg-paint-green transition-transform duration-[600ms] ease-out"
              style={{ transform: `scaleX(${drawn / lessons.length})` }}
            />
          </span>
        </div>
      </div>

      <div role="group" aria-label={t('lessons.filter')} className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {['All', ...themes].map((th) => {
          const on = th === theme
          return (
            <button
              key={th}
              type="button"
              aria-pressed={on}
              onClick={() => setTheme(th)}
              className={cn(
                'inline-flex min-h-touch shrink-0 items-center gap-2 rounded-pill border px-4 text-sm font-bold transition duration-fast ease-out active:scale-95',
                on ? 'border-transparent bg-fg text-bg' : 'border-line bg-raised text-fg hover:bg-surface',
              )}
            >
              {th !== 'All' ? <span aria-hidden="true" className="h-2.5 w-2.5 rounded-pill" style={{ background: toneOf(th) }} /> : null}
              {th === 'All' ? t('lessons.all') : tDyn(`lt.${th}`, th)}
            </button>
          )
        })}
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((l, idx) => {
          const best = progress[l.slug]
          const tone = toneOf(l.theme)
          const text = lessonText(l, lang)
          return (
            <li
              key={l.slug}
              className="paper lift sketch-hover rise flex gap-4 overflow-hidden p-3 sm:flex-col sm:gap-0 sm:p-0"
              style={{ ['--i' as string]: Math.min(idx, 8) } as CSSProperties}
            >
              <div
                className="relative aspect-square w-28 shrink-0 overflow-hidden rounded-md sm:aspect-[4/3] sm:w-full sm:rounded-none"
                style={{ background: `color-mix(in srgb, ${tone} 22%, var(--color-canvas))` }}
              >
                <div className="absolute inset-3 sm:inset-5">
                  <Sketch lesson={l} tone={tone} />
                </div>
                {best ? (
                  <span aria-hidden="true" className="absolute right-2 top-2 flex rounded-pill glass-raised px-1.5 py-1 shadow-card">
                    {[1, 2, 3].map((i) => (
                      <Star
                        key={i}
                        style={{ ['--i' as string]: i - 1 } as CSSProperties}
                        className={cn('h-4 w-4', i <= best.stars ? 'star-pop fill-paint-yellow text-paint-yellow' : 'text-input')}
                      />
                    ))}
                  </span>
                ) : null}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:p-5">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-pill" style={{ background: tone }} />
                  {tDyn(`lt.${l.theme}`, l.theme)}
                </p>
                <h2 className="text-lg font-semibold leading-tight">{text.title}</h2>
                <p className="hidden text-muted sm:block">{text.summary}</p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                  <span>
                    {t('lessons.meta', { steps: l.steps.length, min: l.estMinutes })}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Dots level={l.difficulty} />
                    <span className="sr-only">{t('lessons.difficulty', { n: l.difficulty })}</span>
                  </span>
                </p>
                {best ? (
                  <p className="text-sm font-bold text-success" aria-label={t('lessons.bestAria', { stars: best.stars, acc: best.accuracy })}>
                    <span aria-hidden="true">{t('lessons.bestAcc', { acc: best.accuracy })}</span>
                  </p>
                ) : null}
                <ButtonLink to={`/lesson/${l.slug}`} variant={best ? 'secondary' : 'primary'} className="mt-auto self-start sm:mt-2">
                  {best ? t('lessons.again') : t('lessons.start')}
                </ButtonLink>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
