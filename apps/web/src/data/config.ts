// Build-time settings, all public. Secrets never belong in a VITE_ variable: see apps/web/.env.example.

export const REALTIME_URL: string = import.meta.env.VITE_REALTIME_URL ?? 'http://localhost:8787'
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

/** Rooms need a Supabase project for guest sign-in. Without one the app runs in demo mode. */
export const BACKEND_CONFIGURED = SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== ''

/** Worker origin as a WebSocket origin: http -> ws, https -> wss. */
export const toWsUrl = (httpUrl: string) => httpUrl.replace(/^http/, 'ws')

/** Cloudflare Turnstile site key (public). Empty means no human check is shown. */
export const TURNSTILE_SITE_KEY: string = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? ''

/** Who runs the service and how to reach them, shown on the privacy and terms pages. Empty hides the line. */
export const OPERATOR_NAME: string = import.meta.env.VITE_OPERATOR_NAME ?? ''
export const CONTACT_EMAIL: string = import.meta.env.VITE_CONTACT_EMAIL ?? ''
