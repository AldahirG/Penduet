import { useT, type StringKey } from '../i18n'
import { cn } from './cn'

export type PlayerStatus = 'online' | 'drawing' | 'reconnecting' | 'left' | 'waiting'

export interface PlayerChipProps {
  name: string
  /** Which seat the player has. Decides the colour of their dot and strokes. */
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

/** The dot is decoration: the name and the status text always carry the meaning. */
export function PlayerChip({ name, slot, status, isMe = false, className }: PlayerChipProps) {
  const { t } = useT()
  const word = t(statusKey[status])
  const label = isMe ? t('chip.labelYou', { name, status: word }) : t('chip.label', { name, status: word })
  return (
    <span
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-2 rounded-pill border bg-raised px-3 py-1 text-sm font-semibold shadow-card',
        // Not faded: faded text fails contrast. A dashed border says "not here" without touching the text.
        status === 'left' || status === 'waiting' ? 'border-dashed border-input' : 'border-line',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'h-3 w-3 rounded-pill ring-2 ring-offset-1 ring-offset-raised',
          slot === 1 ? 'bg-player-1 ring-player-1' : 'bg-player-2 ring-player-2',
          status === 'drawing' && 'animate-pulse motion-reduce:animate-none',
        )}
      />
      <span aria-hidden="true">{name}</span>
      <span aria-hidden="true" className="text-xs text-muted">
        {isMe ? t('chip.you', { status: word }) : word}
      </span>
    </span>
  )
}
