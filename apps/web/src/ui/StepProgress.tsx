import { cn } from './cn'

export interface StepProgressProps {
  /** 1-based number of the step being worked on. */
  current: number
  total: number
  className?: string
}

export function StepProgress({ current, total, className }: StepProgressProps) {
  const done = Math.max(0, Math.min(current - 1, total))
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <p className="text-sm font-semibold">
        Step {Math.min(current, total)} of {total}
      </p>
      <div
        role="progressbar"
        aria-label="Lesson progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={`${done} of ${total} steps finished`}
        className="flex gap-1"
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn(
              'h-2 flex-1 rounded-pill border',
              i < done && 'border-accent bg-accent',
              i === done && 'border-accent bg-accent-soft',
              i > done && 'border-line bg-surface',
            )}
          />
        ))}
      </div>
    </div>
  )
}
