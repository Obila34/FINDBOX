import { VoicePoweredOrb } from '@/components/ui/voice-powered-orb'
import { cx } from '@/lib/util'
export function BrandOrb({ className }: { className?: string }) {
 return <span className={cx('fb-brand-orb fb-brand-orb-new', className)} aria-hidden="true"><span className="fb-orb-static" /><VoicePoweredOrb /></span>
}
