import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, ArrowRight } from 'lucide-react'
import { cx } from '@/lib/util'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark' | 'inverted' | 'glass'
type Size = 'sm' | 'md' | 'lg'
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; size?: Size; loading?: boolean; icon?: ReactNode; iconRight?: ReactNode;
  arrow?: boolean; to?: string; full?: boolean; magnetic?: boolean;
}
const variants: Record<Variant, string> = {
  primary: 'fb-btn-primary bg-cream text-black border-transparent hover:bg-cream-soft',
  secondary: 'bg-white/5 text-ink border-white/10 hover:bg-white/10',
  ghost: 'bg-transparent text-ink border-transparent hover:bg-white/5',
  danger: 'bg-transparent text-[#f4b4a6] border-[#f4b4a6]/30 hover:bg-[#f4b4a6]/10',
  dark: 'bg-sage-deep text-cream-soft border-sage-deep hover:brightness-110',
  inverted: 'bg-cream text-black border-cream hover:bg-cream-soft',
  glass: 'bg-white/5 text-ink border-white/10 backdrop-blur-md hover:bg-white/10',
}
const sizes: Record<Size, string> = {
  sm: 'min-h-[38px] px-4 text-[13px]', md: 'min-h-[44px] px-5 text-[14px]', lg: 'min-h-[50px] px-6 text-[14px]',
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, iconRight, arrow, className, children, to, full, disabled, magnetic, type = 'button', ...rest }, ref,
) {
  const cls = cx('fb-btn group relative inline-flex items-center justify-center gap-3 rounded-full border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50', variants[variant], sizes[size], full && 'w-full', arrow && '!pr-2', className)
  const content = <>
    {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" /> : icon}
    {typeof children === 'string' ? <span className="fb-roll"><span><span>{children}</span><span aria-hidden="true">{children}</span></span></span> : <span>{children}</span>}
    {iconRight}
    {arrow && <span className={cx('fb-btn-arrow-circle', variant === 'primary' ? 'text-[#0D6166]' : 'text-ink')}><ArrowRight size={16} aria-hidden="true" /></span>}
  </>
  if (to) return <Link to={to} className={cls} data-magnetic={magnetic ? '' : undefined} aria-disabled={disabled || loading || undefined} tabIndex={disabled || loading ? -1 : undefined} onClick={e => { if (disabled || loading) e.preventDefault() }}>{content}</Link>
  return <button ref={ref} type={type} className={cls} data-magnetic={magnetic ? '' : undefined} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>{content}</button>
})
