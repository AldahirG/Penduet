import { useMemo } from 'react'
import type { GuidePoint } from '@penduet/lessons'
import { cn } from '../ui/cn'
import { handLine } from './handDrawn'

export interface GuideOverlayProps {
  guide: GuidePoint[][]
  /** Allowed distance from the guide, in logical units. Drawn as a faint band so the target is visible. */
  tolerance: number
  /**
   * After a check: how much of each guide line was traced (0-1). Lines at 0.8 or more turn solid green,
   * the others stay dashed in the warning colour. Omit while drawing.
   */
  result?: number[]
  className?: string
}

const HIT_AT = 0.8

/**
 * The dashed line the learner traces. It sits over the canvas, does not catch pointer events, and is
 * decoration: the step's text prompt says the same thing, so nothing depends on seeing it.
 * The SVG shares the canvas's 1000 x 1000 space, so it lines up at any size.
 */
export function GuideOverlay({ guide, tolerance, result, className }: GuideOverlayProps) {
  // The guide is drawn the way a person would pencil it in: a little off, never off by more than the tolerance.
  const paths = useMemo(() => guide.map((line, i) => handLine(line, { seed: `guide-${i}`, wobble: Math.min(3.5, tolerance / 4) })), [guide, tolerance])
  return (
    <svg
      viewBox="0 0 1000 1000"
      aria-hidden="true"
      focusable="false"
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
    >
      {guide.map((line, i) => {
        const hit = result ? (result[i] ?? 0) >= HIT_AT : null
        return (
          <g key={i}>
            {result ? null : <path d={paths[i]} fill="none" strokeWidth={tolerance * 2} strokeLinecap="round" strokeLinejoin="round" className="stroke-accent" opacity={0.1} />}
            <path
              d={paths[i]}
              fill="none"
              vectorEffect="non-scaling-stroke"
              strokeWidth={hit ? 4.5 : 3.5}
              strokeDasharray={hit ? undefined : '2 9'}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={hit === null ? 'stroke-guide' : hit ? 'stroke-success' : 'stroke-danger'}
            />
            {result ? null : <circle cx={line[0]![0]} cy={line[0]![1]} r={9} className="fill-guide" />}
          </g>
        )
      })}
    </svg>
  )
}
