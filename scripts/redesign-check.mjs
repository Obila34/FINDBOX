import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
const base = process.env.BASE ?? 'http://127.0.0.1:4175'
mkdirSync('shots/redesign', { recursive: true })
let browser
for (const channel of ['chrome', 'msedge', undefined]) {
  try { browser = await chromium.launch({ channel }); break } catch {}
}
if (!browser) throw new Error('No browser available')
const failures = []
const errors = []
let checked = 0
const roles = { parent: 'Parent / guardian', student: 'Student', staff: 'Lost Property Staff', manager: 'School Manager' }
const routes = {
  public: ['/', '/demo', '/app/welcome', '/app/sign-in', '/app/sign-up', '/app/forgot', '/app/invite', '/missing-page'],
  parent: ['/app/home', '/app/items', '/app/items/item-zuri-bottle', '/app/register', '/app/report', '/app/gallery', '/app/inbox', '/app/account'],
  student: ['/app/home', '/app/items', '/app/quest', '/app/found'],
  staff: ['/manage', '/manage/scan', '/manage/log', '/manage/gallery', '/manage/activity', '/manage/cases/case-cardigan'],
  manager: ['/manage/dashboard', '/manage/settings'],
}
for (const width of [390, 1440]) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
  const page = await context.newPage()
  page.on('pageerror', e => errors.push(e.message))
  for (const [role, paths] of Object.entries(routes)) {
    if (role !== 'public') {
      await page.goto(base + '/demo')
      await page.getByRole('button', { name: new RegExp('^' + roles[role]) }).first().click()
      await page.waitForURL(/\/(app|manage)/)
    }
    for (const path of paths) {
      await page.goto(base + path, { waitUntil: 'networkidle' })
      await page.locator('#root').waitFor()
      await page.locator('img').evaluateAll(imgs => Promise.all(imgs.map(i => { i.loading = 'eager'; return i.decode().catch(() => {}) })))
      console.log('checked', width, path)
      const layout = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, broken: [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.src) }))
      if (layout.document > width + 1 || layout.broken.length) failures.push({ width, path, ...layout })
      checked++
      if (['/', '/app/welcome', '/app/home', '/manage', '/manage/dashboard'].includes(path)) await page.screenshot({ path: 'shots/redesign/' + role + '-' + (path === '/' ? 'landing' : path.split('/').pop()) + '-' + width + '.png', fullPage: path === '/' })
    }
  }
  if (width === 390) {
    await page.goto(base + '/')
    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('dialog').waitFor()
    await page.keyboard.press('Escape')
    if (await page.getByRole('dialog').count()) failures.push('Mobile menu did not close with Escape')
    if (await page.evaluate(() => document.body.style.overflow === 'hidden')) failures.push('Menu left scroll locked')
    await page.getByRole('link', { name: 'Find your way home' }).first().click()
    await page.waitForURL(/\/(app\/(welcome|home)|manage)/)
  }
  await context.close()
}
const motionPage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
motionPage.on('pageerror', e => errors.push(e.message))
await motionPage.goto(base + '/')
await motionPage.waitForTimeout(4000)
await motionPage.screenshot({ path: 'shots/redesign/landing-motion.png' })
await browser.close()
const result = { checked, failures, errors: [...new Set(errors)] }
writeFileSync('shots/redesign/checks.json', JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))
if (failures.length || errors.length) process.exitCode = 1
