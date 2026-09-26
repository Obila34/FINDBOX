import { useState } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import type { ItemCategory } from '@/domain/types'
import { ItemArt } from '@/components/ui/ItemArt'
export function ProductViewer({ category = 'bottle' }: { category?: ItemCategory }) {
 const [zoomed, setZoomed] = useState(false)
 return <div className={`fb-product-viewer fb-photo-viewer ${zoomed ? 'is-zoomed' : ''}`}><ItemArt category={category} size="100%" className="fb-scene-poster" /><button className="fb-open-3d" aria-pressed={zoomed} onClick={() => setZoomed(z => !z)}>{zoomed ? <ZoomOut size={14} /> : <ZoomIn size={14} />}{zoomed ? 'Show full item' : 'Take a closer look'}</button></div>
}
