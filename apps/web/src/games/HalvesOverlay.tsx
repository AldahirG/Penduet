import type { GuidePoint } from '@penduet/lessons'

/**
 * Drawn over the canvas in a two-halves room: the whole picture as a dashed guide, the line down the
 * middle, and a light shade over the half that is not yours. It catches no pointer events and shares the
 * canvas's 1000 x 1000 space.
 */
export function HalvesOverlay({ guide, side }: { guide: GuidePoint[][]; side: 'left' | 'right' }) {
  const otherX = side === 'left' ? 500 : 0
  return (
    <svg viewBox="0 0 1000 1000" aria-hidden="true" focusable="false" className="pointer-events-none absolute inset-0 h-full w-full">
      <rect x={otherX} y={0} width={500} height={1000} className="fill-fg" opacity={0.07} />
      {guide.map((line, i) => (
        <polyline
          key={i}
          points={line.map(([x, y]) => `${x},${y}`).join(' ')}
          fill="none"
          vectorEffect="non-scaling-stroke"
          strokeWidth={3}
          strokeDasharray="8 8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-guide"
        />
      ))}
      <line x1={500} y1={0} x2={500} y2={1000} vectorEffect="non-scaling-stroke" strokeWidth={2} className="stroke-line" />
    </svg>
  )
}
