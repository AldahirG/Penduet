import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { setLang } from './i18n'

// The tests read English. (The app starts in Spanish; i18n tests switch on purpose.)
setLang('en', false)

// Vitest runs without globals, so Testing Library cannot register its own cleanup.
afterEach(cleanup)

// jsdom has no ResizeObserver. The canvas only needs it to refit on resize, so a no-op is enough.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// jsdom has no canvas either: getContext returns null, which the drawing engine tolerates.
// (It logs "not implemented" once per call; keep the test output readable.)
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']

// jsdom has no PointerEvent either, and Testing Library falls back to a plain Event that loses the
// coordinates. This is the smallest version that carries what the canvas reads.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number
    readonly pointerType: string
    readonly pressure: number
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 0
      this.pointerType = init.pointerType ?? 'mouse'
      this.pressure = init.pressure ?? 0
    }
  }
  window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent
}
