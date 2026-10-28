import { useEffect } from 'react'
import { useLang } from './i18n'

const BASE = 'Penduet'

/** Sets the tab title for a page, so history, tabs and screen readers tell pages apart. */
export function usePageTitle(title?: string): void {
  const [lang] = useLang() // the title is re-set when the language changes
  useEffect(() => {
    document.title = title ? `${title} · ${BASE}` : BASE
  }, [title, lang])
}
