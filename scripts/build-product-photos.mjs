import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
await mkdir('public/media/objects', { recursive: true })
for (const kind of ['bottle', 'nfc', 'airtag']) {
 for (const width of [640, 1280]) await sharp(`assets/product-originals/${kind}.png`).resize({ width }).webp({ quality: 86, alphaQuality: 100 }).toFile(`public/media/objects/${kind}-${width}.webp`)
}
console.log('Responsive transparent product photographs saved.')
