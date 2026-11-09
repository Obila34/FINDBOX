import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { SwirlMark } from '@/components/brand/Logo'
import { cx } from '@/lib/util'
import FooterBlock from '@/components/ui/footer-3'
import { SiteNav } from '@/components/layout/SiteNav'
import '@/styles/cinema.css'

const ease = [0.16, 1, 0.3, 1] as const

export type AuthMode = 'sign-in' | 'sign-up'

export interface SignIn1Props {
  /** Heading inside the card. */
  title: string
  lede?: string
  /** Small line above the heading, e.g. "School portal". */
  kicker?: string
  /** Shows the Sign in / Sign up switch. The active mode drives the slide direction. */
  tabs?: { mode: AuthMode; signIn: string; signUp: string; state?: unknown }
  /** Changes whenever the card's content should animate to a new screen (usually the path). */
  screen: string
  back?: { to: string; label: string; external?: boolean }
  /** Background photograph behind the card. */
  image?: string
  wide?: boolean
  children: ReactNode
  /** Help links shown under the card. */
  footer?: ReactNode
  /** The site footer under the sign-in screen (off for the company workspace). */
  siteFooter?: boolean
}

/**
 * FindBox's sign-in card: a frosted card over a cinematic photograph. Switching between
 * sign in and sign up slides the form sideways and resizes the card smoothly.
 * Used by the family and school sign-in, account security and the company workspace.
 */
export function SignIn1({ title, lede, kicker, tabs, screen, back = { to: '/', label: 'Back to FindBox' }, image = '/media/catalog/everyday-qr-960.webp', wide, children, footer, siteFooter = true }: SignIn1Props) {
  const still = useReducedMotion()
  const direction = tabs?.mode === 'sign-up' ? 1 : -1
  const slide = {
    enter: (d: number) => (still ? { opacity: 0 } : { opacity: 0, x: d * 40, filter: 'blur(4px)' }),
    center: { opacity: 1, x: 0, filter: 'blur(0px)' },
    exit: (d: number) => (still ? { opacity: 0 } : { opacity: 0, x: d * -40, filter: 'blur(4px)' }),
  }
  const backLink = back.external
    ? <a href={back.to} className="cinema-link inline-flex items-center gap-1.5 text-xs sm:text-sm"><ArrowLeft size={14} />{back.label}</a>
    : <Link to={back.to} className="cinema-link inline-flex items-center gap-1.5 text-xs sm:text-sm"><ArrowLeft size={14} />{back.label}</Link>

  return <div className="cinema-root min-h-[100svh] p-3 sm:p-4 md:p-6">
    <div className="fb-dark-scope relative flex min-h-[calc(100svh-1.5rem)] flex-col overflow-hidden rounded-2xl sm:min-h-[calc(100svh-2rem)] md:min-h-[calc(100svh-3rem)] md:rounded-[2rem]">
      <AnimatePresence initial={false}>
        <motion.img key={image} src={image} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover"
          initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1.02 }} exit={{ opacity: 0 }} transition={{ duration: 1.1, ease }} />
      </AnimatePresence>
      <div className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.6] mix-blend-overlay" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-black/45 to-black/85" />

      <SiteNav overlay />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-10 pt-32 md:pt-24">
        <motion.section layout={!still} transition={{ layout: { duration: 0.5, ease } }}
          className={cx('fa-card w-full rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.12] via-white/[0.05] to-black/40 p-7 shadow-2xl backdrop-blur-xl sm:p-8', wide ? 'max-w-xl' : 'max-w-sm')}
          initial={still ? false : { opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
          <motion.div layout="position" className="mb-6 flex flex-col items-center text-center">
            <span className="mb-5 grid h-14 w-14 place-items-center rounded-full bg-black/40 text-[#8fa77c] shadow-lg ring-1 ring-white/15">
              <SwirlMark size={40} />
            </span>
            {kicker && <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-sage sm:text-xs">{kicker}</p>}
            <AnimatePresence mode="wait" initial={false}>
              <motion.h1 key={title} className="text-2xl font-medium tracking-[-0.03em] text-cream-soft sm:text-[1.7rem]"
                initial={still ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease }}>
                {title}
              </motion.h1>
            </AnimatePresence>
            {lede && <p className="mt-2 max-w-[19rem] text-xs leading-relaxed text-gray-400 sm:text-sm">{lede}</p>}
          </motion.div>

          {tabs && <nav aria-label="Account access" className="relative mb-6 grid grid-cols-2 rounded-full bg-black/40 p-1 ring-1 ring-white/10">
            {([['sign-in', 'Sign in', tabs.signIn], ['sign-up', 'Sign up', tabs.signUp]] as const).map(([mode, label, to]) => {
              const active = tabs.mode === mode
              return <Link key={mode} to={to} state={tabs.state} aria-current={active ? 'page' : undefined}
                className={cx('relative z-0 rounded-full py-2 text-center text-sm transition-colors duration-300', active ? 'text-black' : 'text-cream/70 hover:text-cream-soft')}>
                {active && <motion.span layoutId="fa-tab" className="absolute inset-0 -z-10 rounded-full bg-primary" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                {label}
              </Link>
            })}
          </nav>}

          <div className="relative overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false} custom={direction}>
              <motion.div key={screen} custom={direction} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.45, ease }}>
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.section>

        <motion.div className="mt-8 flex flex-col items-center gap-4 text-center" initial={still ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3, ease }}>
          <p className="inline-flex items-center gap-2 text-xs text-gray-300 sm:text-sm"><ShieldCheck size={16} className="text-sage" />Private details. School-verified returns.</p>
          {footer}
          {backLink}
        </motion.div>
      </main>
    </div>
    {siteFooter && <div className="mt-3 sm:mt-4 md:mt-6"><FooterBlock onInstall={() => window.location.assign('/app/sign-in')} /></div>}
  </div>
}

export default SignIn1
