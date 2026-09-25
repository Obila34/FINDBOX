import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const browser = await chromium.launch({ channel: 'chrome' })
// Render the app icons directly from their vector source, in the same palette as the navigation.
const iconPage = await browser.newPage()
for (const [name, size, source] of [['icon-192.png',192,'icon.svg'],['icon-512.png',512,'icon.svg'],['icon-maskable-512.png',512,'icon-maskable.svg'],['apple-touch-icon.png',180,'icon.svg'],['favicon-32.png',32,'icon.svg']]) {
  await iconPage.setViewportSize({ width: size, height: size })
  await iconPage.setContent('<style>*{margin:0}svg{display:block;width:100vw;height:100vh}</style>' + readFileSync('public/icons/' + source,'utf8'))
  await iconPage.screenshot({ path: 'public/icons/' + name, omitBackground: true })
}
await iconPage.close()
await browser.close()
