import { z } from 'zod'
import { TICKET_TTL_SECONDS } from '@penduet/protocol'

// A ticket is a short-lived pass to one room's WebSocket: base64url(claims) + '.' + base64url(HMAC).
// It travels in Sec-WebSocket-Protocol, not the URL, so it does not end up in access logs.

export const ticketClaimsSchema = z.object({
  sub: z.string().min(1).max(64), // Supabase user id
  name: z.string().min(1).max(30), // display name at the time the ticket was issued
  rid: z.string().min(1).max(64), // rooms.id. The Durable Object is named by it, never by the code
  code: z.string().length(6),
  cap: z.number().int().min(2).max(10),
  lesson: z.string().max(64).nullable(),
  exp: z.number().int(), // unix seconds
})
export type TicketClaims = z.infer<typeof ticketClaimsSchema>

const enc = new TextEncoder()
const dec = new TextDecoder()

function b64urlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null
  try {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
    return Uint8Array.from(bin, (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}

function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage])
}

export async function signTicket(
  secret: string,
  claims: Omit<TicketClaims, 'exp'>,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<string> {
  const body = b64urlEncode(enc.encode(JSON.stringify({ ...claims, exp: nowSeconds + TICKET_TTL_SECONDS })))
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), enc.encode(body))
  return `${body}.${b64urlEncode(new Uint8Array(sig))}`
}

/** Returns the claims, or null for anything wrong: format, signature, shape or expiry. */
export async function verifyTicket(
  secret: string,
  ticket: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<TicketClaims | null> {
  if (ticket.length > 1024) return null
  const parts = ticket.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts as [string, string]
  const sigBytes = b64urlDecode(sig)
  if (!sigBytes) return null
  // subtle.verify compares in constant time.
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret, 'verify'), sigBytes, enc.encode(body))
  if (!ok) return null
  const raw = b64urlDecode(body)
  if (!raw) return null
  let json: unknown
  try {
    json = JSON.parse(dec.decode(raw))
  } catch {
    return null
  }
  const parsed = ticketClaimsSchema.safeParse(json)
  if (!parsed.success || parsed.data.exp < nowSeconds) return null
  return parsed.data
}

/** Pulls the ticket out of 'penduet.v1, <ticket>'. Returns null unless the first token is the protocol. */
export function ticketFromProtocolHeader(header: string | null, protocol: string): string | null {
  if (!header) return null
  const tokens = header.split(',').map((t) => t.trim())
  if (tokens.length !== 2 || tokens[0] !== protocol) return null
  return tokens[1] || null
}
