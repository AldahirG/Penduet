import { CircleAlert, RefreshCw, WifiOff } from 'lucide-react'
import { cn } from './cn'
import { Button } from './Button'

export type ConnectionKind = 'reconnecting' | 'offline' | 'peer-left' | 'room-full' | 'room-expired' | 'replaced'

export interface ConnectionBannerProps {
  kind: ConnectionKind
  /** Optional recovery action, for example retry or leave the room. */
  action?: { label: string; onClick: () => void }
  className?: string
}

const copy: Record<ConnectionKind, { text: string; terminal: boolean }> = {
  reconnecting: { text: 'Lost the connection. Trying to get you back in the room…', terminal: false },
  offline: { text: 'You are offline. Drawings you make now stay on this device only.', terminal: false },
  'peer-left': { text: 'Your partner left the room. You can keep drawing or invite someone else.', terminal: false },
  'room-full': { text: 'This room already has two people in it.', terminal: true },
  'room-expired': { text: 'This room has closed. Start a new one to keep drawing together.', terminal: true },
  replaced: { text: 'You opened this room somewhere else, so drawing is paused here.', terminal: false },
}

/** Always an icon plus a plain sentence, so state never depends on colour alone. */
export function ConnectionBanner({ kind, action, className }: ConnectionBannerProps) {
  const { text, terminal } = copy[kind]
  const Icon = kind === 'reconnecting' ? RefreshCw : kind === 'offline' ? WifiOff : CircleAlert
  return (
    <div
      role="status"
      className={cn(
        'rise flex flex-wrap items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold shadow-card',
        terminal ? 'border border-danger bg-raised text-danger' : 'bg-warning-soft text-warning-text',
        className,
      )}
    >
      <Icon aria-hidden="true" className={cn('h-4 w-4 shrink-0', kind === 'reconnecting' && 'animate-spin motion-reduce:animate-none')} />
      <span className="flex-1">{text}</span>
      {action ? (
        <Button size="sm" variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  )
}
