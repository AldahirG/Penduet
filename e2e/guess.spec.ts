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
  joinWithCode,
  type Player,
} from './fixtures'

// Draw and guess. The Worker runs the clock; these tests wait for its phases, so a round takes as long as the
// room's pace (GAME_SPEED, 0.4 when Playwright starts the stack itself, 1 against a stack you started yourself).

const PHASE_WAIT = 45_000
const panel = (p: Player) => p.page.getByTestId('guess-panel')
const waitPhase = (p: Player, phase: string, timeout = PHASE_WAIT) => expect(panel(p)).toHaveAttribute('data-phase', phase, { timeout })
// A short, quick stroke: the canvas is only open for a couple of seconds at the test pace.
const stroke = (p: Player, y: number) => drawPath(p.page, along([[150, y], [850, y + 40]], 120))

type Viewport = { width: number; height: number }

/** Two people in a draw-and-guess room, once the wheel has stopped: who draws, and who guesses. */
async function round(players: { open(origin?: string, opts?: { viewport?: Viewport }): Promise<Player> }, viewport?: Viewport) {
  const a = await players.open(ORIGIN_A, viewport ? { viewport } : undefined)
  const b = await players.open(ORIGIN_B, viewport ? { viewport } : undefined)
  const code = await createGameRoom(a.page, 'Draw and guess')
  await expect(panel(a)).toHaveAttribute('data-phase', 'waiting')
  await joinWithCode(b.page, code)
  await waitPhase(a, 'countdown')
  await waitPhase(b, 'countdown')
  const aDraws = (await a.page.getByTestId('secret-word').count()) > 0
  const [drawer, guesser] = aDraws ? [a, b] : [b, a]
  const word = (await drawer.page.getByTestId('secret-word').innerText()).trim()
  return { a, b, drawer, guesser, word }
}

const answer = async (p: Player, text: string) => {
  await p.page.getByLabel('One try: what is it?').fill(text)
  await p.page.getByRole('button', { name: 'Guess' }).click()
}

test.describe('Draw and guess', () => {
  test.setTimeout(150_000)

  test('GD-H1 waits for two people, spins the wheel, and tells only the drawer the word', async ({ players }) => {
    const { drawer, guesser, word } = await round(players)
    expect(word.length).toBeGreaterThan(1)
    await expect(drawer.page.getByTestId('secret-word')).toBeVisible()
    await expect(guesser.page.getByTestId('secret-word')).toHaveCount(0)
    await expect(drawer.page.getByRole('heading', { name: /Round 1: you draw/ })).toBeVisible()
    await expect(guesser.page.getByRole('heading', { name: /Round 1: .* draws/ })).toBeVisible()
  })

  test('GD-H2 only the drawer draws, only while the canvas is open; a wrong answer opens it again; a right one ends the round', async ({ players }) => {
    const { drawer, guesser, word } = await round(players)
    await waitPhase(drawer, 'draw')

    // the drawer can draw, and the guesser sees it; the guesser cannot draw
    await stroke(drawer, 300)
    await expect.poll(() => ink(drawer.page)).toBeGreaterThan(300)
    await expect.poll(async () => (await ink(guesser.page)) === (await ink(drawer.page))).toBe(true)
    const seen = await ink(guesser.page)
    await stroke(guesser, 600)
    expect(await ink(guesser.page)).toBe(seen)

    // the canvas closes at the end of the burst: the drawer's next stroke does nothing
    await waitPhase(guesser, 'answer')
    const locked = await ink(drawer.page)
    await stroke(drawer, 600)
    expect(await ink(drawer.page)).toBe(locked)
    await expect(drawer.page.getByText(/is guessing/)).toBeVisible()

    // one wrong try opens the canvas again, and the drawer hears about it
    await answer(guesser, 'definitely not it')
    await waitPhase(drawer, 'draw')
    await expect(drawer.page.getByText(/tried “definitely not it”/)).toBeVisible()
    await expect(guesser.page.getByText('Not “definitely not it”.')).toBeVisible()
    await stroke(drawer, 600)
    await expect.poll(() => ink(drawer.page)).toBeGreaterThan(locked)

    // a right answer in the next window ends the round for both: 3 points for the second window
    await waitPhase(guesser, 'answer')
    await answer(guesser, word.toUpperCase())
    for (const p of [drawer, guesser]) {
      await waitPhase(p, 'result', 15_000)
      await expect(p.page.getByText('Got it! +3 points')).toBeVisible()
      await expect(p.page.getByTestId('secret-word')).toHaveText(word)
      await expect(p.page.getByText('Score 3. 1 of 1 rounds guessed.')).toBeVisible()
    }
    // and the finished drawing stays on screen to look at
    expect(await ink(guesser.page)).toBeGreaterThan(300)
  })

  test('GD-E1 with no right answer the round is lost, and the next one has the other person drawing on a clean canvas', async ({ players }) => {
    const { drawer, guesser } = await round(players)
    await waitPhase(drawer, 'draw')
    await stroke(drawer, 300)
    await expect.poll(() => ink(guesser.page)).toBeGreaterThan(300)
    for (const p of [drawer, guesser]) {
      await waitPhase(p, 'result', 90_000)
      await expect(p.page.getByText(/No luck this time/)).toBeVisible()
      await expect(p.page.getByTestId('secret-word')).toBeVisible()
    }
    // the next round: the roles swap, and the canvas is wiped
    await waitPhase(guesser, 'countdown', 30_000)
    await expect(guesser.page.getByRole('heading', { name: /Round 2: you draw/ })).toBeVisible()
    await expect(guesser.page.getByTestId('secret-word')).toBeVisible()
    await expect(drawer.page.getByTestId('secret-word')).toHaveCount(0)
    expect(await ink(drawer.page)).toBe(0)
    expect(await ink(guesser.page)).toBe(0)
  })

  test('GD-E2 an answer takes one try, and a reload during the round brings back where it stands', async ({ players }) => {
    const { drawer, guesser, word } = await round(players)
    await waitPhase(guesser, 'answer')
    await guesser.page.getByLabel('One try: what is it?').fill('nope')
    await guesser.page.getByLabel('One try: what is it?').press('Enter')
    await expect(guesser.page.getByLabel('One try: what is it?')).toBeDisabled().catch(() => undefined) // the round may already have moved on
    await waitPhase(drawer, 'draw')

    await drawer.page.reload()
    await expect(drawer.page.getByText('you, here')).toBeVisible()
    await expect(drawer.page.getByTestId('secret-word')).toHaveText(word)
    await expect(guesser.page.getByTestId('secret-word')).toHaveCount(0)
  })

  test('GD-E3 someone leaving calls the round off, and it starts again when they are back', async ({ players }) => {
    const { drawer, guesser } = await round(players)
    await drawer.page.getByRole('button', { name: 'Leave' }).click()
    await expect(guesser.page.getByText(/Waiting for your partner/)).toBeVisible({ timeout: 15_000 })
    await expect(guesser.page.getByTestId('secret-word')).toHaveCount(0)
    await expect(panel(guesser)).toHaveAttribute('data-phase', 'waiting')
  })

  test('GD-E4 the rooms hub says what the game is', async ({ page }) => {
    await page.goto('/together')
    await page.getByLabel('What will you draw?').selectOption({ label: 'Game: Draw and guess' })
    await expect(page.getByText(/four short bursts/)).toBeVisible()
  })

  test('GD-E5 the room has no axe violations while guessing and at the result', async ({ players }) => {
    const { drawer, guesser, word } = await round(players)
    await expectNoAxeViolations(drawer.page, 'draw and guess: countdown, drawer')
    await waitPhase(guesser, 'answer')
    await expectNoAxeViolations(guesser.page, 'draw and guess: answer window, guesser')
    await answer(guesser, 'wrong')
    await waitPhase(guesser, 'answer')
    await answer(guesser, word)
    await waitPhase(guesser, 'result', 15_000)
    await expectNoAxeViolations(guesser.page, 'draw and guess: result')
    await expectNoAxeViolations(drawer.page, 'draw and guess: result, drawer')
  })
})

test.describe('Draw and guess on a phone @mobile', () => {
  test.setTimeout(150_000)
  const phone = { width: 390, height: 844 }

  test('GD-E6 the word, the clock and the answer box are on the canvas, and nothing runs off the side', async ({ players }) => {
    const { drawer, guesser, word } = await round(players, phone)
    for (const p of [drawer, guesser]) {
      expect(await p.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
    }
    // the drawer reads the word on the canvas itself
    const canvas = drawer.page.getByRole('img', { name: /Shared canvas/ })
    await waitPhase(drawer, 'draw')
    const c = (await canvas.boundingBox())!
    const pill = drawer.page.getByText(word, { exact: true }).first()
    const pillBox = (await pill.boundingBox())!
    expect(pillBox.y).toBeGreaterThanOrEqual(c.y)
    expect(pillBox.y + pillBox.height).toBeLessThanOrEqual(c.y + c.height)

    // the guesser answers from the canvas, without scrolling
    await waitPhase(guesser, 'answer')
    const box = guesser.page.getByLabel('One try: what is it?')
    await expect(box).toBeInViewport()
    const [b, gc] = [(await box.boundingBox())!, (await guesser.page.getByRole('img', { name: /Shared canvas/ }).boundingBox())!]
    expect(b.y).toBeGreaterThanOrEqual(gc.y)
    expect(b.y + b.height).toBeLessThanOrEqual(gc.y + gc.height)
    await answer(guesser, 'nothing')
    await waitPhase(guesser, 'draw')
    await waitPhase(guesser, 'answer')
    await answer(guesser, word)
    await waitPhase(guesser, 'result', 15_000)
    await expect(guesser.page.getByText('Got it! +3 points')).toBeAttached()
    await expectNoAxeViolations(guesser.page, 'draw and guess on a phone: result')
  })
})
