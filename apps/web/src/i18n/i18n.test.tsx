import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { words } from '@penduet/lessons'
import { AppShell } from '../components/AppShell'
import { GuessPanel, type GuessControls } from '../games/GuessPanel'
import { Home } from '../pages/Home'
import { Lessons } from '../pages/Lessons'
import { Privacy } from '../pages/Legal'
import { ToastProvider } from '../ui'
import { DEFAULT_LANG, getLang, setLang, t, tDyn, tn } from './index'
import { strings } from './strings'

afterEach(() => {
  setLang('en', false) // the rest of the tests read English
  window.localStorage.clear()
})

describe('the language', () => {
  it('starts in Spanish when nothing was chosen', async () => {
    window.localStorage.clear()
    vi.resetModules()
    const fresh = await import('./index')
    expect(fresh.DEFAULT_LANG).toBe('es')
    expect(fresh.getLang()).toBe('es')
  })

  it('starts in the language that was chosen before', async () => {
    window.localStorage.setItem('penduet.lang', 'en')
    vi.resetModules()
    const fresh = await import('./index')
    expect(fresh.getLang()).toBe('en')
  })

  it('ignores a value in storage that is not a language', async () => {
    window.localStorage.setItem('penduet.lang', 'klingon')
    vi.resetModules()
    const fresh = await import('./index')
    expect(fresh.getLang()).toBe(DEFAULT_LANG)
  })

  it('changes everywhere, remembers the choice, and tells the page', () => {
    setLang('es')
    expect(getLang()).toBe('es')
    expect(document.documentElement.lang).toBe('es')
    expect(window.localStorage.getItem('penduet.lang')).toBe('es')
    setLang('en')
    expect(document.documentElement.lang).toBe('en')
    expect(window.localStorage.getItem('penduet.lang')).toBe('en')
  })

  it('does not remember a change made without asking to', () => {
    setLang('es', false)
    expect(window.localStorage.getItem('penduet.lang')).toBeNull()
  })
})

describe('texts', () => {
  it('fills placeholders and picks singular or plural', () => {
    setLang('en', false)
    expect(t('guess.round', { n: 3 })).toBe('Round 3')
    expect(tn('guess.result.points', 1)).toBe('+1 point')
    expect(tn('guess.result.points', 3)).toBe('+3 points')
    setLang('es', false)
    expect(t('guess.round', { n: 3 })).toBe('Ronda 3')
    expect(tn('guess.result.points', 1)).toBe('+1 punto')
    expect(tn('guess.result.points', 3)).toBe('+3 puntos')
  })

  it('looks up a key built from data, and falls back for one that is missing', () => {
    setLang('es', false)
    expect(tDyn('lt.Animals', 'Animals')).toBe('Animales')
    expect(tDyn('lt.Nope', 'Nope')).toBe('Nope')
  })

  it('has both languages for every text, with the same placeholders', () => {
    const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    for (const [key, [en, es]] of Object.entries(strings)) {
      expect(en.length, key).toBeGreaterThan(0)
      expect(es.length, key).toBeGreaterThan(0)
      expect(holes(es), `placeholders of ${key}`).toEqual(holes(en))
    }
  })

  it('has a singular and a plural for each counted text', () => {
    for (const key of Object.keys(strings)) {
      if (key.endsWith('_one')) expect(strings, key).toHaveProperty(`${key.slice(0, -4)}_other`)
      if (key.endsWith('_other')) expect(strings, key).toHaveProperty(`${key.slice(0, -6)}_one`)
    }
  })

  it('names every colour of the palette in both languages', () => {
    for (const c of ['Ink', 'Slate', 'Red', 'Orange', 'Yellow', 'Green', 'Teal', 'Blue', 'Purple', 'Pink']) {
      expect(strings, c).toHaveProperty(`colour.${c}`)
    }
  })
})

describe('the app in Spanish', () => {
  it('shows the lessons in Spanish, with their Spanish titles', () => {
    setLang('es', false)
    render(
      <MemoryRouter>
        <Lessons />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Lecciones' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Líneas rectas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Calentamiento' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Empezar' }).length).toBeGreaterThan(5)
  })

  it('shows the home page in Spanish', () => {
    setLang('es', false)
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Cómo funciona' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Precio: nada' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Dibuja con alguien que conoces/ })).toBeInTheDocument()
  })

  it('shows the privacy policy in Spanish, and in English again after the switch', () => {
    setLang('es', false)
    const { unmount } = render(
      <MemoryRouter>
        <Privacy />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Política de privacidad' })).toBeInTheDocument()
    unmount()
    setLang('en', false)
    render(
      <MemoryRouter>
        <Privacy />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Privacy policy' })).toBeInTheDocument()
  })

  it('switches the whole shell from the header button', () => {
    setLang('es', false)
    render(
      <MemoryRouter>
        <ToastProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<p>hola</p>} />
            </Route>
          </Routes>
        </ToastProvider>
      </MemoryRouter>,
    )
    expect(screen.getAllByText('Lecciones').length).toBeGreaterThan(0)
    expect(screen.getByRole('radiogroup', { name: 'Tema' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar el idioma a English' }))
    expect(getLang()).toBe('en')
    expect(screen.getAllByText('Lessons').length).toBeGreaterThan(0)
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Switch language to Español' })).toBeInTheDocument()
  })

  it('plays draw and guess in Spanish, showing the word in Spanish', () => {
    setLang('es', false)
    const cat = words.findIndex((w) => w.word === 'cat')
    const g: GuessControls = {
      kind: 'guess',
      phase: 'draw',
      round: 1,
      interval: 0,
      intervals: 4,
      amDrawer: true,
      seat: 1,
      drawerSeat: 1,
      myName: 'Mara',
      peerName: 'Teo',
      hasPartner: true,
      word: words[cat]!,
      deadline: Date.now() + 15_000,
      canDraw: true,
      drawUntil: null,
      last: null,
      result: null,
      score: 0,
      played: 0,
      won: 0,
      submit: () => undefined,
    }
    render(<GuessPanel g={g} />)
    expect(screen.getByRole('heading', { name: 'Ronda 1: dibujas tú' })).toBeInTheDocument()
    expect(screen.getByTestId('secret-word')).toHaveTextContent('gato')
    expect(screen.getByText('Animales')).toBeInTheDocument()
    expect(screen.getByText(/Dibujando 1 de 4/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Silenciar el sonido' })).toBeInTheDocument()
  })
})
