import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Brush, Globe, Settings, Shapes, Users, type LucideIcon } from 'lucide-react'
import { CONTACT_EMAIL } from '../data/config'
import { setLang, useT, type StringKey } from '../i18n'
import { cn, SegmentedControl } from '../ui'
import { useTheme, type ThemeChoice } from '../theme'
import { BrandMark } from './Brand'

const nav: { to: string; label: StringKey; icon: LucideIcon }[] = [
  { to: '/lessons', label: 'nav.lessons', icon: Shapes },
  { to: '/together', label: 'nav.together', icon: Users },
  { to: '/draw', label: 'nav.draw', icon: Brush },
  { to: '/settings', label: 'nav.settings', icon: Settings },
]

const themes: { value: ThemeChoice; label: StringKey }[] = [
  { value: 'system', label: 'theme.auto' },
  { value: 'light', label: 'theme.light' },
  { value: 'dark', label: 'theme.dark' },
]

export function AppShell() {
  const { t, lang } = useT()
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
    <div className="min-h-dvh text-fg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-raised focus:px-4 focus:py-2 focus:shadow-pop"
      >
        {t('a11y.skip')}
      </a>
      <header className="sticky top-0 z-30 flex h-header items-center justify-between gap-3 border-b border-line glass px-4 md:px-8">
        <div className="flex items-center gap-4 md:gap-8">
          <NavLink to="/" className="group inline-flex min-h-touch min-w-touch items-center justify-center gap-2.5" aria-label={t('a11y.brandHome')}>
            <BrandMark className="transition-transform duration-base ease-out group-hover:-rotate-6 group-active:scale-95" />
            <span className="hidden font-display text-xl font-bold tracking-tight min-[430px]:inline">Penduet</span>
          </NavLink>
          <nav aria-label={t('nav.main')} className="hidden gap-1 sm:flex">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cn(
                    'relative inline-flex min-h-touch items-center rounded-md px-3 text-sm font-bold transition-colors duration-fast hover:bg-surface',
                    'after:absolute after:inset-x-3 after:bottom-1.5 after:h-[3px] after:origin-left after:rounded-pill after:bg-paint-yellow',
                    'after:transition-transform after:duration-base after:ease-out',
                    isActive ? 'text-fg after:scale-x-100' : 'text-muted after:scale-x-0 hover:text-fg',
                  )
                }
              >
                {t(n.label)}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
            aria-label={t('lang.switchTo', { name: lang === 'es' ? 'English' : 'Español' })}
            title={t('lang.switchTo', { name: lang === 'es' ? 'English' : 'Español' })}
            className="inline-flex min-h-touch min-w-touch items-center justify-center gap-1.5 rounded-pill border border-line bg-raised px-3 text-sm font-bold shadow-card transition hover:bg-surface active:scale-95"
          >
            <Globe aria-hidden="true" className="h-4 w-4" />
            <span lang={lang === 'es' ? 'en' : 'es'}>{lang === 'es' ? 'English' : 'Español'}</span>
          </button>
          <SegmentedControl label={t('theme.label')} options={themes.map((o) => ({ ...o, label: t(o.label) }))} value={theme} onChange={setTheme} />
        </div>
      </header>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-content px-4 py-6 focus:outline-none md:px-8 md:py-8">
        <div key={pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
      <footer className="mx-auto flex w-full max-w-content flex-wrap items-center gap-x-6 gap-y-1 border-t border-line px-4 py-6 pb-28 text-sm text-muted sm:pb-6 md:px-8">
        <span>{t('footer.early')}</span>
        <nav aria-label={t('nav.legal')} className="flex flex-wrap gap-x-4">
          <Link className="inline-flex min-h-touch min-w-touch items-center justify-center underline" to="/privacy">
            {t('footer.privacy')}
          </Link>
          <Link className="inline-flex min-h-touch min-w-touch items-center justify-center underline" to="/terms">
            {t('footer.terms')}
          </Link>
          {CONTACT_EMAIL ? (
            <a className="inline-flex min-h-touch min-w-touch items-center justify-center underline" href={`mailto:${CONTACT_EMAIL}`}>
              {t('footer.feedback')}
            </a>
          ) : null}
        </nav>
      </footer>
      <nav
        aria-label={t('nav.mainCompact')}
        className="pb-safe fixed inset-x-0 bottom-0 z-30 flex rounded-t-xl border-t border-line glass-raised shadow-pop sm:hidden"
      >
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              cn(
                'group flex h-tabbar flex-1 flex-col items-center justify-center gap-1 text-xs font-bold transition-colors duration-fast',
                isActive ? 'text-accent-text' : 'text-muted',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'flex h-8 w-14 items-center justify-center rounded-pill transition-all duration-base ease-out group-active:scale-90',
                    isActive ? 'bg-accent-soft' : 'bg-transparent',
                  )}
                >
                  <n.icon aria-hidden="true" className={cn('h-5 w-5 transition-transform duration-base ease-out', isActive && '-translate-y-px scale-110')} strokeWidth={isActive ? 2.5 : 2} />
                </span>
                {t(n.label)}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
