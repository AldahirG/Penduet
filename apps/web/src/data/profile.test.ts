import { describe, expect, it, vi } from 'vitest'

vi.mock('./session', () => ({
  accessToken: vi.fn(async () => 't'),
  supabase: vi.fn(() => {
    throw new Error('network must not be touched')
  }),
}))

import { NAME_MAX, ProfileError, cleanName, renameMe } from './profile'

describe('cleanName', () => {
  it('trims and collapses spaces', () => {
    expect(cleanName('  Mara   Lou ')).toBe('Mara Lou')
  })
  it('refuses empty and too long names', () => {
    expect(cleanName('   ')).toBeNull()
    expect(cleanName('x'.repeat(NAME_MAX + 1))).toBeNull()
    expect(cleanName('x'.repeat(NAME_MAX))).toHaveLength(NAME_MAX)
  })
})

describe('renameMe', () => {
  it('rejects an invalid name before any request is made', async () => {
    await expect(renameMe('   ')).rejects.toBeInstanceOf(ProfileError)
    await expect(renameMe('   ')).rejects.toMatchObject({ code: 'invalid_name' })
  })
})
