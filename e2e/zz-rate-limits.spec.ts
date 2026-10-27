import { test, expect, API, newGuestToken } from './fixtures'

// Runs last: the limits are per minute, per address, and every other spec shares this address.

test('API-N9 guessing room codes is slowed down per network, however many guest accounts are used', async () => {
  const statuses: number[] = []
  for (let i = 0; i < 80; i++) {
    const token = await newGuestToken() // a fresh account every time: per-user limits would never trip
    const res = await fetch(`${API}/rooms/join`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: '{"code":"ZZZZZZ"}',
    })
    statuses.push(res.status)
    if (res.status === 429) {
      expect(res.headers.get('retry-after')).toMatch(/^\d+$/)
      expect(await res.json()).toEqual({ error: 'rate_limited' })
      break
    }
  }
  expect(statuses).toContain(429)
  expect(statuses.filter((s) => s === 404).length).toBeGreaterThan(5) // normal answers came first
})

test('API-N10 one user cannot open rooms faster than the hourly limit', async () => {
  const token = await newGuestToken()
  const statuses: number[] = []
  for (let i = 0; i < 14; i++) {
    const res = await fetch(`${API}/rooms`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: '{}' })
    statuses.push(res.status)
  }
  // three open rooms is the cap; after that the cap answers (429 too_many_rooms) until the hourly limit says rate_limited
  expect(statuses.slice(0, 3)).toEqual([201, 201, 201])
  expect(statuses.slice(3).every((s) => s === 429)).toBe(true)
})
