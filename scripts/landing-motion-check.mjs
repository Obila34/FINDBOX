import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
  await desktop.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
  await desktop.waitForSelector('.fs-halo-card')
  const carousel = await desktop.locator('.fs-service-carousel').boundingBox()
  const intro = await desktop.locator('.fs-service-intro').boundingBox()
  if (!carousel || !intro || carousel.x >= intro.x) throw new Error('Hero carousel is not positioned to the left of the copy')

  const supportsFinePointer = await desktop.evaluate(() => matchMedia('(pointer: fine) and (hover: hover)').matches)
  if (supportsFinePointer) {
    await desktop.mouse.move(520, 280)
    await desktop.waitForTimeout(250)
    const cursorOpacity = Number(await desktop.locator('.fb-magnetic-cursor').evaluate(el => getComputedStyle(el).opacity))
    if (cursorOpacity < .9) throw new Error('Magnetic cursor did not become visible for a fine pointer')
  }

  await desktop.evaluate(() => scrollTo({ top: document.body.scrollHeight * .45, behavior: 'instant' }))
  await desktop.waitForTimeout(900)
  const progress = await desktop.locator('.fb-scroll-progress').evaluate(el => getComputedStyle(el).transform)
  if (progress === 'none' || progress.includes('matrix(0,')) throw new Error('Scroll progress did not react to page movement')
  const visibleSections = await desktop.locator('.fb-scroll-reveal').evaluateAll(els => els.filter(el => Number(getComputedStyle(el).opacity) > .9).length)
  if (visibleSections < 2) throw new Error('Scroll sections did not reveal as they entered the viewport')
  await desktop.screenshot({ path: 'output/landing-motion-desktop.png', fullPage: true })

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
  await mobile.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 1) throw new Error(`Mobile landing overflows horizontally by ${overflow}px`)
  const mobileCursor = await mobile.locator('.fb-magnetic-cursor').evaluate(el => getComputedStyle(el).display)
  if (mobileCursor !== 'none') throw new Error('Custom cursor should be disabled on coarse/mobile pointers')
  await mobile.screenshot({ path: 'output/landing-motion-mobile.png', fullPage: false })

  const reduced = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
  await reduced.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
  if (await reduced.locator('.fb-magnetic-cursor').count()) throw new Error('Custom cursor rendered while reduced motion was requested')
  const reducedOpacity = Number(await reduced.locator('.fb-scroll-reveal').first().evaluate(el => getComputedStyle(el).opacity))
  if (reducedOpacity !== 1) throw new Error('Reduced-motion content should be immediately visible')

  console.log('Landing motion passed: desktop composition, cursor, scroll progress, reveals, mobile layout and reduced-motion behavior.')
} finally {
  await browser.close()
}
