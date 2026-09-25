import type { ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { cx } from '@/lib/util'

/** Editorial metric tile: serif number, plain label, one-line hint. Clickable tiles drill into cases. */
export function Stat({ label, value, unit, hint, onClick, tone = 'neutral', icon, className, index = 0 }: { label: string; value: ReactNode; unit?: string; hint?: string; onClick?: () => void; tone?: 'neutral' | 'attention' | 'good'; icon?: ReactNode; className?: string; index?: number }) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp type={onClick ? 'button' : undefined} onClick={onClick} style={{ ['--i' as string]: index }}
      className={cx('fb-tile fb-enter relative flex flex-col gap-1 p-4 text-left', onClick && 'fb-press fb-raise cursor-pointer', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.8rem] font-medium text-ink-3">{label}</p>
        {icon ?? (onClick && <ArrowUpRight className="h-4 w-4 text-ink-4" aria-hidden="true" />)}
      </div>
      <p className={cx('fb-display text-[2rem] leading-none tabular-nums md:text-[2.4rem]', tone === 'attention' ? 'text-status-lost' : tone === 'good' ? 'text-status-done' : 'text-ink')}>
        {value}{unit && <span className="ml-1 font-sans text-[0.85rem] font-medium text-ink-3">{unit}</span>}
      </p>
      {hint && <p className="text-[0.75rem] text-ink-3">{hint}</p>}
    </Comp>
  )
}
