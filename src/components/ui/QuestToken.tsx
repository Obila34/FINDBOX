import { cx } from '@/lib/util'

export type TokenKind = 'tag' | 'label' | 'lantern' | 'key' | 'compass'

const D = 'var(--fb-teal-800)'; const M = 'var(--fb-teal-500)'; const L = 'var(--fb-teal-200)'; const G = '#e8c15a'; const T = 'var(--fb-tile)'

const glyph: Record<TokenKind, React.ReactNode> = {
  tag: (<g><path d="M10 22l12-12h10v10L20 32z" fill={M} /><path d="M10 22l12-12v10L12 30z" fill={L} /><circle cx="27" cy="15" r="2.5" fill={T} /></g>),
  label: (<g><rect x="9" y="14" width="22" height="12" fill={L} /><rect x="9" y="14" width="22" height="4" fill={M} /><rect x="12" y="20" width="12" height="2" fill={D} /></g>),
  lantern: (<g><rect x="14" y="8" width="12" height="4" fill={D} /><path d="M12 12h16l2 14H10z" fill={G} /><path d="M12 12h8l1 14H10z" fill="#f4d98a" /><rect x="11" y="26" width="18" height="4" fill={D} /></g>),
  key: (<g><circle cx="14" cy="16" r="6" fill="none" stroke={G} strokeWidth="4" /><path d="M18 18l12 12 3-3-2-2 2-2-2-2 2-2-3-3z" fill={G} /></g>),
  compass: (<g><circle cx="20" cy="20" r="11" fill={L} /><circle cx="20" cy="20" r="11" fill="none" stroke={D} strokeWidth="1.5" /><path d="M20 9l3 11-3 11-3-11z" fill={D} /><path d="M20 9l3 11h-6z" fill={M} /></g>),
}

/** Collectible token: an octagonal seal. `earned` renders in colour and settles into its slot once. */
export function QuestToken({ kind, earned, size = 48, settle, className, label }: { kind: TokenKind; earned: boolean; size?: number; settle?: boolean; className?: string; label?: string }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} role="img" aria-label={label ?? `${kind} token${earned ? ', earned' : ', locked'}`}
      className={cx('shrink-0', settle && 'fb-settle', !earned && 'opacity-40 grayscale', className)}>
      <path d="M12 2h16l10 10v16L28 38H12L2 28V12z" fill={earned ? 'var(--fb-teal-50)' : 'var(--fb-paper-3)'} stroke={earned ? 'var(--fb-teal-600)' : 'var(--fb-line-strong)'} strokeWidth="1.5" />
      <path d="M12 2h16l10 10v16L28 38H12L2 28V12z" fill="none" stroke="var(--fb-paper)" strokeWidth="0.75" transform="translate(0 1)" opacity="0.6" />
      {glyph[kind]}
    </svg>
  )
}
