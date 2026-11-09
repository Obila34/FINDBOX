/**
 * Every photograph on the public site and sign-in screens, in one place.
 *
 * House rules for FindBox imagery (see docs/IMAGE-BRIEF.md):
 *  - No people. Belongings, labels and school spaces only.
 *  - Hard items (bottles, lunchboxes, books, pencil cases, gadgets) carry a FindBox QR sticker.
 *  - Clothing (shirts, sweaters, blazers, tracksuits) carries a woven FindBox fabric tag sewn at the collar.
 *
 * Generated photograph exports live in public/media/brand-v2/.
 * Original PNGs and generation provenance are retained in assets/brand-v2/.
 */
export type Picture = { src: string; alt: string }

const p = (src: string, alt: string): Picture => ({ src, alt })

export const imagery = {
  hero: [
    p('/media/brand-v2/hero-uniforms.webp', 'School uniforms folded in a wooden box, each with a FindBox fabric tag at the collar'),
    p('/media/brand-v2/hero-belongings.webp', 'A water bottle, lunchbox and exercise book, each with a FindBox QR sticker'),
    p('/media/brand-v2/hero-collar.webp', 'A green school sweater with a FindBox fabric tag at the collar'),
    p('/media/brand-v2/hero-collection-point.webp', 'A tidy school collection point with labelled belongings waiting to go home'),
  ],
  features: {
    film: p('/media/brand-v2/labels-flatlay.webp', 'FindBox QR stickers, fabric tags and a school sweater laid out together'),
    label: p('/media/brand-v2/bottle-sticker.webp', 'Belongings with FindBox QR stickers'),
    record: p('/media/brand-v2/role-staff.webp', 'A school collection point'),
    collect: p('/media/brand-v2/ready-to-go-home.webp', 'A water bottle with a FindBox QR sticker, ready to go home'),
  },
  auth: {
    signIn: p('/media/brand-v2/hero-belongings.webp', 'Belongings with FindBox QR stickers'),
    signUp: p('/media/brand-v2/hero-collar.webp', 'A school sweater with a FindBox fabric tag at the collar'),
    school: p('/media/brand-v2/hero-collection-point.webp', 'A school collection point'),
    company: p('/media/brand-v2/hero-collection-point.webp', 'A school collection point'),
  },
  journey: {
    hero: p('/media/brand-v2/hero-uniforms.webp', 'Uniforms with FindBox fabric tags at the collar'),
    schoolsHero: p('/media/brand-v2/hero-collection-point.webp', 'Storage cubbies at a school collection point'),
    choose: p('/media/brand-v2/labels-flatlay.webp', 'FindBox QR stickers and fabric tags'),
    connect: p('/media/brand-v2/sticker-applied.webp', 'Belongings with FindBox QR stickers applied'),
    lose: p('/media/brand-v2/bottle-left-behind.webp', 'A water bottle left behind'),
    find: p('/media/brand-v2/phone-scan.webp', 'A phone showing an item-found confirmation beside a QR-labelled bottle'),
    collect: p('/media/brand-v2/collection-reception.webp', 'A school collection point'),
    reunite: p('/media/brand-v2/ready-to-go-home.webp', 'Labelled uniforms sorted and ready to go home'),
    roles: [
      p('/media/brand-v2/role-staff.webp', 'A school collection point'),
      p('/media/brand-v2/labels-flatlay.webp', 'FindBox labels'),
      p('/media/brand-v2/role-admin.webp', 'An administrator desk with a laptop and FindBox labels'),
      p('/media/brand-v2/role-parent.webp', 'Labelled school belongings packed on a family kitchen counter'),
    ],
  },
  catalog: {
    bottle: p('/media/brand-v2/catalog-bottle.webp', 'Water bottle with a FindBox QR sticker'),
    lunchbox: p('/media/brand-v2/catalog-lunchbox.webp', 'Lunchbox with a FindBox QR sticker'),
    book: p('/media/brand-v2/catalog-book.webp', 'Exercise books with a FindBox QR sticker'),
    clothing: p('/media/brand-v2/catalog-sweater.webp', 'School sweater with a woven FindBox label inside its back collar'),
  },
  collectionPoints: {
    reception: p('/media/brand-v2/collection-reception.webp', 'A collection point by the school reception'),
    library: p('/media/brand-v2/collection-library.webp', 'Books and stationery with FindBox QR stickers'),
    sports: p('/media/brand-v2/collection-sports.webp', 'Sports kit with FindBox fabric tags'),
  },
} as const
