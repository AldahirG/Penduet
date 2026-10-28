import { useEffect, useRef, useState } from 'react'
import { sfx } from '../sound/sfx'

/** Milliseconds left until `deadline`, refreshed ten times a second while there is one. */
export function useRemaining(deadline: number | null): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (deadline === null) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(id)
  }, [deadline])
  return deadline === null ? 0 : Math.max(0, deadline - now)
}

/** How long the current phase lasts, learned from the first time it is seen (the room may be running at any pace). */
export function usePhaseLength(key: string, remaining: number): number {
  const seen = useRef({ key: '', total: 1 })
  if (seen.current.key !== key) seen.current = { key, total: Math.max(1, remaining) }
  return seen.current.total
}

export const seconds = (ms: number): number => Math.ceil(ms / 1000)

/** A soft tick for each of the last `from` seconds. Louder for the last three. */
export function useTickSound(remainingMs: number, active: boolean, from = 5): void {
  const s = seconds(remainingMs)
  const last = useRef(s)
  useEffect(() => {
    if (active && s !== last.current && s >= 1 && s <= from) sfx.tick(s <= 3)
    last.current = s
  }, [s, active, from])
}

/** True under the system's "reduce motion" setting. Sounds and layout do not change; the flashiest effects are skipped. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}
