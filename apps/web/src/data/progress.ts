// What the learner has finished, kept on this device. Lesson progress is not in the database yet:
// the lessons are static content here, and the `attempts` table needs lesson rows that do not exist
// until the authoring tool does (see replica/backend.md).

export interface LessonProgress {
  /** Best result so far. */
  stars: 0 | 1 | 2 | 3
  accuracy: number
  /** ISO time of the best run. */
  at: string
}

const KEY = 'penduet.progress.v1'

type Store = Record<string, LessonProgress>

function read(): Store {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const out: Store = {}
    for (const [slug, v] of Object.entries(parsed as Record<string, Partial<LessonProgress>>)) {
      if (typeof v?.stars === 'number' && v.stars >= 0 && v.stars <= 3 && typeof v.accuracy === 'number' && typeof v.at === 'string') {
        out[slug] = { stars: v.stars as LessonProgress['stars'], accuracy: v.accuracy, at: v.at }
      }
    }
    return out
  } catch {
    return {} // private window, blocked storage, or damaged data: start fresh
  }
}

export function getProgress(): Store {
  return read()
}

/** Keeps the better of the stored result and this one (stars first, then accuracy). */
export function saveResult(slug: string, result: { stars: LessonProgress['stars']; accuracy: number }): LessonProgress {
  const store = read()
  const old = store[slug]
  const better = !old || result.stars > old.stars || (result.stars === old.stars && result.accuracy > old.accuracy)
  const next: LessonProgress = better ? { ...result, at: new Date().toISOString() } : old
  store[slug] = next
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // not saved: the lesson still works
  }
  return next
}
