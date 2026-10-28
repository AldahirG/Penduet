import { describe, expect, it } from 'vitest'
import { halfSubjects, halfText, lessons, lessonText, spanishCoverage, topics, topicText } from './index'

describe('Spanish content', () => {
  it('has a title, a summary and one prompt per step for every lesson', () => {
    for (const l of lessons) {
      const es = lessonText(l, 'es')
      expect(es.title, l.slug).not.toBe(l.title)
      expect(es.summary.length, l.slug).toBeGreaterThan(10)
      expect(es.steps, l.slug).toHaveLength(l.steps.length)
      for (const p of es.steps) expect(p.length).toBeGreaterThan(5)
    }
    expect(spanishCoverage.lessons().every((l) => l.has === l.steps)).toBe(true)
  })

  it('keeps English as it was', () => {
    for (const l of lessons) {
      expect(lessonText(l, 'en')).toEqual({ title: l.title, summary: l.summary, steps: l.steps.map((s) => s.prompt) })
    }
  })

  it('translates every topic, in the same order', () => {
    expect(spanishCoverage.topics().spanish).toBe(topics.length)
    for (let i = 0; i < topics.length; i++) {
      expect(topicText(i, 'es')).not.toBe(topics[i])
      expect(topicText(i, 'en')).toBe(topics[i])
    }
  })

  it('translates every two-halves picture', () => {
    for (const s of halfSubjects) {
      const es = halfText(s, 'es')
      expect(es.title, s.slug).not.toBe(s.title)
      expect(es.prompt.length).toBeGreaterThan(10)
      expect(halfText(s, 'en')).toEqual({ title: s.title, prompt: s.prompt })
    }
  })
})
