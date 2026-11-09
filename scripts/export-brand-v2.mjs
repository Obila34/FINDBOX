import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const metadataDir = path.join(root, 'tmp/brand-v2-generation')
const originals = path.join(root, 'assets/brand-v2/originals')
const destination = path.join(root, 'public/media/brand-v2')
const review = path.join(root, 'output/brand-v2')
await Promise.all([originals, destination, review].map(p => fs.mkdir(p, { recursive: true })))
const records = []
for (const file of (await fs.readdir(metadataDir)).filter(f => f.endsWith('.json')).sort()) {
  const record = JSON.parse(await fs.readFile(path.join(metadataDir, file), 'utf8'))
  const source = path.join(originals, record.name + '.png')
  await fs.copyFile(record.source, source)
  const native = await sharp(source).metadata()
  const target = path.join(destination, record.name + '.webp')
  await sharp(source).resize(record.width, record.height, { fit: 'cover', position: 'centre', kernel: 'lanczos3' }).webp({ quality: 80, effort: 6 }).toFile(target)
  records.push({ ...record, source: 'assets/brand-v2/originals/' + record.name + '.png', nativeWidth: native.width, nativeHeight: native.height, exported: 'public/media/brand-v2/' + record.name + '.webp', exportMethod: 'Centre crop to requested aspect ratio; Lanczos3 resize; WebP quality 80', bytes: (await fs.stat(target)).size })
}
await fs.writeFile(path.join(root, 'assets/brand-v2/generation-manifest.json'), JSON.stringify({ note: 'Generated marketing photography. QR patterns in photographs are illustrative, not operational tags. Native dimensions are recorded separately from requested export sizes.', images: records }, null, 2))
for (let offset = 0; offset < records.length; offset += 10) {
  const batch = records.slice(offset, offset + 10)
  const layers = []
  for (let i = 0; i < batch.length; i++) {
    const r = batch[i], x = (i % 2) * 600, y = Math.floor(i / 2) * 440
    layers.push({ input: await sharp(path.join(root, r.exported)).resize(580, 390, { fit: 'contain', background: '#e7ecde' }).toBuffer(), left: x + 10, top: y + 10 })
    layers.push({ input: Buffer.from(`<svg width="580" height="30"><rect width="580" height="30" fill="#fff"/><text x="10" y="22" font-family="Arial" font-size="18" fill="#174c39">${r.name} · ${r.width} × ${r.height}</text></svg>`), left: x + 10, top: y + 402 })
  }
  await sharp({ create: { width: 1200, height: Math.ceil(batch.length / 2) * 440, channels: 3, background: '#fff' } }).composite(layers).jpeg({ quality: 90 }).toFile(path.join(review, `contact-sheet-${offset / 10 + 1}.jpg`))
}
console.log(JSON.stringify({ exported: records.length, names: records.map(r => r.name) }))
