import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react'

const magneticSelector = 'a, button, [data-magnetic]'

export function LandingMotion({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 150, damping: 26, mass: .25 })

  return <div className="fb-motion-page">
    <motion.div className="fb-scroll-progress" style={{ scaleX: reduced ? 0 : progress }} aria-hidden="true" />
    {children}
    {!reduced && <MagneticCursor />}
  </div>
}

export function ScrollReveal({ children, className = '', delay = 0, direction = 'up' }: {
  children: ReactNode
  className?: string
  delay?: number
  direction?: 'up' | 'left' | 'right' | 'none'
}) {
  const reduced = useReducedMotion()
  const offset = direction === 'left' ? { x: -34, y: 0 } : direction === 'right' ? { x: 34, y: 0 } : direction === 'none' ? { x: 0, y: 0 } : { x: 0, y: 42 }
  return <motion.div
    className={'fb-scroll-reveal ' + className}
    initial={reduced ? false : { opacity: 0, filter: 'blur(7px)', ...offset }}
    whileInView={reduced ? undefined : { opacity: 1, x: 0, y: 0, filter: 'blur(0px)' }}
    viewport={{ once: true, amount: .12, margin: '0px 0px -7% 0px' }}
    transition={{ duration: .82, delay, ease: [.2, .75, .2, 1] }}
  >{children}</motion.div>
}

function MagneticCursor() {
  const x = useMotionValue(-100), y = useMotionValue(-100)
  const dotX = useSpring(x, { stiffness: 900, damping: 55, mass: .08 })
  const dotY = useSpring(y, { stiffness: 900, damping: 55, mass: .08 })
  const ringX = useSpring(x, { stiffness: 260, damping: 28, mass: .22 })
  const ringY = useSpring(y, { stiffness: 260, damping: 28, mass: .22 })
  const ringOffsetX = useTransform(ringX, v => v - 19)
  const ringOffsetY = useTransform(ringY, v => v - 19)
  const dotOffsetX = useTransform(dotX, v => v - 3)
  const dotOffsetY = useTransform(dotY, v => v - 3)
  const [visible, setVisible] = useState(false)
  const [active, setActive] = useState(false)
  const target = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const finePointer = window.matchMedia('(pointer: fine) and (hover: hover)')
    if (!finePointer.matches) return
    const resetTarget = () => {
      if (!target.current) return
      target.current.style.setProperty('--fb-magnetic-x', '0px')
      target.current.style.setProperty('--fb-magnetic-y', '0px')
      target.current.removeAttribute('data-magnetic-active')
      target.current = null
    }
    const move = (event: PointerEvent) => {
      x.set(event.clientX); y.set(event.clientY); setVisible(true)
      const next = (event.target as Element | null)?.closest?.(magneticSelector) as HTMLElement | null
      if (next !== target.current) {
        resetTarget(); target.current = next
        if (next) next.setAttribute('data-magnetic-active', '')
      }
      setActive(Boolean(next))
      if (!next) return
      const box = next.getBoundingClientRect()
      const pullX = Math.max(-7, Math.min(7, (event.clientX - box.left - box.width / 2) * .1))
      const pullY = Math.max(-7, Math.min(7, (event.clientY - box.top - box.height / 2) * .1))
      next.style.setProperty('--fb-magnetic-x', pullX + 'px')
      next.style.setProperty('--fb-magnetic-y', pullY + 'px')
    }
    const leave = () => { setVisible(false); setActive(false); resetTarget() }
    window.addEventListener('pointermove', move, { passive: true })
    document.documentElement.addEventListener('mouseleave', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      document.documentElement.removeEventListener('mouseleave', leave)
      resetTarget()
    }
  }, [x, y])

  return <div className="fb-magnetic-cursor" aria-hidden="true" data-visible={visible} data-active={active}>
    <motion.span className="fb-cursor-ring" style={{ x: ringOffsetX, y: ringOffsetY }} />
    <motion.span className="fb-cursor-dot" style={{ x: dotOffsetX, y: dotOffsetY }} />
  </div>
}
