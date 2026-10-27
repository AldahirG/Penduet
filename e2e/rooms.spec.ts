import { test, expect, ORIGIN_A, ORIGIN_B, along, canvasOf, createRoom, dropConnection, drawPath, ink, joinWithCode, newGuestToken, type Player } from './fixtures'

const stroke1 = along([[100, 150], [900, 300]])
const stroke2 = along([[100, 800], [900, 650]])

/** A hosts a room, B joins with the code. Both are live. */
async function pair(players: { open(origin?: string): Promise<Player> }) {
  const a = await players.open(ORIGIN_A)
  const b = await players.open(ORIGIN_B)
  const code = await createRoom(a.page)
  await joinWithCode(b.page, code)
  await expect(a.page.getByLabel(/, here$/)).toHaveCount(2)
  await expect(b.page.getByLabel(/, here$/)).toHaveCount(2)
  return { a, b, code }
}

test.describe('F05 invite a friend by room code (S09 S10 S11 S12)', () => {
  test('F05-H1 create, join with the code, draw both ways, undo, end the room', async ({ players }) => {
    const { a, b, code } = await pair(players)
    // the host sees the code on the page, one character per cell
    await expect(a.page.getByRole('heading', { name: `Room ${code}` })).toBeVisible()

    await drawPath(a.page, stroke1)
    const mineOnA = await ink(a.page)
    expect(mineOnA).toBeGreaterThan(500)
    await expect.poll(() => ink(b.page), { message: "B sees A's stroke" }).toBeGreaterThan(mineOnA * 0.9)

    await drawPath(b.page, stroke2)
    await expect.poll(() => ink(a.page), { message: "A sees B's stroke" }).toBeGreaterThan(mineOnA * 1.5)

    // B undoes only B's stroke, on both screens
    const both = await ink(a.page)
    await b.page.getByRole('button', { name: 'Undo your last stroke' }).click()
    await expect.poll(() => ink(a.page)).toBeLessThan(both)
    await expect.poll(() => ink(a.page)).toBeGreaterThan(mineOnA * 0.9)
    await expect(b.page.getByRole('button', { name: 'Undo your last stroke' })).toBeDisabled()

    // the host ends the room: both are told, both canvases stop taking strokes
    await a.page.getByRole('button', { name: 'End room' }).click()
    await a.page.getByRole('button', { name: 'End room' }).last().click()
    for (const p of [a, b]) {
      await expect(p.page.getByRole('heading', { name: 'The room has closed' })).toBeVisible()
      await expect(p.page.getByText(/drew \d+ strokes?/)).toBeVisible()
    }
    const frozen = await ink(b.page)
    await drawPath(b.page, along([[100, 500], [900, 520]]))
    expect(await ink(b.page)).toBe(frozen)
    // a room that has ended cannot be joined again
    const c = await players.open(ORIGIN_B)
    await c.page.goto('/together')
    await c.page.getByLabel('Room code').fill(code)
    await expect(c.page.getByText(/No open room has that code/)).toBeVisible()
  })

  test('F05-H2 an invite link opens the room and joins', async ({ players }) => {
    const a = await players.open(ORIGIN_A)
    const code = await createRoom(a.page)
    const b = await players.open(ORIGIN_B)
    await b.page.goto(`/room/${code}`)
    await expect(b.page.getByText('you, here')).toBeVisible()
    await expect(a.page.getByLabel(/, here$/)).toHaveCount(2)
  })

  test('F05-E1 a messy code (lowercase, dash, spaces) is accepted', async ({ players }) => {
    const a = await players.open(ORIGIN_A)
    const code = await createRoom(a.page)
    const b = await players.open(ORIGIN_B)
    await b.page.goto('/together')
    await b.page.getByLabel('Room code').fill(` ${code.slice(0, 3).toLowerCase()} - ${code.slice(3).toLowerCase()} `)
    await expect(b.page).toHaveURL(new RegExp(`/room/${code}$`))
  })

  test('F05-E2 a code that matches no room says so and stays on the page', async ({ players }) => {
    const b = await players.open(ORIGIN_B)
    await b.page.goto('/together')
    await b.page.getByLabel('Room code').fill('ZZZZZZ')
    await expect(b.page.getByText(/No open room has that code/)).toBeVisible()
    await expect(b.page).toHaveURL(/\/together$/)
    // and typing again clears the message
    await b.page.getByLabel('Room code').fill('ZZZZZ')
    await expect(b.page.getByText(/No open room has that code/)).toBeHidden()
  })

  test('F05-E3 a third person gets "room is full" and no canvas', async ({ players }) => {
    const { code } = await pair(players)
    const c = await players.open(ORIGIN_A) // same origin as A is fine: a new context is a new guest
    await c.page.goto('/together')
    await c.page.getByLabel('Room code').fill(code)
    await expect(c.page.getByText(/already has two people/)).toBeVisible()
    await expect(c.page).toHaveURL(/\/together$/)
    // opening the invite link instead shows the same, on the room page
    await c.page.goto(`/room/${code}`)
    await expect(c.page.getByText(/already has two people/)).toBeVisible()
    await expect(canvasOf(c.page)).toHaveCount(0)
  })

  test('F05-E4 reloading brings the drawing back for the person who reloaded', async ({ players }) => {
    const { a, b } = await pair(players)
    await drawPath(a.page, stroke1)
    await drawPath(b.page, stroke2)
    await expect.poll(() => ink(a.page)).toBeGreaterThan(1000)
    const before = await ink(a.page)
    await a.page.reload()
    await expect(a.page.getByText('you, here')).toBeVisible()
    await expect.poll(() => ink(a.page)).toBeGreaterThan(before * 0.9)
    await expect(b.page.getByLabel(/, here$/)).toHaveCount(2) // B never saw A leave for good
  })

  test('F05-E5 the same person in a second tab takes the room over; the first can take it back', async ({ players }) => {
    const { a } = await pair(players)
    const second = await a.context.newPage()
    await second.goto(a.page.url())
    await expect(second.getByText('you, here')).toBeVisible()
    await expect(a.page.getByText(/opened this room somewhere else/)).toBeVisible()
    await a.page.getByRole('button', { name: 'Use this tab' }).click()
    await expect(a.page.getByText('you, here')).toBeVisible()
    await expect(second.getByText(/opened this room somewhere else/)).toBeVisible()
    // the partner did not see anyone leave through all of that
  })

  test('F05-E6 the guest leaves: the host is told and keeps the room', async ({ players }) => {
    const { a, b } = await pair(players)
    await b.page.getByRole('button', { name: 'Leave' }).click()
    await expect(b.page).toHaveURL(/\/together$/)
    await expect(a.page.getByText(/Your partner left the room/)).toBeVisible()
    await expect(a.page.getByLabel(/, left$/)).toBeVisible()
    await drawPath(a.page, stroke1) // the host can keep drawing alone
    expect(await ink(a.page)).toBeGreaterThan(500)
  })

  test('F05-E7 the host leaves: the guest becomes the host and can end the room', async ({ players }) => {
    const { a, b } = await pair(players)
    await expect(b.page.getByRole('button', { name: 'End room' })).toHaveCount(0) // a guest cannot end it
    await a.page.getByRole('button', { name: 'Leave' }).click()
    await expect(b.page.getByText(/Your partner left the room/)).toBeVisible()
    // The person left alone is the host now. The page should say so without a reload.
    await expect(b.page.getByRole('button', { name: 'End room' })).toBeVisible()
  })

  test('F05-E8 a dropped connection comes back by itself, with what was drawn meanwhile', async ({ players }) => {
    const { a, b } = await pair(players)
    await dropConnection(b.page)
    await expect(b.page.getByText(/Lost the connection/)).toBeVisible()
    await expect(canvasOf(b.page)).toHaveClass(/cursor-not-allowed/) // drawing is paused, not silently lost
    await drawPath(a.page, stroke1)
    await expect(b.page.getByText('you, here')).toBeVisible({ timeout: 15_000 })
    await expect(b.page.getByText(/Lost the connection/)).toBeHidden()
    await expect.poll(() => ink(b.page)).toBeGreaterThan(500)
  })

  test('F05-E9 a malformed code in the address says the room is closed', async ({ players }) => {
    const a = await players.open(ORIGIN_A)
    await a.page.goto('/room/ZZ')
    await expect(a.page.getByText(/does not look like a room code/)).toBeVisible()
    await a.page.getByRole('link', { name: 'Back to rooms' }).click()
    await expect(a.page).toHaveURL(/\/together$/)
  })

  test('F05-E10 a room nobody can open (valid code, no such room) says it has closed', async ({ players }) => {
    const a = await players.open(ORIGIN_A)
    await a.page.goto('/room/ZZZZZZ')
    await expect(a.page.getByText(/This room has closed/)).toBeVisible()
    await expect(canvasOf(a.page)).toHaveCount(0)
  })

  test('F05-E11 double-clicking Create room opens one room', async ({ players }) => {
    const a = await players.open(ORIGIN_A)
    await a.page.goto('/together')
    const create = a.page.getByRole('button', { name: 'Create room' })
    await Promise.all([create.click(), create.click({ timeout: 500 }).catch(() => undefined)])
    await a.page.waitForURL(/\/room\//)
    await expect(a.page.getByText('you, here')).toBeVisible()
    // The cap is three open rooms. Two more must be allowed (so the double click made one room, not two),
    // and then a fourth is refused.
    for (let i = 0; i < 2; i++) await createRoom(a.page)
    await a.page.goto('/together')
    await a.page.getByRole('button', { name: 'Create room' }).click()
    await expect(a.page.getByText(/already have three open rooms/)).toBeVisible()
  })

  test('F05-B1 the canvas does not move when the partner joins, drops or comes back (a moving canvas bends strokes)', async ({ players }) => {
    const a = await players.open(ORIGIN_A)
    const code = await createRoom(a.page)
    const top = async () => (await canvasOf(a.page).boundingBox())!.y
    const y0 = await top()
    const b = await players.open(ORIGIN_B)
    await joinWithCode(b.page, code)
    await expect(a.page.getByLabel(/, here$/)).toHaveCount(2)
    expect(await top(), 'after the partner joined').toBe(y0)
    await dropConnection(b.page)
    await expect(a.page.getByLabel(/, left$/)).toBeVisible()
    expect(await top(), 'after the partner dropped').toBe(y0)
    await expect(a.page.getByLabel(/, here$/)).toHaveCount(2, { timeout: 15_000 })
    expect(await top(), 'after the partner came back').toBe(y0)
  })

  test('F05-B3 the canvas stays put whatever the names are: long names, short names, a partner who has not come yet', async ({ players }) => {
    for (const width of [1280, 390]) {
      const a = await players.open(ORIGIN_A, { viewport: { width, height: 900 } })
      const b = await players.open(ORIGIN_B, { viewport: { width, height: 900 } })
      // a very long name on one side, a very short one on the other
      for (const [p, name] of [[a, 'Alexandria Montgomery-Wellington'.slice(0, 30)], [b, 'Jo']] as const) {
        await p.page.goto('/settings')
        await p.page.getByLabel('Name shown in rooms').fill(name)
        await p.page.getByRole('button', { name: 'Save name' }).click()
        await expect(p.page.getByText(/Name saved/)).toBeVisible()
      }
      const code = await createRoom(a.page)
      const top = async () => (await canvasOf(a.page).boundingBox())!.y
      const y0 = await top()
      await joinWithCode(b.page, code)
      await expect(a.page.getByLabel(/, here$/)).toHaveCount(2)
      expect(await top(), `after the partner joined at ${width}px`).toBe(y0)
      await dropConnection(b.page)
      await expect(a.page.getByLabel(/, left$/)).toBeVisible()
      expect(await top(), `after the partner dropped at ${width}px`).toBe(y0)
      await expect(a.page.getByLabel(/, here$/)).toHaveCount(2, { timeout: 15_000 })
      expect(await top(), `after the partner came back at ${width}px`).toBe(y0)
    }
  })

  test('F05-B2 a stroke the partner is halfway through when you connect still arrives', async ({ players }) => {
    const a = await players.open(ORIGIN_A)
    const code = await createRoom(a.page)
    const box = (await canvasOf(a.page).boundingBox())!
    // A starts a stroke and holds it open while B arrives
    await a.page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.2)
    await a.page.mouse.down()
    await a.page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.3, { steps: 10 })
    const b = await players.open(ORIGIN_B)
    await joinWithCode(b.page, code)
    await a.page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.5, { steps: 10 })
    await a.page.mouse.up()
    await expect.poll(() => ink(b.page), { message: 'B sees the stroke A was drawing when B joined' }).toBeGreaterThan(500)
    // and it is there for good: a reload shows it too
    await b.page.reload()
    await expect(b.page.getByText('you, here')).toBeVisible()
    await expect.poll(() => ink(b.page)).toBeGreaterThan(500)
  })

  test('F05-N1 a fourth open room is refused with a plain message', async ({ players }) => {
    const a = await players.open(ORIGIN_A)
    for (let i = 0; i < 3; i++) await createRoom(a.page)
    await a.page.goto('/together')
    await a.page.getByRole('button', { name: 'Create room' }).click()
    await expect(a.page.getByText(/already have three open rooms/)).toBeVisible()
    await expect(a.page).toHaveURL(/\/together$/)
  })

  test('F05-N2 someone who is not in a room cannot read it, whatever they try', async ({ players }) => {
    const { a, code } = await pair(players)
    const token = await newGuestToken() // a signed-in stranger, with no place in any room
    const c = await players.open(ORIGIN_B)
    // no ticket for a room you are not in
    const res = await c.page.request.post(`http://127.0.0.1:8787/rooms/${code}/ticket`, { headers: { authorization: `Bearer ${token}` } })
    expect(res.status()).toBe(404)
    // and you cannot end it
    const end = await c.page.request.post(`http://127.0.0.1:8787/rooms/${code}/end`, { headers: { authorization: `Bearer ${token}` } })
    expect(end.status()).toBe(404)
    await expect(a.page.getByRole('button', { name: 'End room' })).toBeVisible() // untouched
    await expect(a.page.getByText(/closed/)).toHaveCount(0)
  })

  test('F05-N3 strokes drawn by the partner cannot be undone by you', async ({ players }) => {
    const { a, b } = await pair(players)
    await drawPath(a.page, stroke1)
    await expect.poll(() => ink(b.page)).toBeGreaterThan(500)
    await expect(b.page.getByRole('button', { name: 'Undo your last stroke' })).toBeDisabled()
  })
})
