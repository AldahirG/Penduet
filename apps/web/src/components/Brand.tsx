import { cn } from '../ui'

/**
 * The Penduet mark: a sun drawn by two people, the ring in one seat's colour and the rays in the other's.
 * It sits on a paper tile, so it looks the same in every theme. Decorative: the wordmark next to it names it.
 */
export function BrandMark({ className }: { className?: string }) {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4
    const [x1, y1] = [32 + Math.cos(a) * 17, 32 + Math.sin(a) * 17]
    const [x2, y2] = [32 + Math.cos(a) * 24, 32 + Math.sin(a) * 24]
    return `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`
  })
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={cn('h-9 w-9 shrink-0', className)}>
      <rect width="64" height="64" rx="16" fill="var(--color-canvas)" />
      <circle cx="32" cy="32" r="9" fill="none" strokeWidth="6" strokeLinecap="round" className="stroke-player-1" />
      {rays.map((d) => (
        <path key={d} d={d} fill="none" strokeWidth="5" strokeLinecap="round" className="stroke-player-2" />
      ))}
    </svg>
  )
}

/** A hand-painted wavy underline. Put it inside an element with the `brush-underline` class. */
export function BrushUnderline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true" focusable="false" className={className}>
      <path
        d="M3 7 C 30 2, 55 11, 85 6 S 150 2, 197 7"
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        pathLength="1"
        vectorEffect="non-scaling-stroke"
        className="draw-line stroke-paint-yellow"
        style={{ ['--i' as string]: 4 }}
      />
    </svg>
  )
}
