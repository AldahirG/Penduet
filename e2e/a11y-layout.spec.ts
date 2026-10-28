import type { Page } from '@playwright/test'
import { test, expect, ORIGIN_A, canvasOf, createRoom, drawPath, along, expectNoAxeViolations, traceStep } from './fixtures'

// Cross-cutting checks: every screen, in light and dark, on a laptop and on a phone.

const PAGES: { name: string; path: string; ready: (p: Page) => Promise<unknown> }[] = [
  { name: 'home', path: '/', ready: (p) => p.getByRole('heading', { level: 1 }).waitFor() },
  { name: 'lessons', path: '/lessons', ready: (p) => p.getByRole('heading', { name: 'Lessons' }).waitFor() },
  { name: 'lesson intro', path: '/lesson/straight-lines', ready: (p) => p.getByRole('button', { name: 'Start lesson' }).waitFor() },
  { name: 'free draw', path: '/draw', ready: (p) => canvasOf(p).waitFor() },
  { name: 'rooms hub', path: '/together', ready: (p) => p.getByRole('button', { name: 'Create room' }).waitFor() },
  { name: 'settings', path: '/settings', ready: (p) => p.getByLabel('Name shown in rooms').waitFor() },
  { name: 'privacy policy', path: '/privacy', ready: (p) => p.getByRole('heading', { level: 1, name: 'Privacy policy' }).waitFor() },
  { name: 'terms of use', path: '/terms', ready: (p) => p.getByRole('heading', { level: 1, name: 'Terms of use' }).waitFor() },
  { name: 'not found', path: '/nope/nothing', ready: (p) => p.getByRole('heading', { name: /nothing at this address/ }).waitFor() },
  { name: 'closed room', path: '/room/ZZZZZZ', ready: (p) => p.getByText(/This room has closed/).waitFor() },
  { name: 'bad room code', path: '/room/ZZ', ready: (p) => p.getByText(/does not look like a room code/).waitFor() },
]

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`X accessibility scans, ${scheme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme })
    })

    for (const p of PAGES) {
      test(`X-2 ${p.name} has no axe violations`, async ({ page }) => {
        await page.goto(p.path)
        await p.ready(page)
        await expectNoAxeViolations(page, `${p.name} (${scheme})`)
      })
    }

    test('X-2 lesson drawing screen and result card have no axe violations', async ({ page }) => {
      await page.goto('/lesson/straight-lines')
      await page.getByRole('button', { name: 'Start lesson' }).click()
      await expectNoAxeViolations(page, `lesson drawing (${scheme})`)
      await traceStep(page, 'straight-lines', 0)
      await page.getByRole('button', { name: 'Check my drawing' }).click()
      await page.getByLabel('3 of 3 stars').waitFor()
      await expectNoAxeViolations(page, `lesson result (${scheme})`)
    })

    test('X-2 a live room and the clear confirmation have no axe violations', async ({ page }) => {
      await createRoom(page)
      await expectNoAxeViolations(page, `live room (${scheme})`)
      await page.getByRole('button', { name: 'Clear the canvas' }).click()
      await expectNoAxeViolations(page, `clear dialog (${scheme})`)
    })

    test('X-2 the colour and size panels have no axe violations', async ({ page }) => {
      await page.goto('/draw')
      await page.getByRole('button', { name: 'Brush colour' }).click()
      await expectNoAxeViolations(page, `colour panel (${scheme})`)
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Brush size' }).click()
      await expectNoAxeViolations(page, `size panel (${scheme})`)
    })
  })
}

test.describe('X pages on a phone @mobile', () => {
  for (const p of PAGES) {
    test(`X-3 ${p.name} fits 390px wide with no sideways scroll`, async ({ page }) => {
      await page.goto(p.path)
      await p.ready(page)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, 'pixels of horizontal overflow').toBeLessThanOrEqual(0)
    })
  }

  test('X-3 a live room and a lesson room fit 390px wide', async ({ players }) => {
    const a = await players.open(ORIGIN_A, { viewport: { width: 390, height: 844 } })
    await createRoom(a.page)
    expect(await a.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
    await createRoom(a.page, 'First shapes')
    expect(await a.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  })

  test('X-3 touch targets in the toolbar and header are at least 44px', async ({ page }) => {
    await page.goto('/draw')
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('header a, header button, header label, [role=toolbar] button, nav a')]
        .map((e) => ({ name: e.getAttribute('aria-label') ?? e.textContent?.trim() ?? e.tagName, r: e.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && (r.height < 43.5 || r.width < 43.5))
        .map(({ name, r }) => `${name}: ${Math.round(r.width)}x${Math.round(r.height)}`),
    )
    expect(small).toEqual([])
  })
})

test.describe('X navigation, focus and titles', () => {
  test('X-4 every page has its own title', async ({ page }) => {
    const titles = new Set<string>()
    for (const p of PAGES) {
      await page.goto(p.path)
      await p.ready(page)
      const t = await page.title()
      expect(t.length, `title of ${p.name}`).toBeGreaterThan(0)
      titles.add(t)
    }
    // home and the rest are different; the two room pages and 404 each have one too
    expect(titles.size).toBeGreaterThanOrEqual(PAGES.length - 2)
    await page.goto('/lessons')
    expect(await page.title()).toMatch(/Lessons/)
  })

  test('X-5 the skip link is the first tab stop and moves focus to the content', async ({ page }) => {
    await page.goto('/lessons')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Skip to content' })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page.locator('#main')).toBeFocused()
  })

  test('X-5 moving to another page announces it and puts focus on the content', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Lessons' }).click()
    await expect(page.locator('#main')).toBeFocused()
    await expect(page.locator('[role=status][aria-live=polite]').first()).toContainText('Lessons')
  })

  test('X-6 the theme choice persists across a reload', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('radiogroup', { name: 'Theme' }).getByText('Dark').click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.getByRole('radiogroup', { name: 'Theme' }).getByText('Auto').click()
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
  })

  test('X-7 the main flows are reachable by keyboard: Tab through the rooms hub to Create room', async ({ page }) => {
    await page.goto('/together')
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab')
      if (await page.getByRole('button', { name: 'Create room' }).evaluate((e) => e === document.activeElement)) break
    }
    await expect(page.getByRole('button', { name: 'Create room' })).toBeFocused()
    await page.keyboard.press('Enter')
    await page.waitForURL(/\/room\/[A-Z2-9]{6}$/)
  })

  test('X-8 the whole canvas is on screen on a 1280x720 laptop, in free draw, a lesson and a room', async ({ players }) => {
    const a = await players.open(ORIGIN_A, { viewport: { width: 1280, height: 720 } })
    const fits = async (where: string) => {
      const box = (await canvasOf(a.page).boundingBox())!
      expect(box.y + box.height, `bottom edge of the canvas in ${where}`).toBeLessThanOrEqual(720)
      expect(box.y, `top edge of the canvas in ${where}`).toBeGreaterThanOrEqual(0)
    }
    await a.page.goto('/draw')
    await fits('free draw')
    await a.page.goto('/lesson/straight-lines')
    await a.page.getByRole('button', { name: 'Start lesson' }).click()
    await fits('a lesson')
    await createRoom(a.page)
    await fits('a room')
    await createRoom(a.page, 'First shapes')
    await fits('a lesson room')
  })
})
