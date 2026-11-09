import { ScanLine } from 'lucide-react'
import { cx } from '@/lib/util'
import { SWIRL_CORE, swirlRings } from './swirl'

interface LogoProps {
  /** Height in px; the wordmark and mark scale together. */
  height?: number
  /** Kept for compatibility: the logo is always the brand green. */
  variant?: 'brand' | 'inverted' | 'mono'
  className?: string
  title?: string
  /** Hide the wordmark and show only the swirl mark. */
  markOnly?: boolean
}

const RINGS = swirlRings()

/** The FindBox swirl: concentric rings that drift as they tighten, turning slowly around a solid core. */
export function SwirlMark({ size = 24, className, still = false }: { size?: number; className?: string; still?: boolean }) {
  return <svg className={cx('fb-swirl', !still && 'is-turning', className)} viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
    <circle cx="50" cy="50" r={RINGS[0]!.r} fill="none" stroke="currentColor" strokeWidth={RINGS[0]!.w} />
    <g className="fb-swirl-rings">
      {RINGS.slice(1).map((g, i) => <circle key={i} cx={g.cx} cy={g.cy} r={g.r} fill="none" stroke="currentColor" strokeWidth={g.w} />)}
    </g>
    <circle cx="50" cy="50" r={SWIRL_CORE.ring} fill="none" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="50" cy="50" r={SWIRL_CORE.r} fill="currentColor" />
  </svg>
}

/** FIND in a light weight, BOX in bold, then the swirl, all in the brand green. */
export function Logo({ height = 24, className, title = 'FindBox', markOnly = false }: LogoProps) {
  return <span role="img" aria-label={title} className={cx('fb-wordmark', className)} style={{ fontSize: height }}>
    {!markOnly && <span className="fb-wordmark-text"><span className="fb-word-find">FIND</span><span className="fb-word-box">BOX</span></span>}
    <SwirlMark size={Math.round(height * 1.18)} />
  </span>
}

/** Square app-icon rendition. */
export function Mark({ size = 32, className }: { size?: number; variant?: 'brand' | 'inverted' | 'mono' | 'outline'; className?: string; pulse?: boolean; strokeWidth?: number }) {
  return <img src="/icons/icon-512.png" width={size} height={size} alt="" className={cx('shrink-0 rounded-sm', className)} />
}

/** A simple status icon; branding always uses the wordmark. */
export function DiscoveryRing({ size = 120, className }: { size?: number; className?: string; active?: boolean }) {
  return <ScanLine size={size} strokeWidth={1.4} className={className} aria-hidden="true" />
}
