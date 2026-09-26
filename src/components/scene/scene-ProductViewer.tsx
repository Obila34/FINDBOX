import { OrbitControls } from '@react-three/drei'
import { ExperienceCanvas } from './ExperienceCanvas'
import { BelongingModel } from './BelongingModels'
import type { ItemCategory } from '@/domain/types'
export function ProductViewer({ category = 'bottle' }: { category?: ItemCategory }) {
  return <div className="fb-product-viewer" role="img" aria-label={`Interactive 3D ${category}`}><ExperienceCanvas><BelongingModel category={category} /><OrbitControls enableZoom={false} enablePan={false} /></ExperienceCanvas><span>Drag to look around</span></div>
}
