import { useEffect, useState } from 'react'

export type ThemeChoice = 'system' | 'light' | 'dark'

const KEY = 'penduet.theme'

function read(): ThemeChoice {
  // localStorage can throw in private windows or with blocked site data; the app works without it.
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

function apply(choice: ThemeChoice) {
  const root = document.documentElement
  if (choice === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', choice)
}

/** Applies the saved choice before first paint, so there is no flash of the wrong theme. */
export function initTheme() {
  apply(read())
}

export function useTheme(): [ThemeChoice, (next: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>(read)
  useEffect(() => apply(choice), [choice])
  const update = (next: ThemeChoice) => {
    setChoice(next)
    try {
      if (next === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, next)
    } catch {
      /* not persisted, still applied for this visit */
    }
  }
  return [choice, update]
}
