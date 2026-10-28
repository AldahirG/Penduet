import type { ReactNode } from 'react'
import { useT } from '../i18n'

export interface StubProps {
  /** Screen id from replica/recon.md, for example S19. */
  screen: string
  title: string
  /** Milestone from replica/architecture.md where this becomes real. */
  milestone: string
  children?: ReactNode
}

/** Placeholder for a screen that is routed but not built yet. Says plainly what is missing. */
export function Stub({ screen, title, milestone, children }: StubProps) {
  const { t } = useT()
  return (
    <section className="flex max-w-xl flex-col gap-4">
      <p className="text-sm font-semibold text-muted">
        {t('common.stub', { screen, milestone })}
      </p>
      <h1 className="font-display text-xl font-bold">{title}</h1>
      {children}
    </section>
  )
}
