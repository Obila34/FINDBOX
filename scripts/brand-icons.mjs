// Renders the FindBox swirl into the favicon, app icons and brand SVGs. Run: node scripts/brand-icons.mjs
import sharp from 'sharp'
import { writeFile } from 'node:fs/promises'
import { swirlRings, SWIRL_CORE } from '../src/components/brand/swirl.ts'

const GREEN = '#657b56', SAGE = '#aebe9e', NIGHT = '#0f1a14'
const mark = (color, scale = 1, count = 12, weight) => {
  const t = (v) => (50 + (v - 50) * scale).toFixed(2)
  return swirlRings(count).map((g, i) => `<circle cx="${t(g.cx)}" cy="${t(g.cy)}" r="${(g.r * scale).toFixed(2)}" fill="none" stroke="${color}" stroke-width="${((i && weight ? weight : g.w) * scale).toFixed(2)}"/>`).join('')
    + `<circle cx="50" cy="50" r="${(SWIRL_CORE.ring * scale).toFixed(2)}" fill="none" stroke="${color}" stroke-width="${(1.6 * scale).toFixed(2)}"/><circle cx="50" cy="50" r="${(SWIRL_CORE.r * scale).toFixed(2)}" fill="${color}"/>`
}
const svg = (body, bg, radius = 22) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 100 100">${bg ? `<rect width="100" height="100" rx="${radius}" fill="${bg}"/>` : ''}${body}</svg>`
const icon = svg(mark(SAGE, 0.78), NIGHT)               // app icon: sage swirl on forest night
const maskable = svg(mark(SAGE, 0.6), NIGHT, 0)         // keeps the swirl inside the maskable safe zone
const favicon = svg(mark(SAGE, 0.86, 4, 3.2), NIGHT, 24)
const plain = svg(mark(GREEN))
const wordmark = (color) => `<svg xmlns="http://www.w3.org/2000/svg" width="540" height="120" viewBox="0 0 540 120"><text x="0" y="86" font-family="Arial,Helvetica,sans-serif" font-size="84" letter-spacing="7" fill="${color}"><tspan font-weight="300">FIND</tspan><tspan font-weight="700">BOX</tspan></text><g transform="translate(424 6) scale(1.08)">${mark(color)}</g></svg>`

const png = (s, size, file) => sharp(Buffer.from(s)).resize(size, size).png({ compressionLevel: 9 }).toFile(file)
await Promise.all([
  png(icon, 512, 'public/icons/icon-512.png'), png(icon, 192, 'public/icons/icon-192.png'), png(icon, 180, 'public/icons/apple-touch-icon.png'),
  png(maskable, 512, 'public/icons/icon-maskable-512.png'), png(favicon, 32, 'public/icons/favicon-32.png'),
  writeFile('public/icons/icon.svg', icon), writeFile('public/icons/icon-maskable.svg', maskable), writeFile('public/favicon.svg', favicon),
  writeFile('public/brand/mark-square.svg', favicon), writeFile('public/brand/mark.svg', plain), writeFile('public/brand/mark-mono.svg', svg(mark('#0f1a14'))),
  writeFile('public/brand/mark-inverted.svg', svg(mark('#ffffff'))), writeFile('public/brand/logo.svg', wordmark(GREEN)), writeFile('public/brand/logo-mono.svg', wordmark('#0f1a14')),
  writeFile('public/brand/logo-inverted.svg', wordmark('#ffffff')), writeFile('public/brand/logo-square.svg', favicon),
])
console.log('Icons and brand SVGs written.')
