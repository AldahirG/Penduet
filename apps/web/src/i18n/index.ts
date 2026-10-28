import { useSyncExternalStore } from 'react'
import { hasKey, strings, type StringKey } from './strings'

// Two languages, Spanish by default. A string lives in one place as a pair, [English, Spanish], so a missing
// translation is a type error, not a surprise. The language is a small store outside React, so the data layer
// (error messages, toasts) can use it too, and components re-render when it changes.

export type Lang = 'es' | 'en'
export const LANGS: readonly Lang[] = ['es', 'en']
export const DEFAULT_LANG: Lang = 'es'
const KEY = 'penduet.lang'

const isLang = (v: unknown): v is Lang => v === 'es' || v === 'en'

function read(): Lang {
  try {
    const v = window.localStorage.getItem(KEY)
    if (isLang(v)) return v
  } catch {
    // storage blocked: use the default
  }
  return DEFAULT_LANG
}

let current: Lang = typeof window === 'undefined' ? DEFAULT_LANG : read()
const listeners = new Set<() => void>()

export const getLang = (): Lang => current

/** Changes the language everywhere. `persist: false` is for tests. */
export function setLang(next: Lang, persist = true): void {
  if (next === current) return
  current = next
  if (typeof document !== 'undefined') document.documentElement.lang = next
  if (persist) {
    try {
      window.localStorage.setItem(KEY, next)
    } catch {
      // not saved: still changed for this visit
    }
  }
  listeners.forEach((fn) => fn())
}

/** Sets the page's language attribute and meta tags once, at start. */
export function initI18n(): void {
  document.documentElement.lang = current
  const meta = document.querySelector('meta[name="description"]')
  if (meta) meta.setAttribute('content', t('meta.description'))
}

export type Vars = Record<string, string | number>

const fill = (text: string, vars?: Vars): string => (vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text)

/** The text for a key in the current language, with `{name}` placeholders filled from `vars`. */
export function t(key: StringKey, vars?: Vars): string {
  return fill(strings[key][current === 'es' ? 1 : 0], vars)
}

type PluralBase = {
  [K in StringKey]: K extends `${infer B}_one` ? (`${B}_other` extends StringKey ? B : never) : never
}[StringKey]

/** Singular or plural by `n`: looks up `<base>_one` or `<base>_other`, and fills `{n}` as well as `vars`. */
export function tn(base: PluralBase, n: number, vars?: Vars): string {
  return t(`${base}_${n === 1 ? 'one' : 'other'}` as StringKey, { n, ...vars })
}

/** Text for a key built from data (a theme, a colour). Falls back to `fallback` when there is no such key. */
export function tDyn(key: string, fallback: string, vars?: Vars): string {
  return hasKey(key) ? t(key, vars) : fallback
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** The current language, and a way to change it. Re-renders the component when it changes. */
export function useLang(): [Lang, (lang: Lang) => void] {
  const lang = useSyncExternalStore(subscribe, getLang, getLang)
  return [lang, setLang]
}

/** `t` and `tn` for a component: calling this subscribes it to language changes. */
export function useT(): { t: typeof t; tn: typeof tn; lang: Lang } {
  const lang = useSyncExternalStore(subscribe, getLang, getLang)
  return { t, tn, lang }
}

export type { StringKey }
