import type { Limiter } from './limiter'
import type { Room } from './room'

export interface Env {
  ROOM: DurableObjectNamespace<Room>
  LIMITER: DurableObjectNamespace<Limiter>
  /** https://<project>.supabase.co. Not a secret. */
  SUPABASE_URL: string
  /** The project's publishable (anon) key. Public by design: access is decided by RLS and the user's JWT. */
  SUPABASE_ANON_KEY: string
  /** HMAC key for socket tickets. A secret: `wrangler secret put TICKET_SECRET`. At least 32 random bytes. */
  TICKET_SECRET: string
  /** Comma separated origins allowed to call the API and open sockets, e.g. https://app.example.com */
  ALLOWED_ORIGINS: string
  /** Cloudflare Turnstile secret. When set, guests must send a valid token to create a room. */
  TURNSTILE_SECRET?: string
}
