import { ScanLine } from 'lucide-react'
import { cx } from '@/lib/util'

interface LogoProps {
  /** Height in px; width follows the lockup ratio (548:78). */
  height?: number
  /** 'auto' uses currentColor for the wordmark and the brand tile; 'inverted' is for teal grounds. */
  variant?: 'brand' | 'inverted' | 'mono'
  className?: string
  title?: string
}

/** The shared typographic FINDBOX wordmark. */
export function Logo({ height = 24, variant = 'brand', className, title = 'FindBox' }: LogoProps) {
 return <span role="img" aria-label={title} className={cx('fb-wordmark', className)} style={{ fontSize: height, color: variant === 'inverted' ? '#fff' : undefined }}>FINDBOX</span>
}

interface MarkProps { size?: number; variant?: 'brand' | 'inverted' | 'mono' | 'outline'; className?: string; pulse?: boolean; strokeWidth?: number }

/** Square app-icon rendition of the same wordmark. */
export function Mark({ size = 32, className }: MarkProps) {
 return <img src="/icons/icon-512.png" width={size} height={size} alt="" className={cx('shrink-0 rounded-sm',className)} />
}

/** A simple status icon; branding always uses the wordmark. */
export function DiscoveryRing({ size = 120, className }: { size?: number; className?: string; active?: boolean }) {
 return <ScanLine size={size} strokeWidth={1.4} className={className} aria-hidden="true" />
}
