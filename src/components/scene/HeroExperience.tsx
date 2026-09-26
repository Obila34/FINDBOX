import { useEffect, useRef, useState } from 'react'
import { motion, useAnimationFrame, useInView, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react'
import Balancer from 'react-wrap-balancer'
import { Pause, Play, ArrowUpRight } from 'lucide-react'
import { ProductImage, type ProductKind } from '@/components/ui/ProductImage'
import { Button } from '@/components/ui/Button'

const products: { kind: ProductKind; name: string; eyebrow: string; body: string }[] = [
  { kind: 'bottle', name: 'Everyday. Never ordinary.', eyebrow: '01 / THE CLEAR BOTTLE', body: 'A favourite bottle. A tiny QR label. A simpler way back through your school.' },
  { kind: 'nfc', name: 'A little tap goes a long way.', eyebrow: '02 / THE NFC TAG', body: 'A tactile tag for the things you take everywhere. Register your NFC tag in FindBox.' },
  { kind: 'airtag', name: 'Keep your essentials close.', eyebrow: '03 / THE TRACKER', body: 'A keyring tracker for the essentials you carry. Connect its item record to your school’s return process.' },
]
function Orbit({ progress, paused, selected, onSelect }: { progress: MotionValue<number>; paused: boolean; selected: number; onSelect: (i: number) => void }) {
 const host = useRef<HTMLDivElement>(null)
 const objects = useRef<(HTMLButtonElement | null)[]>([])
 const phase = useRef(0); const radius = useRef(200)
 const visible = useInView(host)
 useEffect(() => {
  const observer = new ResizeObserver(([entry]) => { radius.current = entry.contentRect.width * .29 })
  if (host.current) observer.observe(host.current)
  return () => observer.disconnect()
 }, [])
 useAnimationFrame((_time, delta) => {
  if (!visible || document.hidden) return
  if (!paused) phase.current += Math.min(delta, 40) * .00016
  objects.current.forEach((el, i) => {
   if (!el) return
   const a = phase.current + i * Math.PI * 2 / 3 + Math.PI / 2 + (paused ? 0 : progress.get() * 1.4)
   const x = Math.cos(a) * radius.current, y = Math.sin(a) * 55
   const scale = (selected === i ? 1 : .85) + Math.sin(a) * .06
   el.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scale}) rotate(${Math.cos(a) * 7}deg)`
   el.style.zIndex = String(Math.round((Math.sin(a) + 1) * 10))
  })
 })
 return <div ref={host} className="fb-photo-orbit">{products.map((p, i) => <button key={p.kind} ref={el => { objects.current[i] = el }} className={`fb-orbit-object is-${p.kind}`} onClick={() => onSelect(i)} aria-label={`Explore ${p.kind === 'airtag' ? 'tracking tag' : p.kind}`} aria-pressed={selected === i}><ProductImage kind={p.kind} eager /></button>)}</div>
}
export function HeroExperience() {
  const ref = useRef<HTMLDivElement>(null); const reduced = useReducedMotion(); const [paused, setPaused] = useState(false); const [selected, setSelected] = useState(0)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] }); const y = useTransform(scrollYProgress, [0, 1], [0, 130]); const rotate = useTransform(scrollYProgress, [0, 1], [0, -5])
  return <div ref={ref} className="fb-orbit-hero">
    <motion.div className="fb-orbit-heading" initial={reduced ? false : { opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
      <p className="fb-kicker"><span /> SMALL TAGS. BIG PEACE OF MIND.</p>
      <h1><Balancer>A little less lost.<br /><em>A lot more found.</em></Balancer></h1>
      <p className="fb-hero-intro">For the things that go everywhere with you.<br />One connected school. A thousand little reunions.</p>
      <div className="fb-orbit-actions"><Button to="/app/welcome" size="lg" arrow>Find your way home</Button><Button to="/app/sign-in" variant="ghost" size="lg" iconRight={<ArrowUpRight size={17} />}>Open FindBox</Button></div>
    </motion.div>
    <motion.div className="fb-orbit-stage" style={reduced || paused ? {} : { y, rotate }}>
      <div className="fb-orbit-ring" /><div className="fb-orbit-ring fb-orbit-ring-inner" /><span className="fb-stage-note">DESIGNED TO COME BACK.</span>
      <Orbit progress={scrollYProgress} paused={paused || !!reduced} selected={selected} onSelect={setSelected} />
      <button className="fb-motion-control" onClick={() => setPaused(!paused)} aria-label={paused ? 'Resume object motion' : 'Pause object motion'}>{paused ? <Play size={15} /> : <Pause size={15} />} {paused || reduced ? 'Motion off' : 'Motion on'}</button>
    </motion.div>
    <div className="fb-product-selector" role="group" aria-label="Explore connected objects">{products.map((p, i) => <button key={p.kind} onClick={() => setSelected(i)} aria-pressed={selected === i}>{p.kind === 'bottle' ? 'QR bottle' : p.kind === 'nfc' ? 'NFC tag' : 'Key finder'}<span>0{i + 1}</span></button>)}</div>
    <div className="fb-product-story" aria-live="polite"><span>{products[selected].eyebrow}</span><h2>{products[selected].name}</h2><p>{products[selected].body}</p></div>
    <a className="fb-scroll-cue" href="#how">SCROLL TO DISCOVER ↓</a>
  </div>
}
