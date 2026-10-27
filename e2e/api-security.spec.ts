import { request } from 'node:http'
import { test, expect, API, ORIGIN_A, ORIGIN_B, newGuestToken } from './fixtures'
import { WS_SUBPROTOCOL } from '@penduet/protocol'

// The Worker's HTTP and WebSocket surface, called directly: what a stranger, a curious user or a
// script could try. No browser UI involved.

const post = (path: string, init: { token?: string; body?: string; origin?: string } = {}) =>
  fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      'content-type': 'application/json',
      ...(init.origin ? { origin: init.origin } : {}),
    },
    body: init.body ?? '{}',
  })

test.describe('API security and validation', () => {
  test('API-N1 every room route refuses a call with no token or a bad one', async () => {
    for (const path of ['/rooms', '/rooms/join', '/rooms/ABCD23/ticket', '/rooms/ABCD23/leave', '/rooms/ABCD23/end']) {
      expect((await post(path)).status, `${path} without a token`).toBe(401)
      expect((await post(path, { token: 'not-a-token-at-all-but-long-enough' })).status, `${path} with junk`).toBe(401)
    }
  })

  test('API-N2 a token for an account that no longer exists is refused', async () => {
    const forged = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{"sub":"11111111-1111-4111-8111-111111111111"}').toString('base64url')}.sig`
    expect((await post('/rooms', { token: forged })).status).toBe(401)
  })

  test('API-N3 bad bodies get 400, not a crash', async () => {
    const token = await newGuestToken()
    for (const body of ['not json', '{"lessonSlug":"Bad Slug!"}', '{"lessonSlug":42}', JSON.stringify({ pad: 'x'.repeat(5000) })]) {
      const res = await post('/rooms', { token, body })
      expect(res.status, body.slice(0, 30)).toBe(400)
      expect(await res.json()).toEqual({ error: 'bad_request' })
    }
    for (const body of ['{}', '{"code":"AB"}', '{"code":"0O1I"}', '{"code":12345}', '{"code":"' + 'A'.repeat(100) + '"}']) {
      expect((await post('/rooms/join', { token, body })).status, body.slice(0, 30)).toBe(400)
    }
  })

  test('API-N4 unknown routes and wrong methods are plain errors', async () => {
    expect((await fetch(`${API}/nope`)).status).toBe(404)
    expect((await fetch(`${API}/rooms`, { headers: { authorization: 'Bearer x'.repeat(10) } })).status).toBe(405)
    expect((await fetch(`${API}/health`)).status).toBe(200)
  })

  test('API-N5 errors carry no internals: no stack, no token echo, no upstream text', async () => {
    const token = await newGuestToken()
    const res = await post('/rooms/join', { token, body: '{"code":"ZZZZZZ"}' })
    expect(res.status).toBe(404)
    const text = await res.text()
    expect(text).toBe('{"error":"room_not_found"}')
    expect(text).not.toContain(token)
  })

  test('API-N6 only the web origins get CORS headers', async () => {
    for (const origin of [ORIGIN_A, ORIGIN_B]) {
      const res = await fetch(`${API}/rooms`, { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST' } })
      expect(res.status).toBe(204)
      expect(res.headers.get('access-control-allow-origin')).toBe(origin)
    }
    const evil = await fetch(`${API}/rooms`, { method: 'OPTIONS', headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' } })
    expect(evil.headers.get('access-control-allow-origin')).toBeNull()
    const err = await post('/rooms', { origin: 'https://evil.example' })
    expect(err.headers.get('access-control-allow-origin')).toBeNull()
  })

  test('API-N7 a socket needs a valid ticket for this room, and a page from an allowed origin', async ({ page, players }) => {
    players.allow(/WebSocket connection to .* failed/) // the refusals below are the point of the test
    const token = await newGuestToken()
    const mine = (await (await post('/rooms', { token })).json()) as { code: string; ticket: string }
    const other = (await (await post('/rooms', { token: await newGuestToken() })).json()) as { code: string; ticket: string }
    await page.goto('/')
    const open = (code: string, protocols: string[]) =>
      page.evaluate(
        ([url, protos]) =>
          new Promise<string>((resolve) => {
            const ws = new WebSocket(url as string, protos as string[])
            ws.onopen = () => {
              ws.close()
              resolve('open')
            }
            ws.onerror = () => resolve('refused')
          }),
        [`ws://127.0.0.1:8787/rooms/${code}/ws`, protocols],
      )
    expect(await open(mine.code, [WS_SUBPROTOCOL, mine.ticket])).toBe('open')
    expect(await open(mine.code, [WS_SUBPROTOCOL, 'forged.ticket'])).toBe('refused')
    expect(await open(mine.code, [WS_SUBPROTOCOL, other.ticket])).toBe('refused') // a ticket for another room
    expect(await open(mine.code, [WS_SUBPROTOCOL])).toBe('refused')
  })

  test('API-N8 a ticket does not work for the wrong room code, and expires after about a minute (by signature)', async () => {
    const token = await newGuestToken()
    const { ticket } = (await (await post('/rooms', { token })).json()) as { ticket: string }
    const [body, sig] = ticket.split('.')
    const claims = JSON.parse(Buffer.from(body!, 'base64url').toString())
    expect(claims.exp - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(60)
    // changing any claim breaks the signature
    const forged = Buffer.from(JSON.stringify({ ...claims, exp: claims.exp + 3600 })).toString('base64url')
    // fetch() will not send an Upgrade header, so make the request with node:http
    const status = await new Promise<number>((resolve, reject) => {
      const req = request(`${API}/rooms/${claims.code}/ws`, { headers: { connection: 'Upgrade', upgrade: 'websocket', 'sec-websocket-protocol': `${WS_SUBPROTOCOL}, ${forged}.${sig}`, 'sec-websocket-version': '13', 'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==' } }, (res) => resolve(res.statusCode ?? 0))
      req.on('upgrade', () => resolve(101))
      req.on('error', reject)
      req.end()
    })
    expect(status).toBe(401)
  })
})
