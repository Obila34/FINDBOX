import { RINGS, TILE } from './brandGeometry'
import { cx } from '@/lib/util'

/**
 * The FindBox orb: the emblem rendered as a floating, lit glass sphere.
 * Layers (back to front): halo bloom, body (radial teal), inner refraction ring, emblem rings,
 * specular highlight, rim light, and a soft contact shadow. Pure CSS/SVG, so it stays crisp and light.
 * `tilt` is a normalised pointer (-1..1) for a subtle parallax between layers.
 */
export function Orb({ size = 160, tilt = { x: 0, y: 0 }, className, floating = true, label = 'FindBox' }: { size?: number; tilt?: { x: number; y: number }; className?: string; floating?: boolean; label?: string }) {
  const sh = (d: number) => ({ transform: `translate3d(${(tilt.x * d).toFixed(2)}px, ${(tilt.y * d).toFixed(2)}px, 0)` })
  return (
    <div className={cx('fb-orb relative', floating && 'fb-orb-float', className)} style={{ width: size, height: size }} role="img" aria-label={label}>
      <span className="fb-orb-halo" aria-hidden="true" style={sh(-4)} />
      <span className="fb-orb-body" aria-hidden="true" />
      <span className="fb-orb-inner" aria-hidden="true" style={sh(3)} />
      <svg viewBox="0 0 64 64" className="absolute inset-[18%]" aria-hidden="true" style={sh(6)}>
        <g transform="translate(1.765 1.765)">
          {RINGS.map(([a, b], i) => <circle key={i} cx={TILE / 2} cy={TILE / 2} r={(a + b) / 2} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={0.6} opacity={0.35 + (i / RINGS.length) * 0.6} />)}
        </g>
      </svg>
      <span className="fb-orb-spec" aria-hidden="true" style={sh(9)} />
      <span className="fb-orb-rim" aria-hidden="true" />
      <span className="fb-orb-shadow" aria-hidden="true" />
    </div>
  )
}
