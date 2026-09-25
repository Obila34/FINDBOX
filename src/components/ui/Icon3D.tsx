import type { LucideIcon } from 'lucide-react'
import { cx } from '@/lib/util'
type Tone = 'teal' | 'mint' | 'ink' | 'gold' | 'rose' | 'plum'
const tones: Record<Tone, string> = { teal: 'bg-teal-50 text-teal-700', mint: 'bg-paper-3 text-ink', ink: 'bg-ink text-white', gold: 'bg-[#fbf1e4] text-status-lost', rose: 'bg-teal-100 text-teal-700', plum: 'bg-[#efedf8] text-status-review' }
/** Existing API, now rendered with the studio design's flat icon treatment. */
export function Icon3D({ icon: Icon, tone = 'teal', size = 48, shape = 'tile', className, label }: { icon: LucideIcon; tone?: Tone; size?: number; shape?: 'tile' | 'orb'; className?: string; label?: string }) {
  return <span className={cx('inline-flex shrink-0 items-center justify-center', shape === 'orb' ? 'rounded-full' : 'rounded-lg', tones[tone], className)} style={{ width: size, height: size }} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}><Icon size={size * .43} strokeWidth={1.6} /></span>
}
