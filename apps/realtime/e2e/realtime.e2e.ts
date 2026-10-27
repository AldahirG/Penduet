import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { WS_SUBPROTOCOL, type ServerMessage } from '@penduet/protocol'
import { startFakeSupabase, type FakeSupabase } from './fakeSupabase'

// End to end: the real Worker and Durable Objects run in `wrangler dev` (workerd), the real SQL
// functions and RLS policies run in an in-process Postgres, and `ws` clients play the browsers.
// Run with: pnpm --filter @penduet/realtime test:e2e

const WORKER_PORT = 8799
const SUPABASE_PORT = 54399
const ORIGIN = 'http://localhost:5173'
const API = `http://127.0.0.1:${WORKER_PORT}`

let supabase: FakeSupabase
let worker: ChildProcess
let workerLog = ''

type Guest = { id: string; token: string }
type Msg = ServerMessage | Record<string, unknown>

class Client {
  msgs: Msg[] = []
  /** Frames that are not JSON, such as the keep-alive pong. */
  raw: string[] = []
  closed: { code: number } | null = null
  constructor(readonly ws: WebSocket) {
    ws.on('message', (data) => {
      const text = data.toString()
      try {
        this.msgs.push(JSON.parse(text) as Msg)
      } catch {
        this.raw.push(text)
      }
    })
    ws.on('close', (code) => (this.closed = { code }))
  }
  send(msg: unknown) {
    this.ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  async waitFor<T extends Msg = Msg>(pred: (m: Msg) => boolean, ms = 4000): Promise<T> {
    const deadline = Date.now() + ms
    for (;;) {
      const hit = this.msgs.find(pred)
      if (hit) return hit as T
      if (Date.now() > deadline) throw new Error(`timed out; got ${JSON.stringify(this.msgs)}`)
      await new Promise((r) => setTimeout(r, 15))
    }
  }
  // The server's close frame arrives at once, but under `wrangler dev` the proxy keeps the TCP
  // connection for about 10 seconds, and the ws library only reports 'close' when it ends.
  async waitClosed(ms = 20_000): Promise<number> {
    const deadline = Date.now() + ms
    while (!this.closed) {
      if (Date.now() > deadline) throw new Error('socket did not close')
      await new Promise((r) => setTimeout(r, 15))
    }
    return this.closed.code
  }
  ofType(type: string) {
    return this.msgs.filter((m) => (m as { type: string }).type === type)
  }
}

const api = async (path: string, guest: Guest, body?: unknown) => {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${guest.token}`, 'content-type': 'application/json', origin: ORIGIN },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  return { status: res.status, json: text ? (JSON.parse(text) as Record<string, any>) : null }
}

/** Waits for a room event whose body has this type. */
const eventOf = (c: Client, type: string) => c.waitFor((m) => (m as any).type === 'event' && (m as any).body?.type === type) as Promise<any>

async function connect(code: string, ticket: string): Promise<Client> {
  const ws = new WebSocket(`ws://127.0.0.1:${WORKER_PORT}/rooms/${code}/ws`, [WS_SUBPROTOCOL, ticket], { origin: ORIGIN })
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve())
    ws.once('error', reject)
    ws.once('unexpected-response', (_req, res) => reject(new Error(`handshake ${res.statusCode}`)))
  })
  return new Client(ws)
}

const stroke = (id: string) => [
  { type: 'stroke_start', id, tool: 'pen', color: '#336699', size: 6 },
  { type: 'stroke_pts', id, pts: [[10, 10, 0.5], [20, 25, 0.6], [40, 60, 0.7]] },
  { type: 'stroke_end', id },
]

async function newRoom() {
  const [host, guest] = [await supabase.signInAnonymously(), await supabase.signInAnonymously()]
  const created = await api('/rooms', host, {})
  expect(created.status).toBe(201)
  const code = created.json!.code as string
  expect(created.json!.isHost).toBe(true)
  const hostClient = await connect(code, created.json!.ticket)
  await hostClient.waitFor((m) => (m as { type: string }).type === 'welcome')
  return { host, guest, code, hostClient }
}

async function waitForWorker() {
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${API}/health`)).ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`worker did not start:\n${workerLog}`)
}

beforeAll(async () => {
  // A worker left over from an earlier run would answer instead of ours, with old code and old state.
  const stale = await fetch(`${API}/health`).then((r) => r.ok, () => false)
  if (stale) throw new Error(`something is already listening on port ${WORKER_PORT}: stop it and run again`)
  supabase = await startFakeSupabase(SUPABASE_PORT)
  const args = [
    'wrangler', 'dev', '--port', String(WORKER_PORT), '--ip', '127.0.0.1', '--local',
    '--var', `SUPABASE_URL:${supabase.url}`,
    '--var', 'SUPABASE_ANON_KEY:anon-key-for-tests',
    '--var', 'TICKET_SECRET:e2e-ticket-secret-e2e-ticket-secret',
    '--var', `ALLOWED_ORIGINS:${ORIGIN}`,
  ]
  worker = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { cwd: process.cwd(), shell: process.platform === 'win32' })
  worker.stdout?.on('data', (d) => (workerLog += d))
  worker.stderr?.on('data', (d) => (workerLog += d))
  await waitForWorker()
}, 120_000)

afterAll(async () => {
  if (worker?.pid) {
    // Kill the whole tree (npx > wrangler > workerd) and wait, or the next run finds a stale worker.
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(worker.pid), '/T', '/F'])
    else worker.kill('SIGTERM')
  }
  await supabase?.close()
})

describe('two people, one room', () => {
  it('creates a room, joins it, and puts each in a different seat', async () => {
    const { guest, code, hostClient } = await newRoom()
    const joined = await api('/rooms/join', guest, { code: code.toLowerCase() })
    expect(joined.status).toBe(200)
    expect(joined.json!.isHost).toBe(false)
    const guestClient = await connect(code, joined.json!.ticket)

    const hostWelcome = hostClient.msgs.find((m) => (m as { type: string }).type === 'welcome') as Extract<ServerMessage, { type: 'welcome' }>
    expect(hostWelcome.you.slot).toBe(1)
    expect(hostWelcome.peer).toBeNull()

    const guestWelcome = await guestClient.waitFor<Extract<ServerMessage, { type: 'welcome' }>>((m) => (m as { type: string }).type === 'welcome')
    expect(guestWelcome.you.slot).toBe(2)
    expect(guestWelcome.peer?.slot).toBe(1)
    expect(guestWelcome.you.name).toMatch(/^Artist /) // the name came from the profile through the signed ticket

    const joinedMsg = await hostClient.waitFor<Extract<ServerMessage, { type: 'peer_joined' }>>((m) => (m as { type: string }).type === 'peer_joined')
    expect(joinedMsg.peer.id).toBe(guest.id)
    hostClient.ws.close()
    guestClient.ws.close()
  })

  it('relays strokes to both sides in one order, and a late joiner gets the finished drawing', async () => {
    const { guest, code, hostClient } = await newRoom()
    const guestTicket = (await api('/rooms/join', guest, { code })).json!.ticket
    const guestClient = await connect(code, guestTicket)
    await guestClient.waitFor((m) => (m as { type: string }).type === 'welcome')

    for (const m of stroke('host-stroke-1')) hostClient.send(m)
    for (const m of stroke('guest-stroke-1')) guestClient.send(m)
    await hostClient.waitFor((m) => (m as any).type === 'event' && (m as any).body?.id === 'guest-stroke-1' && (m as any).body?.type === 'stroke_end')
    await guestClient.waitFor((m) => (m as any).type === 'event' && (m as any).body?.id === 'host-stroke-1' && (m as any).body?.type === 'stroke_end')

    const order = (c: Client) => c.ofType('event').map((m) => (m as { seq: number }).seq)
    expect(order(hostClient)).toEqual(order(guestClient)) // same events, same order, for both
    expect(order(hostClient)).toEqual([...order(hostClient)].sort((a, b) => a - b))
    expect(new Set(order(hostClient)).size).toBe(6)

    // The guest drops and comes back with a fresh ticket. Their snapshot has both strokes.
    guestClient.ws.close()
    await hostClient.waitFor((m) => (m as { type: string }).type === 'peer_left')
    const again = await api(`/rooms/${code}/ticket`, guest)
    expect(again.status).toBe(200)
    const back = await connect(code, again.json!.ticket)
    const welcome = await back.waitFor<Extract<ServerMessage, { type: 'welcome' }>>((m) => (m as { type: string }).type === 'welcome')
    expect(welcome.strokes.map((s) => s.id).sort()).toEqual(['guest-stroke-1', 'host-stroke-1'])
    expect(welcome.strokes[0]!.points).toHaveLength(3)
    expect(welcome.lastSeq).toBeGreaterThanOrEqual(6)
    hostClient.ws.close()
    back.ws.close()
  })

  it('undo removes only your own latest stroke, for both people', async () => {
    const { guest, code, hostClient } = await newRoom()
    const guestClient = await connect(code, (await api('/rooms/join', guest, { code })).json!.ticket)
    await guestClient.waitFor((m) => (m as { type: string }).type === 'welcome')
    for (const m of stroke('host-stroke-1')) hostClient.send(m)
    for (const m of stroke('guest-stroke-1')) guestClient.send(m)
    guestClient.send({ type: 'undo' })
    const undo = (c: Client) => c.waitFor((m) => (m as any).type === 'event' && (m as any).body?.type === 'undo')
    expect(((await undo(hostClient)) as any).from).toBe(guest.id)
    await undo(guestClient)

    hostClient.ws.close()
    await new Promise((r) => setTimeout(r, 100))
    const back = await connect(code, (await api(`/rooms/${code}/ticket`, guest)).json!.ticket)
    const welcome = await back.waitFor<Extract<ServerMessage, { type: 'welcome' }>>((m) => (m as { type: string }).type === 'welcome')
    expect(welcome.strokes.map((s) => s.id)).toEqual(['host-stroke-1'])
    guestClient.ws.close()
    back.ws.close()
  })

  it('a third person cannot get in', async () => {
    const { guest, code, hostClient } = await newRoom()
    await api('/rooms/join', guest, { code })
    const third = await supabase.signInAnonymously()
    const res = await api('/rooms/join', third, { code })
    expect([res.status, res.json]).toEqual([409, { error: 'room_full' }])
    const noTicket = await api(`/rooms/${code}/ticket`, third)
    expect(noTicket.status).toBe(404) // not a member: no way to a socket through the reconnect route either
    hostClient.ws.close()
  })

  it('replaces the older socket of the same person without telling the partner they left', async () => {
    const { guest, code, hostClient } = await newRoom()
    const first = await connect(code, (await api('/rooms/join', guest, { code })).json!.ticket)
    await first.waitFor((m) => (m as { type: string }).type === 'welcome')
    const second = await connect(code, (await api(`/rooms/${code}/ticket`, guest)).json!.ticket)
    await second.waitFor((m) => (m as { type: string }).type === 'welcome')
    expect(await first.waitClosed()).toBe(4001)
    await new Promise((r) => setTimeout(r, 200))
    expect(hostClient.ofType('peer_left')).toHaveLength(0)
    hostClient.ws.close()
    second.ws.close()
  })

  it('answers bad messages with an error and floods with rate_limited, and hangs up on repeat offenders', async () => {
    const { hostClient } = await newRoom()
    hostClient.send('not json')
    hostClient.send({ type: 'stroke_pts', id: 'nope-0000', pts: [[5000, 0, 0]] }) // outside the canvas
    await hostClient.waitFor((m) => (m as any).type === 'error' && (m as any).code === 'bad_message')
    expect(hostClient.ofType('error').length).toBeGreaterThanOrEqual(1)

    for (let i = 0; i < 120; i++) hostClient.send({ type: 'undo' })
    await hostClient.waitFor((m) => (m as any).type === 'error' && (m as any).code === 'rate_limited')

    const other = await newRoom()
    for (let i = 0; i < 25; i++) other.hostClient.send('{bad')
    expect(await other.hostClient.waitClosed()).toBe(1008)
    hostClient.ws.close()
  })

  it('tells both people when the host ends the room, and nobody can come back', async () => {
    const { host, guest, code, hostClient } = await newRoom()
    const guestClient = await connect(code, (await api('/rooms/join', guest, { code })).json!.ticket)
    await guestClient.waitFor((m) => (m as { type: string }).type === 'welcome')

    expect((await api(`/rooms/${code}/end`, guest)).status).toBe(404) // a guest cannot end it
    expect(guestClient.closed).toBeNull()

    expect((await api(`/rooms/${code}/end`, host)).status).toBe(204)
    await guestClient.waitFor((m) => (m as { type: string }).type === 'room_ended')
    await hostClient.waitFor((m) => (m as { type: string }).type === 'room_ended')
    expect(await guestClient.waitClosed()).toBe(4004)

    expect((await api(`/rooms/${code}/ticket`, guest)).status).toBe(404)
    expect((await api('/rooms/join', guest, { code })).status).toBe(404)
  })

  it('leaving closes your socket and tells your partner', async () => {
    const { guest, code, hostClient } = await newRoom()
    const guestClient = await connect(code, (await api('/rooms/join', guest, { code })).json!.ticket)
    await guestClient.waitFor((m) => (m as { type: string }).type === 'welcome')
    const res = await fetch(`${API}/rooms/${code}/leave`, { method: 'POST', headers: { authorization: `Bearer ${guest.token}`, origin: ORIGIN } })
    expect(res.status).toBe(204)
    expect(await guestClient.waitClosed()).toBe(4003)
    await hostClient.waitFor((m) => (m as { type: string }).type === 'peer_left')
    hostClient.ws.close()
  })
})

describe('a lesson shared by two people', () => {
  const result = { accuracy: 92, smoothness: 81, stars: 3, passed: true, hint: 'great', guideCoverage: [1] }
  type Welcome = Extract<ServerMessage, { type: 'welcome' }>

  async function lessonRoom() {
    const [host, guest] = [await supabase.signInAnonymously(), await supabase.signInAnonymously()]
    const created = await api('/rooms', host, { lessonSlug: 'straight-lines' })
    expect(created.status).toBe(201)
    expect(created.json!.lessonSlug).toBe('straight-lines')
    const code = created.json!.code as string
    const hostClient = await connect(code, created.json!.ticket)
    const hostWelcome = await hostClient.waitFor<Welcome>((m) => (m as { type: string }).type === 'welcome')
    const guestClient = await connect(code, (await api('/rooms/join', guest, { code })).json!.ticket)
    const guestWelcome = await guestClient.waitFor<Welcome>((m) => (m as { type: string }).type === 'welcome')
    return { host, guest, code, hostClient, guestClient, hostWelcome, guestWelcome }
  }
  
  it('starts both people on step 1 of the room lesson', async () => {
    const { hostWelcome, guestWelcome, hostClient, guestClient } = await lessonRoom()
    for (const w of [hostWelcome, guestWelcome]) expect(w.lesson).toEqual({ slug: 'straight-lines', step: 0, from: 0, result: null, results: [] })
    hostClient.ws.close()
    guestClient.ws.close()
  })

  it('shares a check, the next step, and a restart with both, and a reconnect sees the same state', async () => {
    const { host, guest, code, hostClient, guestClient } = await lessonRoom()
    for (const m of stroke('host-step0-1')) hostClient.send(m)
    for (const m of stroke('guest-step0-1')) guestClient.send(m)
    await eventOf(hostClient, 'stroke_end')

    guestClient.send({ type: 'step_result', step: 0, result })
    expect((await eventOf(hostClient, 'step_result')).body.result.accuracy).toBe(92)
    await eventOf(guestClient, 'step_result') // the sender gets it back too: the room's order is the truth

    hostClient.send({ type: 'lesson_set', slug: 'straight-lines', step: 1 })
    await eventOf(guestClient, 'lesson_set')
    for (const m of stroke('host-step1-1')) hostClient.send(m)
    await new Promise((r) => setTimeout(r, 150))

    // The guest drops and returns: the snapshot says step 2, where it began, and the step 1 result.
    guestClient.ws.close()
    await hostClient.waitFor((m) => (m as { type: string }).type === 'peer_left')
    const back = await connect(code, (await api(`/rooms/${code}/ticket`, guest)).json!.ticket)
    const w = await back.waitFor<Welcome>((m) => (m as { type: string }).type === 'welcome')
    expect(w.lesson).toMatchObject({ slug: 'straight-lines', step: 1, from: 2, result: null })
    expect(w.lesson!.results[0]).toEqual({ accuracy: 92, smoothness: 81, stars: 3 })
    expect(w.strokes.map((s) => s.id).sort()).toEqual(['guest-step0-1', 'host-step0-1', 'host-step1-1'])

    // Starting step 2 again removes its stroke for everyone, and the earlier drawing stays.
    back.send({ type: 'lesson_set', slug: 'straight-lines', step: 1, restart: true })
    await eventOf(hostClient, 'lesson_set')
    await new Promise((r) => setTimeout(r, 100))
    hostClient.ws.close()
    await back.waitFor((m) => (m as { type: string }).type === 'peer_left')
    const hostAgain = await connect(code, (await api(`/rooms/${code}/ticket`, host)).json!.ticket)
    const w2 = await hostAgain.waitFor<Welcome>((m) => (m as { type: string }).type === 'welcome')
    expect(w2.strokes.map((s) => s.id).sort()).toEqual(['guest-step0-1', 'host-step0-1'])
    expect(w2.lesson).toMatchObject({ step: 1, from: 2, result: null })
    expect(w2.lesson!.results[1]).toBeNull()
    hostAgain.ws.close()
    back.ws.close()
  })

  it('refuses another lesson, and a result for a step the room is not on', async () => {
    const { hostClient, guestClient } = await lessonRoom()
    hostClient.send({ type: 'lesson_set', slug: 'first-shapes', step: 1 })
    await hostClient.waitFor((m) => (m as any).type === 'error' && (m as any).code === 'bad_message')
    guestClient.send({ type: 'step_result', step: 5, result })
    await guestClient.waitFor((m) => (m as any).type === 'error' && (m as any).code === 'bad_message')
    hostClient.ws.close()
    guestClient.ws.close()
  })
})

describe('a stroke that is in progress', () => {
  type Welcome = Extract<ServerMessage, { type: 'welcome' }>

  it('is in the snapshot of someone who connects meanwhile, and is finished for everyone if its author drops', async () => {
    const { host, guest, code, hostClient } = await newRoom()
    hostClient.send({ type: 'stroke_start', id: 'half-stroke-1', tool: 'pen', color: '#336699', size: 6 })
    hostClient.send({ type: 'stroke_pts', id: 'half-stroke-1', pts: [[10, 10, 0.5], [20, 20, 0.5]] })
    await new Promise((r) => setTimeout(r, 150))

    const guestClient = await connect(code, (await api('/rooms/join', guest, { code })).json!.ticket)
    const w = await guestClient.waitFor<Welcome>((m) => (m as { type: string }).type === 'welcome')
    expect(w.strokes).toEqual([]) // not finished yet
    expect(w.open?.map((s) => [s.id, s.points.length])).toEqual([['half-stroke-1', 2]])

    // the author's connection dies mid-stroke: the stroke is finished for them, and the guest is told
    hostClient.ws.terminate()
    await eventOf(guestClient, 'stroke_end')
    await guestClient.waitFor((m) => (m as { type: string }).type === 'peer_left')

    const back = await connect(code, (await api(`/rooms/${code}/ticket`, host)).json!.ticket)
    const w2 = await back.waitFor<Welcome>((m) => (m as { type: string }).type === 'welcome')
    expect(w2.strokes.map((s) => s.id)).toEqual(['half-stroke-1'])
    expect(w2.open ?? []).toEqual([])
    back.ws.close()
    guestClient.ws.close()
  })
})

describe('keep-alive', () => {
  it('answers ping with pong without disturbing the room', async () => {
    const { hostClient } = await newRoom()
    hostClient.send('ping')
    const deadline = Date.now() + 4000
    while (!hostClient.raw.includes('pong') && Date.now() < deadline) await new Promise((r) => setTimeout(r, 15))
    expect(hostClient.raw).toContain('pong')
    expect(hostClient.ofType('error')).toHaveLength(0) // not counted as a bad message
    hostClient.ws.close()
  })
})

describe('handshake security', () => {
  it('refuses a socket with no ticket, a forged ticket, or a ticket for a different room code', async () => {
    const { guest, code, hostClient } = await newRoom()
    const other = await api('/rooms', guest, {})
    const open = (path: string, protocols?: string[], origin = ORIGIN) =>
      new Promise<number>((resolve) => {
        const ws = new WebSocket(`ws://127.0.0.1:${WORKER_PORT}${path}`, protocols, { origin })
        ws.once('open', () => { ws.close(); resolve(101) })
        ws.once('unexpected-response', (_req, res) => resolve(res.statusCode ?? 0))
        ws.once('error', () => undefined)
      })
    expect(await open(`/rooms/${code}/ws`)).toBe(401)
    expect(await open(`/rooms/${code}/ws`, [WS_SUBPROTOCOL, 'forged.ticket'])).toBe(401)
    expect(await open(`/rooms/${code}/ws`, [WS_SUBPROTOCOL, other.json!.ticket])).toBe(401) // right ticket, wrong room
    expect(await open(`/rooms/${code}/ws`, [WS_SUBPROTOCOL, other.json!.ticket], 'https://evil.example')).toBe(403)
    hostClient.ws.close()
  })

  it('rejects calls without a token and with a token Supabase does not know', async () => {
    const none = await fetch(`${API}/rooms`, { method: 'POST', body: '{}' })
    expect(none.status).toBe(401)
    const bogus = await fetch(`${API}/rooms`, { method: 'POST', headers: { authorization: 'Bearer test.not-a-uuid.signaturesignaturesignature' }, body: '{}' })
    expect(bogus.status).toBe(401)
  })

  it('caps open rooms per host through the SQL rule', async () => {
    const host = await supabase.signInAnonymously()
    for (let i = 0; i < 3; i++) expect((await api('/rooms', host, {})).status).toBe(201)
    const res = await api('/rooms', host, {})
    expect([res.status, res.json]).toEqual([429, { error: 'too_many_rooms' }])
  })
})
