import { strokeSchema, type Stroke } from '@penduet/protocol'
import { z } from 'zod'

// Free draw keeps its picture on this device, so a refresh or a closed tab does not lose it.
// It is a convenience: if storage is full, blocked or damaged, drawing carries on without it.

const KEY = 'penduet.free-draw.v1'
/** About 2 MB of JSON. Beyond this the picture is not kept, and the person is not interrupted about it. */
const MAX_CHARS = 2_000_000

const listSchema = z.array(strokeSchema)

export function loadDrawing(): Stroke[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = listSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

export function saveDrawing(strokes: Stroke[]): void {
  try {
    if (strokes.length === 0) return window.localStorage.removeItem(KEY)
    const json = JSON.stringify(strokes)
    if (json.length > MAX_CHARS) return
    window.localStorage.setItem(KEY, json)
  } catch {
    // not saved: the drawing is still on screen
  }
}
