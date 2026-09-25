import type { ItemCategory } from '@/domain/types'
import { CATEGORY } from '@/domain/labels'
import { cx } from '@/lib/util'
interface ItemArtProps { category: ItemCategory; photo?: string; size?: number | string; className?: string; alt?: string; muted?: boolean }
export function ItemArt({ category, photo, size = 64, className, alt, muted }: ItemArtProps) {
 const uploaded = photo?.startsWith('data:'); const asset = ['keys','electronics'].includes(category) ? 'airtag' : category
 return <img src={uploaded ? photo : '/media/products/' + asset + '.png'} srcSet={uploaded ? undefined : '/media/products/' + asset + '.png 512w, /media/products/' + asset + '-4k.png 4096w'} sizes="(max-width: 767px) 180px, 320px" alt={alt ?? CATEGORY[category].label} width={size} height={size} className={cx(uploaded ? 'h-full w-full object-cover' : 'fb-item-art object-contain', muted && 'opacity-60 grayscale', className)} />
}
