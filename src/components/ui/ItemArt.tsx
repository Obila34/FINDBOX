import type { ItemCategory } from '@/domain/types'
import { CATEGORY } from '@/domain/labels'
import { cx } from '@/lib/util'
interface ItemArtProps { category: ItemCategory; photo?: string; size?: number | string; className?: string; alt?: string; muted?: boolean }
export function ItemArt({ category, photo, size = 64, className, alt, muted }: ItemArtProps) {
 const uploaded = photo?.startsWith('data:'); const asset = ['keys','electronics'].includes(category) ? 'airtag' : category
 const catalog = ['clothing', 'book', 'lunchbox'].includes(category)
 const product = ['bottle', 'airtag'].includes(asset)
 if (product && !uploaded) return <img src={`/media/objects/${asset}-640.webp`} srcSet={`/media/objects/${asset}-640.webp 640w, /media/objects/${asset}-1280.webp 1280w`} sizes="(max-width: 767px) 180px, 320px" alt={alt ?? CATEGORY[category].label} width={size} height={size} loading="lazy" decoding="async" className={cx('fb-item-art object-contain', muted && 'opacity-60 grayscale', className)} />
 const base = catalog ? '/media/catalog/' + asset : '/media/products/' + asset
 return <img src={uploaded ? photo : base + (catalog ? '-480.webp' : '.webp')} srcSet={uploaded ? undefined : catalog ? `${base}-480.webp 480w, ${base}-960.webp 960w` : `${base}.webp 512w, ${base}-1024.webp 1024w`} sizes="(max-width: 767px) 180px, 320px" alt={alt ?? CATEGORY[category].label} width={size} height={size} loading="lazy" decoding="async" className={cx(uploaded || catalog ? 'fb-catalog-photo h-full w-full object-cover' : 'fb-item-art object-contain', muted && 'opacity-60 grayscale', className)} />
}
