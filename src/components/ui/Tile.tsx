import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '@/lib/util'

interface TileProps extends HTMLAttributes<HTMLDivElement> { pad?: 'none' | 'sm' | 'md' | 'lg'; dark?: boolean; interactive?: boolean; children?: ReactNode }

/** The base surface: a paper tile with the stepped 2 px shadow. */
export function Tile({ pad = 'md', dark, interactive, className, children, ...rest }: TileProps) {
  const padding = { none: '', sm: 'p-3', md: 'p-4 md:p-5', lg: 'p-5 md:p-7' }[pad]
  return (
    <div className={cx(dark ? 'fb-tile-dark' : 'fb-tile', padding, interactive && 'fb-press fb-raise cursor-pointer', className)} {...rest}>
      {children}
    </div>
  )
}

/** Inventory slot: a fixed-ratio slot with a faint grid, for item art and empty spaces. */
export function InventorySlot({ children, empty, className, size = 'md' }: { children?: ReactNode; empty?: boolean; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const dim = { sm: 'h-14 w-14', md: 'aspect-square w-full', lg: 'aspect-square w-full' }[size]
  return (
    <div className={cx('relative overflow-hidden rounded-sm border bg-paper-2', empty ? 'border-dashed border-line-strong' : 'border-line', dim, className)}>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('fb-eyebrow', className)}>{children}</p>
}

export function Note({ children, tone = 'info', className }: { children: ReactNode; tone?: 'info' | 'demo' | 'warn'; className?: string }) {
  const cls = { info: 'bg-teal-50 border-teal-200 text-teal-900', demo: 'bg-paper-3 border-line-strong text-ink-2', warn: 'bg-[#fbf1e4] border-[#e7c9a1] text-status-lost' }[tone]
  return <div className={cx('rounded-md border px-3 py-2 text-[0.85rem] leading-snug', cls, className)}>{children}</div>
}
