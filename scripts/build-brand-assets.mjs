import sharp from 'sharp'
import { writeFile, mkdir } from 'node:fs/promises'
const wordmark = (color) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 550 110"><text x="0" y="90" font-family="Arial,Helvetica,sans-serif" font-size="116" font-weight="600" letter-spacing="-9" fill="${color}" textLength="543" lengthAdjust="spacingAndGlyphs">FINDBOX</text></svg>`
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#e5eade"/><text x="256" y="285" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="84" font-weight="600" letter-spacing="-6" fill="#657b56" textLength="352" lengthAdjust="spacingAndGlyphs">FINDBOX</text></svg>`
for (const [name,color] of [['logo','#657b56'],['logo-inverted','#ffffff'],['logo-mono','#171717'],['mark','#657b56'],['mark-inverted','#ffffff'],['mark-mono','#171717']]) await writeFile(`public/brand/${name}.svg`, wordmark(color))
for (const name of ['public/favicon.svg','public/icons/icon.svg','public/icons/icon-maskable.svg']) await writeFile(name,icon)
for (const [name,size] of [['icon-192.png',192],['icon-512.png',512],['icon-maskable-512.png',512],['apple-touch-icon.png',180],['favicon-32.png',32]]) await sharp(Buffer.from(icon)).resize(size,size).png().toFile('public/icons/'+name)
await mkdir('public/media/avatars',{recursive:true})
for (const width of [640,1280]) await sharp('assets/avatar-originals/findbox-explorer.png').resize({width,withoutEnlargement:true}).webp({quality:86,alphaQuality:100}).toFile(`public/media/avatars/findbox-explorer-${width}.webp`)
console.log('Wordmark icons and responsive illustrated avatar saved.')
