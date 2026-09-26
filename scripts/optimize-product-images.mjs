import sharp from 'sharp'
import { mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
await mkdir('public/media/catalog', { recursive: true })
for (const file of await readdir('assets/catalog-originals')) {
  for (const width of [480, 960]) await sharp(path.join('assets/catalog-originals', file)).resize(width, width, { fit: 'cover' }).webp({ quality: 82 }).toFile(`public/media/catalog/${path.parse(file).name}-${width}.webp`)
}
for (const file of await readdir('public/media/products')) {
  if (!file.endsWith('-4k.png')) continue
  for (const width of [512, 1024]) await sharp(path.join('public/media/products', file)).resize(width, width, { fit: 'inside' }).webp({ quality: 82 }).toFile(`public/media/products/${file.replace('-4k.png', '')}${width === 1024 ? '-1024' : ''}.webp`)
}
console.log('Created responsive WebP assets; original artwork preserved.')
