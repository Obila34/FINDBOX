import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'

await mkdir('shots/carousel', { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto((process.env.BASE || 'http://localhost:5173') + '/', { waitUntil: 'networkidle' })
  await page.locator('.fs-findbox-stream').waitFor()

  assert(await page.locator('.fb-site-header').isVisible(), 'Existing site navigation should remain visible')
  assert.equal(await page.locator('.fb-stream-card').count(), 20, 'Two rails should each contain ten cards')
  assert.equal(await page.getByRole('button', { name: /pause|play/i }).count(), 0, 'Hero should not expose pause or play controls')
  const duration = await page.locator('.fb-stream-card').first().evaluate(element => getComputedStyle(element).animationDuration)
  assert.equal(duration, '38s', 'The image stream should use the requested slow automatic motion')

  const firstCard = page.locator('.fb-stream-card').first()
  const before = await firstCard.evaluate(element => getComputedStyle(element).transform)
  await page.waitForTimeout(1100)
  const after = await firstCard.evaluate(element => getComputedStyle(element).transform)
  assert.notEqual(before, after, 'The image stream should move automatically')

  const streamBox = await page.locator('.fs-findbox-stream').boundingBox()
  const shopBox = await page.getByRole('link', { name: /Shop FindBox labels/i }).boundingBox()
  assert(streamBox && shopBox)
  const shopCentre = shopBox.x + shopBox.width / 2
  const streamCentre = streamBox.x + streamBox.width / 2
  assert(Math.abs(shopCentre - streamCentre) < 8, 'Shop action should sit between the two image rails')
  await page.locator('.fs-findbox-stream').screenshot({ path: 'shots/carousel/desktop.png' })

  await page.setViewportSize({ width: 390, height: 844 })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Hero should not overflow on mobile')
  assert(await page.getByRole('link', { name: /Shop FindBox labels/i }).isVisible())
  await page.locator('.fs-findbox-stream').screenshot({ path: 'shots/carousel/mobile.png' })

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload({ waitUntil: 'networkidle' })
  const playState = await page.locator('.fb-stream-card').first().evaluate(element => getComputedStyle(element).animationPlayState)
  assert.equal(playState, 'paused')
  assert.deepEqual(errors, [])
  console.log('Image-stream hero passed: navigation preserved, two slow automatic rails, centred shop action, no playback controls, mobile layout and reduced motion.')
} finally {
  await browser.close()
}
