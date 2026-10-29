import { useId, useMemo, type CSSProperties } from 'react'
import { handStroke, hashSeed, type Pt } from './handDrawn'

export interface SketchLine {
  points: readonly Pt[]
  colour: string
}

/**
 * Lines as a hand would draw them, in coloured pencil on paper: each line wanders a little, swells and thins, is gone over a
 * second time more lightly, and the whole is roughened and speckled like grain catching on a page.
 * Fills the 1000 x 1000 space of the canvas. Decoration: every use of it sits next to the same thing in words.
 */
export function HandSketch({ lines, seed, width = 24, className, viewBox = '0 0 1000 1000' }: { lines: SketchLine[]; seed: string; width?: number; className?: string; viewBox?: string }) {
  const id = useId().replace(/:/g, '')
  const base = hashSeed(seed)
  const strokes = useMemo(
    () =>
      lines.map((l, i) => ({
        colour: l.colour,
        main: handStroke(l.points, { seed: base + i * 101, wobble: 5, width }),
        // The second pass: thinner, a little off, lighter. What makes it a sketch and not an outline.
        echo: handStroke(l.points, { seed: base + i * 101 + 57, wobble: 7, width: width * 0.32, taper: 0.9 }),
      })),
    [lines, base, width],
  )
  return (
    <svg viewBox={viewBox} aria-hidden="true" focusable="false" className={className ?? 'h-full w-full'} overflow="visible">
      <defs>
        <filter id={`pencil-${id}`} x="-4%" y="-4%" width="108%" height="108%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="5" xChannelSelector="R" yChannelSelector="G" result="rough" />
          <feTurbulence type="fractalNoise" baseFrequency="0.3" numOctaves="2" seed="9" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 2.05" result="holes" />
          <feComposite in="rough" in2="holes" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#pencil-${id})`}>
        {strokes.map((s, i) => (
          <g key={i} className="ink-line" style={{ ['--i' as string]: i } as CSSProperties}>
            <path d={s.echo} fill={s.colour} opacity={0.45} />
            <path d={s.main} fill={s.colour} />
          </g>
        ))}
      </g>
    </svg>
  )
}
