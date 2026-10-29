import { useMemo } from 'react'
import { Pencil, Save, Undo2 } from 'lucide-react'
import { HandSketch } from '../drawing/HandSketch'
import type { Pt } from '../drawing/handDrawn'
import { useT } from '../i18n'

const circle = (cx: number, cy: number, r: number, n = 40): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => [cx + r * Math.cos((i / n) * 2 * Math.PI - 1.2), cy + r * Math.sin((i / n) * 2 * Math.PI - 1.2)])

const curve = (a: Pt, c: Pt, b: Pt, n = 24): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    return [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]]
  })

/** What a room with no lesson and no game shows beside the canvas: who is here, and three small tips. */
export function FreeTable({ together }: { together: boolean }) {
  const { t } = useT()
  // Two people and the line that runs between them: a small drawing of what the room is.
  const lines = useMemo(
    () => [
      { points: circle(190, 500, 120), colour: 'var(--color-player-1)' },
      { points: circle(810, 500, 120), colour: 'var(--color-player-2)' },
      { points: curve([320, 470], [500, 250], [680, 470], 28), colour: 'var(--color-ink)' },
      { points: curve([320, 540], [500, 760], [680, 540], 28), colour: 'var(--color-paint-yellow)' },
    ],
    [],
  )
  const tips = [
    { icon: Pencil, text: t('room.free.tip1') },
    { icon: Undo2, text: t('room.free.tip2') },
    { icon: Save, text: t('room.free.tip3') },
  ]
  return (
    <aside aria-labelledby="free-table-title" className="paper flex flex-col gap-3 p-4">
      <div className="h-24 rounded-md" style={{ background: 'color-mix(in srgb, var(--color-paint-yellow) 18%, var(--color-canvas))' }}>
        <HandSketch lines={lines} seed="free-table" width={34} viewBox="0 200 1000 600" className="h-full w-full" />
      </div>
      <h2 id="free-table-title" className="font-display text-lg font-semibold">
        {t('room.free.title')}
      </h2>
      <p className="text-muted">{together ? t('room.free.together') : t('room.free.waiting')}</p>
      <ul className="flex flex-col gap-2 text-sm text-muted">
        {tips.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-2">
            <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent-text" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </aside>
  )
}
