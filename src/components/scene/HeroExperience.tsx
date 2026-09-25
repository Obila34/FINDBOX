import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react'
import Balancer from 'react-wrap-balancer'
import { Group, Vector3 } from 'three'
import { Pause, Play, ArrowUpRight } from 'lucide-react'
import { ExperienceCanvas } from './ExperienceCanvas'
import { ProductModel, type ProductKind } from './ProductModels'
import { Button } from '@/components/ui/Button'

const products: { kind: ProductKind; name: string; eyebrow: string; body: string }[] = [
  { kind: 'bottle', name: 'Everyday. Never ordinary.', eyebrow: '01 / THE CLEAR BOTTLE', body: 'A favourite bottle. A tiny QR label. A simpler way back through your school.' },
  { kind: 'nfc', name: 'A little tap goes a long way.', eyebrow: '02 / THE NFC TAG', body: 'A tactile tag for the things you take everywhere. Register your NFC tag in FindBox.' },
  { kind: 'airtag', name: 'Keep your essentials close.', eyebrow: '03 / THE TRACKER', body: 'A keyring tracker for the essentials you carry. Connect its item record to your school’s return process.' },
]
function Orbit({ progress, paused, selected, onSelect }: { progress: MotionValue<number>; paused: boolean; selected: number; onSelect: (i: number) => void }) {
  const groups = useRef<(Group | null)[]>([]); const angle = useRef(0); const scaleTarget = useRef(new Vector3())
  useFrame((state, delta) => {
    if (!paused) angle.current += Math.min(delta, 0.04) * 0.13
    groups.current.forEach((g, i) => { if (!g) return; const a = angle.current + i * Math.PI * 2 / 3 + 1.6 + (paused ? 0 : progress.get() * 1.4)
      g.position.set(Math.cos(a) * 1.9, Math.sin(a) * -0.63, Math.sin(a) * 0.38)
      g.rotation.y = paused ? 0 : Math.sin(state.clock.elapsedTime * 0.35 + i) * 0.4 + state.pointer.x * 0.2
      g.rotation.z = paused ? 0 : Math.sin(a) * 0.12
      const scale = i === selected ? 1.12 : 0.83; g.scale.lerp(scaleTarget.current.setScalar(scale), 0.08)
    })
  })
  return <group>{products.map((p, i) => <group key={p.kind} ref={g => { groups.current[i] = g }} position={[(i - 1) * 1.7, 0, 0]} onClick={e => { e.stopPropagation(); onSelect(i) }} onPointerOver={() => { document.body.style.cursor = 'pointer' }} onPointerOut={() => { document.body.style.cursor = '' }}><ProductModel kind={p.kind} /></group>)}</group>
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
      <ExperienceCanvas moving={!paused && !reduced}><Orbit progress={scrollYProgress} paused={paused || !!reduced} selected={selected} onSelect={setSelected} /></ExperienceCanvas>
      <button className="fb-motion-control" onClick={() => setPaused(!paused)} aria-label={paused ? 'Resume object motion' : 'Pause object motion'}>{paused ? <Play size={15} /> : <Pause size={15} />} {paused || reduced ? 'Motion off' : 'Live 3D'}</button>
    </motion.div>
    <div className="fb-product-selector" role="group" aria-label="Explore connected objects">{products.map((p, i) => <button key={p.kind} onClick={() => setSelected(i)} aria-pressed={selected === i}>{p.kind === 'bottle' ? 'QR bottle' : p.kind === 'nfc' ? 'NFC tag' : 'Key finder'}<span>0{i + 1}</span></button>)}</div>
    <div className="fb-product-story" aria-live="polite"><span>{products[selected].eyebrow}</span><h2>{products[selected].name}</h2><p>{products[selected].body}</p></div>
    <a className="fb-scroll-cue" href="#how">SCROLL TO DISCOVER ↓</a>
  </div>
}
