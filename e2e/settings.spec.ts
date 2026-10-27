import { test, expect, ORIGIN_A, ORIGIN_B, createRoom, joinWithCode } from './fixtures'

test.describe('S20 settings: your name, your data', () => {
  test('S-H1 a new name shows to the partner in the next room', async ({ players }) => {
    const a = await players.open(ORIGIN_A)
    await a.page.goto('/settings')
    await a.page.getByLabel('Name shown in rooms').fill('Mara')
    await a.page.getByRole('button', { name: 'Save name' }).click()
    await expect(a.page.getByText(/Name saved/)).toBeVisible()

    const b = await players.open(ORIGIN_B)
    const code = await createRoom(a.page)
    await joinWithCode(b.page, code)
    await expect(b.page.getByLabel('Mara, here')).toBeVisible()
    await expect(a.page.getByLabel('Mara (you), here').or(a.page.getByLabel(/Mara.*you.*here/))).toBeVisible()
  })

  test('S-E1 an empty name is refused with a message, and nothing is sent', async ({ players }) => {
    const a = await players.open(ORIGIN_A)
    await a.page.goto('/settings')
    const input = a.page.getByLabel('Name shown in rooms')
    const before = await input.inputValue()
    await input.fill('    ')
    await a.page.getByRole('button', { name: 'Save name' }).click()
    await expect(a.page.getByText(/between 1 and 30 characters/)).toBeVisible()
    await a.page.reload()
    await expect(a.page.getByLabel('Name shown in rooms')).toHaveValue(before)
  })

  test('S-E2 the name stops at 30 characters', async ({ players }) => {
    const a = await players.open(ORIGIN_A)
    await a.page.goto('/settings')
    const input = a.page.getByLabel('Name shown in rooms')
    await input.fill('x'.repeat(50))
    expect((await input.inputValue()).length).toBe(30)
  })

  test('S-E3 accents and emoji are kept, and a long name does not break the room layout', async ({ players }) => {
    const a = await players.open(ORIGIN_A, { viewport: { width: 390, height: 844 } })
    await a.page.goto('/settings')
    const name = 'Zoë 🎨 Ñandú Çelik-Müller Ünlü X'.slice(0, 30)
    await a.page.getByLabel('Name shown in rooms').fill(name)
    await a.page.getByRole('button', { name: 'Save name' }).click()
    await expect(a.page.getByText(/Name saved/)).toBeVisible()
    await createRoom(a.page)
    await expect(a.page.getByLabel(new RegExp('Zoë'))).toBeVisible()
    const overflow = await a.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('S-E4 surrounding spaces are trimmed', async ({ players }) => {
    const a = await players.open(ORIGIN_A)
    await a.page.goto('/settings')
    await a.page.getByLabel('Name shown in rooms').fill('   Teo   ')
    await a.page.getByRole('button', { name: 'Save name' }).click()
    await expect(a.page.getByText(/Name saved/)).toBeVisible()
    await a.page.reload()
    await expect(a.page.getByLabel('Name shown in rooms')).toHaveValue('Teo')
  })

  test('S-H2 deleting my data asks first, removes the account and its rooms, and the next visit starts a new guest', async ({ players }) => {
    const a = await players.open(ORIGIN_A)
    const b = await players.open(ORIGIN_B)
    const code = await createRoom(a.page)
    await joinWithCode(b.page, code)
    const sessionKey = () => a.page.evaluate(() => Object.keys(localStorage).find((k) => k.includes('auth-token')) ?? null)
    expect(await sessionKey()).not.toBeNull()

    await a.page.goto('/settings')
    await a.page.getByRole('button', { name: 'Delete my data' }).click()
    await a.page.getByRole('button', { name: 'Cancel' }).click() // asked first: cancel changes nothing
    expect(await sessionKey()).not.toBeNull()
    await a.page.getByRole('button', { name: 'Delete my data' }).click()
    await a.page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(a.page).toHaveURL(/\/$/)
    expect(await sessionKey()).toBeNull()

    // the room the deleted user hosted is gone for the other person too
    const c = await players.open(ORIGIN_B)
    await c.page.goto('/together')
    await c.page.getByLabel('Room code').fill(code)
    await expect(c.page.getByText(/No open room has that code/)).toBeVisible()

    // and a new visit works as a brand new guest
    const newCode = await createRoom(a.page)
    expect(newCode).not.toBe(code)
  })
})
