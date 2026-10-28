import { CircleAlert, RefreshCw, WifiOff } from 'lucide-react'
import { cn } from './cn'
import { useT, type StringKey } from '../i18n'
import { Button } from './Button'

export type ConnectionKind = 'reconnecting' | 'offline' | 'peer-left' | 'room-full' | 'room-expired' | 'replaced'

export interface ConnectionBannerProps {
  kind: ConnectionKind
  /** Optional recovery action, for example retry or leave the room. */
  action?: { label: string; onClick: () => void }
  className?: string
}

const copy: Record<ConnectionKind, { text: StringKey; terminal: boolean }> = {
  reconnecting: { text: 'banner.reconnecting', terminal: false },
  offline: { text: 'banner.offline', terminal: false },
  'peer-left': { text: 'banner.peerLeft', terminal: false },
  'room-full': { text: 'banner.roomFull', terminal: true },
  'room-expired': { text: 'banner.roomExpired', terminal: true },
  replaced: { text: 'banner.replaced', terminal: false },
}

/** Always an icon plus a plain sentence, so state never depends on colour alone. */
export function ConnectionBanner({ kind, action, className }: ConnectionBannerProps) {
  const { t } = useT()
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
      <span className="flex-1">{t(text)}</span>
      {action ? (
        <Button size="sm" variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  )
}
