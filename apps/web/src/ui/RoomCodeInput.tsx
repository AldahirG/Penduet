import { useEffect, useId, useRef, useState } from 'react'
import { CircleAlert } from 'lucide-react'
import { ROOM_CODE_LENGTH, normalizeRoomCode } from '@penduet/protocol'
import { useT } from '../i18n'
import { cn } from './cn'

export interface RoomCodeInputProps {
  value: string
  onChange: (value: string) => void
  /** Called once the code is complete and has stayed that way for a moment. */
  onComplete?: (code: string) => void
  /** Message such as "That code does not match an open room." */
  error?: string
  disabled?: boolean
  label?: string
}

const COMPLETE_DELAY_MS = 250

/**
 * One real input, transparent, laid over six decorative cells. That keeps paste, autofill,
 * screen readers and the mobile keyboard working the normal way.
 */
export function RoomCodeInput({ value, onChange, onComplete, error, disabled, label }: RoomCodeInputProps) {
  const { t } = useT()
  const id = useId()
  const errorId = `${id}-error`
  const [focused, setFocused] = useState(false)
  const completeRef = useRef(onComplete)
  completeRef.current = onComplete

  useEffect(() => {
    if (value.length !== ROOM_CODE_LENGTH) return
    const t = window.setTimeout(() => completeRef.current?.(value), COMPLETE_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [value])

  const cells = Array.from({ length: ROOM_CODE_LENGTH }, (_, i) => value[i] ?? '')
  const caret = Math.min(value.length, ROOM_CODE_LENGTH - 1)

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">
        {label ?? t('code.label')}
      </label>
      <div className="relative w-max">
        <div aria-hidden="true" className="flex gap-2">
          {cells.map((ch, i) => (
            <span
              key={i}
              className={cn(
                'grid h-14 w-touch place-items-center rounded-md border bg-bg font-mono text-code font-bold',
                error ? 'border-danger' : 'border-input',
                focused && i === caret && !error && 'border-accent ring-2 ring-accent',
              )}
            >
              {ch}
            </span>
          ))}
        </div>
        <input
          id={id}
          value={value}
          disabled={disabled}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={ROOM_CODE_LENGTH * 2}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => onChange(normalizeRoomCode(e.target.value))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent opacity-0 focus-visible:outline-none"
        />
      </div>
      {error ? (
        <p id={errorId} className="flex items-center gap-1 text-sm text-danger">
          <CircleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  )
}
