import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ reducedMotion: 'reduce' })
for (const [name,size] of [['icon-192.png',192],['icon-512.png',512],['icon-maskable-512.png',512],['apple-touch-icon.png',180],['favicon-32.png',32]]) {
 await page.setViewportSize({width:size,height:size})
 await page.goto('http://127.0.0.1:4175/render-assets.html?kind=orb')
 await page.addStyleTag({ content:'body{background:#0a1a17!important}' })
 await page.waitForTimeout(700)
 await page.screenshot({path:'public/icons/'+name})
}
await browser.close()
