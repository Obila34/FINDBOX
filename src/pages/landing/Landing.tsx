import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useInView, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { ArrowRight, Check, Mail, Pause, Play, Plus } from 'lucide-react'
import FooterBlock from '@/components/ui/footer-3'
import { LandingAuthGate } from '@/components/ui/landing-auth-gate'
import { WordsPullUp, WordsPullUpMultiStyle, ScrollRevealText } from '@/components/ui/pull-up-text'
import { Logo } from '@/components/brand/Logo'
import { useInstallPrompt } from '@/lib/hooks'
import { imagery } from '@/data/imagery'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import '@/styles/cinema.css'

const ease = [0.16, 1, 0.3, 1] as const
const cardEase = [0.22, 1, 0.36, 1] as const
const TEXT = 'rgb(var(--c-cream-soft))'

const nav = [
  { label: 'Our story', to: '/#about' },
  { label: 'How it works', to: '/#how-it-works' },
  { label: 'Schools', to: '/schools' },
  { label: 'Shop', to: '/shop' },
  { label: 'Contact', to: '/#contact' },
]

const features = [
  {
    n: '01', title: 'Label & connect.', image: imagery.features.label.src, to: '/shop/catalog',
    points: ['QR stickers for bottles, lunchboxes, books and gadgets', 'Woven fabric tags at the collar of shirts, sweaters and blazers', 'Activate a whole pack with one code', 'No private details printed on any tag'],
  },
  {
    n: '02', title: 'Record & notify.', image: imagery.features.record.src, to: '/schools',
    points: ['Staff scan a tag or log an unlabelled find', 'The owner hears as soon as the school confirms receipt', 'Unclaimed items wait in a shared gallery'],
  },
  {
    n: '03', title: 'Verified collection.', image: imagery.features.collect.src, to: '/#how-it-works',
    points: ['Staff check ownership before every handover', 'Collection points with clear opening hours', 'A full history of every return'],
  },
]

const questions = [
  ['What is FindBox?', 'FindBox is a digital lost-and-found management platform for schools. It brings found-item records, labels, notifications and collections into one process.'],
  ['How does a school get started?', 'Contact hello@findbox.africa. We help set up collection points and the school’s return process, then provision its administrator’s access.'],
  ['Do parents and students need separate accounts?', 'Parents use their own accounts and confirm the children linked to them by their school. A student record does not require a student login.'],
  ['What happens when an item has no label?', 'School staff can log it in the unclaimed-items gallery. A parent submits a claim, and staff check ownership before handing it over.'],
  ['Are personal details visible when someone scans a label?', 'The public return page gives hand-in instructions without displaying the owner’s private contact details. School staff confirm receipt before collection updates are sent.'],
]

const scenes = imagery.hero

function Hero() {
  const ref = useRef<HTMLElement>(null)
  const still = useReducedMotion()
  const [scene, setScene] = useState(0)
  const [playing, setPlaying] = useState(!still)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const lift = useTransform(scrollYProgress, [0, 1], [0, -120])
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0])

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => setScene(s => (s + 1) % scenes.length), 6500)
    return () => clearInterval(timer)
  }, [playing, scene])
  function toggle() { setPlaying(p => !p) }
  function follow(e: MouseEvent<HTMLDivElement>) {
    if (still) return
    const r = e.currentTarget.getBoundingClientRect()
    setTilt({ x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 })
  }

  return <section ref={ref} className="h-[100svh] p-4 md:p-6" id="top">
    <div className="fb-dark-scope relative h-full overflow-hidden rounded-2xl md:rounded-[2rem]" onMouseMove={follow} onMouseLeave={() => setTilt({ x: 0, y: 0 })}>
      <motion.div className="absolute inset-0" animate={{ x: tilt.x * -18, y: tilt.y * -12 }} transition={{ type: 'spring', stiffness: 40, damping: 20 }}>
        <AnimatePresence initial={false}>
          <motion.img key={scene} src={scenes[scene].src} alt={scenes[scene].alt} fetchPriority={scene === 0 ? 'high' : undefined}
            className="absolute inset-[-3%] h-[106%] w-[106%] max-w-none object-cover"
            initial={{ opacity: 0, scale: 1.12 }} animate={{ opacity: 1, scale: still ? 1.04 : 1.0 }} exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 1.4, ease }, scale: { duration: 8, ease: 'linear' } }} />
        </AnimatePresence>
      </motion.div>
      <div className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.7] mix-blend-overlay" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-black/85" />

      <Link to="/" aria-label="FindBox home" className="absolute left-4 top-3 z-10 hidden rounded-full bg-black/55 px-3 py-1.5 backdrop-blur-md md:block lg:left-6 lg:top-4"><Logo height={20} /></Link>
      <nav aria-label="Main" className="absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded-b-2xl bg-black px-4 py-2 md:rounded-b-3xl md:px-8 md:py-3">
        <ul className="flex items-center gap-3 whitespace-nowrap text-[10px] sm:gap-6 sm:text-xs md:gap-10 md:text-sm lg:gap-14">
          {nav.map(n => <li key={n.label}><Link to={n.to} className="cinema-link">{n.label}</Link></li>)}
        </ul>
      </nav>
      <div className="absolute right-3 top-2 z-10 flex items-center gap-2 md:right-5 md:top-4 lg:right-8 lg:top-5"><ThemeToggle className="h-8 w-8 md:h-9 md:w-9" /><Link to="/app/sign-in" data-auth-bypass className="hidden rounded-full border border-white/25 px-4 py-1.5 text-sm text-cream-soft backdrop-blur-md transition hover:bg-white/10 md:block">Sign in</Link></div>

      <motion.div style={still ? undefined : { y: lift, opacity: fade }} className="absolute bottom-0 left-0 right-0 grid grid-cols-12 items-end gap-4 px-5 pb-6 md:px-8 md:pb-8 lg:px-10">
        <h1 className="col-span-12 max-w-[14ch] font-medium leading-[0.95] tracking-[-0.045em] text-[12vw] sm:text-[9vw] lg:col-span-8 lg:text-[6.4vw] [text-shadow:0_2px_30px_rgba(0,0,0,.45)]" style={{ color: TEXT }}>
          <WordsPullUp text="Every lost item finds its way back home." />
        </h1>
        <div className="col-span-12 flex flex-col items-start gap-5 pb-2 lg:col-span-4 lg:pb-[2vw]">
          <motion.p className="max-w-md text-sm text-cream-soft sm:text-base md:text-lg [text-shadow:0_1px_18px_rgba(0,0,0,.6)]" style={{ lineHeight: 1.35 }} initial={still ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.5, ease }}>
            FindBox helps schools record belongings, notify owners and hand things back safely, with QR stickers for belongings and fabric tags for uniforms.
          </motion.p>
          <motion.div className="flex flex-wrap items-center gap-3" initial={still ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.7, ease }}>
            <Link to="/contact" className="group inline-flex items-center gap-2 rounded-full bg-primary py-1.5 pl-5 pr-1.5 text-sm font-medium text-black transition-all duration-300 hover:gap-3 sm:text-base">
              Enquire for your school
              <span className="grid h-9 w-9 place-items-center rounded-full bg-black transition-transform duration-300 group-hover:scale-110 sm:h-10 sm:w-10"><ArrowRight size={17} className="text-primary" /></span>
            </Link>
            <Link to="/shop/catalog" className="cinema-link text-sm sm:text-base">Shop labels</Link>
            <Link to="/app/sign-in" data-auth-bypass className="cinema-link text-sm md:hidden">Sign in</Link>
          </motion.div>
        </div>
      </motion.div>

      <div className="absolute right-5 top-14 z-10 flex items-center gap-2 md:top-16 lg:right-8">
        {scenes.map((s, i) => <button key={s.src} type="button" onClick={() => setScene(i)} aria-label={`Show photo ${i + 1}`} aria-current={i === scene}
          className="relative h-1 w-6 overflow-hidden rounded-full bg-white/25 transition hover:bg-white/50">
          {i === scene && <motion.span layoutId="hero-dot" className="absolute inset-0 rounded-full bg-cream-soft" />}
        </button>)}
        <button type="button" onClick={toggle} aria-label={playing ? 'Pause slideshow' : 'Play slideshow'} className="ml-1 grid h-7 w-7 place-items-center rounded-full border border-white/20 text-cream-soft backdrop-blur-md transition hover:bg-white/10">
          {playing ? <Pause size={11} /> : <Play size={11} />}
        </button>
      </div>
    </div>
  </section>
}

function About() {
  return <section id="about" className="scroll-mt-6 bg-night px-4 py-16 md:px-6 md:py-24">
    <div className="mx-auto max-w-6xl rounded-2xl bg-night-card px-6 py-16 text-center md:rounded-[2rem] md:px-12 md:py-24">
      <p className="mb-8 text-[10px] uppercase tracking-[0.2em] text-primary sm:text-xs">Made in Kenya · Built by parents</p>
      <h2 className="mx-auto max-w-3xl text-3xl leading-[0.95] tracking-[-0.03em] sm:text-4xl sm:leading-[0.9] md:text-5xl lg:text-6xl xl:text-7xl" style={{ color: TEXT }}>
        <WordsPullUpMultiStyle segments={[
          { text: 'Lost items cost families money', className: 'font-normal' },
          { text: 'and schools time.', className: 'font-serif italic text-[1.12em] text-sage' },
          { text: 'We bring them home.', className: 'font-normal' },
        ]} />
      </h2>
      <ScrollRevealText className="mx-auto mt-10 max-w-2xl text-xs leading-relaxed text-primary sm:text-sm md:mt-14 md:text-base"
        text="Uniforms, bottles, books and bags sit in storage while parents search for them or pay for replacements. FindBox gives each found item a record and connects school staff, parents and students through labels, notifications and a clear collection process. We set up the collection points on the ground and provide the technology to run them." />
    </div>
  </section>
}

function FeatureCard({ index, children, className }: { index: number; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })
  const still = useReducedMotion()
  function spot(e: MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
  }
  return <motion.div ref={ref} onMouseMove={spot} className={className} initial={still ? false : { opacity: 0, scale: 0.95 }} animate={inView ? { opacity: 1, scale: 1 } : undefined} transition={{ duration: 0.8, delay: index * 0.15, ease: cardEase }} whileHover={still ? undefined : { y: -6 }}>
    {children}
  </motion.div>
}

function Features() {
  return <section id="how-it-works" className="relative min-h-screen scroll-mt-6 overflow-hidden bg-night px-4 py-16 md:px-6 md:py-24">
    <div className="bg-noise pointer-events-none absolute inset-0 opacity-[0.15]" />
    <div className="relative mx-auto max-w-[1440px]">
      <h2 className="mb-12 flex flex-col gap-1 text-center text-xl font-normal tracking-[-0.02em] sm:text-2xl md:mb-16 md:text-3xl lg:text-4xl">
        <WordsPullUpMultiStyle segments={[{ text: 'Four steps from a labelled belonging to a recorded handover.', className: 'text-cream-soft' }]} />
        <WordsPullUpMultiStyle segments={[{ text: 'Built for real schools. Designed for every family.', className: 'text-gray-500' }]} />
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:gap-2 md:grid-cols-2 md:gap-1 lg:h-[500px] lg:grid-cols-4">
        <FeatureCard index={0} className="fb-dark-scope group relative min-h-[380px] overflow-hidden rounded-2xl lg:min-h-0">
          <img className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.6s] ease-out group-hover:scale-110" src={imagery.features.film.src} alt={imagery.features.film.alt} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <p className="absolute bottom-6 left-6 right-6 text-xl tracking-[-0.02em] md:text-2xl" style={{ color: TEXT }}>QR stickers for belongings. Fabric tags for uniforms.</p>
        </FeatureCard>
        {features.map((f, i) => <FeatureCard key={f.n} index={i + 1} className="spotlight flex min-h-[380px] flex-col rounded-2xl bg-night-tile p-6 lg:min-h-0">
          <img src={f.image} alt="" className="h-10 w-10 rounded-lg object-cover sm:h-12 sm:w-12" loading="lazy" />
          <h3 className="mt-6 flex items-baseline justify-between gap-3 text-xl tracking-[-0.02em] md:text-2xl" style={{ color: TEXT }}>{f.title}<span className="text-xs text-gray-500">{f.n}</span></h3>
          <ul className="mt-6 flex flex-col gap-3">
            {f.points.map(p => <li key={p} className="flex gap-3 text-sm leading-snug text-gray-400"><Check size={16} className="mt-0.5 shrink-0 text-primary" />{p}</li>)}
          </ul>
          <Link to={f.to} className="group mt-auto inline-flex items-center gap-2 pt-8 text-sm text-primary">
            <span className="cinema-link">Learn more</span>
            <ArrowRight size={16} className="-rotate-45 transition-transform duration-300 group-hover:rotate-0" />
          </Link>
        </FeatureCard>)}
      </div>
    </div>
  </section>
}

function Questions() {
  const [open, setOpen] = useState<number | null>(0)
  return <section id="questions" className="bg-night px-4 pb-16 md:px-6 md:pb-24">
    <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1.4fr]">
      <h2 className="text-3xl tracking-[-0.03em] md:text-5xl" style={{ color: TEXT }}>
        <WordsPullUpMultiStyle align="start" segments={[{ text: 'Questions,' }, { text: 'answered.', className: 'font-serif italic text-sage' }]} />
      </h2>
      <div className="border-t border-white/10">
        {questions.map(([q, a], i) => <div key={q} className="border-b border-white/10">
          <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-6 py-5 text-left text-base text-cream-soft transition-colors hover:text-sage md:text-lg">
            {q}
            <motion.span animate={{ rotate: open === i ? 45 : 0 }} transition={{ duration: 0.3, ease }} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/15"><Plus size={15} /></motion.span>
          </button>
          <AnimatePresence initial={false}>
            {open === i && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease }} className="overflow-hidden">
              <p className="max-w-xl pb-6 text-sm leading-relaxed text-gray-400 md:text-base">{a}</p>
            </motion.div>}
          </AnimatePresence>
        </div>)}
      </div>
    </div>
  </section>
}

function Contact() {
  return <section id="contact" className="scroll-mt-6 bg-night px-4 pb-6 md:px-6">
    <div className="relative mx-auto flex max-w-[1440px] flex-col items-center overflow-hidden rounded-2xl bg-night-card px-6 py-20 text-center md:rounded-[2rem] md:py-28">
      <div className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.25] mix-blend-overlay" />
      <p className="relative mb-6 text-[10px] uppercase tracking-[0.2em] text-primary sm:text-xs">Contact FindBox</p>
      <h2 className="relative max-w-3xl text-3xl leading-[0.95] tracking-[-0.03em] sm:text-5xl md:text-6xl" style={{ color: TEXT }}>
        <WordsPullUpMultiStyle segments={[{ text: 'Bring FindBox' }, { text: 'to your school.', className: 'font-serif italic text-sage' }]} />
      </h2>
      <p className="relative mt-6 max-w-md text-sm text-gray-400 md:text-base">Ask about bringing FindBox to your school or get help with an existing account.</p>
      <div className="relative mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link to="/contact" className="group inline-flex items-center gap-2 rounded-full bg-primary py-1.5 pl-5 pr-1.5 text-sm font-medium text-black transition-all duration-300 hover:gap-3 sm:text-base">
          Send an enquiry
          <span className="grid h-9 w-9 place-items-center rounded-full bg-black transition-transform duration-300 group-hover:scale-110 sm:h-10 sm:w-10"><ArrowRight size={17} className="text-primary" /></span>
        </Link>
        <a href="mailto:hello@findbox.africa" className="cinema-link inline-flex items-center gap-2 text-sm sm:text-base"><Mail size={16} />hello@findbox.africa</a>
      </div>
    </div>
  </section>
}

export function Landing() {
  const location = useLocation()
  useEffect(() => {
    if (!location.hash) return
    const frame = requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }))
    return () => cancelAnimationFrame(frame)
  }, [location.hash, location.key])
  const { install, canPrompt } = useInstallPrompt()
  async function getApp() { if (canPrompt) await install(); else window.location.assign('/app/sign-in') }
  return <LandingAuthGate>
    <div className="cinema-root fb-landing">
      <a href="#main" className="fb-skip">Skip to content</a>
      <main id="main">
        <Hero />
        <About />
        <Features />
        <Questions />
        <Contact />
      </main>
      <FooterBlock onInstall={() => void getApp()} />
    </div>
  </LandingAuthGate>
}
