import { readFileSync } from 'node:fs'
import { test, expect } from './fixtures'

const avoid: string[] = JSON.parse(readFileSync('replica/brand.json', 'utf8')).avoid

// The pages state what the code does. When a claim here stops being true, the test that guards it
// should be the thing that tells you.
test.describe('Privacy policy and terms', () => {
  test('G-H1 every page has the footer links, and they open the two pages', async ({ page }) => {
    for (const path of ['/', '/lessons', '/draw']) {
      await page.goto(path)
      await expect(page.getByRole('navigation', { name: 'Legal' })).toBeVisible()
    }
    await page.goto('/')
    await page.getByRole('navigation', { name: 'Legal' }).getByRole('link', { name: 'Privacy' }).click()
    await expect(page).toHaveURL(/\/privacy$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy policy')
    await page.getByRole('navigation', { name: 'Legal' }).getByRole('link', { name: 'Terms' }).click()
    await expect(page).toHaveURL(/\/terms$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Terms of use')
  })

  test('G-H2 the privacy policy names what is kept, who handles it, and how to delete it', async ({ page }) => {
    await page.goto('/privacy')
    const text = await page.locator('main').innerText()
    for (const needed of ['Supabase', 'Cloudflare', 'Delete my data', 'no ads', 'analytics']) {
      expect(text, `the policy should mention ${needed}`).toContain(needed)
    }
    await expect(page.getByText(/^Last updated \d{4}-\d{2}-\d{2}$/)).toBeVisible()
  })

  test('G-H3 the terms allow free personal use and keep the source code reserved', async ({ page }) => {
    await page.goto('/terms')
    const text = await page.locator('main').innerText()
    expect(text).toContain('free')
    expect(text).toContain('personal, recreational use')
    expect(text).toContain('not open source')
    expect(text).toContain('all rights are reserved')
  })

  test('G-H4 the contact line shows the configured address and links to it', async ({ page }) => {
    await page.goto('/privacy')
    const mail = page.locator('main').getByRole('link', { name: /@/ })
    await expect(mail).toHaveAttribute('href', /^mailto:.+@.+/)
    await expect(page.getByRole('navigation', { name: 'Legal' }).getByRole('link', { name: 'Send feedback' })).toBeVisible()
  })

  test('G-E1 the main navigation has no link to the internal style guide', async ({ page }) => {
    await page.goto('/')
    for (const nav of ['Main', 'Main (compact)']) {
      await expect(page.getByRole('navigation', { name: nav }).getByRole('link', { name: 'Design' })).toHaveCount(0)
    }
  })

  test('G-E2 the pages do not name the original', async ({ page }) => {
    for (const path of ['/privacy', '/terms']) {
      await page.goto(path)
      const all = ((await page.locator('html').innerText()) + (await page.title())).toLowerCase()
      for (const name of avoid) expect(all, `${path} should not contain a name from brand.json`).not.toContain(name.toLowerCase())
    }
  })

  test('G-E3 the home page does not promise ads will never come', async ({ page }) => {
    await page.goto('/')
    const text = (await page.locator('main').innerText()).toLowerCase()
    expect(text).not.toContain('never have ads')
    expect(text).not.toContain('ads, ever')
    expect(text).not.toContain('free forever')
    expect(text).toContain('this first version has no ads')
  })
})
