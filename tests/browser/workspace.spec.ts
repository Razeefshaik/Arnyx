import { expect, test } from '@playwright/test'

test.beforeAll(async ({ request }) => {
  await expect.poll(async () => {
    try { return (await request.get('http://127.0.0.1:4318/actuator/health')).status() }
    catch { return 0 }
  }, { timeout: 40_000, message: 'Spring Boot must be ready before checking the UI' }).toBe(200)
})

test('search, filters, walkthroughs, and keyboard dialogs', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Discover', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Frontend Design', exact: true })).toBeVisible()
  await page.getByRole('group', { name: 'Capability type' }).getByRole('button', { name: 'Connectors', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Context7', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Frontend Design', exact: true })).toHaveCount(0)
  await page.getByRole('group', { name: 'Capability type' }).getByRole('button', { name: 'All capabilities' }).click()
  await page.getByRole('button', { name: 'Frontend Design', exact: true }).click()
  const details = page.getByRole('dialog', { name: 'Capability details' })
  await expect(details.getByRole('heading', { name: 'Frontend Design', exact: true })).toBeVisible()
  await details.getByRole('button', { name: 'Walkthrough', exact: true }).click()
  await expect(details.locator('.walkthrough-steps li')).toHaveCount(4)
  await expect(details.getByText('$frontend-design Build a personal AI')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(details).not.toBeVisible()
  await page.keyboard.press('Control+k')
  await expect(page.getByRole('dialog', { name: 'Go anywhere' })).toBeVisible()
  await page.getByRole('dialog', { name: 'Go anywhere' }).getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your intelligence engine' })).toBeVisible()
  expect(errors).toEqual([])
})

test('saved stack survives page reload', async ({ page, request }) => {
  const original = await (await request.get('http://127.0.0.1:4318/api/state')).json()
  const wasSaved = original.saved.includes('frontend-design')
  await page.goto('/')
  if (wasSaved) await page.getByRole('button', { name: 'Remove Frontend Design from stack' }).click()
  await page.getByRole('button', { name: 'Save Frontend Design to stack' }).click()
  await expect(page.getByRole('button', { name: 'Remove Frontend Design from stack' })).toBeVisible()
  await page.reload()
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /My stack/ }).click()
  await expect(page.getByRole('button', { name: 'Frontend Design', exact: true })).toBeVisible()
  if (!wasSaved) await page.getByRole('button', { name: 'Remove Frontend Design from stack' }).click()
})

test('comparison shows compatibility and concrete advantages', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.capability-card').first()).toBeVisible()
  await page.locator('.capability-card').nth(0).getByRole('button', { name: 'Compare', exact: true }).click()
  await page.locator('.capability-card').nth(1).getByRole('button', { name: 'Compare', exact: true }).click()
  await page.locator('.compare-bar').getByRole('button', { name: 'Compare', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Compare capabilities' })
  await expect(modal.getByRole('columnheader')).toHaveCount(3)
  await expect(modal.getByRole('rowheader', { name: 'Compatibility' })).toBeVisible()
  await expect(modal.getByRole('rowheader', { name: 'Advantages' })).toBeVisible()
})

test('mobile layout and reduced motion remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Discover', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Frontend Design', exact: true })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  expect(overflow).toBe(false)
  expect(await page.locator('.signal-orbit').evaluate(element => getComputedStyle(element).animationName)).toBe('none')
  await page.getByRole('button', { name: 'Frontend Design', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Capability details' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Open workspace menu' }).click()
  await page.getByRole('dialog', { name: 'Go anywhere' }).getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible()
})
