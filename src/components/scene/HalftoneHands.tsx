import { useEffect, useMemo, useRef } from 'react'
import { Mark } from '@/components/brand/Logo'
import { cx, prefersReducedMotion } from '@/lib/util'

/**
 * Two halftone hands: an adult hand offering the FindBox emblem, a child's hand reaching for it.
 * Built from capsule geometry rendered to a mask, then sampled into a dot grid whose radius follows the
 * blurred mask (soft edges) and fades toward the wrists. `progress` (0..1) brings the hands together and
 * passes the emblem from the adult hand to the child's. Original artwork, no external assets.
 */
export function HalftoneHands({ progress, className, tone = 'brand', spacing = 6 }: { progress: number; className?: string; tone?: 'brand' | 'soft'; spacing?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const maskRef = useRef<{ w: number; h: number; data: Uint8ClampedArray; grid: { x: number; y: number; j: number }[] } | null>(null)
  const reduced = useMemo(() => prefersReducedMotion(), [])
  const p = reduced ? 0.5 : progress
  const W = 1200, H = 620

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement!
    let raf = 0
    const draw = () => {
      const cssW = parent.clientWidth
      const scale = cssW / W
      const cssH = H * scale
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr)
      canvas.style.width = `${cssW}px`; canvas.style.height = `${cssH}px`
      const ctx = canvas.getContext('2d')!
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0)
      ctx.clearRect(0, 0, W, H)

      // Hands move toward each other as progress rises.
      const shift = 34 * p
      const off = document.createElement('canvas'); off.width = W; off.height = H
      const octx = off.getContext('2d')!
      octx.filter = 'blur(13px)'
      drawHand(octx, 290 + shift, 360, 1.12, 16, false)   // adult hand, fingers pointing right/up
      drawHand(octx, 915 - shift, 320, 0.8, -20, true)   // child hand, mirrored, fingers pointing left/down
      const img = octx.getImageData(0, 0, W, H).data

      // Dot grid with a stable jitter
      const dots: { x: number; y: number; j: number }[] = []
      let seed = 7
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
      for (let y = spacing / 2; y < H; y += spacing) for (let x = spacing / 2; x < W; x += spacing) dots.push({ x: x + (rnd() - 0.5) * 1.2, y: y + (rnd() - 0.5) * 1.2, j: 0.8 + rnd() * 0.4 })
      maskRef.current = { w: W, h: H, data: img, grid: dots }

      const dark = tone === 'brand' ? [7, 56, 71] : [95, 114, 117]
      const teal = tone === 'brand' ? [19, 134, 142] : [169, 217, 216]
      for (const d of dots) {
        const ix = (Math.round(d.y) * W + Math.round(d.x)) * 4 + 3
        const a = img[ix] / 255
        if (a < 0.12) continue
        // fade toward the wrists (left edge for adult, right edge for child) so the hands dissolve into the page
        const fade = d.x < W / 2 ? smooth((d.x - 40) / 260) : smooth((W - 40 - d.x) / 220)
        const r = (spacing * 0.46) * Math.min(1, (a - 0.1) * 1.25) * (0.2 + 0.8 * fade) * d.j
        if (r < 0.35) continue
        const t = d.x < W / 2 ? smooth((d.x - 300) / 300) : smooth((900 - d.x) / 260)
        const c = mix(dark, teal, t * 0.85)
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`
        ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, Math.PI * 2); ctx.fill()
      }
    }
    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw) }
    schedule()
    const ro = new ResizeObserver(schedule)
    ro.observe(parent)
    return () => { ro.disconnect(); cancelAnimationFrame(raf) }
  }, [p, tone, spacing])

  // Emblem travels from the adult fingertips to the child's fingertips.
  const tx = 45.5 + (58.5 - 45.5) * p
  const ty = 49 - Math.sin(p * Math.PI) * 4
  return (
    <div className={cx('relative w-full', className)} aria-hidden="true" style={{ aspectRatio: `${W} / ${H}` }}>
      <canvas ref={canvasRef} className="block h-auto w-full" />
      <div className="absolute" style={{ left: `${tx}%`, top: `${ty}%`, transform: 'translate(-50%, -50%)', transition: reduced ? undefined : 'left 120ms linear, top 120ms linear' }}>
        <Mark size={54} pulse={!reduced && p < 0.9} className="drop-shadow-[0_8px_18px_rgba(7,56,71,0.25)] md:h-[72px] md:w-[72px]" />
      </div>
    </div>
  )
}

const smooth = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x) }
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t))

function capsule(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number) {
  ctx.lineWidth = w; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
}

/** A stylised open hand in local space: wrist at the left, fingers toward +x. */
function drawHand(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, rotDeg: number, mirror: boolean) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((rotDeg * Math.PI) / 180)
  ctx.scale(mirror ? -s : s, s)
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'
  // forearm + palm
  capsule(ctx, -330, 6, -70, 2, 104)
  ctx.beginPath(); ctx.ellipse(0, 0, 92, 76, 0.08, 0, Math.PI * 2); ctx.fill()
  // fingers: [baseX, baseY, angleDeg, length, width]
  const fingers: [number, number, number, number, number][] = [
    [58, -56, -22, 162, 31],
    [80, -18, -8, 182, 33],
    [80, 20, 5, 168, 31],
    [60, 56, 20, 122, 27],
  ]
  for (const [bx, by, ang, len, w] of fingers) {
    const a = (ang * Math.PI) / 180
    capsule(ctx, bx, by, bx + Math.cos(a) * len, by + Math.sin(a) * len, w)
  }
  // thumb
  const ta = (-64 * Math.PI) / 180
  capsule(ctx, -24, -62, -24 + Math.cos(ta) * 122, -62 + Math.sin(ta) * 122, 38)
  ctx.restore()
}
