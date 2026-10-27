import { useEffect } from 'react'

const BASE = 'Penduet'

/** Sets the tab title for a page, so history, tabs and screen readers tell pages apart. */
export function usePageTitle(title?: string): void {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE}` : BASE
  }, [title])
}
