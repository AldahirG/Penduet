import { readFileSync } from 'node:fs'
import { test, expect } from './fixtures'

// The names to keep out are listed in replica/brand.json, so they are not spelled out in code.
const avoid: string[] = JSON.parse(readFileSync('replica/brand.json', 'utf8')).avoid

test.describe('Home and landing (S02)', () => {
  test('L-H1 the page says what the product is and offers the three ways in', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Draw with someone you know.')
    for (const name of ['Start a room', 'Try a lesson', 'Draw on your own']) {
      await expect(page.getByRole('link', { name }).first()).toBeVisible()
    }
    for (const section of ['How it works', 'What you get', 'Price: nothing', 'Questions', 'Open a room and send the code.']) {
      await expect(page.getByRole('heading', { name: section })).toBeVisible()
    }
  })

  test('L-H2 the hero button starts a room from the home page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Start a room' }).first().click()
    await expect(page).toHaveURL(/\/together$/)
  })

  test('L-E1 the product pictures load and describe themselves', async ({ page }) => {
    await page.goto('/')
    const hero = page.getByRole('img', { name: /A room with two people in it/ })
    await expect(hero).toBeVisible()
    expect(await hero.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(500)
  })

  test('L-E2 the page makes no claim it cannot keep: no counts, ratings, logos or testimonials', async ({ page }) => {
    await page.goto('/')
    const text = (await page.locator('main').innerText()).toLowerCase()
    for (const banned of ['million', 'trusted by', '5 stars', '★', 'as seen', 'testimonial', 'award']) {
      expect(text, `the page should not say "${banned}"`).not.toContain(banned)
    }
  })

  test('L-E3 the original is not named anywhere on the page or in its title', async ({ page }) => {
    await page.goto('/')
    const all = ((await page.locator('html').innerText()) + (await page.title())).toLowerCase()
    for (const name of avoid) expect(all, `the page should not contain ${name.length} letters of a name from brand.json`).not.toContain(name.toLowerCase())
  })
})
