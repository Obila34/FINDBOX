import { motion, useReducedMotion } from 'motion/react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { useState } from 'react'
import { ProductViewer } from '@/components/scene/ProductViewer'
export function UltraQualityShowcaseGrid() {
  const reduced = useReducedMotion(); const [step, setStep] = useState(0)
  const steps = [
    { title: 'Give it a way home.', body: 'Add a photo, name your belonging, and connect a unique QR or NFC tag. Your personal details stay off the label.', cta: 'Tag a belonging', to: '/app/register' },
    { title: 'A small scan. A big relief.', body: 'Found something? Scan the tag or tell the school office where you found it. The right people take it from there.', cta: 'Report a find', to: '/app/found' },
    { title: 'Follow every little update.', body: 'See when staff identify a match, verify ownership, and prepare your belonging for collection.', cta: 'Open your inbox', to: '/app/inbox' },
    { title: 'Back where it belongs.', body: 'Collect at the school office. Staff record the handover, so every return has a clear, complete history.', cta: 'Open FindBox', to: '/app/sign-in' },
  ]
  return <section id="how" className="fb-showcase-grid-section fb-container"><div className="fb-showcase-grid-heading"><p className="fb-kicker">01 / LITTLE STEPS. HAPPY REUNIONS.</p><h2>Less lost.<br /><em>More living.</em></h2><p>One simple system for everything that goes to school.<br />Here’s how the little things find their way back.</p></div>
    <div className="fb-how-bento"><motion.article className="fb-how-main" initial={reduced ? false : { opacity: 0, y: 35 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}><div className="fb-how-art"><span className="fb-how-badge">CONNECTED BY FINDBOX</span><ProductViewer /><span className="fb-how-orbit-caption">YOURS. ALWAYS.</span></div><div className="fb-how-card-copy"><div className="fb-step-tabs" role="group" aria-label="How FindBox works">{steps.map((s, i) => <button key={s.title} aria-label={`Step ${i + 1}: ${s.title}`} aria-pressed={step === i} onClick={() => setStep(i)}>0{i + 1}</button>)}</div><div aria-live="polite"><h3>{steps[step].title}</h3><p>{steps[step].body}</p><Link to={steps[step].to}>{steps[step].cta}<ArrowUpRight size={18} /></Link></div></div></motion.article>
      <motion.article className="fb-how-photo" initial={reduced ? false : { opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}><img src="/media/classroom.jpg" alt="Children learning together in a bright classroom" loading="lazy" /><div><span>FOR YOUR WHOLE SCHOOL</span><h3>Everyone connected.<br />Every return cared for.</h3><Link to="/app/sign-in">Find your place <ArrowUpRight size={18} /></Link></div></motion.article>
      <motion.article className="fb-how-streak" initial={reduced ? false : { opacity: 0, y: 45 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}><img src="/media/products/explorer-4k.png" alt="Your FindBox companion" loading="lazy" /><div><span>SMALL HABITS. BIG DIFFERENCE.</span><h3>Keep your<br />good-day streak.</h3><p>A little daily care goes a long way.</p><Link to="/app/streaks">Find your rhythm <ArrowUpRight size={18} /></Link></div></motion.article>
    </div>
  </section>
}
