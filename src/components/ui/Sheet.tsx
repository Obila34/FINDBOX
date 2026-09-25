import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cx } from '@/lib/util'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  /** bottom sheet on phones, centered dialog on larger screens (default); 'right' is a side panel */
  side?: 'auto' | 'right'
  size?: 'md' | 'lg'
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Accessible dialog: focus trap, Escape to close, focus restore, scroll lock. */
export function Sheet({ open, onClose, title, description, children, footer, side = 'auto', size = 'md' }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null)
  const restore = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    restore.current = document.activeElement as HTMLElement
    const node = ref.current
    const first = node?.querySelector<HTMLElement>(FOCUSABLE)
    window.setTimeout(() => (first ?? node)?.focus(), 30)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
      if (e.key === 'Tab' && node) {
        const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null)
        if (!items.length) return
        const firstEl = items[0]; const lastEl = items[items.length - 1]
        if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus() }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; restore.current?.focus?.() }
  }, [open, onClose])

  if (!open) return null
  const panel = side === 'right'
    ? 'fixed inset-y-0 right-0 w-full max-w-md md:max-w-lg fb-slide-l rounded-none md:border-l'
    : cx('fixed inset-x-3 bottom-3 max-h-[92svh] rounded-xl fb-sheet-in md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg md:border', size === 'lg' ? 'md:w-[720px]' : 'md:w-[520px]')
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="fb-fade absolute inset-0 bg-teal-900/60" onClick={onClose} aria-hidden="true" />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="sheet-title" aria-describedby={description ? 'sheet-desc' : undefined} tabIndex={-1}
        className={cx('flex flex-col bg-paper shadow-sheet outline-none border-line', panel)}>
        <header className="flex items-start gap-3 border-b border-line px-5 pt-4 pb-3 md:px-6">
          {side !== 'right' && <span className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-line-strong md:hidden" aria-hidden="true" />}
          <div className="min-w-0 flex-1 pt-1">
            <h2 id="sheet-title" className="fb-display text-[1.35rem] leading-tight text-ink">{title}</h2>
            {description && <p id="sheet-desc" className="mt-0.5 text-[0.85rem] text-ink-3">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="fb-press -mr-2 rounded-md p-2 text-ink-3 hover:bg-paper-2 hover:text-ink"><X className="h-5 w-5" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 md:px-6">{children}</div>
        {footer && <footer className="fb-safe-b border-t border-line px-5 py-3 md:px-6">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
