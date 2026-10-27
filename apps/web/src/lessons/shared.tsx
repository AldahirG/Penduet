import { Star } from 'lucide-react'
import type { HintKey, Lesson, LessonStage } from '@penduet/lessons'
import { Button, ButtonLink, cn } from '../ui'

// Wording and small pieces shared by the solo lesson page and the room that draws a lesson together.

export const stageLabel: Record<LessonStage, string> = { lines: 'Lines', shapes: 'Shapes', details: 'Details', colour: 'Colour' }

export const hintText: Record<HintKey, string> = {
  empty: 'Nothing drawn yet. Trace the dashed guide, then check again.',
  incomplete: 'Part of the guide is still empty. Trace all of it.',
  wandering: 'Some of your lines are away from the guide. Stay close to the dashed line.',
  shaky: 'Right place, but the line is shaky. Slow down and draw in one steady movement.',
  close: 'Close. Try once more, a little nearer to the line.',
  good: 'Good work. Move on, or try again for a steadier line.',
  great: 'Excellent: accurate and steady.',
}

/** The hint for a key that came over the wire. An unknown key (a newer server) gets a neutral line. */
export const hintFor = (key: string): string => (key in hintText ? hintText[key as HintKey] : 'Checked.')

export function Stars({ n, label = true }: { n: number; label?: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5" role={label ? 'img' : undefined} aria-label={label ? `${n} of 3 stars` : undefined}>
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
  title = 'Well drawn',
}: {
  lesson: Lesson
  outcomes: StepOutcome[]
  actions: React.ReactNode
  title?: string
}) {
  return (
    <div className="flex max-w-md flex-col gap-4 rounded-lg bg-raised p-6 shadow-card">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <p className="flex items-center gap-2">
        <Stars n={overallStars(outcomes)} /> <span className="text-muted">overall</span>
      </p>
      <ol className="flex flex-col gap-1 text-sm">
        {lesson.steps.map((s, i) => (
          <li key={i} className="flex items-center justify-between gap-3">
            <span>
              {i + 1}. {stageLabel[s.stage]}
            </span>
            {outcomes[i]?.skipped ? <span className="text-muted">skipped</span> : <Stars n={outcomes[i]?.stars ?? 0} />}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  )
}

export { Button, ButtonLink }
