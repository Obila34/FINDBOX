import { useEffect, useRef, useState, type RefObject } from 'react'
import { prefersReducedMotion } from './util'

/** Exponential smoothing on a rAF loop: values glide toward their target instead of jumping per scroll event. */
function useLerpLoop(getTarget: () => number, alpha = 0.12): number {
  const [v, setV] = useState(0)
  const cur = useRef(0)
  useEffect(() => {
    if (prefersReducedMotion()) { setV(getTarget()); return }
    let raf = 0
    const tick = () => {
      const t = getTarget()
      cur.current += (t - cur.current) * alpha
      if (Math.abs(t - cur.current) < 0.0005) cur.current = t
      setV(cur.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [getTarget, alpha])
  return v
}

/** Smoothed progress of an element through the viewport (0 top enters at bottom, 1 bottom leaves top). */
export function useSmoothScroll<T extends HTMLElement>(mode: 'pin' | 'enter' = 'pin', alpha = 0.12): { ref: RefObject<T | null>; p: number } {
  const ref = useRef<T>(null)
  const target = useRef(0)
  useEffect(() => {
    const onScroll = () => {
      const el = ref.current; if (!el) return
      const r = el.getBoundingClientRect(); const vh = window.innerHeight
      const v = mode === 'pin' ? -r.top / Math.max(1, r.height - vh) : (vh - r.top) / (r.height + vh)
      target.current = Math.max(0, Math.min(1, v))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll) }
  }, [mode])
  const p = useLerpLoop(() => target.current, alpha)
  return { ref, p }
}

/** Smoothed pointer position, normalised to -1..1 across the viewport (0,0 when the pointer leaves or on touch). */
export function useSmoothPointer(alpha = 0.08): { x: number; y: number } {
  const target = useRef({ x: 0, y: 0 })
  useEffect(() => {
    if (window.matchMedia('(hover: none)').matches) return
    const onMove = (e: PointerEvent) => { target.current = { x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 } }
    const onLeave = () => { target.current = { x: 0, y: 0 } }
    window.addEventListener('pointermove', onMove, { passive: true }); document.addEventListener('pointerleave', onLeave)
    return () => { window.removeEventListener('pointermove', onMove); document.removeEventListener('pointerleave', onLeave) }
  }, [])
  const x = useLerpLoop(() => target.current.x, alpha)
  const y = useLerpLoop(() => target.current.y, alpha)
  return { x, y }
}

/** Magnetic hover: the element drifts a few px toward the pointer while hovered, then springs back. */
export function useMagnetic<T extends HTMLElement>(strength = 0.25): RefObject<T | null> {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion() || window.matchMedia('(hover: none)').matches) return
    let raf = 0; let tx = 0, ty = 0, cx = 0, cy = 0; let active = false
    const loop = () => {
      cx += (tx - cx) * 0.18; cy += (ty - cy) * 0.18
      el.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0)`
      if (active || Math.abs(cx) > 0.05 || Math.abs(cy) > 0.05) raf = requestAnimationFrame(loop); else el.style.transform = ''
    }
    const onMove = (e: PointerEvent) => { const r = el.getBoundingClientRect(); tx = (e.clientX - (r.left + r.width / 2)) * strength; ty = (e.clientY - (r.top + r.height / 2)) * strength; if (!active) { active = true; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop) } }
    const onLeave = () => { active = false; tx = 0; ty = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop) }
    el.addEventListener('pointermove', onMove); el.addEventListener('pointerleave', onLeave)
    return () => { el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerleave', onLeave); cancelAnimationFrame(raf) }
  }, [strength])
  return ref
}
