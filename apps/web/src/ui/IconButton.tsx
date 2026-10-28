import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from './cn'

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> {
  /** Required: an icon alone has no accessible name. Also used as the tooltip. */
  label: string
  icon: ReactNode
  variant?: 'ghost' | 'filled'
  /** Toggle state. Omit for a plain action button. */
  pressed?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = 'ghost', pressed, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={cn(
        'inline-grid h-touch w-touch min-h-touch min-w-touch place-items-center rounded-md border border-transparent',
        'transition duration-fast ease-out active:scale-90 disabled:cursor-not-allowed disabled:opacity-45',
        pressed ? 'bg-accent-soft text-accent-text shadow-card' : variant === 'filled' ? 'bg-surface text-fg hover:bg-line' : 'text-fg hover:bg-surface',
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true" className="grid place-items-center [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
    </button>
  )
})
