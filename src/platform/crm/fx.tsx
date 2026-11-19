import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'

export const ease = [0.22, 1, 0.36, 1] as const
export const spring = { type: 'spring', stiffness: 420, damping: 34 } as const

/** Counts up to a number when it appears or changes. */
export function CountUp({ value, format = (n: number) => Math.round(n).toLocaleString('en-KE'), ms = 900 }: { value: number; format?: (n: number) => string; ms?: number }) {
  const still = useReducedMotion()
  const [shown, setShown] = useState(still ? value : 0)
  const from = useRef(0)
  useEffect(() => {
    if (still) { setShown(value); return }
    const start = performance.now(), a = from.current
    let raf = 0
    const tick = (t: number) => { const p = Math.min(1, (t - start) / ms), e = 1 - Math.pow(1 - p, 4), v = a + (value - a) * e; setShown(v); if (p < 1) raf = requestAnimationFrame(tick); else from.current = value }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); from.current = value }
  }, [value, still, ms])
  return <>{format(shown)}</>
}
