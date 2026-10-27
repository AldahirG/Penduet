import { ButtonLink } from '../ui'
import { usePageTitle } from '../usePageTitle'

export function NotFound() {
  usePageTitle('Not found')
  return (
    <section className="flex max-w-xl flex-col gap-4">
      <h1 className="font-display text-xl font-bold">There is nothing at this address</h1>
      <p className="text-muted">The page may have moved, or the link may be mistyped.</p>
      <ButtonLink to="/" className="self-start">
        Go home
      </ButtonLink>
    </section>
  )
}
