import { cx } from '@/lib/util'
export type ProductKind = 'bottle' | 'nfc' | 'airtag'
const descriptions = { bottle: 'Clear bottle with a black loop cap and FindBox label', nfc: 'Silver circular NFC sticker with detailed antenna', airtag: 'Charcoal tracking tag with a silver keyring' }
export function ProductImage({ kind, className, eager = false }: { kind: ProductKind; className?: string; eager?: boolean }) {
 return <img src={`/media/objects/${kind}-640.webp`} srcSet={`/media/objects/${kind}-640.webp 640w, /media/objects/${kind}-1280.webp 1280w`} sizes="(max-width: 767px) 230px, 420px" alt={descriptions[kind]} loading={eager ? 'eager' : 'lazy'} decoding="async" className={cx('fb-product-photo', className)} />
}
