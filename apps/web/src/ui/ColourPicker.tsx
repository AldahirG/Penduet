import { useId } from 'react'
import { Check } from 'lucide-react'
import type { PaletteColor } from '../drawing/palette'
import { cn } from './cn'

export interface ColourPickerProps {
  colours: PaletteColor[]
  value: string
  onChange: (value: string) => void
  label?: string
}

/** Radio group of swatches. Each swatch has a name so the choice is never colour alone. */
export function ColourPicker({ colours, value, onChange, label = 'Brush colour' }: ColourPickerProps) {
  const name = useId()
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
      {colours.map((c) => {
        const selected = c.value === value
        return (
          <label
            key={c.value}
            title={c.name}
            className="grid h-touch w-touch cursor-pointer place-items-center rounded-md has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
          >
            <input
              type="radio"
              name={name}
              value={c.value}
              checked={selected}
              onChange={() => onChange(c.value)}
              aria-label={c.name}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              style={{ backgroundColor: c.value }}
              className={cn('grid h-9 w-9 place-items-center rounded-pill border border-line', selected && 'ring-2 ring-accent ring-offset-2 ring-offset-bg')}
            >
              {selected ? <Check className="h-4 w-4 text-canvas mix-blend-difference" /> : null}
            </span>
          </label>
        )
      })}
    </div>
  )
}
