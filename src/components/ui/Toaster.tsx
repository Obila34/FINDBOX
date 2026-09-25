import { useEffect, useState } from 'react'
import { CheckCircle2, Info, AlertCircle, Sparkles, X } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { cx, prefersReducedMotion } from '@/lib/util'

const icon = {
  info: <Info className="h-5 w-5 text-teal-600" aria-hidden="true" />,
  success: <CheckCircle2 className="h-5 w-5 text-status-done" aria-hidden="true" />,
  danger: <AlertCircle className="h-5 w-5 text-status-danger" aria-hidden="true" />,
  reward: <Sparkles className="h-5 w-5 text-teal-600" aria-hidden="true" />,
}

export function Toaster() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  return (
    <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+12px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6">
      {toasts.map((t) => (
        <div key={t.id} role="status" className={cx('fb-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border bg-paper p-3 shadow-raise', t.tone === 'danger' ? 'border-[#efbdb8]' : 'border-line-strong')}>
          {icon[t.tone ?? 'info']}
          <div className="min-w-0 flex-1">
            <p className="text-[0.875rem] font-medium leading-snug text-ink">{t.title}</p>
            {t.body && <p className="mt-0.5 text-[0.8rem] leading-snug text-ink-3">{t.body}</p>}
          </div>
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="-m-1 rounded-sm p-1 text-ink-4 hover:text-ink"><X className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  )
}

/** One-shot celebration used only for verified helpful actions or a confirmed return. */
export function Celebration() {
  const count = useStore((s) => s.celebrate)
  const [burst, setBurst] = useState<number | null>(null)
  useEffect(() => {
    if (!count || prefersReducedMotion()) return
    setBurst(count)
    const t = window.setTimeout(() => setBurst(null), 1000)
    return () => window.clearTimeout(t)
  }, [count])
  if (!burst) return null
  const colors = ['var(--fb-teal-300)', 'var(--fb-teal-500)', 'var(--fb-teal-700)', 'var(--fb-tile)', '#f2c94c']
  return (
    <div aria-hidden="true" className="fb-confetti pointer-events-none fixed inset-0 z-[70]">
      {Array.from({ length: 18 }).map((_, i) => {
        const a = (i / 18) * Math.PI * 2
        const r = 90 + (i % 4) * 30
        return <span key={i} style={{ background: colors[i % colors.length], ['--dx' as string]: `${Math.cos(a) * r}px`, ['--dy' as string]: `${Math.sin(a) * r - 40}px`, animationDelay: `${(i % 6) * 20}ms` }} />
      })}
    </div>
  )
}
