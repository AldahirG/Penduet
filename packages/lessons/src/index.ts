export * from './content'
export * from './score'
export * from './topics'
export * from './halves'
export { mirror } from './shapes'

import { lessons, type Lesson } from './content'

export function findLesson(slug: string): Lesson | undefined {
  return lessons.find((l) => l.slug === slug)
}
