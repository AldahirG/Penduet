import { cn } from './cn'

/** Decorative: whatever uses it carries the accessible label (for example aria-busy on a button). */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-pill border-2 border-current border-r-transparent motion-reduce:animate-none',
        className,
      )}
    />
  )
}
