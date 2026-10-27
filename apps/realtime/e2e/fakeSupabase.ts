import { createServer, type IncomingMessage, type Server } from 'node:http'
import { asUser, createDb, newGuest, type Db } from '../../../packages/db/src/harness'

// A stand-in for the three Supabase endpoints the Worker calls, backed by the real migrations in
// an in-process Postgres. The SQL functions and RLS policies under test are the real ones: only the
// HTTP wrapper (PostgREST and GoTrue) is imitated.

export interface FakeSupabase {
  url: string
  db: Db
  /** Creates a guest and returns a token the fake accepts. Shaped like a JWT so it passes header checks. */
  signInAnonymously(): Promise<{ id: string; token: string }>
  close(): Promise<void>
}

const COMPOSITE_FNS: Record<string, string[]> = { create_room: ['p_lesson_slug'], join_room: ['p_code'] }
const SCALAR_FNS: Record<string, string[]> = { leave_room: ['p_code'], end_room: ['p_code'], delete_my_account: [] }

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? (JSON.parse(text) as Record<string, unknown>) : {}
}

export async function startFakeSupabase(port: number): Promise<FakeSupabase> {
  const db = await createDb()
  // pglite has one connection and role/claims are session state, so run one request at a time.
  let queue: Promise<unknown> = Promise.resolve()
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn, fn)
    queue = run.catch(() => undefined)
    return run
  }

  // Tokens look like JWTs (supabase-js decodes them) but are unsigned: only this fake reads them.
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const mintToken = (id: string) =>
    `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: id, role: 'authenticated', is_anonymous: true, exp: Math.floor(Date.now() / 1000) + 3600 })}.fakesignature`
  const uidFromToken = (header: string | undefined): string | null => {
    const m = /^Bearer [\w-]+\.([\w-]+)\.[\w-]+$/.exec(header ?? '')
    if (!m) return null
    try {
      const sub = (JSON.parse(Buffer.from(m[1]!, 'base64url').toString('utf8')) as { sub?: unknown }).sub
      return typeof sub === 'string' && /^[0-9a-f-]{36}$/.test(sub) ? sub : null
    } catch {
      return null
    }
  }
  const sessionFor = (id: string) => ({
    access_token: mintToken(id),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: `r-${id}`,
    user: { id, aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  })

  const server: Server = createServer(async (req, res) => {
    // Open CORS: a browser app on another port calls this directly, like it would call Supabase.
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version, prefer, accept-profile, content-profile, accept',
      'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
    }
    const send = (status: number, payload: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json', ...cors })
      res.end(JSON.stringify(payload))
    }
    try {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
      if (req.method === 'OPTIONS') {
        res.writeHead(204, cors)
        return res.end()
      }
      // Guest sign-in and token refresh need no user token, only the apikey header.
      if (url.pathname === '/auth/v1/signup' && req.method === 'POST') {
        const id = await serial(() => newGuest(db))
        return send(200, sessionFor(id))
      }
      if (url.pathname === '/auth/v1/logout') {
        res.writeHead(204, cors)
        return res.end()
      }
      if (url.pathname === '/auth/v1/token' && req.method === 'POST') {
        const refresh = String((await body(req)).refresh_token ?? '')
        const id = /^r-([0-9a-f-]{36})$/.exec(refresh)?.[1]
        return id ? send(200, sessionFor(id)) : send(400, { message: 'invalid refresh token' })
      }
      const uid = uidFromToken(req.headers.authorization)
      if (!uid) return send(401, { message: 'invalid JWT' })
      // Like Supabase for a deleted user: the token still parses, but the account is gone.
      if ((await serial(() => db.query('select 1 from auth.users where id = $1', [uid]))).rows.length === 0) return send(401, { message: 'User from sub claim in JWT does not exist' })

      if (url.pathname === '/auth/v1/user') return send(200, { id: uid, is_anonymous: true })

      const rpc = /^\/rest\/v1\/rpc\/(\w+)$/.exec(url.pathname)
      if (rpc && req.method === 'POST') {
        const fn = rpc[1]!
        const args = await body(req)
        const names = COMPOSITE_FNS[fn] ?? SCALAR_FNS[fn]
        if (!names) return send(404, { message: 'no such function' })
        const params = names.map((n) => args[n] ?? null)
        const placeholders = params.map((_, i) => `$${i + 1}`).join(', ')
        const sql = COMPOSITE_FNS[fn]
          ? `select to_jsonb(r) as v from ${fn}(${placeholders}) r`
          : `select ${fn}(${placeholders}) as v`
        try {
          const rows = await serial(() => asUser<{ v: unknown }>(db, uid, sql, params))
          return send(200, rows[0]?.v ?? null)
        } catch (e) {
          return send(400, { code: 'P0001', message: e instanceof Error ? e.message : 'error' })
        }
      }

      if (url.pathname === '/rest/v1/rooms') {
        const code = (url.searchParams.get('code') ?? '').replace(/^eq\./, '')
        const rows = await serial(() =>
          asUser(
            db,
            uid,
            `select id, code, host_id, lesson_slug, capacity, status from rooms where code = $1 and status in ('open','active')`,
            [code],
          ),
        )
        return send(200, rows)
      }

      if (url.pathname === '/rest/v1/profiles') {
        const id = (url.searchParams.get('id') ?? '').replace(/^eq\./, '')
        if (req.method === 'PATCH') {
          const patch = await body(req)
          try {
            // Only the columns the real grants allow: anything else fails like it would on Supabase.
            const cols = Object.keys(patch)
            const sets = cols.map((c, i) => `${c.replace(/[^a-z_]/g, '')} = $${i + 2}`).join(', ')
            await serial(() => asUser(db, uid, `update profiles set ${sets} where id = $1`, [id, ...cols.map((c) => patch[c])]))
            res.writeHead(204, cors)
            return res.end()
          } catch (e) {
            return send(400, { code: '42501', message: e instanceof Error ? e.message : 'error' })
          }
        }
        const rows = await serial(() => asUser(db, uid, 'select display_name, is_guest from profiles where id = $1', [id]))
        // .single() asks for one object instead of a list
        return send(200, String(req.headers.accept ?? '').includes('pgrst.object') ? rows[0] ?? null : rows)
      }
      return send(404, { message: 'not found' })
    } catch (e) {
      return send(500, { message: e instanceof Error ? e.message : 'error' })
    }
  })
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve))

  return {
    url: `http://127.0.0.1:${port}`,
    db,
    async signInAnonymously() {
      const id = await serial(() => newGuest(db))
      return { id, token: mintToken(id) }
    },
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()))
      await db.close()
    },
  }
}
