// Drawing colours are content the user picks, not UI roles, so raw hex is fine here.
// Names are what screen readers announce. The tail of the list leaves room for a custom colour later.
export interface PaletteColor {
  name: string
  value: string
}

export const DEFAULT_PALETTE: PaletteColor[] = [
  { name: 'Ink', value: '#1d1b17' },
  { name: 'Slate', value: '#64748b' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Teal', value: '#0d9488' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Pink', value: '#db2777' },
]

export const BRUSH_SIZES = { min: 2, max: 32, presets: { small: 4, medium: 10, large: 20 } } as const
