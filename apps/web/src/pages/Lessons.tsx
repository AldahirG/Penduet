import { Star } from 'lucide-react'
import { lessons } from '@penduet/lessons'
import { getProgress } from '../data/progress'
import { ButtonLink, cn } from '../ui'
import { usePageTitle } from '../usePageTitle'

// A simple list of the starter lessons, with the best result on this device.
export function Lessons() {
  usePageTitle('Lessons')
  const progress = getProgress()
  return (
    <section aria-labelledby="lessons-title" className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 id="lessons-title" className="font-display text-xl font-bold">
          Lessons
        </h1>
        <p className="text-muted">Short guided drawings. Trace the dashed line, check your work, and move on.</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {lessons.map((l) => {
          const best = progress[l.slug]
          return (
            <li key={l.slug} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5">
              <h2 className="font-display text-lg font-semibold">{l.title}</h2>
              <p className="text-muted">{l.summary}</p>
              <p className="text-sm text-muted">
                {l.steps.length} steps · about {l.estMinutes} min · difficulty {l.difficulty} of 5
              </p>
              {best ? (
                <p className="flex items-center gap-2 text-sm" aria-label={`Your best: ${best.stars} of 3 stars, accuracy ${best.accuracy}`}>
                  <span className="inline-flex" aria-hidden="true">
                    {[1, 2, 3].map((i) => (
                      <Star key={i} className={cn('h-4 w-4', i <= best.stars ? 'fill-accent text-accent' : 'text-input')} />
                    ))}
                  </span>
                  <span aria-hidden="true" className="text-muted">
                    accuracy {best.accuracy}
                  </span>
                </p>
              ) : null}
              <ButtonLink to={`/lesson/${l.slug}`} variant={best ? 'secondary' : 'primary'} className="self-start">
                {best ? 'Draw again' : 'Start'}
              </ButtonLink>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
