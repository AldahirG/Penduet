import { describe, expect, it } from 'vitest'
import { isCorrectAnswer, normalizeAnswer, wordIn, words } from './words'

const id = (w: string) => words.findIndex((x) => x.word === w)

describe('draw and guess words', () => {
  it('has no word twice, and none that is another word with an "s"', () => {
    const seen = new Set<string>()
    for (const w of words) {
      const key = normalizeAnswer(w.word)
      expect(key.length, w.word).toBeGreaterThan(1)
      expect(seen.has(key), `duplicate: ${w.word}`).toBe(false)
      seen.add(key)
    }
  })

  it('gives every word a category and an icon name', () => {
    for (const w of words) {
      expect(w.category, w.word).toBeTruthy()
      expect(w.icon, w.word).toMatch(/^[A-Z][A-Za-z0-9]*$/)
    }
  })

  it('does not let one word answer for another', () => {
    for (const a of words)
      for (const b of words)
        if (a !== b) {
          expect(isCorrectAnswer(words.indexOf(a), b.word), `${b.word} for ${a.word}`).toBe(false)
          expect(isCorrectAnswer(words.indexOf(a), b.es), `${b.es} for ${a.word}`).toBe(false)
        }
  })

  it('has a Spanish word for every word, none twice', () => {
    const seen = new Set<string>()
    for (const w of words) {
      expect(w.es.length, w.word).toBeGreaterThan(1)
      expect(wordIn(w, 'es')).toBe(w.es)
      expect(wordIn(w, 'en')).toBe(w.word)
      const key = normalizeAnswer(w.es)
      expect(seen.has(key), `duplicate: ${w.es}`).toBe(false)
      seen.add(key)
    }
  })
})

describe('checking an answer', () => {
  const cat = id('cat')
  const iceCream = id('ice cream')
  const guitar = id('guitar')

  it('ignores case, accents, spaces, punctuation and a leading article', () => {
    expect(isCorrectAnswer(cat, 'CAT')).toBe(true)
    expect(isCorrectAnswer(cat, '  a cat! ')).toBe(true)
    expect(isCorrectAnswer(iceCream, 'The Ice-Cream')).toBe(true)
    expect(isCorrectAnswer(iceCream, 'icecream')).toBe(true)
    expect(isCorrectAnswer(id('croissant'), 'Croíssant')).toBe(true)
  })

  it('accepts listed alternatives and a plural', () => {
    expect(isCorrectAnswer(cat, 'kitten')).toBe(true)
    expect(isCorrectAnswer(cat, 'cats')).toBe(true)
    expect(isCorrectAnswer(id('donut'), 'doughnut')).toBe(true)
  })

  it('accepts the answer in Spanish, with accents or without, with an article', () => {
    expect(isCorrectAnswer(cat, 'gato')).toBe(true)
    expect(isCorrectAnswer(cat, 'El Gato')).toBe(true)
    expect(isCorrectAnswer(id('croissant'), 'cruasan')).toBe(true)
    expect(isCorrectAnswer(id('rainbow'), 'arco iris')).toBe(true)
    expect(isCorrectAnswer(id('house'), 'la casa')).toBe(true)
    expect(isCorrectAnswer(cat, 'perro')).toBe(false)
  })

  it('forgives one mistyped letter in a longer word, but not in a short one', () => {
    expect(isCorrectAnswer(guitar, 'guitr')).toBe(true) // a letter missing
    expect(isCorrectAnswer(guitar, 'guitor')).toBe(true) // a letter different
    expect(isCorrectAnswer(guitar, 'guitaar')).toBe(true) // a letter extra
    expect(isCorrectAnswer(guitar, 'gitr')).toBe(false) // two off
    expect(isCorrectAnswer(cat, 'cut')).toBe(false)
    expect(isCorrectAnswer(cat, 'car')).toBe(false)
  })

  it('refuses a wrong answer, an empty one, and a word that does not exist', () => {
    expect(isCorrectAnswer(cat, 'dog')).toBe(false)
    expect(isCorrectAnswer(cat, '   ')).toBe(false)
    expect(isCorrectAnswer(9999, 'cat')).toBe(false)
  })
})
