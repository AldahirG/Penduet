import { useEffect, useRef, type PointerEvent } from 'react'
import type { Point } from '@penduet/protocol'
import type { Board, StrokeMeta } from './board'
import { CanvasEngine } from './render'
import { cn } from '../ui/cn'

export interface DrawingCanvasProps {
  board: Board
  /** Who the strokes drawn here belong to. */
  authorId: string
  tool: 'pen' | 'eraser'
  color: string
  size: number
  /** Blocks drawing, for example while a room is reconnecting. */
  disabled?: boolean
  /** Called as the person draws, for sending to a room. Local drawing happens either way. */
  onStrokeStart?: (meta: StrokeMeta) => void
  onStrokePoints?: (id: string, pts: Point[]) => void
  onStrokeEnd?: (id: string) => void
  /** Text for screen readers, for example the lesson step. */
  label?: string
  /** Gives the parent the engine, for exporting a picture. */
  onEngine?: (engine: CanvasEngine | null) => void
  className?: string
}

/** Skip points closer than this (logical units) to the previous one. Keeps the data small. */
const MIN_STEP = 1.5

const newId = () => crypto.randomUUID()

/** A pen reports real pressure. Mouse and touch are drawn at the nominal size. */
const pressureOf = (e: globalThis.PointerEvent) => (e.pointerType === 'pen' ? e.pressure || 0.5 : 0.5)

/**
 * A square drawing surface. Pointer Events cover mouse, touch and pen; coalesced events give the full
 * detail of a fast stroke; `touch-action: none` stops the page scrolling under a finger. Everything is
 * stored in the logical 1000 x 1000 space, so the canvas can be any size on screen.
 */
export function DrawingCanvas({
  board,
  authorId,
  tool,
  color,
  size,
  disabled = false,
  onStrokeStart,
  onStrokePoints,
  onStrokeEnd,
  onEngine,
  label = 'Drawing canvas. Draw with a mouse, a finger or a pen.',
  className,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<CanvasEngine | null>(null)
  const active = useRef<{ pointerId: number; id: string; last: [number, number] } | null>(null)
  const lastPenAt = useRef(0)
  // The latest props for event handlers, without re-binding them on every render.
  const live = useRef({ authorId, tool, color, size, disabled, onStrokeStart, onStrokePoints, onStrokeEnd })
  live.current = { authorId, tool, color, size, disabled, onStrokeStart, onStrokePoints, onStrokeEnd }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const engine = new CanvasEngine(canvas)
    engineRef.current = engine
    const fit = () => {
      const { width } = canvas.getBoundingClientRect()
      if (width > 0) {
        engine.resize(width, Math.min(window.devicePixelRatio || 1, 3))
        board.repaint()
      }
    }
    board.attach(engine)
    fit()
    onEngine?.(engine)
    const observer = new ResizeObserver(fit)
    observer.observe(canvas)
    return () => {
      observer.disconnect()
      board.attach(null)
      onEngine?.(null)
      engineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- board and onEngine are stable by contract
  }, [board])

  // A stroke in progress when the canvas is disabled (or this unmounts) is ended, not left open.
  useEffect(() => {
    if (disabled) finish()
    return () => finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled])

  const toPoint = (e: globalThis.PointerEvent): Point | null => {
    const canvas = canvasRef.current
    const engine = engineRef.current
    if (!canvas || !engine) return null
    const rect = canvas.getBoundingClientRect()
    const [x, y] = engine.toLogical(e.clientX - rect.left, e.clientY - rect.top)
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10, pressureOf(e)]
  }

  const finish = () => {
    const a = active.current
    if (!a) return
    active.current = null
    board.end(live.current.authorId, a.id)
    live.current.onStrokeEnd?.(a.id)
  }

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const cur = live.current
    if (cur.disabled || active.current || (e.pointerType === 'mouse' && e.button !== 0)) return
    // Palm rejection: while a pen is in use, touches are the hand resting on the screen.
    if (e.pointerType === 'pen') lastPenAt.current = Date.now()
    else if (e.pointerType === 'touch' && Date.now() - lastPenAt.current < 1500) return
    const first = toPoint(e.nativeEvent)
    if (!first) return
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId) // keeps the stroke going outside the canvas
    } catch {
      // the pointer is already gone (a very quick tap): draw the dot anyway
    }
    const meta: StrokeMeta = { id: newId(), tool: cur.tool, color: cur.color, size: cur.size }
    active.current = { pointerId: e.pointerId, id: meta.id, last: [first[0], first[1]] }
    board.start(cur.authorId, meta, [first])
    cur.onStrokeStart?.(meta)
    cur.onStrokePoints?.(meta.id, [first])
  }

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const a = active.current
    if (!a || a.pointerId !== e.pointerId) return
    if (e.pointerType === 'pen') lastPenAt.current = Date.now()
    const events = e.nativeEvent.getCoalescedEvents?.() ?? []
    const batch: Point[] = []
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const p = toPoint(ev)
      if (!p) continue
      if (Math.hypot(p[0] - a.last[0], p[1] - a.last[1]) < MIN_STEP) continue
      a.last = [p[0], p[1]]
      batch.push(p)
    }
    if (batch.length === 0) return
    board.points(live.current.authorId, a.id, batch)
    live.current.onStrokePoints?.(a.id, batch)
  }

  const onPointerEnd = (e: PointerEvent<HTMLCanvasElement>) => {
    const a = active.current
    if (!a || a.pointerId !== e.pointerId) return
    // The last position, so a quick flick still reaches where the finger lifted.
    const p = e.type === 'pointerup' ? toPoint(e.nativeEvent) : null
    if (p && Math.hypot(p[0] - a.last[0], p[1] - a.last[1]) >= MIN_STEP) {
      board.points(live.current.authorId, a.id, [p])
      live.current.onStrokePoints?.(a.id, [p])
    }
    finish()
  }

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        'aspect-square w-full touch-none select-none rounded-lg border border-line bg-canvas',
        disabled ? 'cursor-not-allowed opacity-70' : tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair',
        className,
      )}
    />
  )
}
