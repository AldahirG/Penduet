import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { BACKEND_CONFIGURED, SUPABASE_ANON_KEY, SUPABASE_URL } from './config'

// Guest identity. The first time someone needs the backend they are signed in anonymously: a real
// user id with no email or password. supabase-js keeps the session in localStorage and refreshes it,
// so the same browser stays the same person. Linking an email later keeps the id.

let client: SupabaseClient | null = null

export function supabase(): SupabaseClient {
  if (!BACKEND_CONFIGURED) throw new Error('backend not configured')
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  })
  return client
}

let signingIn: Promise<string> | null = null

/** A valid access token for the current guest, signing one in if this browser has none yet. */
export async function accessToken(): Promise<string> {
  const auth = supabase().auth
  const { data } = await auth.getSession()
  if (data.session) return data.session.access_token
  // Several calls at once share one sign-in, or the browser would become two guests.
  signingIn ??= auth
    .signInAnonymously()
    .then(({ data: signed, error }) => {
      if (error || !signed.session) throw new Error('guest sign-in failed')
      return signed.session.access_token
    })
    .finally(() => {
      signingIn = null
    })
  return signingIn
}

/**
 * Forget the stored session and start a new guest. For a token the backend no longer accepts: the user
 * was deleted (here or in another tab), or an idle guest was cleaned up after 30 days. The old guest and
 * their rooms are gone, so a new one is the only way forward.
 */
export async function resetSession(): Promise<void> {
  try {
    await supabase().auth.signOut({ scope: 'local' })
  } catch {
    // nothing to sign out of
  }
}
