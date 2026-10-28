import { Star } from 'lucide-react'
import type { HintKey, Lesson, LessonStage } from '@penduet/lessons'
import { t, useT, type StringKey } from '../i18n'
import { Button, ButtonLink, cn } from '../ui'

// Wording and small pieces shared by the solo lesson page and the room that draws a lesson together.

const stageKey: Record<LessonStage, StringKey> = { lines: 'stage.lines', shapes: 'stage.shapes', details: 'stage.details', colour: 'stage.colour' }
/** The name of a stage of a lesson, in the language of the moment. */
export const stageLabel = (stage: LessonStage): string => t(stageKey[stage])

const hintKey: Record<HintKey, StringKey> = {
  empty: 'hint.empty',
  incomplete: 'hint.incomplete',
  wandering: 'hint.wandering',
  shaky: 'hint.shaky',
  close: 'hint.close',
  good: 'hint.good',
  great: 'hint.great',
}

/** The hint for a key, in the language of the moment. */
export const hintText = (key: HintKey): string => t(hintKey[key])

/** The hint for a key that came over the wire. An unknown key (a newer server) gets a neutral line. */
export const hintFor = (key: string): string => (key in hintKey ? t(hintKey[key as HintKey]) : t('hint.checked'))

export function Stars({ n, label = true }: { n: number; label?: boolean }) {
  const { t } = useT()
  return (
    <span className="inline-flex items-center gap-0.5" role={label ? 'img' : undefined} aria-label={label ? t('score.stars', { n }) : undefined}>
      {[1, 2, 3].map((i) => (
        <Star key={i} aria-hidden="true" className={cn('h-4 w-4', i <= n ? 'fill-accent text-accent' : 'text-input')} />
      ))}
    </span>
  )
}

export interface StepOutcome {
  stars: number
  /** Skipped or never checked. */
  skipped: boolean
}

/** The overall result of a finished lesson: the mean of the steps, rounded. A skipped step counts as zero. */
export function overallStars(outcomes: StepOutcome[]): 0 | 1 | 2 | 3 {
  if (outcomes.length === 0) return 0
  return Math.round(outcomes.reduce((a, o) => a + o.stars, 0) / outcomes.length) as 0 | 1 | 2 | 3
}

export function LessonSummary({
  lesson,
  outcomes,
  actions,
  title,
}: {
  lesson: Lesson
  outcomes: StepOutcome[]
  actions: React.ReactNode
  title?: string
}) {
  const { t } = useT()
  return (
    <div className="flex max-w-md flex-col gap-4 rounded-lg bg-raised p-6 shadow-card">
      <h2 className="font-display text-lg font-semibold">{title ?? t('lesson.wellDrawn')}</h2>
      <p className="flex items-center gap-2">
        <Stars n={overallStars(outcomes)} /> <span className="text-muted">{t('lesson.overall')}</span>
      </p>
      <ol className="flex flex-col gap-1 text-sm">
        {lesson.steps.map((s, i) => (
          <li key={i} className="flex items-center justify-between gap-3">
            <span>
              {i + 1}. {stageLabel(s.stage)}
            </span>
            {outcomes[i]?.skipped ? <span className="text-muted">{t('lesson.skipped')}</span> : <Stars n={outcomes[i]?.stars ?? 0} />}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  )
}

export { Button, ButtonLink }
