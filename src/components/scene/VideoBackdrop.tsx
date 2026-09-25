import { useEffect, useRef, useState } from 'react'
import { cx, prefersReducedMotion } from '@/lib/util'

/**
 * Full-bleed ambient video: muted, looping, inline. Starts only when on screen, pauses when hidden,
 * and stays a still gradient under reduced motion or if the file fails to load.
 */
export function VideoBackdrop({ src, className, overlay = 'light', fallback, speed = 1, fixed }: { src: string; className?: string; overlay?: 'light' | 'dark' | 'none' | 'veil'; fallback?: string; speed?: number; fixed?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [failed, setFailed] = useState(false)
  const reduced = prefersReducedMotion()
  useEffect(() => {
    const v = ref.current
    if (!v || reduced) return
    v.playbackRate = speed
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !document.hidden) v.play().catch(() => {}); else v.pause() }, { threshold: 0.05 })
    io.observe(v)
    const vis = () => { if (document.hidden) v.pause(); else v.play().catch(() => {}) }
    document.addEventListener('visibilitychange', vis)
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', vis) }
  }, [reduced, speed])
  const overlays = {
    light: 'linear-gradient(180deg, rgba(246,247,248,0.35) 0%, rgba(246,247,248,0.15) 45%, rgba(246,247,248,0.85) 100%)',
    veil: 'linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.55) 100%)',
    dark: 'linear-gradient(180deg, rgba(7,56,71,0.55) 0%, rgba(7,56,71,0.7) 100%)',
    none: 'none',
  }
  return (
    <div className={cx(fixed ? 'fixed' : 'absolute', 'inset-0 -z-0 overflow-hidden', className)} aria-hidden="true">
      <div className="absolute inset-0" style={{ background: fallback ?? 'radial-gradient(60% 50% at 50% 40%, #d6ebeb 0%, #f6f7f8 60%, #eef6f6 100%)' }} />
      {!reduced && !failed && (
        <video ref={ref} className="fb-video absolute inset-0 h-full w-full object-cover" src={src} muted loop playsInline autoPlay preload="metadata" onError={() => setFailed(true)} />
      )}
      <div className="absolute inset-0" style={{ background: overlays[overlay] }} />
    </div>
  )
}
