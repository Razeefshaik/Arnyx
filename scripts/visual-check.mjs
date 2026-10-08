import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

mkdirSync('artifacts', { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1160 }, deviceScaleFactor: 1 })
await page.goto('http://127.0.0.1:5175', { waitUntil: 'networkidle', timeout: 90000 })
await page.getByRole('button', { name: 'Frontend Design', exact: true }).waitFor()
await page.screenshot({ path: 'artifacts/arnyx-desktop.png', fullPage: true })
await page.screenshot({ path: 'artifacts/arnyx-desktop-viewport.png', fullPage: false })
await page.evaluate(() => { document.documentElement.dataset.theme = 'light' })
await page.waitForTimeout(350)
await page.screenshot({ path: 'artifacts/arnyx-light.png', fullPage: false })
await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(350)
await page.screenshot({ path: 'artifacts/arnyx-mobile.png', fullPage: true })
await browser.close()
console.log('Saved desktop and mobile screenshots in artifacts/')
