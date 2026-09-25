// Screenshots of the main screens at phone (390) and desktop (1440) widths.
// Usage: npm run build && npm run preview  (in another terminal)  then: npm run shots
// Uses the locally installed Chrome/Edge via Playwright channels; no browser download needed.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:4173'
const OUT = 'shots'
mkdirSync(OUT, { recursive: true })

const SHOTS = [
  { name: 'landing', role: null, path: '/' },
  { name: 'welcome', role: null, path: '/app/welcome' },
  { name: 'signin', role: null, path: '/app/sign-in' },
  { name: 'demo-guide', role: null, path: '/demo' },
  { name: 'student-home', role: 'student', path: '/app/home' },
  { name: 'student-quest', role: 'student', path: '/app/quest' },
  { name: 'parent-home', role: 'parent', path: '/app/home' },
  { name: 'parent-item', role: 'parent', path: '/app/items/item-zuri-bottle' },
  { name: 'parent-gallery', role: 'parent', path: '/app/gallery' },
  { name: 'staff-queue', role: 'staff', path: '/manage' },
  { name: 'staff-scan', role: 'staff', path: '/manage/scan' },
  { name: 'staff-case', role: 'staff', path: '/manage/cases/case-cardigan' },
  { name: 'manager-dashboard', role: 'manager', path: '/manage/dashboard' },
]
const LABEL = { parent: 'Parent / guardian', student: 'Student', staff: 'Lost Property Staff', manager: 'School Manager' }

async function launch() {
  for (const channel of ['chrome', 'msedge', undefined]) {
    try { return await chromium.launch({ channel }) } catch { /* try next */ }
  }
  throw new Error('No Chromium available. Run: npx playwright install chromium')
}

const browser = await launch()
for (const [label, viewport] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 900 }]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  for (const s of SHOTS) {
    if (s.role) {
      // Enter through the real demo guide so the session is created by the app itself.
      await page.goto(`${BASE}/demo`, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: new RegExp(`^${LABEL[s.role]}`) }).first().click()
      await page.waitForURL(/\/(app|manage)/)
    } else {
      await page.goto(`${BASE}/app/welcome`, { waitUntil: 'networkidle' })
      const out = page.getByRole('button', { name: /Sign out/ })
      if (await out.count()) await out.first().click()
    }
    await page.goto(`${BASE}${s.path}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${OUT}/${s.name}-${label}.png`, fullPage: s.name === 'landing' })
    console.log('shot', s.name, label)
  }
  await ctx.close()
}
await browser.close()
