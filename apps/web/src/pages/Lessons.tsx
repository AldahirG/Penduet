import { useMemo, useState, type CSSProperties } from 'react'
import { Star } from 'lucide-react'
import { lessonLevels, lessonText, lessons, type Lesson, type LessonLevel } from '@penduet/lessons'
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

// The rungs. The colour only backs up the words and the pips; the level is always written out.
const levelTone: Record<LessonLevel, string> = {
  beginner: 'var(--color-paint-green)',
  intermediate: 'var(--color-paint-yellow)',
  expert: 'var(--color-paint-red)',
}
// A thick pencil for a few big shapes, a fine one for a picture with a hundred little lines.
const levelPencil: Record<LessonLevel, number> = { beginner: 24, intermediate: 18, expert: 12 }

const themes = [...new Set(lessons.map((l) => l.theme))]

/** The whole lesson as a small pencil drawing: every step's guide, step by step in different colours. */
function Sketch({ lesson, tone }: { lesson: Lesson; tone: string }) {
  const lines = useMemo(() => {
    const inks = ['var(--color-ink)', tone, 'var(--color-player-1)', 'var(--color-player-2)']
    return lesson.steps.flatMap((step, si) => step.guide.map((points) => ({ points, colour: inks[si % inks.length]! })))
  }, [lesson, tone])
  return <HandSketch lines={lines} seed={lesson.slug} width={levelPencil[lesson.level]} />
}

/** One, two or three filled pips for the rung. Decoration: the name of the level always sits next to it. */
function Pips({ level }: { level: LessonLevel }) {
  const n = lessonLevels.indexOf(level) + 1
  return (
    <span aria-hidden="true" className="inline-flex gap-1">
      {[1, 2, 3].map((i) => (
        <span key={i} className="h-2.5 w-2.5 rounded-pill border border-[color:var(--color-input)]" style={i <= n ? { background: levelTone[level], borderColor: 'transparent' } : undefined} />
      ))}
    </span>
  )
}

// The lessons, on three rungs, each with its theme, and the best result on this device.
export function Lessons() {
  const { t, lang } = useT()
  usePageTitle(t('title.lessons'))
  const progress = getProgress()
  const [theme, setTheme] = useState<string>('All')
  const [level, setLevel] = useState<LessonLevel | 'all'>('all')
  const shown = useMemo(() => lessons.filter((l) => (theme === 'All' || l.theme === theme) && (level === 'all' || l.level === level)), [theme, level])
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

      <div role="group" aria-label={t('lessons.levelFilter')} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(['all', ...lessonLevels] as const).map((lv) => {
          const on = lv === level
          const count = lv === 'all' ? lessons.length : lessons.filter((l) => l.level === lv).length
          return (
            <button
              key={lv}
              type="button"
              aria-pressed={on}
              onClick={() => setLevel(lv)}
              className={cn(
                'flex min-h-touch flex-col items-start gap-1 rounded-2xl border p-3 text-left transition duration-fast ease-out active:scale-[0.98]',
                on ? 'border-transparent bg-fg text-bg shadow-lift' : 'border-line bg-raised text-fg hover:bg-surface',
              )}
            >
              <span className="flex w-full items-center justify-between gap-2 text-sm font-bold">
                {lv === 'all' ? t('lessons.levelAll') : t(`level.${lv}` as const)}
                {lv !== 'all' ? <Pips level={lv} /> : null}
              </span>
              <span className={cn('hidden text-xs sm:block', on ? 'text-bg' : 'text-muted')}>{lv === 'all' ? t('lessons.count', { n: count }) : t(`level.${lv}.hint` as const)}</span>
              <span className={cn('text-xs font-semibold sm:hidden', on ? 'text-bg' : 'text-muted')}>{t('lessons.count', { n: count })}</span>
            </button>
          )
        })}
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

      {shown.length === 0 ? <p className="paper p-6 text-muted">{t('lessons.noneShown')}</p> : null}

      {lessonLevels.map((lv) => {
        const items = shown.filter((l) => l.level === lv)
        if (items.length === 0) return null
        return (
          <section key={lv} aria-labelledby={`level-${lv}`} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 id={`level-${lv}`} className="flex items-center gap-3 text-lg font-bold">
                <Pips level={lv} />
                {t(`level.${lv}` as const)}
              </h2>
              <p className="text-sm text-muted">{t(`level.${lv}.hint` as const)}</p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((l, idx) => {
                const best = progress[l.slug]
                const tone = toneOf(l.theme)
                const text = lessonText(l, lang)
                return (
                  <li
                    key={l.slug}
                    className="paper lift sketch-hover rise flex gap-4 overflow-hidden p-3 sm:flex-col sm:gap-0 sm:p-0"
                    style={{ ['--i' as string]: Math.min(idx, 8), contentVisibility: 'auto', containIntrinsicSize: 'auto 440px' } as CSSProperties}
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
                      <h3 className="text-lg font-semibold leading-tight">{text.title}</h3>
                      <p className="hidden text-muted sm:block">{text.summary}</p>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                        <span>
                          {t('lessons.meta', { steps: l.steps.length, min: l.estMinutes })}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <Pips level={l.level} />
                          {t(`level.${l.level}` as const)}
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
      })}
    </section>
  )
}
