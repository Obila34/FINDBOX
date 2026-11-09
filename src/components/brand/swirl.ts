/**
 * The FindBox swirl: an outer ring, then concentric rings whose centres drift a little further
 * with each step, so the circles appear to twirl in towards a solid centre. Shared by the React
 * logo, the favicon and app icons (scripts/brand-icons.mjs) and the email header.
 * Coordinates are in a 100 × 100 box.
 */
export type Ring = { cx: number; cy: number; r: number; w: number }

export function swirlRings(count = 12): Ring[] {
  const rings: Ring[] = [{ cx: 50, cy: 50, r: 47, w: 3.4 }]
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)                       // 0 at the outside, 1 near the centre
    const r = 42 - t * 31                          // 42 → 11
    const angle = -0.6 + t * 2.4                    // the drift turns as it tightens
    const drift = Math.sin(t * Math.PI) * 4.2       // most offset in the middle rings
    rings.push({ cx: 50 + Math.cos(angle) * drift, cy: 50 + Math.sin(angle) * drift, r, w: 1.15 })
  }
  return rings
}

export const SWIRL_CORE = { r: 6.2, ring: 9.6 }

/** The whole mark as an SVG string (for icons, emails and static files). */
export function swirlSvg({ size = 100, color = '#657b56', background }: { size?: number; color?: string; background?: string } = {}) {
  const rings = swirlRings().map(g => `<circle cx="${g.cx.toFixed(2)}" cy="${g.cy.toFixed(2)}" r="${g.r.toFixed(2)}" fill="none" stroke="${color}" stroke-width="${g.w}"/>`).join('')
  const bg = background ? `<rect width="100" height="100" fill="${background}"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${bg}${rings}<circle cx="50" cy="50" r="${SWIRL_CORE.ring}" fill="none" stroke="${color}" stroke-width="1.6"/><circle cx="50" cy="50" r="${SWIRL_CORE.r}" fill="${color}"/></svg>`
}
