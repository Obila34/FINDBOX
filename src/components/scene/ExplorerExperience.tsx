import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { LoadBoundary } from '@/components/ui/LoadBoundary'
const Scene = lazy(() => import('./scene-ExplorerExperience').then(m => ({ default: m.ExplorerExperience })))
const Practice = lazy(() => import('./scene-ExplorerExperience').then(m => ({ default: m.ExplorerPractice })))
export function ExplorerExperience({ personId = 'preview', compact = false }: { personId?: string; compact?: boolean }) {
 const [active, setActive] = useState(false)
 const [variant] = useState(() => { try { return localStorage.getItem('findbox.explorer.' + personId) === '1' ? 1 : 0 } catch { return 0 } })
 if (active) return <LoadBoundary><Suspense fallback={<div className="fb-scene-load">Meet your explorer…</div>}><Scene personId={personId} compact={compact} /></Suspense></LoadBoundary>
 return <section className={`fb-explorer-panel ${compact ? 'is-compact' : ''}`} aria-label="Your companion"><div className="fb-explorer-copy"><p className="fb-kicker">YOUR NEXT LITTLE ADVENTURE</p><h2>Good things<br />start with you.</h2><p>Tag a belonging. Help it home.<br />Make a little difference, every day.</p><Link to="/app/streaks" className="fb-black-link">{compact ? 'Meet your companion' : 'Build your daily streak'}<ArrowUpRight size={18} /></Link></div><div className="fb-avatar-stage"><span className="fb-avatar-halo" /><img className="fb-scene-poster" src={`/media/products/explorer${variant ? '-boy' : ''}.webp`} alt={variant ? 'Noah, your explorer companion' : 'Maya, your explorer companion'} width={512} height={512} /><button className="fb-open-3d" onClick={() => setActive(true)}>Explore in 3D</button></div></section>
}
export function ExplorerPractice() { return <LoadBoundary><Suspense fallback={<div className="fb-scene-load">Opening practice…</div>}><Practice /></Suspense></LoadBoundary> }
