import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { loadDrawing, saveDrawing } from '../data/autosave'
import { Board } from '../drawing/board'
import { DrawingCanvas } from '../drawing/DrawingCanvas'
import { CANVAS_BOX } from '../drawing/layout'
import { useCanUndo, useMediaQuery, useSavePicture } from '../drawing/hooks'
import { BRUSH_SIZES, DEFAULT_PALETTE } from '../drawing/palette'
import { Button, DrawingToolbar, type DrawingTool } from '../ui'
import { usePageTitle } from '../usePageTitle'

const ME = 'me'

// S19 Free draw: a blank canvas on this device. Nothing is sent anywhere.
export function Draw() {
  usePageTitle('Free draw')
  const [board] = useState(() => {
    const b = new Board()
    b.load(loadDrawing())
    return b
  })
  const [tool, setTool] = useState<DrawingTool>('pen')
  const [color, setColor] = useState(DEFAULT_PALETTE[0]!.value)
  const [size, setSize] = useState<number>(BRUSH_SIZES.presets.medium)
  const canUndo = useCanUndo(board, ME)
  const wide = useMediaQuery('(min-width: 768px)')
  const { onEngine, save } = useSavePicture()

  // Keep the picture on this device a moment after each finished stroke.
  useEffect(() => {
    let timer: number | undefined
    const unsubscribe = board.subscribe(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => saveDrawing(board.snapshot()), 400)
    })
    return () => {
      unsubscribe()
      window.clearTimeout(timer)
      saveDrawing(board.snapshot())
    }
  }, [board])

  return (
    <section aria-labelledby="draw-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="draw-title" className="font-display text-xl font-bold">
          Free draw
        </h1>
        <Button variant="secondary" icon={<Download aria-hidden="true" className="h-4 w-4" />} onClick={() => save('drawing')}>
          Save as image
        </Button>
      </div>
      <div className="flex flex-col-reverse gap-3 md:flex-row md:items-start">
        <DrawingToolbar
          orientation={wide ? 'vertical' : 'horizontal'}
          tool={tool}
          onToolChange={setTool}
          color={color}
          onColorChange={setColor}
          size={size}
          onSizeChange={setSize}
          canUndo={canUndo}
          onUndo={() => board.undoLast(ME)}
          onClear={() => board.clear()}
        />
        <div className={CANVAS_BOX}>
          <DrawingCanvas board={board} authorId={ME} tool={tool} color={color} size={size} onEngine={onEngine} />
        </div>
      </div>
      <p className="text-sm text-muted">Mouse, finger or pen. Your drawing is kept on this device, so a refresh does not lose it.</p>
    </section>
  )
}
