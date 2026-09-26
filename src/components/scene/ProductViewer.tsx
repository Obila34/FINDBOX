import { lazy, Suspense, useState } from 'react'
import type { ItemCategory } from '@/domain/types'
import { ItemArt } from '@/components/ui/ItemArt'
import { LoadBoundary } from '@/components/ui/LoadBoundary'
const Scene = lazy(() => import('./scene-ProductViewer').then(m => ({ default: m.ProductViewer })))
export function ProductViewer({ category = 'bottle' }: { category?: ItemCategory }) {
 const [active, setActive] = useState(false)
 if (active) return <LoadBoundary><Suspense fallback={<div className="fb-scene-load">Opening your 3D view…</div>}><Scene category={category} /></Suspense></LoadBoundary>
 return <div className="fb-product-viewer"><ItemArt category={category} size="100%" className="fb-scene-poster" /><button className="fb-open-3d" onClick={() => setActive(true)}>View in 3D · drag to explore</button></div>
}
