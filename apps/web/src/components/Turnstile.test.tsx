import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { Turnstile } from './Turnstile'

type Opts = { sitekey: string; callback: (t: string) => void; 'expired-callback': () => void }

function fakeTurnstile() {
  const calls: { opts?: Opts } = {}
  const api = {
    render: vi.fn((_el: HTMLElement, opts: Opts) => {
      calls.opts = opts
      return 'widget-1'
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  }
  window.turnstile = api
  return { api, calls }
}

afterEach(() => {
  delete window.turnstile
})

describe('Turnstile', () => {
  it('shows nothing and loads nothing without a site key', () => {
    const { api } = fakeTurnstile()
    const { container } = render(<Turnstile siteKey="" onToken={() => {}} />)
    expect(container).toBeEmptyDOMElement()
    expect(api.render).not.toHaveBeenCalled()
  })

  it('renders the widget with the site key and reports tokens and expiry', async () => {
    const { api, calls } = fakeTurnstile()
    const onToken = vi.fn()
    render(<Turnstile siteKey="site-key" onToken={onToken} />)
    await waitFor(() => expect(api.render).toHaveBeenCalledOnce())
    expect(calls.opts?.sitekey).toBe('site-key')
    calls.opts!.callback('tok-1')
    expect(onToken).toHaveBeenLastCalledWith('tok-1')
    calls.opts!['expired-callback']()
    expect(onToken).toHaveBeenLastCalledWith(null)
  })

  it('asks for a new challenge when the reset key changes, and removes the widget on unmount', async () => {
    const { api } = fakeTurnstile()
    const onToken = vi.fn()
    const { rerender, unmount } = render(<Turnstile siteKey="site-key" onToken={onToken} resetKey={0} />)
    await waitFor(() => expect(api.render).toHaveBeenCalled())
    rerender(<Turnstile siteKey="site-key" onToken={onToken} resetKey={1} />)
    expect(api.reset).toHaveBeenCalledWith('widget-1')
    expect(onToken).toHaveBeenLastCalledWith(null) // the old token is dead
    unmount()
    expect(api.remove).toHaveBeenCalledWith('widget-1')
  })
})
