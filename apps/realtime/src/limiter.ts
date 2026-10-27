import { DurableObject } from 'cloudflare:workers'

export interface LimitResult {
  ok: boolean
  /** Seconds until the window resets. Meaningful when ok is false. */
  retryAfter: number
}

/**
 * A fixed-window counter. One instance per key (for example "join:user:<id>"). The count lives in
 * storage with an alarm at the end of the window, so an idle key leaves nothing behind.
 */
export class Limiter extends DurableObject {
  async hit(limit: number, windowMs: number): Promise<LimitResult> {
    const now = Date.now()
    const w = (await this.ctx.storage.get<{ start: number; n: number }>('w')) ?? { start: now, n: 0 }
    if (now - w.start >= windowMs) {
      w.start = now
      w.n = 0
    }
    w.n += 1
    await this.ctx.storage.put('w', w)
    await this.ctx.storage.setAlarm(w.start + windowMs)
    return { ok: w.n <= limit, retryAfter: Math.max(1, Math.ceil((w.start + windowMs - now) / 1000)) }
  }

  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll()
  }
}
