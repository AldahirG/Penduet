import { t, type StringKey } from '../i18n'
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  roomApiErrorSchema,
  roomCodeSchema,
  roomJoinedSchema,
  ticketResponseSchema,
  type GameKind,
  type RoomApiErrorCode,
} from '@penduet/protocol'
import { BACKEND_CONFIGURED, REALTIME_URL } from './config'
import { accessToken, resetSession } from './session'

// Data layer for rooms. Screens only know the RoomsApi interface. `realRooms` calls the realtime
// Worker with the guest's token; `fakeRooms` is the in-memory stand-in used when no Supabase project
// is configured and in tests.

export type RoomErrorCode =
  | 'room_not_found'
  | 'room_full'
  | 'too_many_rooms'
  | 'rate_limited'
  | 'captcha'
  | 'not_authenticated'
  | 'network'

export class RoomError extends Error {
  readonly code: RoomErrorCode
  constructor(code: RoomErrorCode) {
    super(code)
    this.code = code
  }
}

export interface RoomsApi {
  /** A room for free drawing, for drawing a lesson together when a lesson slug is given, or for a game. */
  create(opts?: { lessonSlug?: string; game?: GameKind; turnstileToken?: string }): Promise<{ code: string }>
  join(code: string): Promise<{ code: string }>
  /** A socket ticket for a room you are already in. */
  ticket(code: string): Promise<{ ticket: string; isHost: boolean }>
  leave(code: string): Promise<void>
  /** Host only. */
  end(code: string): Promise<void>
}

const FROM_API: Record<RoomApiErrorCode, RoomErrorCode> = {
  not_authenticated: 'not_authenticated',
  bad_request: 'network',
  room_not_found: 'room_not_found',
  room_full: 'room_full',
  too_many_rooms: 'too_many_rooms',
  captcha_required: 'captcha',
  captcha_failed: 'captcha',
  rate_limited: 'rate_limited',
  server_error: 'network',
}

const CREATE_ERRORS: Partial<Record<RoomErrorCode, StringKey>> = {
  too_many_rooms: 'err.tooManyRooms',
  rate_limited: 'err.rateLimitedCreate',
  captcha: 'err.captcha',
  not_authenticated: 'err.notAuthenticated',
}

/** Plain wording for why a room could not be created, in the language of the moment. */
export function createErrorText(err: unknown): string {
  const key = err instanceof RoomError ? CREATE_ERRORS[err.code] : undefined
  return t(key ?? 'err.createGeneric')
}

// ---- the real thing ---------------------------------------------------------------

export interface RealRoomsDeps {
  baseUrl: string
  token: () => Promise<string>
  /** Drops the stored guest session, so the next `token()` signs in as a new one. Called once on a 401. */
  reset?: () => Promise<void>
  fetch?: typeof fetch
  now?: () => number
}

/** Tickets from create/join are good for 60 s. Reuse one for the first connect instead of asking again. */
const REUSE_MS = 30_000

export function createRealRooms({ baseUrl, token, reset, fetch: doFetch = fetch, now = Date.now }: RealRoomsDeps): RoomsApi {
  const fresh = new Map<string, { ticket: string; isHost: boolean; at: number }>()

  async function call(path: string, body?: unknown, retried = false): Promise<Response> {
    let jwt: string
    try {
      jwt = await token()
    } catch {
      throw new RoomError('network')
    }
    let res: Response
    try {
      res = await doFetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      throw new RoomError('network')
    }
    if (res.ok) return res
    if (res.status === 401 && reset && !retried) {
      // The token is not accepted any more: start over as a new guest, once. Nothing happened yet, so retrying is safe.
      await reset().catch(() => undefined)
      return call(path, body, true)
    }
    const parsed = roomApiErrorSchema.safeParse(await res.json().catch(() => null))
    throw new RoomError(parsed.success ? FROM_API[parsed.data.error] : 'network')
  }

  async function joined(res: Response) {
    const parsed = roomJoinedSchema.safeParse(await res.json().catch(() => null))
    if (!parsed.success) throw new RoomError('network')
    fresh.set(parsed.data.code, { ticket: parsed.data.ticket, isHost: parsed.data.isHost, at: now() })
    return { code: parsed.data.code }
  }

  return {
    async create(opts) {
      return joined(
        await call('/rooms', {
          ...(opts?.lessonSlug ? { lessonSlug: opts.lessonSlug } : {}),
          ...(opts?.game && opts.game !== 'free' ? { game: opts.game } : {}),
          ...(opts?.turnstileToken ? { turnstileToken: opts.turnstileToken } : {}),
        }),
      )
    },
    async join(code) {
      return joined(await call('/rooms/join', { code }))
    },
    async ticket(code) {
      const cached = fresh.get(code)
      fresh.delete(code)
      if (cached && now() - cached.at < REUSE_MS) return { ticket: cached.ticket, isHost: cached.isHost }
      const parsed = ticketResponseSchema.safeParse(await (await call(`/rooms/${code}/ticket`)).json().catch(() => null))
      if (!parsed.success) throw new RoomError('network')
      return parsed.data
    },
    async leave(code) {
      fresh.delete(code)
      await call(`/rooms/${code}/leave`)
    },
    async end(code) {
      fresh.delete(code)
      await call(`/rooms/${code}/end`)
    },
  }
}

// ---- the stand-in -----------------------------------------------------------------

const known = new Set<string>()
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH))
  return Array.from(bytes, (b) => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]).join('')
}

/** In-memory: only rooms created in this tab can be joined, and there is no live canvas behind them. */
export const fakeRooms: RoomsApi = {
  async create() {
    await delay(300)
    const code = randomCode()
    known.add(code)
    return { code }
  },
  async join(code) {
    await delay(300)
    if (!roomCodeSchema.safeParse(code).success || !known.has(code)) throw new RoomError('room_not_found')
    return { code }
  },
  async ticket() {
    return { ticket: 'demo', isHost: true }
  },
  async leave() {},
  async end() {},
}

/** True when rooms run against the real Worker. False means demo mode: no live canvas. */
export const ROOMS_ARE_LIVE = BACKEND_CONFIGURED

export const rooms: RoomsApi = BACKEND_CONFIGURED
  ? createRealRooms({ baseUrl: REALTIME_URL, token: accessToken, reset: resetSession })
  : fakeRooms
