export * from './content'
export * from './score'

import { lessons, type Lesson } from './content'

export function findLesson(slug: string): Lesson | undefined {
  return lessons.find((l) => l.slug === slug)
}
