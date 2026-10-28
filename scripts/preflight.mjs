// Checks what has to be true before real people are sent a link. Run: pnpm preflight
// It reads the values the production build will use: the environment first, then apps/web/.env.production.
// It does not call any service. "FAIL" stops a playtest, "WARN" is worth knowing.
import { existsSync, readFileSync } from 'node:fs'

const read = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : '')
const parse = (text) =>
  Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2]]),
  )

const file = parse(read('apps/web/.env.production'))
const env = (name) => process.env[name] ?? file[name] ?? ''
const isLocal = (url) => /localhost|127\.0\.0\.1|\[::1\]/.test(url)

const results = []
const check = (level, ok, text) => results.push({ level: ok ? 'ok' : level, text })

const realtime = env('VITE_REALTIME_URL')
check('FAIL', realtime !== '' && !isLocal(realtime), 'VITE_REALTIME_URL points at the deployed Worker, not localhost')
check('FAIL', env('VITE_SUPABASE_URL').startsWith('https://') && !isLocal(env('VITE_SUPABASE_URL')), 'VITE_SUPABASE_URL is the real Supabase project (https)')
check('FAIL', env('VITE_SUPABASE_ANON_KEY') !== '' && env('VITE_SUPABASE_ANON_KEY') !== 'local-dev-key', 'VITE_SUPABASE_ANON_KEY is set to the project key')
check('FAIL', env('VITE_OPERATOR_NAME') !== '', 'VITE_OPERATOR_NAME is set (shown on the privacy policy and terms)')
check('FAIL', /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(env('VITE_CONTACT_EMAIL')), 'VITE_CONTACT_EMAIL is set to an address you read')
check('WARN', env('VITE_TURNSTILE_SITE_KEY') !== '', 'VITE_TURNSTILE_SITE_KEY is set (human check on room creation); without it the Worker must not require one')

const wrangler = read('apps/realtime/wrangler.toml')
const origins = (wrangler.match(/ALLOWED_ORIGINS\s*=\s*"([^"]*)"/)?.[1] ?? '').split(',').filter(Boolean)
const real = origins.filter((o) => !isLocal(o))
check('FAIL', real.length > 0, 'ALLOWED_ORIGINS in apps/realtime/wrangler.toml lists the real site origin')
check('WARN', real.every((o) => o.startsWith('https://')), 'every real origin in ALLOWED_ORIGINS is https')

const legal = read('apps/web/src/pages/Legal.tsx')
const stamp = legal.match(/LEGAL_UPDATED = '(\d{4}-\d{2}-\d{2})'/)?.[1]
check('WARN', stamp !== undefined && Date.now() - Date.parse(stamp) < 90 * 24 * 3600 * 1000, `the policy date (${stamp ?? 'missing'}) is under 90 days old: reread it against what the code does`)
check('FAIL', existsSync('LICENSE'), 'LICENSE file is present (all rights reserved)')

for (const r of results) console.log(`${r.level.toUpperCase().padEnd(4)} ${r.text}`)
const failed = results.filter((r) => r.level === 'FAIL').length
const warned = results.filter((r) => r.level === 'WARN').length
console.log(failed === 0 ? `\nReady for a playtest link${warned ? ` (${warned} warning${warned > 1 ? 's' : ''})` : ''}.` : `\nNot ready: ${failed} to fix.`)
process.exit(failed === 0 ? 0 : 1)
