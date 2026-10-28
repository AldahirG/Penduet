import { spawn } from 'node:child_process'
import { startFakeSupabase } from './fakeSupabase'

// A local backend with no accounts: a fake Supabase (real migrations in an in-process Postgres, so
// data resets when this stops) and the real Worker in `wrangler dev`. Point the web app at it with
// apps/web/.env.local:
//
//   VITE_SUPABASE_URL=http://127.0.0.1:54321
//   VITE_SUPABASE_ANON_KEY=local-dev-key
//   VITE_REALTIME_URL=http://127.0.0.1:8787
//
// This is for development only. It trusts any token it minted itself and has no security of its own.

const SUPABASE_PORT = 54321
const WORKER_PORT = 8787

const supabase = await startFakeSupabase(SUPABASE_PORT)
console.log(`fake Supabase on ${supabase.url}`)

const shell = process.platform === 'win32'
const worker = spawn(
  shell ? 'npx.cmd' : 'npx',
  [
    'wrangler', 'dev', '--port', String(WORKER_PORT), '--ip', '127.0.0.1', '--local',
    '--var', `SUPABASE_URL:${supabase.url}`,
    '--var', 'SUPABASE_ANON_KEY:local-dev-key',
    '--var', 'TICKET_SECRET:local-dev-ticket-secret-local-dev-ticket-secret',
    // Optional: TURNSTILE_SECRET=1x0000000000000000000000000000000AA (Cloudflare's always-pass test secret)
    ...(process.env.TURNSTILE_SECRET ? ['--var', `TURNSTILE_SECRET:${process.env.TURNSTILE_SECRET}`] : []),
    // Optional: GAME_SPEED=0.4 runs draw and guess at 40% of its pace (tests use it to keep rounds short).
    ...(process.env.GAME_SPEED ? ['--var', `GAME_SPEED:${process.env.GAME_SPEED}`] : []),
  ],
  { stdio: 'inherit', shell },
)

const stop = () => {
  if (shell && worker.pid) spawn('taskkill', ['/pid', String(worker.pid), '/T', '/F'])
  else worker.kill('SIGTERM')
  void supabase.close().finally(() => process.exit(0))
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
worker.on('exit', () => void supabase.close().finally(() => process.exit(0)))
