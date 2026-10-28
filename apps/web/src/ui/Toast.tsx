import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { useT } from '../i18n'
import { cn } from './cn'

export type ToastKind = 'info' | 'success' | 'error'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastApi {
  show: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const AUTO_DISMISS_MS = 4000
const MAX_VISIBLE = 2

const icons = { info: Info, success: CircleCheck, error: CircleAlert } as const
const tone: Record<ToastKind, string> = {
  info: 'border-line text-fg',
  success: 'border-success text-success',
  error: 'border-danger text-danger',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setItems((cur) => cur.filter((t) => t.id !== id)), [])

  const api = useMemo<ToastApi>(
    () => ({
      show: (message, kind = 'info') => {
        const id = nextId.current++
        setItems((cur) => [...cur, { id, kind, message }].slice(-MAX_VISIBLE))
      },
    }),
    [],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <ToastView key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const { t } = useT()
  const Icon = icons[item.kind]
  useEffect(() => {
    // Errors stay until dismissed, so nobody misses them.
    if (item.kind === 'error') return
    const t = window.setTimeout(() => onDismiss(item.id), AUTO_DISMISS_MS)
    return () => window.clearTimeout(t)
  }, [item, onDismiss])

  return (
    <div
      role={item.kind === 'error' ? 'alert' : 'status'}
      className={cn(
        'pointer-events-auto flex max-w-content items-center gap-3 rounded-md border bg-raised px-4 py-3 text-sm font-medium shadow-pop',
        tone[item.kind],
      )}
    >
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span className="text-fg">{item.message}</span>
      <button
        type="button"
        aria-label={t('common.dismiss')}
        onClick={() => onDismiss(item.id)}
        className="-mr-2 grid h-touch w-touch place-items-center rounded-md text-muted hover:text-fg"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
