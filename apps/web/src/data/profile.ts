import { accessToken, resetSession, supabase } from './session'

// The guest's own profile. Row level security lets a user read and edit only their own row, and the
// column grants let them change the display name but not, for example, is_guest (see the migrations).

export const NAME_MAX = 30

export interface MyProfile {
  displayName: string
  isGuest: boolean
}

export type ProfileErrorCode = 'invalid_name' | 'network'
export class ProfileError extends Error {
  constructor(readonly code: ProfileErrorCode) {
    super(code)
  }
}

/** Trimmed and collapsed, or null when it cannot be a name (empty, or past the limit). */
export function cleanName(input: string): string | null {
  const name = input.replace(/\s+/g, ' ').trim()
  return name.length >= 1 && name.length <= NAME_MAX ? name : null
}

async function myId(): Promise<string> {
  await accessToken() // makes sure this browser has a guest session
  const { data } = await supabase().auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new ProfileError('network')
  return id
}

export async function getMyProfile(retried = false): Promise<MyProfile> {
  const id = await myId()
  const { data, error } = await supabase().from('profiles').select('display_name, is_guest').eq('id', id).maybeSingle()
  if (!error && !data && !retried) {
    // A session for a user that no longer exists: begin again as a new guest, once.
    await resetSession()
    return getMyProfile(true)
  }
  if (error || !data) throw new ProfileError('network')
  return { displayName: String(data.display_name), isGuest: data.is_guest === true }
}

export async function renameMe(input: string): Promise<string> {
  const name = cleanName(input)
  if (!name) throw new ProfileError('invalid_name')
  const id = await myId()
  const { error } = await supabase().from('profiles').update({ display_name: name }).eq('id', id)
  if (error) throw new ProfileError('network')
  return name
}

/** Deletes the user and everything that cascades from them (rooms hosted, memberships, attempts...), then signs out here. */
export async function deleteMyAccount(): Promise<void> {
  await accessToken()
  const { error } = await supabase().rpc('delete_my_account')
  if (error) throw new ProfileError('network')
  await supabase().auth.signOut({ scope: 'local' })
}
