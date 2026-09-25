import type { ReactNode } from 'react'
import { InventorySlot } from './Tile'
import { cx } from '@/lib/util'

/** Zero-state with an empty inventory slot, plain-language copy and a single next action. */
export function EmptyState({ icon, title, body, action, className, compact }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cx('flex flex-col items-center rounded-md border border-dashed border-line-strong bg-paper-2/60 text-center', compact ? 'gap-2 p-5' : 'gap-3 p-8', className)}>
      <InventorySlot empty size="sm" className="!h-16 !w-16"><span className="text-ink-4">{icon}</span></InventorySlot>
      <div>
        <p className="font-medium text-ink">{title}</p>
        {body && <p className="mx-auto mt-1 max-w-sm text-[0.85rem] text-ink-3">{body}</p>}
      </div>
      {action}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx('fb-skeleton', className)} />
}
