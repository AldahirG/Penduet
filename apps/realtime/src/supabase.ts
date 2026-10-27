import type { RoomApiErrorCode } from '@penduet/protocol'
import type { Env } from './env'

/** An error the API can return to the caller as is. Nothing in it comes from the upstream body. */
export class ApiError extends Error {
  constructor(
    readonly code: RoomApiErrorCode,
    readonly status: number,
    /** Seconds the caller should wait. Sent as Retry-After. */
    readonly retryAfter?: number,
  ) {
    super(code)
  }
}

export interface DbRoom {
  id: string
  code: string
  host_id: string
  lesson_slug: string | null
  capacity: number
  status: string
}

// What our SQL functions raise (see supabase/migrations/0001) mapped to what the API says.
const SQL_ERRORS: Record<string, ApiError> = {
  not_authenticated: new ApiError('not_authenticated', 401),
  room_not_found: new ApiError('room_not_found', 404),
  room_full: new ApiError('room_full', 409),
  too_many_rooms: new ApiError('too_many_rooms', 429),
  bad_lesson: new ApiError('bad_request', 400),
}

const TIMEOUT_MS = 8000

function headers(env: Env, jwt: string, extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${jwt}`, ...extra }
}

async function upstream(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    throw new ApiError('server_error', 502)
  }
}

/**
 * Asks Supabase Auth who the token belongs to. The Worker never trusts a JWT it decoded itself:
 * Supabase checks signature, expiry and revocation, whichever signing key the project uses.
 */
export async function getUser(env: Env, jwt: string): Promise<{ id: string; isAnonymous: boolean }> {
  const res = await upstream(`${env.SUPABASE_URL}/auth/v1/user`, { headers: headers(env, jwt) })
  if (res.status === 401 || res.status === 403) throw new ApiError('not_authenticated', 401)
  if (!res.ok) throw new ApiError('server_error', 502)
  const body = (await res.json()) as { id?: unknown; is_anonymous?: unknown }
  if (typeof body.id !== 'string') throw new ApiError('server_error', 502)
  return { id: body.id, isAnonymous: body.is_anonymous === true }
}

/** Calls a SQL function as the user, so auth.uid() inside it is the caller. */
export async function rpc<T>(env: Env, jwt: string, fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await upstream(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: headers(env, jwt, { 'content-type': 'application/json' }),
    body: JSON.stringify(args),
  })
  if (res.ok) return (await res.json()) as T
  let message = ''
  try {
    message = String(((await res.json()) as { message?: unknown }).message ?? '')
  } catch {
    // not JSON: fall through to a generic error
  }
  if (res.status === 401) throw new ApiError('not_authenticated', 401)
  throw SQL_ERRORS[message] ?? new ApiError('server_error', 502)
}

/** The caller's own room row, or null. RLS only returns it to a current member. */
export async function getMyRoom(env: Env, jwt: string, code: string): Promise<DbRoom | null> {
  const query = `code=eq.${encodeURIComponent(code)}&status=in.(open,active)&select=id,code,host_id,lesson_slug,capacity,status`
  const res = await upstream(`${env.SUPABASE_URL}/rest/v1/rooms?${query}`, { headers: headers(env, jwt) })
  if (res.status === 401) throw new ApiError('not_authenticated', 401)
  if (!res.ok) throw new ApiError('server_error', 502)
  const rows = (await res.json()) as DbRoom[]
  return rows[0] ?? null
}

/** The caller's own display name. Falls back to a neutral label rather than failing a join. */
export async function getMyName(env: Env, jwt: string, userId: string): Promise<string> {
  try {
    const res = await upstream(
      `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=display_name`,
      { headers: headers(env, jwt) },
    )
    if (res.ok) {
      const rows = (await res.json()) as { display_name?: unknown }[]
      const name = rows[0]?.display_name
      if (typeof name === 'string' && name.length > 0) return name.slice(0, 30)
    }
  } catch {
    // use the fallback
  }
  return 'Artist'
}

/** Cloudflare Turnstile server-side check. */
export async function verifyTurnstile(secret: string, token: string, ip: string | null): Promise<boolean> {
  const form = new URLSearchParams({ secret, response: token })
  if (ip) form.set('remoteip', ip)
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    return res.ok && ((await res.json()) as { success?: unknown }).success === true
  } catch {
    return false
  }
}
