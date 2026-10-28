import { halfGuide, halfSubjects, topics } from '@penduet/lessons'
import {
  test,
  expect,
  ORIGIN_A,
  ORIGIN_B,
  along,
  createGameRoom,
  drawPath,
  expectNoAxeViolations,
  ink,
  inkIn,
  joinWithCode,
  type Player,
} from './fixtures'

// Game rooms: a topic to draw together, and pass the pen.

async function pair(players: { open(origin?: string): Promise<Player> }, game: 'Draw a topic together' | 'Pass the pen' | 'Two halves of one picture') {
  const a = await players.open(ORIGIN_A)
  const b = await players.open(ORIGIN_B)
  const code = await createGameRoom(a.page, game)
  await joinWithCode(b.page, code)
  await expect(a.page.getByLabel(/, here$/)).toHaveCount(2)
  return { a, b, code }
}

const topicText = async (p: Player) => (await p.page.getByTestId('topic').innerText()).trim()
const stroke = (p: Player, y: number) => drawPath(p.page, along([[150, y], [850, y + 40]]))

test.describe('Game rooms', () => {
  test('G-H1 a topic room gives both people the same topic, and a new topic clears the canvas for both', async ({ players }) => {
    const { a, b } = await pair(players, 'Draw a topic together')
    const first = await topicText(a)
    expect(topics).toContain(first)
    expect(await topicText(b)).toBe(first)

    // both draw, at the same time
    await stroke(a, 300)
    await stroke(b, 600)
    await expect.poll(() => ink(a.page)).toBeGreaterThan(300)
    await expect.poll(async () => (await ink(b.page)) === (await ink(a.page))).toBe(true)

    await b.page.getByRole('button', { name: 'New topic' }).click()
    await expect(b.page.getByRole('dialog')).toContainText('The canvas is cleared for both of you')
    await b.page.getByRole('dialog').getByRole('button', { name: 'New topic' }).click()

    for (const p of [a, b]) {
      await expect.poll(() => topicText(p)).not.toBe(first)
      await expect.poll(() => ink(p.page)).toBe(0)
    }
    expect(await topicText(a)).toBe(await topicText(b))
  })

  test('G-E1 cancelling "New topic" changes nothing', async ({ players }) => {
    const { a, b } = await pair(players, 'Draw a topic together')
    const first = await topicText(a)
    await stroke(a, 300)
    await expect.poll(() => ink(b.page)).toBeGreaterThan(300)
    await a.page.getByRole('button', { name: 'New topic' }).click()
    await a.page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()
    expect(await topicText(a)).toBe(first)
    expect(await ink(a.page)).toBeGreaterThan(300)
  })

  test('G-H2 pass the pen: one stroke each, and the person without the pen cannot draw', async ({ players }) => {
    const { a, b } = await pair(players, 'Pass the pen')
    await expect(a.page.getByRole('heading', { name: 'Your turn' })).toBeVisible()
    await expect(b.page.getByText(/has the pen\. Their stroke comes next\./)).toBeVisible()

    // B tries to draw out of turn: nothing appears for either of them
    await stroke(b, 600)
    expect(await ink(b.page)).toBe(0)
    expect(await ink(a.page)).toBe(0)

    // A draws one stroke: the pen moves to B on both screens
    await stroke(a, 300)
    await expect(b.page.getByRole('heading', { name: 'Your turn' })).toBeVisible()
    await expect(a.page.getByText(/has the pen\. Their stroke comes next\./)).toBeVisible()
    await expect.poll(() => ink(b.page)).toBeGreaterThan(300)
    const afterA = await ink(a.page)

    // A cannot draw a second one
    await stroke(a, 450)
    expect(await ink(a.page)).toBe(afterA)

    // B draws, and the pen goes back
    await stroke(b, 600)
    await expect(a.page.getByRole('heading', { name: 'Your turn' })).toBeVisible()
    await expect.poll(() => ink(a.page)).toBeGreaterThan(afterA)
  })

  test('G-H3 pass the pen: you can pass without drawing, and take your stroke back to have the pen again', async ({ players }) => {
    const { a, b } = await pair(players, 'Pass the pen')
    await a.page.getByRole('button', { name: 'Pass the pen' }).click()
    await expect(b.page.getByRole('heading', { name: 'Your turn' })).toBeVisible()
    await expect(a.page.getByRole('button', { name: 'Pass the pen' })).toHaveCount(0)
    await expect(b.page.getByRole('button', { name: 'Pass the pen' })).toBeVisible()

    await stroke(b, 500)
    await expect(a.page.getByRole('heading', { name: 'Your turn' })).toBeVisible()
    // A draws, then changes their mind
    await stroke(a, 300)
    await expect(b.page.getByRole('heading', { name: 'Your turn' })).toBeVisible()
    const before = await ink(b.page)
    await a.page.getByRole('button', { name: 'Undo' }).click()
    await expect(a.page.getByRole('heading', { name: 'Your turn' })).toBeVisible()
    await expect(b.page.getByText(/has the pen/)).toBeVisible()
    await expect.poll(() => ink(b.page)).toBeLessThan(before)
  })

  test('G-E2 pass the pen: nobody is blocked while the partner is not there yet', async ({ players }) => {
    const a = await players.open(ORIGIN_A)
    await createGameRoom(a.page, 'Pass the pen')
    await expect(a.page.getByText(/Waiting for your friend/)).toBeVisible()
    await stroke(a, 300)
    await expect.poll(() => ink(a.page)).toBeGreaterThan(300)
    const one = await ink(a.page)
    await stroke(a, 500) // still allowed: there is no one to give the pen to
    await expect.poll(() => ink(a.page)).toBeGreaterThan(one + 300)
  })

  test('G-E3 the rooms hub says what each game is, and a lesson hides that', async ({ page }) => {
    await page.goto('/together')
    const select = page.getByLabel('What will you draw?')
    await select.selectOption({ label: 'Game: Pass the pen' })
    await expect(page.getByText('You take turns: one stroke each, back and forth.')).toBeVisible()
    await select.selectOption({ label: 'Game: Draw a topic together' })
    await expect(page.getByText('You both get a prompt to draw on one canvas. No score.')).toBeVisible()
    await select.selectOption({ label: 'Lesson: Happy cat' })
    await expect(page.getByText('No score.')).toHaveCount(0)
    expect(await select.locator('optgroup').count()).toBeGreaterThanOrEqual(6) // Games, then one group per lesson theme
  })

  test('G-E4 a topic room and a turns room have no axe violations', async ({ players }) => {
    for (const game of ['Draw a topic together', 'Pass the pen', 'Two halves of one picture'] as const) {
      const a = await players.open(ORIGIN_A)
      await createGameRoom(a.page, game)
      await expectNoAxeViolations(a.page, game)
    }
  })

  test('G-E5 a reload brings back the topic and the drawing', async ({ players }) => {
    const { a } = await pair(players, 'Draw a topic together')
    const topic = await topicText(a)
    await stroke(a, 400)
    await expect.poll(() => ink(a.page)).toBeGreaterThan(300)
    await a.page.reload()
    await expect(a.page.getByText('you, here')).toBeVisible()
    expect(await topicText(a)).toBe(topic)
    await expect.poll(() => ink(a.page)).toBeGreaterThan(300)
  })
})

test.describe('Two halves', () => {
  const title = (p: Player) => p.page.getByTestId('subject').innerText()
  const across = (p: Player, y: number, from: number, to: number) => drawPath(p.page, along([[from, y], [to, y]]))

  test('G-H4 each person draws their own half, and a line stops at the middle', async ({ players }) => {
    const { a, b } = await pair(players, 'Two halves of one picture')
    await expect(a.page.getByText(/You draw the\s+left\s+half/)).toBeVisible()
    await expect(b.page.getByText(/You draw the\s+right\s+half/)).toBeVisible()
    expect(await title(a)).toBe(await title(b))

    // A starts on the left and drags all the way to the right edge
    await across(a, 450, 100, 900)
    await expect.poll(() => inkIn(a.page, 'left')).toBeGreaterThan(200)
    // (a line stopped at the middle still has a round end, so a few pixels spill over; a line that crossed would have hundreds)
    expect(await inkIn(a.page, 'right')).toBeLessThan(80)
    // B sees the same, and nothing on the right
    await expect.poll(() => inkIn(b.page, 'left')).toBeGreaterThan(200)
    expect(await inkIn(b.page, 'right')).toBeLessThan(80)

    // B starts on the right and drags to the left edge
    await across(b, 600, 900, 100)
    await expect.poll(() => inkIn(a.page, 'right')).toBeGreaterThan(200)
    // both canvases show both halves, and they agree
    expect(Math.abs((await inkIn(b.page, 'left')) - (await inkIn(a.page, 'left')))).toBeLessThan(10)
    expect(Math.abs((await inkIn(b.page, 'right')) - (await inkIn(a.page, 'right')))).toBeLessThan(10)
    // both are drawing at the same time, with no turns
  })

  test('G-H5 a press in the other half does nothing', async ({ players }) => {
    const { a, b } = await pair(players, 'Two halves of one picture')
    await across(a, 450, 700, 900) // A is on the left: this starts in B's half
    expect(await ink(a.page)).toBe(0)
    await across(b, 450, 100, 300) // and the same for B
    expect(await ink(b.page)).toBe(0)
    expect(await ink(a.page)).toBe(0)
  })

  test('G-E7 the picture is shown as a dashed guide, mirrored, and a new picture clears the canvas for both', async ({ players }) => {
    const { a, b } = await pair(players, 'Two halves of one picture')
    const first = await title(a)
    const subject = halfSubjects.find((s) => s.title === first)!
    await expect(a.page.locator('svg polyline.stroke-guide')).toHaveCount(halfGuide(subject).length)
    await across(a, 450, 100, 300)
    await expect.poll(() => ink(b.page)).toBeGreaterThan(100)

    await b.page.getByRole('button', { name: 'New picture' }).click()
    await expect(b.page.getByRole('dialog')).toContainText('The canvas is cleared for both of you')
    await b.page.getByRole('dialog').getByRole('button', { name: 'New picture' }).click()
    for (const p of [a, b]) {
      await expect.poll(() => title(p)).not.toBe(first)
      await expect.poll(() => ink(p.page)).toBe(0)
    }
  })

  test('G-E8 a reload keeps the picture, the drawing and your half', async ({ players }) => {
    const { a } = await pair(players, 'Two halves of one picture')
    const first = await title(a)
    await across(a, 450, 100, 300)
    await expect.poll(() => ink(a.page)).toBeGreaterThan(100)
    await a.page.reload()
    await expect(a.page.getByText('you, here')).toBeVisible()
    expect(await title(a)).toBe(first)
    await expect(a.page.getByText(/You draw the\s+left\s+half/)).toBeVisible()
    await expect.poll(() => ink(a.page)).toBeGreaterThan(100)
  })
})

test.describe('Game rooms on a phone @mobile', () => {
  test('G-E6 a topic room and a turns room fit 390px wide, with the game text above the canvas', async ({ players }) => {
    for (const game of ['Draw a topic together', 'Pass the pen', 'Two halves of one picture'] as const) {
      const a = await players.open(ORIGIN_A, { viewport: { width: 390, height: 844 } })
      await createGameRoom(a.page, game)
      expect(await a.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
      const text = a.page.getByRole('heading', { name: game === 'Pass the pen' ? 'Your turn' : game === 'Draw a topic together' ? 'Your topic' : /^A |^An / })
      await expect(text).toBeVisible()
      const canvas = a.page.getByRole('img', { name: /Shared canvas|Drawing canvas/ })
      const [t, c] = await Promise.all([text.boundingBox(), canvas.boundingBox()])
      expect(t!.y).toBeLessThan(c!.y)
    }
  })
})
