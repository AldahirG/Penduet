import { useT, type StringKey } from '../i18n'
import { cn } from './cn'

export type PlayerStatus = 'online' | 'drawing' | 'reconnecting' | 'left' | 'waiting'

export interface PlayerChipProps {
  name: string
  /** Which seat the player has. Decides the colour of their avatar and strokes. */
  slot: 1 | 2
  status: PlayerStatus
  isMe?: boolean
  className?: string
}

const statusKey: Record<PlayerStatus, StringKey> = {
  online: 'chip.here',
  drawing: 'chip.drawing',
  reconnecting: 'chip.reconnecting',
  left: 'chip.left',
  waiting: 'chip.waiting',
}

const initialOf = (name: string) => {
  const letter = [...name.trim()].find((c) => /\p{L}|\p{N}/u.test(c))
  return (letter ?? '?').toLocaleUpperCase()
}

/** The avatar, the dot and the colours are decoration: the name and the status text always carry the meaning. */
export function PlayerChip({ name, slot, status, isMe = false, className }: PlayerChipProps) {
  const { t } = useT()
  const word = t(statusKey[status])
  const label = isMe ? t('chip.labelYou', { name, status: word }) : t('chip.label', { name, status: word })
  const away = status === 'left' || status === 'waiting'
  return (
    <span
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-2.5 rounded-pill border bg-raised py-1 pl-1 pr-4 text-sm font-semibold shadow-card transition duration-base ease-out',
        // Not faded: faded text fails contrast. A dashed border says "not here" without touching the text.
        away ? 'border-dashed border-input' : 'border-line',
        status === 'drawing' && 'ring-2 ring-offset-2 ring-offset-bg',
        status === 'drawing' && (slot === 1 ? 'ring-player-1' : 'ring-player-2'),
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'relative grid h-8 w-8 shrink-0 place-items-center rounded-pill font-display text-base font-bold text-white',
          slot === 1 ? 'bg-player-1' : 'bg-player-2',
          away && 'opacity-60',
        )}
      >
        {away ? <span className="h-2.5 w-2.5 rounded-pill border-2 border-white" /> : initialOf(name)}
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-pill border-2 border-raised',
            status === 'online' && 'bg-success',
            status === 'drawing' && 'animate-pulse bg-paint-yellow motion-reduce:animate-none',
            status === 'reconnecting' && 'animate-pulse bg-danger motion-reduce:animate-none',
            away && 'bg-input',
          )}
        />
      </span>
      <span className="flex flex-col leading-tight">
        <span aria-hidden="true">{name}</span>
        <span aria-hidden="true" className="text-xs font-semibold text-muted">
          {isMe ? t('chip.you', { status: word }) : word}
        </span>
      </span>
    </span>
  )
}
