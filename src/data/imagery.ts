/**
 * Every photograph on the public site and sign-in screens, in one place.
 *
 * House rules for FindBox imagery (see docs/IMAGE-BRIEF.md):
 *  - No people. Belongings, labels and school spaces only.
 *  - Hard items (bottles, lunchboxes, books, pencil cases, gadgets) carry a FindBox QR sticker.
 *  - Clothing (shirts, sweaters, blazers, tracksuits) carries a woven FindBox fabric tag sewn at the collar.
 *
 * When the refined images arrive, drop them into public/media/brand-v2/ with the file names from the
 * brief and point the entries below at them. Nothing else needs to change.
 */
export type Picture = { src: string; alt: string }

const p = (src: string, alt: string): Picture => ({ src, alt })

export const imagery = {
  hero: [
    p('/media/editorial/organised-school-box.webp', 'School uniforms folded in a wooden box, each with a FindBox fabric tag at the collar'),
    p('/media/catalog/everyday-qr-960.webp', 'A water bottle, lunchbox and exercise book, each with a FindBox QR sticker'),
    p('/media/catalog/fabric-qr-960.webp', 'A green school sweater with a FindBox fabric tag at the collar'),
    p('/media/journey/collection-concept.webp', 'A tidy school collection point with labelled belongings waiting to go home'),
  ],
  features: {
    film: p('/media/editorial/choose.webp', 'FindBox QR stickers, fabric tags and a school sweater laid out together'),
    label: p('/media/catalog/everyday-qr-960.webp', 'Belongings with FindBox QR stickers'),
    record: p('/media/journey/collection-concept.webp', 'A school collection point'),
    collect: p('/media/objects/bottle-1280.webp', 'A water bottle with a FindBox QR sticker, ready to go home'),
  },
  auth: {
    signIn: p('/media/catalog/everyday-qr-960.webp', 'Belongings with FindBox QR stickers'),
    signUp: p('/media/catalog/fabric-qr-960.webp', 'A school sweater with a FindBox fabric tag at the collar'),
    school: p('/media/journey/collection-concept.webp', 'A school collection point'),
    company: p('/media/journey/collection-concept.webp', 'A school collection point'),
  },
  journey: {
    hero: p('/media/editorial/organised-school-box.webp', 'Uniforms with FindBox fabric tags at the collar'),
    schoolsHero: p('/media/editorial/school-hero.webp', 'Storage cubbies at a school collection point'),
    choose: p('/media/editorial/choose.webp', 'FindBox QR stickers and fabric tags'),
    connect: p('/media/catalog/everyday-qr-960.webp', 'Belongings with FindBox QR stickers applied'),
    lose: p('/media/catalog/bottle-960.webp', 'A water bottle left behind'),
    find: p('/media/objects/bottle-1280.webp', 'A bottle with a FindBox QR sticker, ready to scan'),
    collect: p('/media/journey/collection-concept.webp', 'A school collection point'),
    reunite: p('/media/editorial/organised-school-box.webp', 'Labelled uniforms sorted and ready to go home'),
    roles: [
      p('/media/journey/collection-concept.webp', 'A school collection point'),
      p('/media/editorial/choose.webp', 'FindBox labels'),
      p('/media/editorial/school-hero.webp', 'School storage cubbies'),
      p('/media/editorial/organised-school-box.webp', 'Labelled uniforms'),
    ],
  },
  collectionPoints: {
    reception: p('/media/journey/collection-concept.webp', 'A collection point by the school reception'),
    library: p('/media/catalog/everyday-qr-960.webp', 'Books and stationery with FindBox QR stickers'),
    sports: p('/media/catalog/fabric-qr-960.webp', 'Sports kit with FindBox fabric tags'),
  },
} as const
