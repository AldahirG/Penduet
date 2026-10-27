import { forwardRef, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from 'react'
import { cn } from './cn'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Shows a spinner, keeps the label, sets aria-busy and ignores clicks. */
  loading?: boolean
  icon?: ReactNode
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:brightness-110',
  secondary: 'border-line bg-surface text-fg hover:bg-line',
  ghost: 'bg-transparent text-accent-text hover:bg-accent-soft',
  danger: 'bg-danger text-on-danger hover:brightness-110',
}

// sm is 36px tall; the ::after pseudo-element extends the hit area to the 44px minimum.
const sizes: Record<ButtonSize, string> = {
  sm: 'relative px-3 py-2 text-sm after:absolute after:inset-x-0 after:-inset-y-1 after:content-[""]',
  md: 'min-h-touch px-4 text-base',
  lg: 'min-h-touch px-6 py-3 text-lg',
}

/** Shared by Button and ButtonLink so a link that looks like a button is still a real link. */
export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra?: string): string {
  return cn(
    'inline-flex min-w-touch items-center justify-center gap-2 rounded-md border border-transparent font-semibold',
    'transition duration-fast ease-out active:translate-y-px',
    'disabled:cursor-not-allowed disabled:opacity-45',
    variants[variant],
    sizes[size],
    extra,
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, icon, disabled, className, children, onClick, type = 'button', ...rest },
  ref,
) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (loading) {
      event.preventDefault()
      return
    }
    onClick?.(event)
  }

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={handleClick}
      className={buttonClasses(variant, size, className)}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  )
})
