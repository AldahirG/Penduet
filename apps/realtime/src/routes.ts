import {
  WS_SUBPROTOCOL,
  createRoomRequestSchema,
  joinRoomRequestSchema,
  normalizeRoomCode,
  roomCodeSchema,
  type RoomJoined,
} from '@penduet/protocol'
import type { Env } from './env'
import { ApiError, getMyName, getMyRoom, getUser, rpc, verifyTurnstile, type DbRoom } from './supabase'
import { signTicket, ticketFromProtocolHeader, verifyTicket } from './ticket'

const REQUIRED_CONFIG = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'TICKET_SECRET'] as const
const MAX_BODY_BYTES = 2048
const MINUTE = 60_000
const HOUR = 60 * MINUTE

// Limits are per window. The per-IP one runs first and before any call to Supabase, so
// unauthenticated noise costs this Worker a counter and nothing more. Guest accounts are cheap to
// make, which is why the per-user limits alone would not be enough.
const LIMITS = {
  ipAnyRoute: { max: 240, windowMs: MINUTE },
  ipJoin: { max: 60, windowMs: MINUTE },
  userCreate: { max: 10, windowMs: HOUR },
  userJoin: { max: 30, windowMs: MINUTE },
}

// ---- small helpers -------------------------------------------------------------

function allowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
}

function corsHeaders(env: Env, origin: string | null): Record<string, string> {
  if (!origin || !allowedOrigins(env).includes(origin)) return {}
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-max-age': '600',
    vary: 'Origin',
  }
}

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra },
  })
}

function bearer(request: Request): string {
  const header = request.headers.get('authorization') ?? ''
  const match = /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(header)
  if (!match) throw new ApiError('not_authenticated', 401)
  return match[1]!
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) throw new ApiError('bad_request', 400)
  if (text === '') return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new ApiError('bad_request', 400)
  }
}

async function limit(env: Env, key: string, rule: { max: number; windowMs: number }): Promise<void> {
  const result = await env.LIMITER.get(env.LIMITER.idFromName(key)).hit(rule.max, rule.windowMs)
  if (!result.ok) throw new ApiError('rate_limited', 429, result.retryAfter)
}

async function issueTicket(env: Env, jwt: string, userId: string, room: DbRoom): Promise<RoomJoined> {
  const name = await getMyName(env, jwt, userId)
  const ticket = await signTicket(env.TICKET_SECRET, {
    sub: userId,
    name,
    rid: room.id,
    code: room.code,
    cap: room.capacity,
    lesson: room.lesson_slug,
  })
  return { code: room.code, lessonSlug: room.lesson_slug, ticket, isHost: room.host_id === userId }
}

const roomStub = (env: Env, roomId: string) => env.ROOM.get(env.ROOM.idFromName(roomId))

// ---- the router ----------------------------------------------------------------

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const origin = request.headers.get('origin')
  const cors = corsHeaders(env, origin)

  if (url.pathname === '/health') {
    // Public and carries no data, so any origin may read it.
    return json({ ok: true, service: 'realtime' }, 200, { 'access-control-allow-origin': '*' })
  }
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

  // A missing secret is the likeliest first-run mistake. Say which names, never their values.
  const missing = REQUIRED_CONFIG.filter((name) => !env[name])
  if (missing.length > 0 || env.TICKET_SECRET.length < 32) {
    console.error('worker misconfigured', missing.length > 0 ? `missing: ${missing.join(', ')}` : 'TICKET_SECRET shorter than 32 characters')
    return json({ error: 'server_error' }, 500, cors)
  }

  try {
    const res = await route(request, env, url, origin)
    // A Response from a Durable Object upgrade (status 101) must be returned as it is.
    if (res.status === 101) return res
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  } catch (e) {
    if (e instanceof ApiError) {
      const extra: Record<string, string> = { ...cors }
      if (e.retryAfter) extra['retry-after'] = String(e.retryAfter)
      return json({ error: e.code }, e.status, extra)
    }
    // Log the kind of failure only: no request data, tokens or user ids.
    console.error('unhandled', e instanceof Error ? e.name : 'unknown')
    return json({ error: 'server_error' }, 500, cors)
  }
}

async function route(request: Request, env: Env, url: URL, origin: string | null): Promise<Response> {
  const { method } = request
  const path = url.pathname
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'

  const sub = /^\/rooms\/([A-Za-z0-9-]{1,12})\/(ticket|ws|leave|end)$/.exec(path)
  const known = path === '/rooms' || path === '/rooms/join' || sub
  if (!known) return json({ error: 'room_not_found' }, 404)

  await limit(env, `ip:${ip}`, LIMITS.ipAnyRoute)

  if (path === '/rooms' && method === 'POST') return createRoom(request, env, ip)
  if (path === '/rooms/join' && method === 'POST') return joinRoom(request, env, ip)

  if (sub) {
    const code = normalizeRoomCode(sub[1]!)
    // An invalid code is reported as "not found", the same as a valid one nobody is in.
    if (!roomCodeSchema.safeParse(code).success) throw new ApiError('room_not_found', 404)
    const action = sub[2]!
    if (action === 'ws' && method === 'GET') return openSocket(request, env, code, origin)
    if (method === 'POST') {
      if (action === 'ticket') return reconnectTicket(request, env, code)
      if (action === 'leave') return leaveRoom(request, env, code)
      if (action === 'end') return endRoom(request, env, code)
    }
  }
  return json({ error: 'bad_request' }, 405)
}

// ---- handlers ------------------------------------------------------------------

async function createRoom(request: Request, env: Env, ip: string): Promise<Response> {
  const jwt = bearer(request)
  const user = await getUser(env, jwt)
  await limit(env, `create:${user.id}`, LIMITS.userCreate)

  const parsed = createRoomRequestSchema.safeParse(await readJson(request))
  if (!parsed.success) throw new ApiError('bad_request', 400)

  // Guests are free to make, so rooms they open sit behind a Turnstile check once it is configured.
  if (env.TURNSTILE_SECRET && user.isAnonymous) {
    if (!parsed.data.turnstileToken) throw new ApiError('captcha_required', 403)
    const ok = await verifyTurnstile(env.TURNSTILE_SECRET, parsed.data.turnstileToken, ip === 'unknown' ? null : ip)
    if (!ok) throw new ApiError('captcha_failed', 403)
  }

  const room = await rpc<DbRoom>(env, jwt, 'create_room', { p_lesson_slug: parsed.data.lessonSlug ?? null })
  return json(await issueTicket(env, jwt, user.id, room), 201)
}

async function joinRoom(request: Request, env: Env, ip: string): Promise<Response> {
  // Codes are short, so guessing them is the attack to slow down: count by network as well as by user.
  await limit(env, `join-ip:${ip}`, LIMITS.ipJoin)
  const jwt = bearer(request)
  const user = await getUser(env, jwt)
  await limit(env, `join:${user.id}`, LIMITS.userJoin)

  const parsed = joinRoomRequestSchema.safeParse(await readJson(request))
  if (!parsed.success) throw new ApiError('bad_request', 400)

  const room = await rpc<DbRoom>(env, jwt, 'join_room', { p_code: parsed.data.code })
  return json(await issueTicket(env, jwt, user.id, room), 200)
}

/** A new ticket for someone who is already in the room (reconnect). It never adds a member. */
async function reconnectTicket(request: Request, env: Env, code: string): Promise<Response> {
  const jwt = bearer(request)
  const user = await getUser(env, jwt)
  const room = await getMyRoom(env, jwt, code)
  if (!room) throw new ApiError('room_not_found', 404)
  const { ticket, isHost } = await issueTicket(env, jwt, user.id, room)
  return json({ ticket, isHost }, 200)
}

async function openSocket(request: Request, env: Env, code: string, origin: string | null): Promise<Response> {
  // Browsers always send Origin on a WebSocket. Refuse pages we do not serve.
  if (origin && !allowedOrigins(env).includes(origin)) throw new ApiError('not_authenticated', 403)
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'bad_request' }, 426)
  const ticket = ticketFromProtocolHeader(request.headers.get('sec-websocket-protocol'), WS_SUBPROTOCOL)
  const claims = ticket ? await verifyTicket(env.TICKET_SECRET, ticket) : null
  if (!claims || claims.code !== code) throw new ApiError('not_authenticated', 401)
  return roomStub(env, claims.rid).fetch(request)
}

async function leaveRoom(request: Request, env: Env, code: string): Promise<Response> {
  const jwt = bearer(request)
  const user = await getUser(env, jwt)
  const roomId = await rpc<string | null>(env, jwt, 'leave_room', { p_code: code })
  if (roomId) await roomStub(env, roomId).kick(user.id)
  return new Response(null, { status: 204 })
}

async function endRoom(request: Request, env: Env, code: string): Promise<Response> {
  const jwt = bearer(request)
  await getUser(env, jwt)
  const roomId = await rpc<string | null>(env, jwt, 'end_room', { p_code: code })
  // Not the host, or no such live room: the same answer, so this cannot be used to probe codes.
  if (!roomId) throw new ApiError('room_not_found', 404)
  await roomStub(env, roomId).end()
  return new Response(null, { status: 204 })
}
