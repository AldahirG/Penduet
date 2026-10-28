import { test as base, expect, type BrowserContext, type Locator, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { findLesson, type GuidePoint } from '@penduet/lessons'

export { expect }

// Two different origins serve the same app, so two people in one test have separate localStorage and
// therefore separate guest sessions. The Worker allows both origins.
export const ORIGIN_A = 'http://localhost:5173'
export const ORIGIN_B = process.env.E2E_ORIGIN_B ?? 'http://127.0.0.1:5173'
export const API = 'http://127.0.0.1:8787'
export const SUPABASE = 'http://127.0.0.1:54321'

// ---- a person in a browser -------------------------------------------------------

export interface Player {
  page: Page
  context: BrowserContext
  origin: string
}

/**
 * Every page a test opens is watched. A test fails if a page throws, logs a console error, or gets a
 * 5xx answer. A 4xx is an answer the app is meant to handle, and the browser logs it as a console error
 * ("Failed to load resource"), so those are ignored unless a test says otherwise.
 */
interface Fixtures {
  players: {
    open(origin?: string, opts?: { viewport?: { width: number; height: number } }): Promise<Player>
    /** Tolerate a known, expected problem (a regex on the text) for the rest of this test. */
    allow(pattern: RegExp): void
  }
}

export const test = base.extend<Fixtures>({
  players: async ({ browser }, use) => {
    const problems: string[] = []
    const allowed: RegExp[] = [/Failed to load resource: the server responded with a status of 4\d\d/]
    const contexts: BrowserContext[] = []

    const watch = (page: Page, who: string) => {
      page.on('pageerror', (e) => problems.push(`${who} pageerror: ${e.message}`))
      page.on('console', (m) => {
        if (m.type() === 'error') problems.push(`${who} console: ${m.text()}`)
      })
      page.on('response', (r) => {
        if (r.status() >= 500) problems.push(`${who} ${r.status()} ${r.request().method()} ${r.url()}`)
      })
    }

    await use({
      async open(origin = ORIGIN_A, opts = {}) {
        const context = await browser.newContext({ baseURL: origin, reducedMotion: 'reduce', ...(opts.viewport ? { viewport: opts.viewport } : {}) })
        contexts.push(context)
        // Remember every WebSocket the page opens, so a test can cut the connection like a bad network would.
        await context.addInitScript(() => {
          const Native = window.WebSocket
          const all: WebSocket[] = []
          ;(window as unknown as { __sockets: WebSocket[] }).__sockets = all
          window.WebSocket = class extends Native {
            constructor(url: string | URL, protocols?: string | string[]) {
              super(url, protocols)
              all.push(this)
            }
          }
        })
        const page = await context.newPage()
        watch(page, origin === ORIGIN_B ? 'B' : 'A')
        return { page, context, origin }
      },
      allow: (pattern) => allowed.push(pattern),
    })

    const real = problems.filter((p) => !allowed.some((a) => a.test(p)))
    await Promise.all(contexts.map((c) => c.close()))
    expect(real, 'console errors, page errors or 5xx responses').toEqual([])
  },
  // The built-in page fixture also gets watched, through the same mechanism.
  page: async ({ players }, use) => {
    const { page } = await players.open(ORIGIN_A)
    await use(page)
  },
})

/** Cuts the page's room connection from the client side. The app should notice and reconnect by itself. */
export async function dropConnection(page: Page): Promise<void> {
  await page.evaluate(() => {
    const all = (window as unknown as { __sockets: WebSocket[] }).__sockets
    all[all.length - 1]?.close()
  })
}

// ---- drawing -----------------------------------------------------------------------

/** The drawing surface of whichever page is open (free draw, a lesson, or a room). */
export const canvasOf = (page: Page): Locator => page.getByRole('img', { name: /canvas/i })

/** Draws one stroke through points given in the 1000 x 1000 logical canvas. */
export async function drawPath(page: Page, points: ReadonlyArray<readonly [number, number]>): Promise<void> {
  await canvasOf(page).scrollIntoViewIfNeeded()
  const box = await canvasOf(page).boundingBox()
  if (!box) throw new Error('no canvas on the page')
  const at = ([x, y]: readonly [number, number]) => ({ x: box.x + (x / 1000) * box.width, y: box.y + (y / 1000) * box.height })
  const [first, ...rest] = points
  const p0 = at(first!)
  await page.mouse.move(p0.x, p0.y)
  await page.mouse.down()
  for (const pt of rest) {
    const p = at(pt)
    await page.mouse.move(p.x, p.y, { steps: 2 })
  }
  await page.mouse.up()
}

/** Points along a polyline about every `gap` logical units. Mouse events are sparse, so give the stroke some body. */
export function along(line: ReadonlyArray<readonly [number, number]>, gap = 25): [number, number][] {
  const out: [number, number][] = [[line[0]![0], line[0]![1]]]
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1]!
    const [bx, by] = line[i]!
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / gap))
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n])
  }
  return out
}

/** How many canvas pixels have ink on them. The canvas is transparent where nothing is drawn. */
export async function ink(page: Page): Promise<number> {
  return canvasOf(page).evaluate((el) => {
    const c = el as HTMLCanvasElement
    const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
    let n = 0
    for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) n++
    return n
  })
}

/** How many canvas pixels have ink in the left or the right half of the canvas. */
export async function inkIn(page: Page, half: 'left' | 'right'): Promise<number> {
  return canvasOf(page).evaluate((el, which) => {
    const c = el as HTMLCanvasElement
    const mid = Math.floor(c.width / 2)
    const [x0, w] = which === 'left' ? [0, mid] : [mid, c.width - mid]
    const data = c.getContext('2d')!.getImageData(x0, 0, w, c.height).data
    let n = 0
    for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) n++
    return n
  }, half)
}

/** Traces every line of a lesson step's guide, as a person would. */
export async function traceStep(page: Page, slug: string, step: number): Promise<void> {
  const guide = findLesson(slug)!.steps[step]!.guide
  for (const line of guide) await drawPath(page, along(line as GuidePoint[]))
}

export const stepsOf = (slug: string): number => findLesson(slug)!.steps.length

/** A brand new guest straight from the (fake) auth service, with no browser involved. */
export async function newGuestToken(): Promise<string> {
  const res = await fetch(`${SUPABASE}/auth/v1/signup`, { method: 'POST', headers: { apikey: 'local-dev-key', 'content-type': 'application/json' }, body: '{}' })
  return ((await res.json()) as { access_token: string }).access_token
}

// ---- flows shared by many specs ---------------------------------------------------

/** Creates a room (optionally for a lesson) and waits until the person is live in it. Returns the code. */
export async function createRoom(page: Page, lessonTitle?: string): Promise<string> {
  await page.goto('/together')
  if (lessonTitle) await page.getByLabel('What will you draw?').selectOption({ label: `Lesson: ${lessonTitle}` })
  await page.getByRole('button', { name: 'Create room' }).click()
  await page.waitForURL(/\/room\/[A-Z2-9]{6}$/)
  await expect(page.getByText('you, here')).toBeVisible()
  return page.url().split('/').pop()!
}

/** Creates a room for a game from the rooms hub, as a person would, and waits until live. Returns its code. */
export async function createGameRoom(page: Page, game: 'Draw a topic together' | 'Pass the pen' | 'Two halves of one picture'): Promise<string> {
  await page.goto('/together')
  await page.getByLabel('What will you draw?').selectOption({ label: `Game: ${game}` })
  await page.getByRole('button', { name: 'Create room' }).click()
  await page.waitForURL(/\/room\/[A-Z2-9]{6}$/)
  await expect(page.getByText('you, here')).toBeVisible()
  return page.url().split('/').pop()!
}

/** Joins with a code typed into the code field, as a person would, and waits until live. */
export async function joinWithCode(page: Page, code: string): Promise<void> {
  await page.goto('/together')
  await page.getByLabel(/Room code/).first().fill(code)
  await page.waitForURL(/\/room\//)
  await expect(page.getByText('you, here')).toBeVisible()
}

export async function expectNoAxeViolations(page: Page, label: string): Promise<void> {
  const result = await new AxeBuilder({ page }).analyze()
  const summary = result.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)
  expect(summary, `axe violations on ${label}`).toEqual([])
}

/** Sets the theme through the header switch, as a person would. */
export async function setTheme(page: Page, theme: 'Auto' | 'Light' | 'Dark'): Promise<void> {
  await page.getByRole('radio', { name: theme }).check({ force: true }).catch(async () => page.getByText(theme, { exact: true }).click())
}
