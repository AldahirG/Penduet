import { useId } from 'react'
import { BRUSH_SIZES } from '../drawing/palette'
import { useT, type StringKey } from '../i18n'
import { SegmentedControl } from './SegmentedControl'

export interface SizeControlProps {
  value: number
  onChange: (value: number) => void
  /** Colour of the preview dot. */
  color?: string
}

const sizeWord = (n: number): StringKey => (n <= BRUSH_SIZES.presets.small ? 'size.wordSmall' : n <= BRUSH_SIZES.presets.medium ? 'size.wordMedium' : 'size.wordLarge')

type Preset = 'small' | 'medium' | 'large'
const presetOf = (n: number): Preset | '' =>
  n === BRUSH_SIZES.presets.small ? 'small' : n === BRUSH_SIZES.presets.medium ? 'medium' : n === BRUSH_SIZES.presets.large ? 'large' : ''

export function SizeControl({ value, onChange, color }: SizeControlProps) {
  const { t } = useT()
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={id} className="text-sm font-semibold">
          {t('tool.size')}
        </label>
        {/* The dot shows the stroke width at roughly real size. Its size is data, so it is inline. */}
        <span className="grid h-touch w-touch place-items-center" aria-hidden="true">
          <span className="rounded-pill bg-ink" style={{ width: value, height: value, backgroundColor: color }} />
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={BRUSH_SIZES.min}
        max={BRUSH_SIZES.max}
        value={value}
        aria-valuetext={`${t(sizeWord(value))}, ${value}`}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-touch w-full accent-accent"
      />
      <SegmentedControl<Preset | ''>
        className="self-start"
        label={t('size.presets')}
        value={presetOf(value)}
        onChange={(p) => p && onChange(BRUSH_SIZES.presets[p])}
        options={[
          { value: 'small', label: t('size.small') },
          { value: 'medium', label: t('size.medium') },
          { value: 'large', label: t('size.large') },
        ]}
      />
    </div>
  )
}
