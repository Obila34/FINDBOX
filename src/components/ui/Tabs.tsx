import { useEffect, useRef, useState } from 'react'
import { cx } from '@/lib/util'

export interface TabDef { id: string; label: string; count?: number }

/** Tabs with a sliding indicator (the only layout animation in the system). Arrow keys move between tabs. */
export function Tabs({ tabs, value, onChange, className, ariaLabel, size = 'md' }: { tabs: TabDef[]; value: string; onChange: (id: string) => void; className?: string; ariaLabel: string; size?: 'sm' | 'md' }) {
  const listRef = useRef<HTMLDivElement>(null)
  const [ind, setInd] = useState({ left: 0, width: 0 })
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-tab="${value}"]`)
    if (el) setInd({ left: el.offsetLeft, width: el.offsetWidth })
  }, [value, tabs])
  const onKey = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === value)
    if (e.key === 'ArrowRight') onChange(tabs[(i + 1) % tabs.length].id)
    if (e.key === 'ArrowLeft') onChange(tabs[(i - 1 + tabs.length) % tabs.length].id)
  }
  return (
    <div ref={listRef} role="tablist" aria-label={ariaLabel} onKeyDown={onKey} className={cx('fb-scroll-x relative flex gap-1 border-b border-line', className)}>
      {tabs.map((t) => (
        <button key={t.id} role="tab" data-tab={t.id} aria-selected={t.id === value} tabIndex={t.id === value ? 0 : -1} onClick={() => onChange(t.id)}
          className={cx('fb-press relative flex shrink-0 items-center gap-2 rounded-t-sm font-medium transition-colors', size === 'sm' ? 'px-3 py-2 text-[0.8rem]' : 'px-3.5 py-2.5 text-[0.875rem]', t.id === value ? 'text-teal-800' : 'text-ink-3 hover:text-ink')}>
          {t.label}
          {t.count !== undefined && <span className={cx('rounded-full px-1.5 py-0.5 text-[0.68rem] tabular-nums leading-none', t.id === value ? 'bg-teal-100 text-teal-800' : 'bg-paper-3 text-ink-3')}>{t.count}</span>}
        </button>
      ))}
      <span aria-hidden="true" className="absolute bottom-[-1px] h-[2px] bg-teal-700 transition-[left,width] duration-base ease-inout" style={{ left: ind.left, width: ind.width }} />
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange, ariaLabel, className }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; ariaLabel: string; className?: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cx('inline-flex rounded-md border border-line-strong bg-paper-2 p-0.5', className)}>
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
          className={cx('fb-press min-h-[36px] rounded-sm px-3 text-[0.82rem] font-medium', o.value === value ? 'bg-paper text-teal-800 shadow-tile' : 'text-ink-3 hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
