import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { cn, SegmentedControl } from '../ui'
import { useTheme, type ThemeChoice } from '../theme'

const nav = [
  { to: '/lessons', label: 'Lessons' },
  { to: '/together', label: 'Together' },
  { to: '/draw', label: 'Free draw' },
  { to: '/settings', label: 'Settings' },
  { to: '/design', label: 'Design' },
]

const themes: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function AppShell() {
  const [theme, setTheme] = useTheme()
  const { pathname } = useLocation()
  const [announcement, setAnnouncement] = useState('')
  const shown = useRef(pathname)

  // A single-page app does not reload, so tell screen readers the page changed and move focus to it.
  useEffect(() => {
    // Only when the page really changed: React StrictMode runs this effect twice on the first load.
    if (shown.current === pathname) return
    shown.current = pathname
    document.getElementById('main')?.focus({ preventScroll: true })
    const t = window.setTimeout(() => setAnnouncement(document.title), 100) // after the page sets its title
    return () => window.clearTimeout(t)
  }, [pathname])

  return (
    <div className="min-h-screen bg-bg text-fg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-raised focus:px-4 focus:py-2 focus:shadow-pop"
      >
        Skip to content
      </a>
      <header className="flex h-header items-center justify-between gap-4 border-b border-line px-4 md:px-8">
        <div className="flex items-center gap-6">
          <NavLink to="/" className="inline-flex min-h-touch items-center font-display text-lg font-extrabold">
            Penduet
          </NavLink>
          <nav aria-label="Main" className="hidden gap-1 sm:flex">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cn(
                    'inline-flex min-h-touch items-center rounded-md px-3 text-sm font-semibold hover:bg-surface',
                    isActive ? 'text-accent-text' : 'text-muted',
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <SegmentedControl label="Theme" options={themes} value={theme} onChange={setTheme} />
      </header>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-content focus:outline-none px-4 py-8 md:px-8">
        <Outlet />
      </main>
      <nav aria-label="Main (compact)" className="fixed inset-x-0 bottom-0 z-20 flex h-tabbar border-t border-line bg-bg sm:hidden">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              cn('flex flex-1 items-center justify-center text-sm font-semibold', isActive ? 'text-accent-text' : 'text-muted')
            }
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
