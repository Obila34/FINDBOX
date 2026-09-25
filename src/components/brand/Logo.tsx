import { RINGS } from './brandGeometry'
import { cx } from '@/lib/util'

interface LogoProps {
  /** Height in px; width follows the lockup ratio (548:78). */
  height?: number
  /** 'auto' uses currentColor for the wordmark and the brand tile; 'inverted' is for teal grounds. */
  variant?: 'brand' | 'inverted' | 'mono'
  className?: string
  title?: string
}

/** The FINDBOX lockup, traced from the brand PDF. Wordmark + emblem, always in this proportion. */
export function Logo({ height = 24, variant = 'brand', className, title = 'FindBox' }: LogoProps) {
 return <span role="img" aria-label={title} className={cx('inline-flex items-center gap-2 shrink-0', className)} style={{ height, color: variant === 'inverted' ? '#fff' : 'currentColor' }}><img src="/icons/icon-512.png" width={height} height={height} alt="" style={{borderRadius:'50%'}} /><strong style={{fontFamily:'Arial, sans-serif',fontSize:height*.58,letterSpacing:'-.05em'}}>FINDBOX</strong></span>
}

interface MarkProps { size?: number; variant?: 'brand' | 'inverted' | 'mono' | 'outline'; className?: string; pulse?: boolean; strokeWidth?: number }

/** The square emblem alone. `pulse` adds the discovery ring animation (paused on hidden tabs, removed under reduced motion). */
export function Mark({ size = 32, className }: MarkProps) {
 return <img src="/icons/icon-512.png" width={size} height={size} alt="" className={cx('shrink-0 rounded-full',className)} />
}

/** Discovery ring: the emblem's rings as a standalone animated signal (used in the hero and on timeline nodes). */
export function DiscoveryRing({ size = 120, className, active = true }: { size?: number; className?: string; active?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className={cx('overflow-visible', className)}>
      {active && <circle cx="32" cy="32" r="28" fill="none" stroke="var(--fb-teal-300)" strokeWidth="1.2" className="fb-pulse-ring" />}
      {active && <circle cx="32" cy="32" r="28" fill="none" stroke="var(--fb-teal-300)" strokeWidth="1.2" className="fb-pulse-ring" style={{ animationDelay: '1.2s' }} />}
      {RINGS.map(([a, b], i) => <circle key={i} cx="32" cy="32" r={(a + b) / 2} fill="none" stroke="currentColor" strokeWidth={0.5} opacity={0.9 - i * 0.03} />)}
    </svg>
  )
}
