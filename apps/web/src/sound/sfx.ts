import { useSyncExternalStore } from 'react'

// Small sound effects made on the spot with the Web Audio API: no audio files, so nothing to license and nothing to
// download. Everything is quiet by design, and one switch (remembered on this device) turns it all off. Where there is
// no Web Audio (tests, old browsers) every call does nothing.

const KEY = 'penduet.sound'

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(KEY) === 'off'
  } catch {
    return false
  }
}

let muted = typeof window === 'undefined' ? false : readMuted()
const listeners = new Set<() => void>()
let ctx: AudioContext | null = null
let master: GainNode | null = null
/** Everything scheduled but not yet played, so a drum roll can be cut short. */
const live = new Set<AudioScheduledSourceNode>()

export const isMuted = (): boolean => muted

export function setMuted(next: boolean): void {
  muted = next
  try {
    window.localStorage.setItem(KEY, next ? 'off' : 'on')
  } catch {
    // not saved: still muted for this visit
  }
  if (next) stopAll()
  listeners.forEach((fn) => fn())
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useMuted(): [boolean, (muted: boolean) => void] {
  return [useSyncExternalStore(subscribe, isMuted, isMuted), setMuted]
}

function audio(): { c: AudioContext; out: GainNode } | null {
  if (muted || typeof window === 'undefined') return null
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    if (!ctx) {
      ctx = new Ctor()
      master = ctx.createGain()
      master.gain.value = 0.7
      master.connect(ctx.destination)
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return { c: ctx, out: master! }
  } catch {
    return null
  }
}

function track(node: AudioScheduledSourceNode): void {
  live.add(node)
  node.onended = () => live.delete(node)
}

/** Stops everything that is playing or waiting to play. */
export function stopAll(): void {
  for (const node of live) {
    try {
      node.stop()
    } catch {
      // already stopped
    }
  }
  live.clear()
}

interface ToneOpts {
  type?: OscillatorType
  gain?: number
  /** Slide the pitch to this frequency by the end. */
  to?: number
  attack?: number
}

function tone(freq: number, at: number, dur: number, { type = 'sine', gain = 0.2, to, attack = 0.01 }: ToneOpts = {}): void {
  const a = audio()
  if (!a) return
  const { c, out } = a
  const t0 = c.currentTime + at
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(out)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
  track(osc)
}

let noiseBuffer: AudioBuffer | null = null

function noise(at: number, dur: number, { gain = 0.2, freq = 1800, q = 0.8, type = 'bandpass' as BiquadFilterType }: { gain?: number; freq?: number; q?: number; type?: BiquadFilterType } = {}): void {
  const a = audio()
  if (!a) return
  const { c, out } = a
  if (!noiseBuffer || noiseBuffer.sampleRate !== c.sampleRate) {
    noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  const t0 = c.currentTime + at
  const src = c.createBufferSource()
  src.buffer = noiseBuffer
  src.loop = true
  const filter = c.createBiquadFilter()
  filter.type = type
  filter.frequency.value = freq
  filter.Q.value = q
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(filter).connect(g).connect(out)
  src.start(t0)
  src.stop(t0 + dur + 0.05)
  track(src)
}

// note frequencies
const C5 = 523.25
const E5 = 659.25
const G5 = 783.99
const C6 = 1046.5
const A5 = 880
const E6 = 1318.5

export const sfx = {
  /** The first sound after a click or key press lets the browser start audio. */
  unlock(): void {
    audio()
  },
  /** One tick of a clock; `urgent` is higher. */
  tick(urgent = false): void {
    tone(urgent ? 1500 : 1000, 0, 0.06, { type: 'square', gain: urgent ? 0.07 : 0.045 })
  },
  /** Numbers counting down to the start. */
  beep(last = false): void {
    tone(last ? 880 : 520, 0, last ? 0.28 : 0.14, { type: 'triangle', gain: 0.16 })
  },
  /** The round starts. */
  go(): void {
    tone(C5, 0, 0.12, { type: 'triangle', gain: 0.18 })
    tone(G5, 0.1, 0.12, { type: 'triangle', gain: 0.18 })
    tone(C6, 0.2, 0.35, { type: 'triangle', gain: 0.2 })
  },
  /** The wheel slows down: clicks that spread out. */
  spin(ms: number): void {
    let t = 0
    let gap = 0.05
    while (t * 1000 < ms - 200) {
      tone(700 + Math.random() * 120, t, 0.03, { type: 'square', gain: 0.05 })
      t += gap
      gap *= 1.09
    }
    tone(C6, t + 0.05, 0.25, { type: 'triangle', gain: 0.12 })
  },
  /** The canvas locks. */
  lock(): void {
    tone(220, 0, 0.12, { type: 'square', gain: 0.1, to: 120 })
    noise(0, 0.08, { gain: 0.1, freq: 900 })
  },
  /** A wrong answer: a buzz that falls. */
  wrong(): void {
    tone(190, 0, 0.32, { type: 'sawtooth', gain: 0.16, to: 95 })
    tone(150, 0.16, 0.34, { type: 'sawtooth', gain: 0.15, to: 70 })
  },
  /** A drum roll that speeds up and swells, for `ms`. */
  drumroll(ms: number): void {
    let t = 0
    let gap = 0.11
    let hit = 0
    const total = ms / 1000
    while (t < total) {
      const swell = 0.07 + 0.2 * (t / total)
      noise(t, 0.07, { gain: swell, freq: 1600, q: 0.7 })
      if (hit % 4 === 0) tone(130, t, 0.1, { type: 'sine', gain: swell * 0.8, to: 70 })
      hit += 1
      t += gap
      gap = Math.max(0.035, gap * 0.955)
    }
  },
  /** A cymbal crash, then a bright run of notes. */
  celebrate(): void {
    noise(0, 1.1, { gain: 0.16, freq: 5500, q: 0.4, type: 'highpass' })
    tone(C5, 0, 0.16, { type: 'triangle', gain: 0.2 })
    tone(E5, 0.12, 0.16, { type: 'triangle', gain: 0.2 })
    tone(G5, 0.24, 0.16, { type: 'triangle', gain: 0.2 })
    tone(C6, 0.36, 0.5, { type: 'triangle', gain: 0.22 })
    tone(E6, 0.5, 0.5, { type: 'sine', gain: 0.12 })
  },
  /** A sad little slide, for a round nobody guessed. */
  sad(): void {
    tone(392, 0, 0.3, { type: 'triangle', gain: 0.16, to: 370 })
    tone(349, 0.28, 0.3, { type: 'triangle', gain: 0.16, to: 330 })
    tone(294, 0.56, 0.7, { type: 'triangle', gain: 0.17, to: 220 })
  },
  /** A small chime. */
  chime(): void {
    tone(A5, 0, 0.18, { type: 'sine', gain: 0.14 })
    tone(E6, 0.09, 0.3, { type: 'sine', gain: 0.12 })
  },
}
