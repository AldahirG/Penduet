// Takes the product screenshots used on the landing page, from the real app running locally
// (`pnpm dev:local`). Two people draw in a room; the pictures are of that room.
//   node scripts/capture-landing.mjs
import { chromium } from '@playwright/test'

const A = 'http://localhost:5173'
const B = process.env.E2E_ORIGIN_B ?? 'http://127.0.0.1:5173'
const out = 'apps/web/public/landing'
// The page starts in Spanish, so that is what the pictures show. LANG=en for English ones.
const lang = process.env.LANG_SHOT ?? 'es'

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' })

async function stroke(page, pts) {
  const box = await page.getByRole('img', { name: /canvas|lienzo/i }).boundingBox()
  const at = ([x, y]) => ({ x: box.x + (x / 1000) * box.width, y: box.y + (y / 1000) * box.height })
  const [first, ...rest] = pts
  await page.mouse.move(at(first).x, at(first).y)
  await page.mouse.down()
  for (const p of rest) await page.mouse.move(at(p).x, at(p).y, { steps: 3 })
  await page.mouse.up()
}
const circle = (cx, cy, r, n = 40, from = 0, to = 360) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = ((from + ((to - from) * i) / n) * Math.PI) / 180
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  })

// reducedMotion: the page scrolls smoothly and fades things in; for a still picture and for Playwright's scroll-into-view, switch both off.
async function shoot(viewport, file, scheme = 'light') {
  const ctxA = await browser.newContext({ baseURL: A, viewport, colorScheme: scheme, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  const ctxB = await browser.newContext({ baseURL: B, viewport, colorScheme: scheme, reducedMotion: 'reduce' })
  for (const c of [ctxA, ctxB]) await c.addInitScript((l) => localStorage.setItem('penduet.lang', l), lang)
  const a = await ctxA.newPage()
  const b = await ctxB.newPage()
  await a.goto('/together')
  await a.getByRole('button', { name: /Create room|Crear sala/ }).click()
  await a.waitForURL(/\/room\//)
  await a.getByText(/you, here|tú, aquí/).waitFor()
  const code = a.url().split('/').pop()
  await b.goto('/together')
  await b.getByLabel(/Room code|Código de sala/).fill(code)
  await b.waitForURL(/\/room\//)
  await b.getByText(/you, here|tú, aquí/).waitFor()

  // A draws a sun, B draws rays and a smile, in their own colours
  await a.getByRole('button', { name: /Brush colour|Color del pincel/ }).click()
  await a.getByRole('radiogroup', { name: /Brush colour|Color del pincel/ }).getByTitle(/Orange|Naranja/).click()
  await a.keyboard.press('Escape')
  await stroke(a, circle(500, 480, 190))
  await b.getByRole('button', { name: /Brush colour|Color del pincel/ }).click()
  await b.getByRole('radiogroup', { name: /Brush colour|Color del pincel/ }).getByTitle(/Blue|Azul/).click()
  await b.keyboard.press('Escape')
  for (let i = 0; i < 8; i++) {
    const t = (i * Math.PI) / 4
    await stroke(b, [[500 + 250 * Math.cos(t), 480 + 250 * Math.sin(t)], [500 + 360 * Math.cos(t), 480 + 360 * Math.sin(t)]])
  }
  await stroke(a, circle(500, 520, 90, 24, 25, 155))
  await a.waitForTimeout(600)
  await a.screenshot({ path: `${out}/${file}` })
  await ctxA.close()
  await ctxB.close()
}

await shoot({ width: 1280, height: 800 }, 'room-desktop.png')
await shoot({ width: 390, height: 844 }, 'room-phone.png')
await browser.close()
console.log('wrote', out)
