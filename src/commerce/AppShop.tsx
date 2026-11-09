import { ProductCard, PromoCarousel } from '@/platform/AppKit'
import { imagery } from '@/data/imagery'
import { catalog } from './store'
import type { Product } from '@/platform/api'

const badge = (id: string) => id === 'complete-41' ? 'Best value' : id === 'everyday-12' ? 'Best seller' : undefined

/** The shop inside the app: one highlight and the product cards. */
export function AppShop({ products, base }: { products: Product[]; base: string }) {
  const shown = products.filter(p => p.format !== 'nfc')
  return <div className="pa-home">
    <PromoCarousel slides={[
      { kicker: 'Best value', title: 'The family', accent: 'pack.', body: "20 fabric labels and 20 QR stickers, all with your child's name.", cta: 'Shop the pack', to: base + '/products/complete-41', image: imagery.features.film.src, tone: 'pop' },
    ]} />
    <div className="pa-grid">{shown.map((p, n) => <ProductCard key={p.id} index={n} id={p.id} name={p.name} subtitle={catalog.find(c => c.serverId === p.id)?.subtitle || p.tag_count + ' labels'} priceMinor={p.price_minor} image={p.image} badge={p.available === false ? 'Coming soon' : badge(p.id)} to={base + '/products/' + p.id} />)}</div>
  </div>
}
