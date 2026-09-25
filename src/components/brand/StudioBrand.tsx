import { Link } from 'react-router-dom'
import { cx } from '@/lib/util'
import { BrandOrb } from './BrandOrb'

export function StudioBrand({ to = '/', compact = false, className }: { to?: string; compact?: boolean; className?: string }) {
  return <Link to={to} aria-label="FindBox home" className={cx('fb-studio-brand', className)}>
    <BrandOrb />
    {!compact && <span className="fb-brand-name">FINDBOX</span>}
  </Link>
}
