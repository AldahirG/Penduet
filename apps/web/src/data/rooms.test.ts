import { describe, expect, it, vi } from 'vitest'
import { RoomError, createRealRooms } from './rooms'

const joined = { code: 'ABCD23', lessonSlug: null, ticket: 'tkt', isHost: true }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

function setup(reply: (url: string, init: RequestInit) => Response, now = () => 1000) {
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => reply(String(url), init ?? {}))
  const token = vi.fn(async () => 'jwt-123')
  const api = createRealRooms({ baseUrl: 'https://rt.test', token, fetch: fetch as unknown as typeof globalThis.fetch, now })
  return { api, fetch, token }
}

describe('real rooms client', () => {
  it('creates a room with the guest token and returns the code', async () => {
    const { api, fetch } = setup(() => json(joined, 201))
    expect(await api.create()).toEqual({ code: 'ABCD23' })
    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe('https://rt.test/rooms')
    expect((init!.headers as Record<string, string>).authorization).toBe('Bearer jwt-123')
  })

  it('sends the typed code on join', async () => {
    const { api, fetch } = setup(() => json(joined))
    await api.join('ABCD23')
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({ code: 'ABCD23' })
  })

  it('reuses the ticket from create for the first connect, once', async () => {
    const { api, fetch } = setup((url) => (url.endsWith('/rooms') ? json(joined, 201) : json({ ticket: 'second', isHost: true })))
    await api.create()
    expect(await api.ticket('ABCD23')).toEqual({ ticket: 'tkt', isHost: true })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(await api.ticket('ABCD23')).toEqual({ ticket: 'second', isHost: true })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('does not reuse a ticket that is getting old', async () => {
    let t = 1000
    const { api, fetch } = setup((url) => (url.endsWith('/rooms') ? json(joined, 201) : json({ ticket: 'newer', isHost: false })), () => t)
    await api.create()
    t += 45_000
    expect(await api.ticket('ABCD23')).toEqual({ ticket: 'newer', isHost: false })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['room_full', 409, 'room_full'],
    ['room_not_found', 404, 'room_not_found'],
    ['too_many_rooms', 429, 'too_many_rooms'],
    ['rate_limited', 429, 'rate_limited'],
    ['captcha_required', 403, 'captcha'],
    ['not_authenticated', 401, 'not_authenticated'],
    ['server_error', 502, 'network'],
  ])('maps the API error %s to %s', async (apiError, status, expected) => {
    const { api } = setup(() => json({ error: apiError }, status))
    await expect(api.join('ABCD23')).rejects.toMatchObject({ code: expected })
  })

  it('treats an unreadable error body and a network failure as "network"', async () => {
    const { api } = setup(() => new Response('<html>bad gateway</html>', { status: 502 }))
    await expect(api.create()).rejects.toBeInstanceOf(RoomError)
    await expect(api.create()).rejects.toMatchObject({ code: 'network' })

    const failing = createRealRooms({ baseUrl: 'x', token: async () => 't', fetch: (async () => { throw new TypeError('offline') }) as unknown as typeof fetch })
    await expect(failing.create()).rejects.toMatchObject({ code: 'network' })
  })

  it('treats a failed guest sign-in as "network" and never calls the Worker', async () => {
    const fetch = vi.fn()
    const api = createRealRooms({ baseUrl: 'x', token: async () => { throw new Error('no session') }, fetch: fetch as unknown as typeof globalThis.fetch })
    await expect(api.create()).rejects.toMatchObject({ code: 'network' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('starts over as a new guest once when the token is no longer accepted', async () => {
    let calls = 0
    const reset = vi.fn(async () => {})
    const tokens = ['stale', 'fresh']
    const fetch = vi.fn(async (_u: string | URL | Request, init?: RequestInit) => {
      calls += 1
      const auth = (init!.headers as Record<string, string>).authorization
      return auth === 'Bearer stale' ? json({ error: 'not_authenticated' }, 401) : json(joined, 201)
    })
    const api = createRealRooms({ baseUrl: 'https://rt.test', token: async () => tokens.shift()!, reset, fetch: fetch as unknown as typeof globalThis.fetch })
    expect(await api.create()).toEqual({ code: 'ABCD23' })
    expect(reset).toHaveBeenCalledOnce()
    expect(calls).toBe(2)
  })

  it('does not loop when a fresh guest is refused too', async () => {
    const reset = vi.fn(async () => {})
    const api = createRealRooms({ baseUrl: 'x', token: async () => 't', reset, fetch: (async () => json({ error: 'not_authenticated' }, 401)) as unknown as typeof fetch })
    await expect(api.create()).rejects.toMatchObject({ code: 'not_authenticated' })
    expect(reset).toHaveBeenCalledOnce()
  })

  it('leave and end hit their routes', async () => {
    const { api, fetch } = setup(() => new Response(null, { status: 204 }))
    await api.leave('ABCD23')
    await api.end('ABCD23')
    expect(fetch.mock.calls.map((c) => c[0])).toEqual(['https://rt.test/rooms/ABCD23/leave', 'https://rt.test/rooms/ABCD23/end'])
  })
})
