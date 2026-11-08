import { useRef, type ReactNode } from 'react'
import { motion, useInView, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react'
import { cx } from '@/lib/util'

const ease = [0.16, 1, 0.3, 1] as const

/** Splits text into words that slide up one after another when they scroll into view. */
export function WordsPullUp({ text, className, mark, delay = 0 }: { text: string; className?: string; mark?: ReactNode; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const still = useReducedMotion()
  const words = text.split(' ')
  return <span ref={ref} className={cx('inline-flex flex-wrap', className)} aria-label={text}>
    {words.map((word, i) => {
      const last = i === words.length - 1
      return <span key={i} className={cx('overflow-hidden pb-[0.08em]', last && mark ? 'pr-[0.32em]' : undefined)} aria-hidden="true">
        <motion.span className="relative inline-block" initial={still ? false : { y: 20, opacity: 0 }} animate={inView ? { y: 0, opacity: 1 } : undefined} transition={{ duration: 0.8, delay: delay + i * 0.08, ease }}>
          {word}
          {last && mark && <span className="absolute top-[0.65em] -right-[0.3em] text-[0.31em] leading-none">{mark}</span>}
          {!last && ' '}
        </motion.span>
      </span>
    })}
  </span>
}

export type StyledSegment = { text: string; className?: string }

/** Same pull-up effect across several differently styled phrases, kept as one flowing line. */
export function WordsPullUpMultiStyle({ segments, className, align = 'center' }: { segments: StyledSegment[]; className?: string; align?: 'center' | 'start' }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const still = useReducedMotion()
  const words = segments.flatMap(s => s.text.split(' ').filter(Boolean).map(word => ({ word, className: s.className })))
  return <span ref={ref} className={cx('inline-flex flex-wrap', align === 'center' ? 'justify-center' : 'justify-start', className)} aria-label={segments.map(s => s.text).join(' ')}>
    {words.map(({ word, className: wordClass }, i) => <span key={i} className="overflow-hidden pb-[0.1em]" aria-hidden="true">
      <motion.span className={cx('inline-block', wordClass)} initial={still ? false : { y: 20, opacity: 0 }} animate={inView ? { y: 0, opacity: 1 } : undefined} transition={{ duration: 0.8, delay: i * 0.08, ease }}>
        {word}{i < words.length - 1 && ' '}
      </motion.span>
    </span>)}
  </span>
}

function AnimatedLetter({ char, progress, range }: { char: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.2, 1])
  return <motion.span style={{ opacity }}>{char}</motion.span>
}

/** Text whose letters brighten one by one as the reader scrolls through it. */
export function ScrollRevealText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.8', 'end 0.2'] })
  const still = useReducedMotion()
  if (still) return <p className={className}>{text}</p>
  const chars = [...text]
  return <p ref={ref} className={className} aria-label={text}>
    <span aria-hidden="true">{chars.map((char, i) => {
      const at = i / chars.length
      return <AnimatedLetter key={i} char={char} progress={scrollYProgress} range={[Math.max(0, at - 0.1), Math.min(1, at + 0.05)]} />
    })}</span>
  </p>
}
