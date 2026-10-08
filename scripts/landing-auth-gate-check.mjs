import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const BASE = process.env.BASE || 'http://127.0.0.1:5173'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })

  const wordmark = page.locator('.fb-site-header .fb-wordmark')
  const mark = wordmark.locator('img')
  assert(await mark.isVisible(), 'Concentric ring mark should appear beside the FINDBOX wordmark')
  const wordmarkBox = await wordmark.boundingBox(), markBox = await mark.boundingBox()
  assert(wordmarkBox && markBox && markBox.x > wordmarkBox.x + wordmarkBox.width / 2, 'Ring mark should sit to the right of the wordmark text')
  assert(await page.locator('.fb-site-header').getByRole('link', { name: 'Log in', exact: true }).isVisible())
  assert(await page.locator('.fb-site-header').getByRole('link', { name: 'Refer your school', exact: true }).isVisible())
  assert.equal(await page.locator('#how').getByRole('heading', { name: /connected return system/i }).count(), 1)
  assert.equal(await page.locator('.fs-stream-heading').getByRole('heading').innerText(), 'Every belonging.\nA way home.')

  await page.getByRole('link', { name: /Shop FindBox labels/i }).click()
  const dialog = page.getByRole('dialog', { name: 'Your FindBox account' })
  await dialog.waitFor()
  assert.equal(new URL(page.url()).pathname, '/')
  assert(await dialog.getByRole('link', { name: /Log in/i }).isVisible())
  assert(await dialog.getByRole('link', { name: /Create account/i }).isVisible())
  await page.screenshot({ path: 'output/landing-auth-gate.png' })
  await dialog.getByRole('link', { name: /Log in/i }).click()
  await page.waitForURL('**/app/sign-in')
  await page.locator('.fb-sample-accounts > button').first().click()
  await page.waitForURL('**/shop/catalog')

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  assert(await page.locator('.fb-site-header').getByRole('link', { name: 'Open app', exact: true }).isVisible())
  await page.locator('.fb-site-header').getByRole('link', { name: 'Refer your school', exact: true }).click()
  await page.waitForURL('**/refer')

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await mobile.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await mobile.evaluate(() => localStorage.clear())
  await mobile.reload({ waitUntil: 'networkidle' })
  const mobileHeader = mobile.locator('.fb-site-header')
  assert(await mobileHeader.getByRole('link', { name: 'Refer your school', exact: true }).isVisible())
  assert(await mobileHeader.getByRole('link', { name: 'Log in', exact: true }).isVisible())
  assert(await mobileHeader.getByRole('button', { name: 'Open menu' }).isVisible())
  assert(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await mobile.close()

  console.log('Landing account journey passed: logo lockup, visible actions, gated shop dialog, destination resume, referral access and FindBox narration.')
} finally {
  await browser.close()
}
