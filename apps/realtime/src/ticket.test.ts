import { describe, expect, it } from 'vitest'
import { signTicket, ticketFromProtocolHeader, verifyTicket } from './ticket'

const SECRET = 'test-secret-test-secret-test-secret'
const claims = { sub: 'user-1', name: 'Mara', rid: 'room-uuid', code: 'ABCD23', cap: 2, lesson: null }
const NOW = 1_800_000_000

describe('tickets', () => {
  it('round-trips the claims', async () => {
    const ticket = await signTicket(SECRET, claims, NOW)
    expect(await verifyTicket(SECRET, ticket, NOW + 5)).toEqual({ ...claims, game: 'free', exp: NOW + 60 })
  })

  it('expires after 60 seconds', async () => {
    const ticket = await signTicket(SECRET, claims, NOW)
    expect(await verifyTicket(SECRET, ticket, NOW + 60)).not.toBeNull()
    expect(await verifyTicket(SECRET, ticket, NOW + 61)).toBeNull()
  })

  it('rejects a ticket signed with another secret', async () => {
    const ticket = await signTicket('another-secret-another-secret-0000', claims, NOW)
    expect(await verifyTicket(SECRET, ticket, NOW)).toBeNull()
  })

  it('rejects a tampered body even when the old signature is kept', async () => {
    const ticket = await signTicket(SECRET, claims, NOW)
    const [, sig] = ticket.split('.')
    const forged = btoa(JSON.stringify({ ...claims, sub: 'someone-else', exp: NOW + 60 }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(await verifyTicket(SECRET, `${forged}.${sig}`, NOW)).toBeNull()
  })

  it('rejects garbage without throwing', async () => {
    for (const junk of ['', '.', 'a.b', 'a.b.c', '!!!.???', 'x'.repeat(2000)]) {
      expect(await verifyTicket(SECRET, junk, NOW)).toBeNull()
    }
  })

  it('reads the ticket from the subprotocol header', () => {
    expect(ticketFromProtocolHeader('penduet.v1, abc.def', 'penduet.v1')).toBe('abc.def')
    expect(ticketFromProtocolHeader('penduet.v1,abc.def', 'penduet.v1')).toBe('abc.def')
    expect(ticketFromProtocolHeader('other, abc.def', 'penduet.v1')).toBeNull()
    expect(ticketFromProtocolHeader('penduet.v1', 'penduet.v1')).toBeNull()
    expect(ticketFromProtocolHeader(null, 'penduet.v1')).toBeNull()
  })
})
