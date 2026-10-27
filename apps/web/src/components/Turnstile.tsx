import { useCallback, useEffect, useRef, useState } from 'react'
import { TURNSTILE_SITE_KEY } from '../data/config'

// Cloudflare Turnstile: a small human check, shown only when a site key is configured. The Worker
// asks guests for the token before it opens a room (see replica/backend.md). A token works once.

interface TurnstileApi {
  render(el: HTMLElement, options: Record<string, unknown>): string
  reset(id: string): void
  remove(id: string): void
}
declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let loading: Promise<TurnstileApi> | null = null

function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const el = document.createElement('script')
    el.src = SCRIPT
    el.async = true
    el.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile missing')))
    el.onerror = () => {
      loading = null // allow another try
      reject(new Error('turnstile failed to load'))
    }
    document.head.appendChild(el)
  })
  return loading
}

export interface TurnstileProps {
  siteKey?: string
  onToken: (token: string | null) => void
  /** Change this to get a fresh challenge, for example after the token was used. */
  resetKey?: number
}

export function Turnstile({ siteKey = TURNSTILE_SITE_KEY, onToken, resetKey = 0 }: TurnstileProps) {
  const box = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const emit = useRef(onToken)
  emit.current = onToken
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!siteKey || !box.current) return
    let gone = false
    loadScript()
      .then((api) => {
        if (gone || !box.current) return
        widget.current = api.render(box.current, {
          sitekey: siteKey,
          callback: (t: string) => emit.current(t),
          'expired-callback': () => emit.current(null),
          'error-callback': () => emit.current(null),
        })
      })
      .catch(() => !gone && setFailed(true))
    return () => {
      gone = true
      if (widget.current) window.turnstile?.remove(widget.current)
      widget.current = null
    }
  }, [siteKey])

  useEffect(() => {
    if (resetKey > 0 && widget.current) {
      emit.current(null)
      window.turnstile?.reset(widget.current)
    }
  }, [resetKey])

  if (!siteKey) return null
  return (
    <div>
      <div ref={box} />
      {failed ? <p className="text-sm text-danger">The human check could not load. Check your connection and reload the page.</p> : null}
    </div>
  )
}

/** The widget, the latest token, and a way to ask for a new one after using it. */
export function useCaptcha(): { widget: React.ReactNode; token: string | null; required: boolean; renew: () => void } {
  const [token, setToken] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const renew = useCallback(() => setResetKey((n) => n + 1), [])
  return {
    widget: TURNSTILE_SITE_KEY ? <Turnstile onToken={setToken} resetKey={resetKey} /> : null,
    token,
    required: TURNSTILE_SITE_KEY !== '',
    renew,
  }
}
