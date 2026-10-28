import { useRef, useState, type KeyboardEvent } from 'react'
import { Eraser, Pencil, Ruler, Trash2, Undo2 } from 'lucide-react'
import { DEFAULT_PALETTE } from '../drawing/palette'
import { cn } from './cn'
import { ColourPicker } from './ColourPicker'
import { IconButton } from './IconButton'
import { Modal } from './Modal'
import { SizeControl } from './SizeControl'

export type DrawingTool = 'pen' | 'eraser'

export interface DrawingToolbarProps {
  tool: DrawingTool
  onToolChange: (tool: DrawingTool) => void
  color: string
  onColorChange: (color: string) => void
  size: number
  onSizeChange: (size: number) => void
  onUndo: () => void
  canUndo: boolean
  onClear: () => void
  /** Wording of the clear confirmation, for places where it does not clear everything. */
  clearCopy?: { title: string; description: string; confirm: string; label?: string }
  /** Vertical rail from md up, horizontal bar on phones. */
  orientation?: 'horizontal' | 'vertical'
}

type Panel = 'colour' | 'size' | null

/**
 * role="toolbar" with a roving tab stop: Tab enters once, arrow keys move between tools,
 * Esc closes an open panel and returns focus to the button that opened it.
 */
export function DrawingToolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  size,
  onSizeChange,
  onUndo,
  canUndo,
  onClear,
  clearCopy,
  orientation = 'horizontal',
}: DrawingToolbarProps) {
  const root = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [panel, setPanel] = useState<Panel>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const vertical = orientation === 'vertical'

  const items = () => Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[data-toolbar-item]:not(:disabled)') ?? [])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && panel) {
      const opener = root.current?.querySelector<HTMLButtonElement>(`[data-panel="${panel}"]`)
      setPanel(null)
      opener?.focus()
      return
    }
    const forward = vertical ? 'ArrowDown' : 'ArrowRight'
    const back = vertical ? 'ArrowUp' : 'ArrowLeft'
    if (e.key !== forward && e.key !== back && e.key !== 'Home' && e.key !== 'End') return
    const list = items()
    const i = list.indexOf(document.activeElement as HTMLButtonElement)
    if (i < 0) return
    e.preventDefault()
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : (i + (e.key === forward ? 1 : -1) + list.length) % list.length
    list[next]?.focus()
  }

  const item = (index: number) => ({
    'data-toolbar-item': '',
    tabIndex: active === index ? 0 : -1,
    onFocus: () => setActive(index),
  })

  const toggle = (p: Exclude<Panel, null>) => setPanel((cur) => (cur === p ? null : p))

  return (
    <div
      ref={root}
      role="toolbar"
      aria-label="Drawing tools"
      aria-orientation={orientation}
      onKeyDown={onKeyDown}
      className={cn(
        'relative inline-flex gap-1 rounded-xl border border-line bg-raised p-1 shadow-card',
        vertical ? 'flex-col' : 'flex-row justify-around',
      )}
    >
      <IconButton label="Pen" icon={<Pencil />} pressed={tool === 'pen'} onClick={() => onToolChange('pen')} {...item(0)} />
      <IconButton label="Eraser" icon={<Eraser />} pressed={tool === 'eraser'} onClick={() => onToolChange('eraser')} {...item(1)} />
      <IconButton label="Undo your last stroke" icon={<Undo2 />} disabled={!canUndo} onClick={onUndo} {...item(2)} />
      <IconButton
        label="Brush colour"
        data-panel="colour"
        aria-expanded={panel === 'colour'}
        pressed={panel === 'colour'}
        icon={<span style={{ backgroundColor: color }} className="h-5 w-5 rounded-pill border border-line" />}
        onClick={() => toggle('colour')}
        {...item(3)}
      />
      <IconButton
        label="Brush size"
        data-panel="size"
        aria-expanded={panel === 'size'}
        pressed={panel === 'size'}
        icon={<Ruler />}
        onClick={() => toggle('size')}
        {...item(4)}
      />
      <IconButton label={clearCopy?.label ?? 'Clear the canvas'} icon={<Trash2 />} onClick={() => setConfirmClear(true)} {...item(5)} />

      {panel ? (
        <div
          className={cn(
            'pop-in absolute z-30 w-64 rounded-xl border border-line bg-raised p-3 shadow-pop',
            vertical ? 'left-full top-0 ml-2 origin-top-left' : 'bottom-full left-0 mb-2 origin-bottom-left',
          )}
        >
          {panel === 'colour' ? (
            <ColourPicker colours={DEFAULT_PALETTE} value={color} onChange={onColorChange} />
          ) : (
            <SizeControl value={size} onChange={onSizeChange} color={tool === 'pen' ? color : undefined} />
          )}
        </div>
      ) : null}

      <Modal
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title={clearCopy?.title ?? 'Clear the whole canvas?'}
        description={clearCopy?.description ?? "Everything on the canvas goes, including your partner's strokes. This cannot be undone."}
        confirm={{
          label: clearCopy?.confirm ?? 'Clear canvas',
          destructive: true,
          onClick: () => {
            setConfirmClear(false)
            onClear()
          },
        }}
      />
    </div>
  )
}
