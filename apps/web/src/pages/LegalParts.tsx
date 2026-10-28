import type { ReactNode } from 'react'
import { CONTACT_EMAIL, OPERATOR_NAME } from '../data/config'
import { useT } from '../i18n'

// Both legal pages are plain text written for this project. They describe what the code does today
// (see replica/launch/legal-notes.md for where each claim comes from). Not legal advice: have a
// lawyer in your country read them before the site is public. They exist in English and Spanish.
export const LEGAL_UPDATED = '2026-10-27'

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export function Contact() {
  const { t } = useT()
  return (
    <>
      {OPERATOR_NAME ? <p className="text-muted">{t('legal.runBy', { name: OPERATOR_NAME })}</p> : null}
      {CONTACT_EMAIL ? (
        <p className="text-muted">
          {t('legal.contact')}{' '}
          <a className="text-accent-text underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      ) : null}
    </>
  )
}

export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  const { t, lang } = useT()
  return (
    <article className="flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-display font-extrabold">{title}</h1>
        <p className="text-sm text-muted">{t('legal.updated', { date: LEGAL_UPDATED })}</p>
        {lang === 'es' ? <p className="text-sm text-muted">{t('legal.translation')}</p> : null}
        <p className="text-lg text-muted">{intro}</p>
      </header>
      {children}
    </article>
  )
}

export const list = 'flex list-disc flex-col gap-1 pl-6 text-muted'
