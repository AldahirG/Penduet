import { findLesson } from '@penduet/lessons'
import { test, expect, along, canvasOf, drawPath, ink, stepsOf, traceStep } from './fixtures'

const SLUG = 'straight-lines'
const lesson = findLesson(SLUG)!

const start = async (page: import('@playwright/test').Page, slug = SLUG) => {
  await page.goto(`/lesson/${slug}`)
  await page.getByRole('button', { name: /Start lesson|Draw it again/ }).click()
  await expect(canvasOf(page)).toBeVisible()
}

test.describe('F01 first lesson, F03 browse and draw a lesson (S05 S06 S07)', () => {
  test('F01-H1 trace every step, pass each, finish with stars, and see it on the list', async ({ page }) => {
    await page.goto('/lessons')
    await page.getByRole('link', { name: 'Start' }).first().click()
    await expect(page.getByRole('heading', { name: lesson.title })).toBeVisible()
    await page.getByRole('button', { name: 'Start lesson' }).click()

    for (let i = 0; i < stepsOf(SLUG); i++) {
      await expect(page.getByText(lesson.steps[i]!.prompt)).toBeVisible()
      await expect(page.getByText(`Step ${i + 1} of ${stepsOf(SLUG)}`).first()).toBeVisible()
      await traceStep(page, SLUG, i)
      await page.getByRole('button', { name: 'Check my drawing' }).click()
      await expect(page.getByRole('heading', { name: `Step ${i + 1} of ${stepsOf(SLUG)}` })).toBeVisible()
      await expect(page.getByLabel('3 of 3 stars')).toBeVisible()
      await page.getByRole('button', { name: 'Next step' }).click()
    }
    await expect(page.getByRole('heading', { name: 'Lesson finished' })).toBeVisible()
    await expect(page.getByText('Well drawn')).toBeVisible()

    await page.goto('/lessons')
    await expect(page.getByLabel(/Your best: 3 of 3 stars/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Draw again' })).toBeVisible()
  })

  test('F01-E1 refresh mid-lesson returns to the intro without errors', async ({ page }) => {
    await start(page)
    await traceStep(page, SLUG, 0)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Start lesson' })).toBeVisible()
  })

  test('F01-E2 double-clicking Check shows one result and does not break', async ({ page }) => {
    await start(page)
    await traceStep(page, SLUG, 0)
    const check = page.getByRole('button', { name: 'Check my drawing' })
    await Promise.all([check.click(), check.click({ timeout: 1000 }).catch(() => undefined)])
    await expect(page.getByRole('heading', { name: `Step 1 of ${stepsOf(SLUG)}` })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next step' })).toHaveCount(1)
  })

  test('F01-E3 the back button mid-lesson goes to the list and reopening starts fresh', async ({ page }) => {
    await page.goto('/lessons')
    await page.getByRole('link', { name: 'Start' }).first().click()
    await page.getByRole('button', { name: 'Start lesson' }).click()
    await traceStep(page, SLUG, 0)
    await page.goBack()
    await expect(page.getByRole('heading', { name: 'Lessons' })).toBeVisible()
    await page.goForward()
    await expect(page.getByRole('button', { name: 'Start lesson' })).toBeVisible()
  })

  test('F01-E5 a lesson can be finished with the keyboard alone, by skipping, and counts as no progress', async ({ page }) => {
    await page.goto(`/lesson/${SLUG}`)
    await page.getByRole('button', { name: 'Start lesson' }).focus()
    await page.keyboard.press('Enter')
    for (let i = 0; i < stepsOf(SLUG); i++) {
      const skip = page.getByRole('button', { name: 'Skip step' })
      await skip.focus()
      await page.keyboard.press('Enter')
    }
    await expect(page.getByRole('heading', { name: 'Lesson finished' })).toBeVisible()
    await expect(page.getByText('skipped')).toHaveCount(stepsOf(SLUG))
    expect(await page.evaluate(() => localStorage.getItem('penduet.progress.v1'))).toBeNull()
  })

  test('F01-E6 damaged saved progress does not break the list', async ({ page }) => {
    await page.goto('/lessons')
    await page.evaluate(() => localStorage.setItem('penduet.progress.v1', '{"straight-lines": 5}'))
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Lessons' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Start' })).toHaveCount(3)
  })

  test('F01-N1 a wrong drawing does not pass; Try again wipes it; Move on anyway counts the step as skipped', async ({ page }) => {
    await start(page)
    await drawPath(page, along([[100, 100], [900, 150]]))
    await page.getByRole('button', { name: 'Check my drawing' }).click()
    await expect(page.getByRole('button', { name: 'Next step' })).toHaveCount(0)
    await expect(page.getByLabel('0 of 3 stars')).toBeVisible()
    await page.getByRole('button', { name: 'Try again' }).click()
    expect(await ink(page)).toBe(0)
    await expect(page.getByRole('button', { name: 'Check my drawing' })).toBeDisabled()
    await drawPath(page, along([[100, 100], [900, 150]]))
    await page.getByRole('button', { name: 'Check my drawing' }).click()
    await page.getByRole('button', { name: 'Move on anyway' }).click()
    await expect(page.getByText(`Step 2 of ${stepsOf(SLUG)}`).first()).toBeVisible()
  })

  test('F01-N2 Check is disabled until something is drawn', async ({ page }) => {
    await start(page)
    await expect(page.getByRole('button', { name: 'Check my drawing' })).toBeDisabled()
    await drawPath(page, along([[100, 100], [200, 100]]))
    await expect(page.getByRole('button', { name: 'Check my drawing' })).toBeEnabled()
  })

  test('F03-H1 the list shows every lesson and each opens its intro', async ({ page }) => {
    await page.goto('/lessons')
    for (const title of ['Straight lines', 'First shapes', 'Happy sun']) {
      await expect(page.getByRole('heading', { name: title })).toBeVisible()
    }
    await page.getByRole('link', { name: 'Start' }).nth(1).click()
    await expect(page.getByRole('heading', { name: 'First shapes' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Draw it with a friend' })).toBeVisible()
  })

  test('F03-E1 an unknown lesson says so and links back', async ({ page }) => {
    await page.goto('/lesson/does-not-exist')
    await expect(page.getByRole('heading', { name: 'Lesson not found' })).toBeVisible()
    await page.getByRole('link', { name: 'See all lessons' }).click()
    await expect(page).toHaveURL(/\/lessons$/)
  })

  test('F03-E3 "Start this step again" removes this step only', async ({ page }) => {
    await start(page)
    await traceStep(page, SLUG, 0)
    await page.getByRole('button', { name: 'Check my drawing' }).click()
    await page.getByRole('button', { name: 'Next step' }).click()
    const afterStep1 = await ink(page)
    await traceStep(page, SLUG, 1)
    expect(await ink(page)).toBeGreaterThan(afterStep1)
    await page.getByRole('button', { name: 'Start this step again' }).click()
    await page.getByRole('button', { name: 'Start again' }).click()
    // step 1 stays, step 2 is gone (a replay differs from live drawing by a few antialiased pixels)
    expect(Math.abs((await ink(page)) - afterStep1)).toBeLessThan(afterStep1 * 0.01)
  })

  test('F03-E4 undo stops at the start of the step', async ({ page }) => {
    await start(page)
    await traceStep(page, SLUG, 0)
    await page.getByRole('button', { name: 'Check my drawing' }).click()
    await page.getByRole('button', { name: 'Next step' }).click()
    await expect(page.getByRole('button', { name: 'Undo your last stroke' })).toBeDisabled() // step 1 belongs to the past
    await traceStep(page, SLUG, 1)
    await expect(page.getByRole('button', { name: 'Undo your last stroke' })).toBeEnabled()
  })

  test('F03-E5 eraser strokes are not scored as drawing', async ({ page }) => {
    await start(page)
    await page.getByRole('button', { name: 'Eraser' }).click()
    await drawPath(page, along([[150, 500], [850, 500]]))
    await page.getByRole('button', { name: 'Check my drawing' }).click()
    await expect(page.getByLabel('0 of 3 stars')).toBeVisible()
  })

  test('F03-E6 the guide is shown while drawing and marks hit and missed lines after a check', async ({ page }) => {
    const stripes = stepsOf(SLUG) - 1
    await start(page)
    for (let i = 0; i < stripes; i++) {
      await traceStep(page, SLUG, i)
      await page.getByRole('button', { name: 'Check my drawing' }).click()
      await page.getByRole('button', { name: 'Next step' }).click()
    }
    // the last step has three lines: trace only the first
    const guide = lesson.steps[stripes]!.guide
    await expect(page.locator('svg polyline.stroke-guide')).toHaveCount(guide.length)
    await drawPath(page, along(guide[0] as [number, number][]))
    await page.getByRole('button', { name: 'Check my drawing' }).click()
    await expect(page.locator('svg polyline.stroke-success')).toHaveCount(1)
    await expect(page.locator('svg polyline.stroke-danger')).toHaveCount(guide.length - 1)
    await expect(page.getByText(/Part of the guide is still empty/)).toBeVisible()
  })

  test('F03-E7 a finished lesson can be drawn again from the summary', async ({ page }) => {
    await start(page)
    for (let i = 0; i < stepsOf(SLUG); i++) await page.getByRole('button', { name: 'Skip step' }).click()
    await page.getByRole('button', { name: 'Draw it again' }).click()
    await expect(page.getByText(lesson.steps[0]!.prompt)).toBeVisible()
    expect(await ink(page)).toBe(0)
  })
})

test.describe('lessons on a phone @mobile', () => {
  test('F01-E4 the lesson fits a 390px screen with no sideways scroll, and can be done by touch', async ({ page }) => {
    await page.goto(`/lesson/${SLUG}`)
    await page.getByRole('button', { name: 'Start lesson' }).click()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    const box = (await canvasOf(page).boundingBox())!
    expect(box.width).toBeGreaterThan(300)
    await traceStep(page, SLUG, 0)
    await page.getByRole('button', { name: 'Check my drawing' }).click()
    await expect(page.getByLabel('3 of 3 stars')).toBeVisible()
  })
})
