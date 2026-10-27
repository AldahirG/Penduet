import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { CircleAlert } from 'lucide-react'
import { cn } from './cn'

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  /** Always visible. Placeholders are not labels. */
  label: string
  hint?: string
  /** Error message. Shown with an icon and linked to the input. */
  error?: string
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { label, hint, error, className, ...rest },
  ref,
) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'min-h-touch w-full rounded-md border bg-bg px-3 text-base text-fg placeholder:text-muted',
          'disabled:cursor-not-allowed disabled:opacity-45',
          error ? 'border-danger' : 'border-input',
        )}
        {...rest}
      />
      {hint && !error ? (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-center gap-1 text-sm text-danger">
          <CircleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  )
})
