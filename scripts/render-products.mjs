import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('public/media/products', { recursive: true })
const browser = await chromium.launch({ channel: 'chrome' })
for (const size of [512, 4096]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
  for (const kind of process.argv.length > 2 ? process.argv.slice(2) : ['bottle', 'nfc', 'airtag', 'explorer', 'explorer-boy', 'book', 'stationery', 'clothing', 'lunchbox', 'sports', 'other']) {
    await page.goto(`http://127.0.0.1:4175/render-assets.html?kind=${kind}`)
    await page.waitForTimeout(1800)
    await page.screenshot({ path: `public/media/products/${kind}${size === 4096 ? '-4k' : ''}.png`, omitBackground: true })
  }
  await page.close()
}
await browser.close()
