import WebSocket from 'ws'
import { WS_SUBPROTOCOL, type LessonState } from '@penduet/protocol'
import { findLesson, scoreStep } from '@penduet/lessons'

// A pretend second person for trying a room by yourself against `pnpm dev:local`:
//   pnpm --filter @penduet/realtime partner ABC234
// It signs in as a new guest, joins the room, draws a red circle and a blue line, then stays
// connected and logs what it receives. Ctrl-C to leave.
//
// In a room made for a lesson, add --play: it traces each step's guide with a slightly shaky hand,
// checks it, and moves on when the step passes, so you can watch a lesson being drawn together.

const play = process.argv.includes('--play')
const code = (process.argv[2] ?? '').toUpperCase()
if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) {
  console.error('usage: partner <ROOM CODE>')
  process.exit(1)
}
const SUPABASE = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const API = process.env.REALTIME_URL ?? 'http://127.0.0.1:8787'
const ORIGIN = 'http://localhost:5173'

const session = (await (await fetch(`${SUPABASE}/auth/v1/signup`, {
  method: 'POST',
  headers: { apikey: 'local-dev-key', 'content-type': 'application/json' },
  body: '{}',
})).json()) as { access_token: string }

const res = await fetch(`${API}/rooms/join`, {
  method: 'POST',
  headers: { authorization: `Bearer ${session.access_token}`, 'content-type': 'application/json', origin: ORIGIN },
  body: JSON.stringify({ code }),
})
const joined = (await res.json()) as { ticket?: string; error?: string }
if (!joined.ticket) {
  console.error('could not join:', joined.error ?? res.status)
  process.exit(1)
}

const ws = new WebSocket(`${API.replace(/^http/, 'ws')}/rooms/${code}/ws`, [WS_SUBPROTOCOL, joined.ticket], { origin: ORIGIN })
const send = (m: unknown) => ws.send(JSON.stringify(m))

async function stroke(id: string, color: string, points: [number, number][]) {
  send({ type: 'stroke_start', id, tool: 'pen', color, size: 12 })
  for (let i = 0; i < points.length; i += 4) {
    send({ type: 'stroke_pts', id, pts: points.slice(i, i + 4).map(([x, y]) => [x, y, 0.5]) })
    await new Promise((r) => setTimeout(r, 40))
  }
  send({ type: 'stroke_end', id })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Traces the guide of one step with a little shake, then shares a check of it. Returns whether it passed. */
async function playStep(lesson: LessonState): Promise<boolean> {
  const def = findLesson(lesson.slug)?.steps[lesson.step]
  if (!def) return false
  const drawn: { points: [number, number, number][] }[] = []
  for (const line of def.guide) {
    // Walk the polyline in steps of about 10 units, with up to a fifth of the tolerance of wobble.
    const pts: [number, number][] = []
    for (let i = 1; i < line.length; i++) {
      const [ax, ay] = line[i - 1]!
      const [bx, by] = line[i]!
      const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 10))
      for (let k = 0; k < n; k++) pts.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n])
    }
    pts.push(line[line.length - 1]!)
    const wobble = def.tolerance / 5
    const shaky = pts.map(([x, y]) => [x + (Math.random() - 0.5) * wobble, y + (Math.random() - 0.5) * wobble, 0.5] as [number, number, number])
    drawn.push({ points: shaky })
    const id = crypto.randomUUID()
    send({ type: 'stroke_start', id, tool: 'pen', color: '#db2777', size: 10 })
    for (let i = 0; i < shaky.length; i += 4) {
      send({ type: 'stroke_pts', id, pts: shaky.slice(i, i + 4) })
      await sleep(30)
    }
    send({ type: 'stroke_end', id })
    await sleep(200)
  }
  const score = scoreStep({ guide: def.guide, tolerance: def.tolerance, strokes: drawn, passAccuracy: def.passAccuracy })
  send({
    type: 'step_result',
    step: lesson.step,
    result: { accuracy: score.accuracy, smoothness: score.smoothness, stars: score.stars, passed: score.passed, hint: score.hint, guideCoverage: score.guideCoverage },
  })
  console.log(`checked step ${lesson.step + 1}: accuracy ${score.accuracy}, ${score.stars} stars`)
  return score.passed
}

let lessonNow: LessonState | null = null

ws.on('open', async () => {
  console.log('partner is in the room')
  await sleep(1000)
  if (play && lessonNow) {
    for (let step = lessonNow.step; step < (findLesson(lessonNow.slug)?.steps.length ?? 0); step++) {
      if (await playStep({ ...lessonNow, step })) {
        await sleep(2500) // let people read the result
        send({ type: 'lesson_set', slug: lessonNow.slug, step: step + 1 })
        await sleep(500)
      } else break
    }
    console.log('played the lesson; staying connected')
    return
  }
  const circle = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 47) * Math.PI * 2
    return [500 + 220 * Math.cos(a), 500 + 220 * Math.sin(a)] as [number, number]
  })
  await stroke(crypto.randomUUID(), '#dc2626', circle)
  await stroke(crypto.randomUUID(), '#2563eb', Array.from({ length: 30 }, (_, i) => [150 + i * 24, 850 - i * 6] as [number, number]))
  console.log('drew a circle and a line; staying connected')
})
ws.on('message', (d) => {
  const text = d.toString()
  if (text === 'pong') return
  const m = JSON.parse(text) as { type: string; lesson?: LessonState | null; body?: { type: string } }
  if (m.type === 'welcome') lessonNow = m.lesson ?? null
  if (m.type === 'event' && m.body?.type === 'stroke_pts') return // too chatty to log
  console.log('<-', m.type, m.body?.type ?? '')
})
ws.on('close', (c) => {
  console.log('closed', c)
  process.exit(0)
})
