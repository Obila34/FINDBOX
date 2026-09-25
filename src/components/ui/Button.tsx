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
  primary: 'fb-btn-primary bg-[#0D6166] text-white border-transparent hover:bg-[#04414C]',
  secondary: 'bg-paper text-ink border-line-strong hover:bg-paper-2',
  ghost: 'bg-transparent text-ink border-transparent hover:bg-paper-3',
  danger: 'bg-paper text-status-danger border-[#efbdb8] hover:bg-[#fbe9e7]',
  dark: 'bg-ink text-white border-ink hover:bg-ink-2',
  inverted: 'bg-white text-ink border-white hover:bg-paper-3',
  glass: 'bg-white text-ink border-line hover:bg-paper-2',
}
const sizes: Record<Size, string> = {
  sm: 'min-h-[38px] px-4 text-[13px]', md: 'min-h-[44px] px-5 text-[14px]', lg: 'min-h-[50px] px-6 text-[14px]',
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, iconRight, arrow, className, children, to, full, disabled, magnetic: _magnetic, type = 'button', ...rest }, ref,
) {
  const cls = cx('fb-btn group relative inline-flex items-center justify-center gap-3 rounded-full border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50', variants[variant], sizes[size], full && 'w-full', arrow && '!pr-2', className)
  const content = <>
    {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" /> : icon}
    {typeof children === 'string' ? <span className="fb-roll"><span><span>{children}</span><span aria-hidden="true">{children}</span></span></span> : <span>{children}</span>}
    {iconRight}
    {arrow && <span className={cx('fb-btn-arrow-circle', variant === 'primary' ? 'text-[#0D6166]' : 'text-ink')}><ArrowRight size={16} aria-hidden="true" /></span>}
  </>
  if (to) return <Link to={to} className={cls} aria-disabled={disabled || loading || undefined} tabIndex={disabled || loading ? -1 : undefined} onClick={e => { if (disabled || loading) e.preventDefault() }}>{content}</Link>
  return <button ref={ref} type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>{content}</button>
})
