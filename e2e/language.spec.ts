import { test, expect, expectNoAxeViolations } from './fixtures'

// The app starts in Spanish, and a visitor can switch to English, which is remembered. (Every other spec reads English: the
// fixtures choose it for their visitors, which is what these tests undo.)

const asNewVisitor = async (page: import('@playwright/test').Page) => {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.removeItem('penduet.lang'))
  await page.reload()
}

test.describe('Language', () => {
  test('L-H1 a new visitor sees Spanish, and the page says so', async ({ page }) => {
    await asNewVisitor(page)
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
    await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Lecciones' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Dibuja con\s+alguien que conoces/ })).toBeVisible()
    await expect(page).toHaveTitle('Penduet')
  })

  test('L-H2 the switch changes the whole page at once, and the choice is remembered', async ({ page }) => {
    await asNewVisitor(page)
    await page.getByRole('button', { name: 'Cambiar el idioma a English' }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('heading', { name: /Draw with\s+someone you know/ })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Lessons' })).toBeVisible()
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('button', { name: 'Switch language to Español' })).toBeVisible()
    await page.getByRole('button', { name: 'Switch language to Español' }).click()
    await expect(page.getByRole('heading', { name: 'Cómo funciona' })).toBeVisible()
  })

  test('L-H3 lessons come in Spanish too: the titles, the steps and the hints', async ({ page }) => {
    await asNewVisitor(page)
    await page.goto('/lessons')
    await expect(page.getByRole('heading', { name: 'Lecciones' })).toBeVisible()
    await page.getByRole('link', { name: 'Empezar' }).first().click()
    await expect(page.getByRole('heading', { name: 'Líneas rectas' })).toBeVisible()
    await page.getByRole('button', { name: 'Empezar la lección' }).click()
    await expect(page.getByText('Dibuja una línea recta de izquierda a derecha siguiendo la guía punteada.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Revisar mi dibujo' })).toBeDisabled()
    await page.getByRole('button', { name: 'Saltar paso' }).click()
    await expect(page.getByText('Ahora una línea de arriba hacia abajo.')).toBeVisible()
  })

  test('L-H4 the rooms hub, a room and the legal pages in Spanish', async ({ page }) => {
    await asNewVisitor(page)
    await page.goto('/together')
    await expect(page.getByRole('heading', { name: 'Dibujar juntos' })).toBeVisible()
    await expect(page.getByLabel('¿Qué van a dibujar?')).toBeVisible()
    await page.getByRole('button', { name: 'Crear sala' }).click()
    await page.waitForURL(/\/room\/[A-Z2-9]{6}$/)
    await expect(page.getByText('tú, aquí')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Invitar' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Guardar como imagen' })).toBeVisible()
    await expect(page.getByRole('toolbar', { name: 'Herramientas de dibujo' })).toBeVisible()
    await page.goto('/privacy')
    await expect(page.getByRole('heading', { name: 'Política de privacidad' })).toBeVisible()
    await page.goto('/terms')
    await expect(page.getByRole('heading', { name: 'Términos de uso' })).toBeVisible()
  })

  test('L-E1 Spanish pages have no axe violations, desktop and phone width', async ({ page }) => {
    await asNewVisitor(page)
    for (const path of ['/', '/lessons', '/together', '/settings', '/privacy']) {
      await page.goto(path)
      await expectNoAxeViolations(page, `${path} in Spanish`)
    }
  })

  test('L-E2 the language can also be changed from Settings', async ({ page }) => {
    await asNewVisitor(page)
    await page.goto('/settings')
    await expect(page.getByRole('radiogroup', { name: 'Idioma' })).toBeVisible()
    await page.getByRole('radiogroup', { name: 'Idioma' }).getByText('English').click()
    await expect(page.getByRole('heading', { name: 'Language' })).toBeVisible()
  })
})

test.describe('Language on a phone @mobile', () => {
  test('L-E3 the header fits 390px with the language and theme switches, in both languages', async ({ players }) => {
    const { page } = await players.open(undefined, { viewport: { width: 390, height: 844 } })
    await asNewVisitor(page)
    for (const name of ['Cambiar el idioma a English', 'Switch language to Español']) {
      await page.getByRole('button', { name }).click()
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
      const box = await page.locator('header').boundingBox()
      expect(box!.height).toBeLessThanOrEqual(64)
    }
  })
})
