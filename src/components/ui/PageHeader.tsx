import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { cx } from '@/lib/util'

/** Every screen starts with this: optional back link, eyebrow, title, one line of orientation, actions. */
export function PageHeader({ eyebrow, title, lede, back, backLabel = 'Back', actions, className, compact }: { eyebrow?: string; title: string; lede?: ReactNode; back?: string; backLabel?: string; actions?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <header className={cx('flex flex-col gap-3 md:flex-row md:items-end md:justify-between', compact ? 'mb-4' : 'mb-6', className)}>
      <div className="min-w-0">
        {back && (
          <Link to={back} className="mb-2 inline-flex items-center gap-1 text-[0.82rem] font-medium text-teal-700 hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {backLabel}
          </Link>
        )}
        {eyebrow && <p className="fb-eyebrow mb-1">{eyebrow}</p>}
        <h1 className={cx('fb-display text-ink', compact ? 'text-[1.6rem] leading-tight' : 'text-[length:var(--t-display)] leading-[1.08]')}>{title}</h1>
        {lede && <p className="mt-1.5 max-w-[60ch] text-[0.92rem] text-ink-3">{lede}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  )
}
