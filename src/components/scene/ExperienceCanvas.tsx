import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <div className="fb-scene-fallback">FINDBOX<span>Little things. Big adventures.</span></div> : this.props.children }
}
export function ExperienceCanvas({ children, moving = true }: { children: ReactNode; moving?: boolean }) {
  const host = useRef<HTMLDivElement>(null); const [active, setActive] = useState(false)
  useEffect(() => {
    let visible = false
    const update = () => setActive(visible && !document.hidden)
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update() }, { rootMargin: '100px' })
    if (host.current) observer.observe(host.current)
    document.addEventListener('visibilitychange', update)
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update) }
  }, [])
  return <div ref={host} className="fb-experience-canvas"><SceneBoundary><Canvas camera={{ position: [0, 0.4, 7.8], fov: 36 }} dpr={[1, 2]} frameloop={active && moving ? 'always' : 'demand'} gl={{ antialias: true, alpha: true }} fallback={<div className="fb-scene-fallback">Your belongings. Connected.</div>}>
    <ambientLight intensity={0.8} /><directionalLight position={[4, 6, 5]} intensity={3} />
    <Suspense fallback={null}><Environment resolution={256}><Lightformer intensity={4} position={[-4, 3, 4]} scale={[3, 8, 1]} /><Lightformer intensity={3} position={[4, 1, 2]} scale={[2, 6, 1]} /><Lightformer intensity={2} position={[0, 5, -3]} scale={[8, 2, 1]} /></Environment>{children}</Suspense>
  </Canvas></SceneBoundary></div>
}
