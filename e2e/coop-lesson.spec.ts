import { findLesson } from '@penduet/lessons'
import { test, expect, ORIGIN_A, ORIGIN_B, along, canvasOf, createRoom, drawPath, ink, joinWithCode, stepsOf, traceStep, type Player } from './fixtures'

const SLUG = 'straight-lines'
const lesson = findLesson(SLUG)!
const TITLE = lesson.title

async function lessonPair(players: { open(origin?: string): Promise<Player> }) {
  const a = await players.open(ORIGIN_A)
  const b = await players.open(ORIGIN_B)
  const code = await createRoom(a.page, TITLE)
  await joinWithCode(b.page, code)
  await expect(a.page.getByLabel(/, here$/)).toHaveCount(2)
  return { a, b, code }
}

const stepHeading = (page: import('@playwright/test').Page, n: number) => page.getByText(`Step ${n} of ${stepsOf(SLUG)}`).first()

test.describe('F05b co-op lesson in a room (S11 lesson mode)', () => {
  test('C-H1 both see step 1, both draw it, one checks, both see the result, the other moves on, both see step 2', async ({ players }) => {
    const { a, b } = await lessonPair(players)
    for (const p of [a, b]) {
      await expect(p.page.getByText(`${TITLE}, together`)).toBeVisible()
      await expect(p.page.getByText(lesson.steps[0]!.prompt)).toBeVisible()
      await expect(p.page.locator('svg path.stroke-guide')).toHaveCount(lesson.steps[0]!.guide.length)
    }
    // A draws the guide; B sees it
    await traceStep(a.page, SLUG, 0)
    await expect.poll(() => ink(b.page)).toBeGreaterThan(500)

    // B checks the drawing A made: both get the same card
    await b.page.getByRole('button', { name: 'Check our drawing' }).click()
    for (const p of [a, b]) {
      await expect(p.page.getByRole('heading', { name: `Step 1 of ${stepsOf(SLUG)}` })).toBeVisible()
      await expect(p.page.getByLabel('3 of 3 stars')).toBeVisible()
      await expect(p.page.locator('svg path.stroke-success')).toHaveCount(1)
    }
    // during the result nobody can add strokes
    const frozen = await ink(a.page)
    await drawPath(a.page, along([[100, 100], [900, 100]]))
    expect(await ink(a.page)).toBe(frozen)

    // A moves on for both
    await a.page.getByRole('button', { name: 'Next step' }).click()
    for (const p of [a, b]) {
      await expect(p.page.getByText(lesson.steps[1]!.prompt)).toBeVisible()
      await expect(stepHeading(p.page, 2)).toBeVisible()
      // the new step starts on a clean canvas: step 1's lines do not sit under step 2's guide
      await expect.poll(() => ink(p.page)).toBe(0)
    }
  })

  test('C-E1 either person can start the step again, and it clears the step for both', async ({ players }) => {
    const { a, b } = await lessonPair(players)
    await traceStep(a.page, SLUG, 0)
    await b.page.getByRole('button', { name: 'Check our drawing' }).click()
    await expect(a.page.getByRole('heading', { name: `Step 1 of ${stepsOf(SLUG)}` })).toBeVisible()
    await b.page.getByRole('button', { name: 'Try again' }).click()
    for (const p of [a, b]) {
      await expect(p.page.getByRole('button', { name: 'Check our drawing' })).toBeDisabled()
      expect(await ink(p.page)).toBe(0)
    }
    // and drawing works again
    await traceStep(b.page, SLUG, 0)
    await expect.poll(() => ink(a.page)).toBeGreaterThan(500)
  })

  test('C-E2 both pressing Next at once moves one step, not two', async ({ players }) => {
    const { a, b } = await lessonPair(players)
    await traceStep(a.page, SLUG, 0)
    await a.page.getByRole('button', { name: 'Check our drawing' }).click()
    await expect(b.page.getByRole('button', { name: 'Next step' })).toBeVisible()
    await Promise.all([a.page.getByRole('button', { name: 'Next step' }).click(), b.page.getByRole('button', { name: 'Next step' }).click()])
    for (const p of [a, b]) await expect(stepHeading(p.page, 2)).toBeVisible()
    await a.page.waitForTimeout(800)
    for (const p of [a, b]) {
      await expect(stepHeading(p.page, 2)).toBeVisible() // still step 2
      await expect(p.page.getByText(lesson.steps[1]!.prompt)).toBeVisible()
    }
  })

  test('C-E3 reloading in the middle of a result keeps the same card', async ({ players }) => {
    const { a } = await lessonPair(players)
    await traceStep(a.page, SLUG, 0)
    await a.page.getByRole('button', { name: 'Check our drawing' }).click()
    await expect(a.page.getByLabel('3 of 3 stars')).toBeVisible()
    await a.page.reload()
    await expect(a.page.getByRole('heading', { name: `Step 1 of ${stepsOf(SLUG)}` })).toBeVisible()
    await expect(a.page.getByLabel('3 of 3 stars')).toBeVisible()
    await expect(a.page.locator('svg path.stroke-success')).toHaveCount(1) // the marks came back too
  })

  test('C-E4 finishing every step ends on a summary for both, and both keep the result', async ({ players }) => {
    const { a, b } = await lessonPair(players)
    for (let i = 0; i < stepsOf(SLUG); i++) {
      const drawer = i % 2 === 0 ? a : b // take turns
      const other = i % 2 === 0 ? b : a
      await expect.poll(() => ink(drawer.page)).toBe(0) // every step starts clean, whatever was drawn before
      await expect.poll(() => ink(other.page)).toBe(0)
      await traceStep(drawer.page, SLUG, i)
      await expect.poll(() => ink(other.page)).toBeGreaterThan(300)
      await drawer.page.getByRole('button', { name: 'Check our drawing' }).click()
      await other.page.getByRole('button', { name: 'Next step' }).click()
    }
    for (const p of [a, b]) {
      await expect(p.page.getByRole('heading', { name: 'Lesson finished' })).toBeVisible()
      await expect(p.page.getByText('Well drawn, both of you')).toBeVisible()
      await expect(p.page.getByRole('button', { name: 'Draw it again' })).toBeVisible()
      expect(await ink(p.page), 'the drawing of the last step stays to look at and save').toBeGreaterThan(300)
    }
    for (const p of [a, b]) {
      const stored = await p.page.evaluate(() => localStorage.getItem('penduet.progress.v1'))
      expect(JSON.parse(stored!)[SLUG].stars).toBeGreaterThanOrEqual(2)
    }
    // starting over clears the canvas and returns both to step 1
    await a.page.getByRole('button', { name: 'Draw it again' }).click()
    for (const p of [a, b]) {
      await expect(p.page.getByText(lesson.steps[0]!.prompt)).toBeVisible()
      await expect.poll(() => ink(p.page)).toBe(0)
    }
  })

  test('C-E5 skipping a step clears it and moves both on, and the summary says skipped', async ({ players }) => {
    const { a, b } = await lessonPair(players)
    await traceStep(a.page, SLUG, 0)
    await expect.poll(() => ink(b.page)).toBeGreaterThan(300)
    await b.page.getByRole('button', { name: 'Skip step' }).click()
    for (const p of [a, b]) {
      await expect(p.page.getByText(lesson.steps[1]!.prompt)).toBeVisible()
      await expect.poll(() => ink(p.page)).toBe(0) // the skipped step's strokes are gone
    }
    for (let i = 1; i < stepsOf(SLUG); i++) await a.page.getByRole('button', { name: 'Skip step' }).click()
    await expect(b.page.getByRole('heading', { name: 'Lesson finished' })).toBeVisible()
    await expect(b.page.getByText('skipped')).toHaveCount(stepsOf(SLUG))
  })

  test('C-E6 undo in a lesson removes only your own stroke of this step', async ({ players }) => {
    const { a, b } = await lessonPair(players)
    await drawPath(a.page, along([[150, 400], [850, 400]]))
    await drawPath(b.page, along([[150, 600], [850, 600]]))
    await expect.poll(() => ink(a.page)).toBeGreaterThan(1000)
    const both = await ink(a.page)
    await b.page.getByRole('button', { name: 'Undo your last stroke' }).click()
    await expect.poll(() => ink(a.page)).toBeLessThan(both)
    await expect.poll(() => ink(a.page)).toBeGreaterThan(300) // A's stroke stays
  })

  test('C-E7 the lesson on offer is the one the room was made for, and a free room has no lesson', async ({ players }) => {
    const a = await players.open(ORIGIN_A)
    await createRoom(a.page)
    await expect(a.page.getByText(/, together$/)).toHaveCount(0)
    await expect(a.page.getByRole('button', { name: 'Check our drawing' })).toHaveCount(0)
    await expect(canvasOf(a.page)).toBeVisible()
  })

  test('C-E8 "Draw it with a friend" on a lesson page opens a room for that lesson', async ({ players }) => {
    const a = await players.open(ORIGIN_A)
    await a.page.goto(`/lesson/${SLUG}`)
    await a.page.getByRole('button', { name: 'Draw it with a friend' }).click()
    await a.page.waitForURL(/\/room\//)
    await expect(a.page.getByText(`${TITLE}, together`)).toBeVisible()
  })
})
