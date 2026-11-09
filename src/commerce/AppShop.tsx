import { useState } from 'react'
import { Chips, ProductCard, PromoCarousel } from '@/platform/AppKit'
import { imagery } from '@/data/imagery'
import { catalog } from './store'
import type { Product } from '@/platform/api'

type Kind = 'all' | 'stickers' | 'fabric' | 'tech' | 'kits'
const kindOf = (p: Product): Kind => p.format === 'fabric' ? 'fabric' : ['wrap', 'compact'].includes(p.format) ? 'tech' : p.format === 'mixed' ? 'kits' : 'stickers'
const badge = (id: string) => id === 'complete-41' ? 'Best value' : id === 'uniform-12' ? 'New' : id === 'everyday-12' ? 'Best seller' : undefined

/** The shop inside the app: a highlight, category chips and product cards with one-tap add to bag. */
export function AppShop({ products, base }: { products: Product[]; base: string }) {
  const [kind, setKind] = useState<Kind>('all')
  const list = products.filter(p => p.available !== false && p.format !== 'nfc')
  const shown = list.filter(p => kind === 'all' || kindOf(p) === kind)
  return <div className="pa-home">
    <PromoCarousel slides={[
      { kicker: 'Best value', title: 'The complete', accent: 'kit.', body: '38 labels for a whole term. Save KSh 246.', cta: 'Shop the kit', to: base + '/products/complete-41', image: imagery.features.film.src, tone: 'pop' },
      { kicker: 'New', title: 'Fabric tags', accent: 'for uniforms.', body: 'Sewn or ironed inside the collar.', cta: 'See fabric tags', to: base + '/products/uniform-12', image: imagery.hero[2]!.src },
    ]} />
    <Chips label="Shop categories" value={kind} onChange={setKind} options={[
      { id: 'all', label: 'All' }, { id: 'stickers', label: 'QR stickers' }, { id: 'fabric', label: 'Fabric tags' }, { id: 'tech', label: 'Tech' }, { id: 'kits', label: 'Kits' },
    ]} />
    <div className="pa-grid">{shown.map((p, n) => <ProductCard key={p.id} index={n} id={p.id} name={p.name} subtitle={catalog.find(c => c.serverId === p.id)?.subtitle || p.tag_count + ' labels'} priceMinor={p.price_minor} image={p.image} badge={badge(p.id)} to={base + '/products/' + p.id} />)}</div>
  </div>
}
