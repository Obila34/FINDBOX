import { Check, CircleDashed, Search, MapPin, PackageCheck, AlertTriangle, Eye } from 'lucide-react'
import { toneClasses, type Tone } from '@/domain/labels'
import { cx } from '@/lib/util'

const glyph: Record<Tone, React.ReactNode> = {
  neutral: <CircleDashed className="h-3.5 w-3.5" aria-hidden="true" />,
  lost: <Search className="h-3.5 w-3.5" aria-hidden="true" />,
  match: <Eye className="h-3.5 w-3.5" aria-hidden="true" />,
  ready: <MapPin className="h-3.5 w-3.5" aria-hidden="true" />,
  done: <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />,
  review: <CircleDashed className="h-3.5 w-3.5" aria-hidden="true" />,
  danger: <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />,
}

/** Status seal: a labelled, glyph-bearing pill. Colour is never the only signal. */
export function StatusSeal({ tone, label, size = 'md', className, live }: { tone: Tone; label: string; size?: 'sm' | 'md'; className?: string; live?: boolean }) {
  return (
    <span
      className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-medium leading-none', toneClasses[tone], size === 'sm' ? 'px-2 py-1 text-[0.72rem]' : 'px-2.5 py-1.5 text-[0.8rem]', className)}
      aria-live={live ? 'polite' : undefined}
    >
      {tone === 'done' ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : glyph[tone]}
      {label}
    </span>
  )
}
