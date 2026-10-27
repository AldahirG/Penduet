import { useCallback, useState, useSyncExternalStore } from 'react'
import type { Board } from './board'
import type { CanvasEngine } from './render'

/** Re-renders when the finished strokes change, and says whether `author` has one to undo. */
export function useCanUndo(board: Board, author: string | null): boolean {
  useSyncExternalStore(
    useCallback((fn) => board.subscribe(fn), [board]),
    () => board.revision,
  )
  return author !== null && board.hasStrokesBy(author)
}

/** matchMedia as state. False where matchMedia does not exist (tests). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (fn: () => void) => {
      const mq = window.matchMedia?.(query)
      mq?.addEventListener('change', fn)
      return () => mq?.removeEventListener('change', fn)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia?.(query).matches ?? false)
}

/** Holds the canvas engine the DrawingCanvas reports, and turns it into a downloaded PNG. */
export function useSavePicture(): { onEngine: (e: CanvasEngine | null) => void; save: (name: string) => Promise<void> } {
  const [engine, setEngine] = useState<CanvasEngine | null>(null)
  const save = async (name: string) => {
    if (!engine) return
    const paper = getComputedStyle(document.documentElement).getPropertyValue('--color-canvas').trim() || '#ffffff'
    const blob = await engine.toBlob(paper)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}.png`
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return { onEngine: setEngine, save }
}
