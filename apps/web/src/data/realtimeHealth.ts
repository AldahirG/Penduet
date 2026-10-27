import { useEffect, useState } from 'react'
import { REALTIME_URL } from './config'

export { REALTIME_URL }

export type RealtimeStatus = 'checking' | 'online' | 'offline'

const TIMEOUT_MS = 3000

/** Pings the Worker's /health once on mount. Used to show whether the co-op service is reachable. */
export function useRealtimeHealth(): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>('checking')

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS)
    fetch(`${REALTIME_URL}/health`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('bad status'))))
      .then((body: { ok?: boolean }) => setStatus(body.ok ? 'online' : 'offline'))
      .catch(() => setStatus('offline'))
      .finally(() => window.clearTimeout(timer))
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [])

  return status
}
