import { useT } from '../i18n'
import { ButtonLink } from '../ui'
import { usePageTitle } from '../usePageTitle'

export function NotFound() {
  const { t } = useT()
  usePageTitle(t('title.notFound'))
  return (
    <section className="flex max-w-xl flex-col gap-4">
      <h1 className="font-display text-xl font-bold">{t('notfound.title')}</h1>
      <p className="text-muted">{t('notfound.text')}</p>
      <ButtonLink to="/" className="self-start">
        {t('notfound.home')}
      </ButtonLink>
    </section>
  )
}
