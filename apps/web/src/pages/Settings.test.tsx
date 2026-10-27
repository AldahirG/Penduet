import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '../ui'

const profile = vi.hoisted(() => ({
  getMyProfile: vi.fn(async () => ({ displayName: 'Artist 1A2B', isGuest: true })),
  renameMe: vi.fn(async (n: string) => n.trim()),
  deleteMyAccount: vi.fn(async () => {}),
}))
const rooms = vi.hoisted(() => ({ live: true }))

vi.mock('../data/profile', async (orig) => ({ ...(await orig<typeof import('../data/profile')>()), ...profile }))
vi.mock('../data/rooms', () => ({
  get ROOMS_ARE_LIVE() {
    return rooms.live
  },
}))

import { Settings } from './Settings'

const renderSettings = () =>
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <ToastProvider>
        <Routes>
          <Route path="/settings" element={<Settings />} />
          <Route path="/" element={<p>home page</p>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  rooms.live = true
})

describe('Settings', () => {
  it('explains itself in demo mode and makes no requests', () => {
    rooms.live = false
    renderSettings()
    expect(screen.getByText(/not configured in this build/)).toBeInTheDocument()
    expect(profile.getMyProfile).not.toHaveBeenCalled()
  })

  it('shows the current name and saves a new one', async () => {
    renderSettings()
    const input = await screen.findByLabelText('Name shown in rooms')
    expect(input).toHaveValue('Artist 1A2B')
    expect(screen.getByRole('button', { name: 'Save name' })).toBeDisabled() // nothing changed
    fireEvent.change(input, { target: { value: 'Mara' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }))
    await waitFor(() => expect(profile.renameMe).toHaveBeenCalledWith('Mara'))
    expect(await screen.findByText(/Name saved/)).toBeInTheDocument()
  })

  it('shows an error for an empty name and does not send it', async () => {
    renderSettings()
    const input = await screen.findByLabelText('Name shown in rooms')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }))
    expect(await screen.findByText(/between 1 and 30 characters/)).toBeInTheDocument()
    expect(profile.renameMe).not.toHaveBeenCalled()
  })

  it('asks before deleting, and goes home afterwards', async () => {
    renderSettings()
    await screen.findByLabelText('Name shown in rooms')
    fireEvent.click(screen.getByRole('button', { name: 'Delete my data' }))
    expect(profile.deleteMyAccount).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(profile.deleteMyAccount).toHaveBeenCalledOnce())
    expect(await screen.findByText('home page')).toBeInTheDocument()
  })

  it('does not delete when the person cancels', async () => {
    renderSettings()
    await screen.findByLabelText('Name shown in rooms')
    fireEvent.click(screen.getByRole('button', { name: 'Delete my data' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(profile.deleteMyAccount).not.toHaveBeenCalled()
  })

  it('says so when the profile cannot be loaded', async () => {
    profile.getMyProfile.mockRejectedValueOnce(new Error('offline'))
    renderSettings()
    expect(await screen.findByText(/Could not reach the service/)).toBeInTheDocument()
  })
})
