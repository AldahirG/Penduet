import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WS_SUBPROTOCOL, roomJoinedSchema } from '@penduet/protocol'
import type { Env } from './env'
import { handleRequest } from './routes'
import { signTicket, verifyTicket } from './ticket'

const SECRET = 'test-secret-test-secret-test-secret'
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.signaturesignaturesignature'
const ROOM = { id: 'room-uuid-1', code: 'ABCD23', host_id: 'user-1', lesson_slug: null, capacity: 2, status: 'open' }

interface UpstreamReply {
  status?: number
  body: unknown
}
type Upstream = Record<string, UpstreamReply | ((url: URL, init?: RequestInit) => UpstreamReply)>

/** A fake Supabase: routes by pathname, records every call. */
function fakeSupabase(routes: Upstream) {
  const calls: { path: string; init?: RequestInit }[] = []
  const fn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    calls.push({ path: url.pathname, init })
    const handler = routes[url.pathname]
    if (!handler) throw new Error(`unexpected upstream call ${url.pathname}`)
    const reply = typeof handler === 'function' ? handler(url, init) : handler
    return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 })
  })
  vi.stubGlobal('fetch', fn)
  return calls
}

function makeEnv(overrides: Partial<Env> = {}) {
  const counters = new Map<string, number>()
  const stub = { fetch: vi.fn(async () => new Response('socket', { status: 200 })), kick: vi.fn(async () => {}), end: vi.fn(async () => {}) }
  const env = {
    SUPABASE_URL: 'https://proj.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    TICKET_SECRET: SECRET,
    ALLOWED_ORIGINS: 'http://localhost:5173, https://app.example.com',
    ROOM: { idFromName: (n: string) => n, get: () => stub },
    LIMITER: {
      idFromName: (n: string) => n,
      get: (key: string) => ({
        hit: async (max: number) => {
          const n = (counters.get(key) ?? 0) + 1
          counters.set(key, n)
          return { ok: n <= max, retryAfter: 42 }
        },
      }),
    },
    ...overrides,
  } as unknown as Env
  return { env, stub, counters }
}

const req = (path: string, init: RequestInit & { auth?: boolean | string } = {}) => {
  const { auth = true, headers, ...rest } = init
  const h = new Headers(headers)
  if (auth) h.set('authorization', `Bearer ${typeof auth === 'string' ? auth : JWT}`)
  if (rest.body && !h.has('content-type')) h.set('content-type', 'application/json')
  return new Request(`https://rt.example.com${path}`, { ...rest, headers: h })
}

const asUser = (isAnonymous = true) => ({ status: 200, body: { id: 'user-1', is_anonymous: isAnonymous } })
const happy = (): Upstream => ({
  '/auth/v1/user': asUser(),
  '/rest/v1/rpc/create_room': { body: ROOM },
  '/rest/v1/rpc/join_room': { body: ROOM },
  '/rest/v1/profiles': { body: [{ display_name: 'Mara' }] },
})

beforeEach(() => vi.stubGlobal('console', { ...console, error: vi.fn() }))
afterEach(() => vi.unstubAllGlobals())

describe('health and routing', () => {
  it('answers /health to anyone, with no auth and no upstream calls', async () => {
    const calls = fakeSupabase({})
    const res = await handleRequest(req('/health', { auth: false }), makeEnv().env)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, service: 'realtime' })
    expect(calls).toHaveLength(0)
  })

  it('returns 404 for unknown paths and 405 for the wrong method', async () => {
    fakeSupabase({})
    const { env } = makeEnv()
    expect((await handleRequest(req('/nope', { auth: false }), env)).status).toBe(404)
    expect((await handleRequest(req('/rooms', { method: 'GET' }), env)).status).toBe(405)
  })
})

describe('configuration', () => {
  it('fails closed with a plain 500 when a secret is missing or too short', async () => {
    const calls = fakeSupabase(happy())
    for (const over of [{ SUPABASE_URL: '' }, { TICKET_SECRET: '' }, { TICKET_SECRET: 'too-short' }]) {
      const res = await handleRequest(req('/rooms', { method: 'POST', body: '{}' }), makeEnv(over).env)
      expect([res.status, await res.text()]).toEqual([500, '{"error":"server_error"}'])
    }
    expect(calls).toHaveLength(0)
  })

  it('still answers /health when configuration is missing', async () => {
    const res = await handleRequest(req('/health', { auth: false }), makeEnv({ TICKET_SECRET: '' }).env)
    expect(res.status).toBe(200)
  })
})

describe('authentication', () => {
  it('rejects a missing or malformed Authorization header before touching Supabase', async () => {
    const calls = fakeSupabase(happy())
    const { env } = makeEnv()
    for (const auth of [false, 'short', 'has spaces in it that is long enough to pass']) {
      const res = await handleRequest(req('/rooms', { method: 'POST', body: '{}', auth }), env)
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'not_authenticated' })
    }
    expect(calls).toHaveLength(0)
  })

  it('rejects a token Supabase does not accept', async () => {
    fakeSupabase({ '/auth/v1/user': { status: 401, body: { msg: 'invalid JWT' } } })
    const res = await handleRequest(req('/rooms', { method: 'POST', body: '{}' }), makeEnv().env)
    expect(res.status).toBe(401)
  })

  it('says 502 and leaks nothing when Supabase is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('connect ECONNREFUSED secret-host') }))
    const res = await handleRequest(req('/rooms', { method: 'POST', body: '{}' }), makeEnv().env)
    expect(res.status).toBe(502)
    const text = await res.text()
    expect(text).toBe('{"error":"server_error"}')
    expect(text).not.toContain(JWT)
  })
})

describe('POST /rooms', () => {
  it('creates a room as the caller and returns a valid ticket', async () => {
    const calls = fakeSupabase(happy())
    const res = await handleRequest(req('/rooms', { method: 'POST', body: JSON.stringify({ lessonSlug: 'straight-lines' }) }), makeEnv().env)
    expect(res.status).toBe(201)
    const body = roomJoinedSchema.parse(await res.json())
    expect(body.code).toBe('ABCD23')
    expect(body.isHost).toBe(true) // ROOM.host_id is user-1
    const claims = await verifyTicket(SECRET, body.ticket)
    expect(claims).toMatchObject({ sub: 'user-1', name: 'Mara', rid: 'room-uuid-1', code: 'ABCD23', cap: 2 })
    // The user's own JWT went to Supabase, so auth.uid() inside the SQL function is the caller.
    const create = calls.find((c) => c.path === '/rest/v1/rpc/create_room')!
    expect((create.init!.headers as Record<string, string>).authorization).toBe(`Bearer ${JWT}`)
    expect(JSON.parse(create.init!.body as string)).toEqual({ p_lesson_slug: 'straight-lines' })
  })

  it('validates the body on the server', async () => {
    fakeSupabase(happy())
    const { env } = makeEnv()
    for (const body of ['{"lessonSlug":"Bad Slug"}', '{"lessonSlug":5}', 'not json', JSON.stringify({ x: 'y'.repeat(5000) })]) {
      const res = await handleRequest(req('/rooms', { method: 'POST', body }), env)
      expect(res.status).toBe(400)
    }
  })

  it('maps SQL errors to API errors', async () => {
    const { env } = makeEnv()
    const cases: [string, number][] = [['too_many_rooms', 429], ['bad_lesson', 400], ['something_unexpected', 502]]
    for (const [message, status] of cases) {
      fakeSupabase({ ...happy(), '/rest/v1/rpc/create_room': { status: 400, body: { code: 'P0001', message, details: 'secret detail' } } })
      const res = await handleRequest(req('/rooms', { method: 'POST', body: '{}' }), env)
      expect(res.status).toBe(status)
      expect(await res.text()).not.toContain('secret detail')
    }
  })

  it('limits how many rooms one user can open per hour', async () => {
    fakeSupabase(happy())
    const { env } = makeEnv()
    const statuses: number[] = []
    for (let i = 0; i < 12; i++) statuses.push((await handleRequest(req('/rooms', { method: 'POST', body: '{}' }), env)).status)
    expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true)
    expect(statuses.slice(10)).toEqual([429, 429])
  })

  it('sends Retry-After with a rate limit response', async () => {
    fakeSupabase(happy())
    const { env } = makeEnv()
    let last!: Response
    for (let i = 0; i < 11; i++) last = await handleRequest(req('/rooms', { method: 'POST', body: '{}' }), env)
    expect(last.status).toBe(429)
    expect(last.headers.get('retry-after')).toBe('42')
    expect(await last.json()).toEqual({ error: 'rate_limited' })
  })
})

describe('Turnstile for guests', () => {
  it('is skipped while no secret is configured', async () => {
    fakeSupabase(happy())
    expect((await handleRequest(req('/rooms', { method: 'POST', body: '{}' }), makeEnv().env)).status).toBe(201)
  })

  it('demands a token from a guest once configured, and checks it', async () => {
    const calls = fakeSupabase({
      ...happy(),
      '/turnstile/v0/siteverify': (_url, init) => ({ body: { success: String(init?.body).includes('response=good') } }),
    })
    const { env } = makeEnv({ TURNSTILE_SECRET: 'ts-secret' })
    const none = await handleRequest(req('/rooms', { method: 'POST', body: '{}' }), env)
    expect([none.status, (await none.json()) as unknown]).toEqual([403, { error: 'captcha_required' }])
    const bad = await handleRequest(req('/rooms', { method: 'POST', body: '{"turnstileToken":"bad"}' }), env)
    expect([bad.status, (await bad.json()) as unknown]).toEqual([403, { error: 'captcha_failed' }])
    const good = await handleRequest(req('/rooms', { method: 'POST', body: '{"turnstileToken":"good"}' }), env)
    expect(good.status).toBe(201)
    expect(calls.filter((c) => c.path === '/rest/v1/rpc/create_room')).toHaveLength(1)
  })

  it('does not ask a signed-in (non-guest) user', async () => {
    fakeSupabase({ ...happy(), '/auth/v1/user': asUser(false) })
    const { env } = makeEnv({ TURNSTILE_SECRET: 'ts-secret' })
    expect((await handleRequest(req('/rooms', { method: 'POST', body: '{}' }), env)).status).toBe(201)
  })
})

describe('POST /rooms/join', () => {
  it('normalises what the person typed before it reaches SQL', async () => {
    const calls = fakeSupabase(happy())
    const res = await handleRequest(req('/rooms/join', { method: 'POST', body: '{"code":" ab-cd 23 "}' }), makeEnv().env)
    expect(res.status).toBe(200)
    const join = calls.find((c) => c.path === '/rest/v1/rpc/join_room')!
    expect(JSON.parse(join.init!.body as string)).toEqual({ p_code: 'ABCD23' })
  })

  it('answers 400 for something that cannot be a code, without calling SQL', async () => {
    const calls = fakeSupabase(happy())
    const res = await handleRequest(req('/rooms/join', { method: 'POST', body: '{"code":"000"}' }), makeEnv().env)
    expect(res.status).toBe(400)
    expect(calls.some((c) => c.path.endsWith('join_room'))).toBe(false)
  })

  it('maps room_full to 409 and room_not_found to 404', async () => {
    const { env } = makeEnv()
    for (const [message, status] of [['room_full', 409], ['room_not_found', 404]] as const) {
      fakeSupabase({ ...happy(), '/rest/v1/rpc/join_room': { status: 400, body: { message } } })
      const res = await handleRequest(req('/rooms/join', { method: 'POST', body: '{"code":"ABCD23"}' }), env)
      expect(res.status).toBe(status)
      expect(await res.json()).toEqual({ error: message })
    }
  })

  it('slows down code guessing per network, even across many different users', async () => {
    let n = 0 // every call is a different guest account
    fakeSupabase({ ...happy(), '/auth/v1/user': () => ({ body: { id: `guest-${n++}`, is_anonymous: true } }) })
    const { env } = makeEnv()
    const statuses: number[] = []
    for (let i = 0; i < 62; i++) {
      statuses.push((await handleRequest(req('/rooms/join', { method: 'POST', body: '{"code":"ABCD23"}', headers: { 'cf-connecting-ip': '203.0.113.7' } }), env)).status)
    }
    expect(statuses.slice(0, 60).every((s) => s === 200)).toBe(true)
    expect(statuses.slice(60)).toEqual([429, 429])
  })
})

describe('reconnect ticket', () => {
  it('issues a ticket to a current member only', async () => {
    const { env } = makeEnv()
    fakeSupabase({ ...happy(), '/rest/v1/rooms': { body: [ROOM] } })
    const ok = await handleRequest(req('/rooms/abcd23/ticket', { method: 'POST' }), env)
    expect(ok.status).toBe(200)
    const issued = (await ok.json()) as { ticket: string; isHost: boolean }
    expect(issued.isHost).toBe(true)
    expect(await verifyTicket(SECRET, issued.ticket)).toMatchObject({ rid: 'room-uuid-1' })

    fakeSupabase({ ...happy(), '/rest/v1/rooms': { body: [] } }) // RLS returns nothing to a non-member
    const no = await handleRequest(req('/rooms/ABCD23/ticket', { method: 'POST' }), env)
    expect([no.status, await no.json()]).toEqual([404, { error: 'room_not_found' }])
  })

  it('never calls join_room, so it cannot add a member', async () => {
    const calls = fakeSupabase({ ...happy(), '/rest/v1/rooms': { body: [ROOM] } })
    await handleRequest(req('/rooms/ABCD23/ticket', { method: 'POST' }), makeEnv().env)
    expect(calls.some((c) => c.path.includes('join_room'))).toBe(false)
  })

  it('treats a malformed code like an unknown room', async () => {
    fakeSupabase(happy())
    expect((await handleRequest(req('/rooms/00/ticket', { method: 'POST' }), makeEnv().env)).status).toBe(404)
  })
})

describe('GET /rooms/:code/ws', () => {
  const ws = (headers: Record<string, string>, code = 'ABCD23') =>
    req(`/rooms/${code}/ws`, { auth: false, headers: { upgrade: 'websocket', ...headers } })
  const ticket = (over = {}) =>
    signTicket(SECRET, { sub: 'user-1', name: 'Mara', rid: 'room-uuid-1', code: 'ABCD23', cap: 2, lesson: null, ...over })

  it('passes a valid ticket through to the room named by the room id', async () => {
    const { env, stub } = makeEnv()
    const res = await handleRequest(ws({ 'sec-websocket-protocol': `${WS_SUBPROTOCOL}, ${await ticket()}` }), env)
    expect(res.status).toBe(200)
    expect(stub.fetch).toHaveBeenCalledOnce()
  })

  it('refuses without a ticket, with a bad one, or one for another room code', async () => {
    const { env, stub } = makeEnv()
    expect((await handleRequest(ws({}), env)).status).toBe(401)
    expect((await handleRequest(ws({ 'sec-websocket-protocol': `${WS_SUBPROTOCOL}, forged.ticket` }), env)).status).toBe(401)
    const other = await ticket({ code: 'WXYZ89' })
    expect((await handleRequest(ws({ 'sec-websocket-protocol': `${WS_SUBPROTOCOL}, ${other}` }), env)).status).toBe(401)
    expect(stub.fetch).not.toHaveBeenCalled()
  })

  it('refuses an expired ticket', async () => {
    const old = await signTicket(SECRET, { sub: 'u', name: 'M', rid: 'r', code: 'ABCD23', cap: 2, lesson: null }, Math.floor(Date.now() / 1000) - 120)
    const { env, stub } = makeEnv()
    expect((await handleRequest(ws({ 'sec-websocket-protocol': `${WS_SUBPROTOCOL}, ${old}` }), env)).status).toBe(401)
    expect(stub.fetch).not.toHaveBeenCalled()
  })

  it('refuses pages from origins that are not allowed', async () => {
    const { env, stub } = makeEnv()
    const t = await ticket()
    const res = await handleRequest(ws({ origin: 'https://evil.example', 'sec-websocket-protocol': `${WS_SUBPROTOCOL}, ${t}` }), env)
    expect(res.status).toBe(403)
    expect(stub.fetch).not.toHaveBeenCalled()
    const ok = await handleRequest(ws({ origin: 'https://app.example.com', 'sec-websocket-protocol': `${WS_SUBPROTOCOL}, ${t}` }), env)
    expect(ok.status).toBe(200)
  })

  it('answers 426 to a plain GET', async () => {
    const res = await handleRequest(req('/rooms/ABCD23/ws', { auth: false }), makeEnv().env)
    expect(res.status).toBe(426)
  })
})

describe('leave and end', () => {
  it('leave drops the socket of the caller only', async () => {
    const { env, stub } = makeEnv()
    fakeSupabase({ ...happy(), '/rest/v1/rpc/leave_room': { body: 'room-uuid-1' } })
    expect((await handleRequest(req('/rooms/ABCD23/leave', { method: 'POST' }), env)).status).toBe(204)
    expect(stub.kick).toHaveBeenCalledWith('user-1')
  })

  it('leave by a non-member is a quiet 204 and touches no room', async () => {
    const { env, stub } = makeEnv()
    fakeSupabase({ ...happy(), '/rest/v1/rpc/leave_room': { body: null } })
    expect((await handleRequest(req('/rooms/ABCD23/leave', { method: 'POST' }), env)).status).toBe(204)
    expect(stub.kick).not.toHaveBeenCalled()
  })

  it('end tells the room when the host ends it, and answers 404 to anyone else', async () => {
    const { env, stub } = makeEnv()
    fakeSupabase({ ...happy(), '/rest/v1/rpc/end_room': { body: 'room-uuid-1' } })
    expect((await handleRequest(req('/rooms/ABCD23/end', { method: 'POST' }), env)).status).toBe(204)
    expect(stub.end).toHaveBeenCalledOnce()

    stub.end.mockClear()
    fakeSupabase({ ...happy(), '/rest/v1/rpc/end_room': { body: null } })
    const res = await handleRequest(req('/rooms/ABCD23/end', { method: 'POST' }), env)
    expect([res.status, await res.json()]).toEqual([404, { error: 'room_not_found' }])
    expect(stub.end).not.toHaveBeenCalled()
  })
})

describe('CORS', () => {
  it('echoes an allowed origin and nothing for others', async () => {
    fakeSupabase(happy())
    const { env } = makeEnv()
    const ok = await handleRequest(req('/rooms', { method: 'OPTIONS', auth: false, headers: { origin: 'http://localhost:5173' } }), env)
    expect(ok.status).toBe(204)
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    const bad = await handleRequest(req('/rooms', { method: 'OPTIONS', auth: false, headers: { origin: 'https://evil.example' } }), env)
    expect(bad.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('adds the header to error responses too, so the browser can read them', async () => {
    fakeSupabase(happy())
    const res = await handleRequest(req('/rooms', { method: 'POST', auth: false, headers: { origin: 'https://app.example.com' } }), makeEnv().env)
    expect(res.status).toBe(401)
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example.com')
  })
})
