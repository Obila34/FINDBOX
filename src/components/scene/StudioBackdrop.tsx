import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
const StudioShader = lazy(() => import('./StudioShader'))

class ShaderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? null : this.props.children }
}

/** Static fluted artwork stays visible while the GPU starts, or when motion is disabled. */
export function StudioBackdrop({ animated = true }: { animated?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)
  useEffect(() => {
    if (!animated) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let visible = true
    const sync = () => setActive(visible && !document.hidden && !motion.matches)
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync() })
    if (ref.current) observer.observe(ref.current)
    sync()
    motion.addEventListener('change', sync)
    document.addEventListener('visibilitychange', sync)
    return () => { observer.disconnect(); motion.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync) }
  }, [animated])
  return <div ref={ref} className="fb-studio-backdrop" aria-hidden="true">
    <div className="fb-fluted-art" />
    {active && <ShaderBoundary><Suspense fallback={null}><StudioShader /></Suspense></ShaderBoundary>}
    <div className="fb-shader-veil" />
  </div>
}
