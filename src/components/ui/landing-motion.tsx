import { type ReactNode } from 'react'
import { motion, useReducedMotion, useScroll, useSpring } from 'motion/react'


export function LandingMotion({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 150, damping: 26, mass: .25 })

  return <div className="fb-motion-page">
    <motion.div className="fb-scroll-progress" style={{ scaleX: reduced ? 0 : progress }} aria-hidden="true" />
    {children}
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
