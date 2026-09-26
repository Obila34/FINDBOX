import { Link } from 'react-router-dom'
import { cx } from '@/lib/util'
import { Logo } from './Logo'

export function StudioBrand({ to = '/', compact = false, className }: { to?: string; compact?: boolean; className?: string }) {
  return <Link to={to} aria-label="FindBox home" className={cx('fb-studio-brand', className)}>
    <Logo height={compact ? 24 : 30} />
  </Link>
}
