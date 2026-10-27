import { readFile } from 'node:fs/promises'
import { test, expect, along, canvasOf, drawPath, ink } from './fixtures'

const diagonal = along([[100, 100], [900, 800]])
const cross = along([[900, 100], [100, 800]])

test.describe('D free draw (S19)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/draw')
    await expect(canvasOf(page)).toBeVisible()
  })

  test('D-H1 draw, undo, colour, size, eraser, clear', async ({ page }) => {
    expect(await ink(page)).toBe(0)
    await drawPath(page, diagonal)
    const one = await ink(page)
    expect(one).toBeGreaterThan(500)

    // a second stroke in another colour and a bigger size
    await page.getByRole('button', { name: 'Brush colour' }).click()
    await page.getByRole('radio', { name: 'Blue' }).check({ force: true })
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Brush size' }).click()
    await page.getByRole('radio', { name: 'L' }).check({ force: true }).catch(() => page.getByText('L', { exact: true }).click())
    await page.keyboard.press('Escape')
    await drawPath(page, cross)
    const two = await ink(page)
    expect(two).toBeGreaterThan(one * 1.5)

    // undo removes the last stroke only
    await page.getByRole('button', { name: 'Undo your last stroke' }).click()
    expect(await ink(page)).toBeLessThan(two)
    expect(await ink(page)).toBeGreaterThan(500)

    // eraser takes ink away
    await page.getByRole('button', { name: 'Eraser' }).click()
    const before = await ink(page)
    await drawPath(page, along([[500, 0], [500, 1000]]))
    expect(await ink(page)).toBeLessThan(before)

    // clear asks first
    await page.getByRole('button', { name: 'Clear the canvas' }).click()
    await page.getByRole('button', { name: 'Cancel' }).click()
    expect(await ink(page)).toBeGreaterThan(0)
    await page.getByRole('button', { name: 'Clear the canvas' }).click()
    await page.getByRole('button', { name: 'Clear canvas' }).click()
    expect(await ink(page)).toBe(0)
    await expect(page.getByRole('button', { name: 'Undo your last stroke' })).toBeDisabled()
  })

  test('D-H2 undo is disabled with nothing drawn, and undoing everything empties the canvas', async ({ page }) => {
    const undo = page.getByRole('button', { name: 'Undo your last stroke' })
    await expect(undo).toBeDisabled()
    await drawPath(page, diagonal)
    await drawPath(page, cross)
    await undo.click()
    await undo.click()
    await expect(undo).toBeDisabled()
    expect(await ink(page)).toBe(0)
  })

  test('D-E1 refresh keeps the drawing', async ({ page }) => {
    await drawPath(page, diagonal)
    const drawn = await ink(page)
    await page.waitForTimeout(700) // autosave waits a moment after the last stroke
    await page.reload()
    await expect.poll(() => ink(page)).toBeGreaterThan(drawn * 0.9)
  })

  test('D-E2 a damaged saved drawing is ignored, not a crash', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('penduet.free-draw.v1', '{"broken'))
    await page.reload()
    await expect(canvasOf(page)).toBeVisible()
    expect(await ink(page)).toBe(0)
  })

  test('D-E3 a click without moving leaves a dot', async ({ page }) => {
    const box = (await canvasOf(page).boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    expect(await ink(page)).toBeGreaterThan(20)
  })

  test('D-E4 drawing that leaves the canvas keeps going and does not break', async ({ page }) => {
    const box = (await canvasOf(page).boundingBox())!
    await page.mouse.move(box.x + 50, box.y + 50)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width + 200, box.y + 100, { steps: 8 })
    await page.mouse.move(box.x + box.width / 2, box.y + box.height + 150, { steps: 8 })
    await page.mouse.up()
    expect(await ink(page)).toBeGreaterThan(200)
    await drawPath(page, diagonal) // still works afterwards
  })

  test('D-E5 the toolbar works from the keyboard: arrows move, Escape closes a panel', async ({ page }) => {
    const toolbar = page.getByRole('toolbar', { name: 'Drawing tools' })
    // the rail is vertical on wide screens and horizontal on phones
    const vertical = (await toolbar.getAttribute('aria-orientation')) === 'vertical'
    const next = vertical ? 'ArrowDown' : 'ArrowRight'
    await toolbar.getByRole('button', { name: 'Pen' }).focus()
    await page.keyboard.press(next)
    await expect(toolbar.getByRole('button', { name: 'Eraser' })).toBeFocused()
    await page.keyboard.press('End')
    await expect(toolbar.getByRole('button', { name: 'Clear the canvas' })).toBeFocused()
    await page.keyboard.press('Home')
    await expect(toolbar.getByRole('button', { name: 'Pen' })).toBeFocused()
    await toolbar.getByRole('button', { name: 'Brush colour' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('radiogroup', { name: 'Brush colour' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('radiogroup', { name: 'Brush colour' })).toBeHidden()
    await expect(toolbar.getByRole('button', { name: 'Brush colour' })).toBeFocused()
  })

  test('D-E6 save as image downloads a real PNG with the drawing in it', async ({ page }) => {
    await drawPath(page, diagonal)
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save as image' }).click()])
    expect(download.suggestedFilename()).toBe('drawing.png')
    const file = await download.path()
    const bytes = await readFile(file)
    expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) // PNG signature
    expect(bytes.length).toBeGreaterThan(2000)
  })

  test('D-E7 a long stroke with many points is smooth enough and does not freeze the page', async ({ page }) => {
    const wiggle: [number, number][] = Array.from({ length: 200 }, (_, i) => [50 + i * 4, 500 + Math.sin(i / 8) * 300])
    const started = Date.now()
    await drawPath(page, wiggle)
    expect(Date.now() - started).toBeLessThan(20_000)
    expect(await ink(page)).toBeGreaterThan(2000)
  })
})
