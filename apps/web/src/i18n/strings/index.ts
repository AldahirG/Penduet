import { app } from './app'
import { guess } from './guess'
import { home } from './home'
import { pages } from './pages'

const meta = {
  'meta.description': [
    'Draw with someone you know. Open a room, send the code, and draw on one canvas together.',
    'Dibuja con alguien que conoces. Abre una sala, manda el código y dibujen juntos en un mismo lienzo.',
  ],
} as const satisfies Record<string, readonly [string, string]>

export const strings = { ...meta, ...app, ...home, ...pages, ...guess } as const

export type StringKey = keyof typeof strings

/** Whether a key exists, for keys built from data (a theme name, a colour name). */
export const hasKey = (key: string): key is StringKey => key in strings
