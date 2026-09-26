import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useReducedMotion } from 'motion/react'
import { OrbitControls } from '@react-three/drei'
import { ArrowUpRight, Hand, Pause, Play } from 'lucide-react'
import { ExperienceCanvas } from './ExperienceCanvas'
import { Explorer } from './ProductModels'

const explorers = ['Maya · Good-day energy', 'Noah · Everyday explorer']
export function ExplorerExperience({ personId = 'preview', compact = false }: { personId?: string; compact?: boolean }) {
  const key = `findbox.explorer.${personId}`
  const [variant, setVariant] = useState(() => { try { const n = Number(localStorage.getItem(key)); return n >= 0 && n <= 1 ? n : 0 } catch { return 0 } })
  const [wave, setWave] = useState(0); const [paused, setPaused] = useState(false); const reduced = useReducedMotion()
  function select(i: number) { setVariant(i); try { localStorage.setItem(key, String(i)) } catch { /* Selection remains available in memory. */ } }
  return <section className={`fb-explorer-panel ${compact ? 'is-compact' : ''}`} aria-label="Your companion">
    <div className="fb-explorer-copy"><p className="fb-kicker">YOUR NEXT LITTLE ADVENTURE</p><h2>Good things<br />start with you.</h2><p>Tag a belonging. Help it home.<br />Make a little difference, every day.</p><Link to={'/app/streaks'} className="fb-black-link">{compact ? 'Meet your companion' : 'Build your daily streak'} <ArrowUpRight size={18} /></Link></div>
    <div className="fb-avatar-stage"><span className="fb-avatar-halo" /><ExperienceCanvas moving={!paused && !reduced}><group scale={1.05} position={[0,-.1,0]}><Explorer variant={variant} wave={wave} moving={!paused && !reduced} /></group><OrbitControls enableZoom={false} enablePan={false} minPolarAngle={1.2} maxPolarAngle={1.8} /></ExperienceCanvas><span className="fb-avatar-name">{explorers[variant]}</span></div>
    {!compact && <div className="fb-avatar-controls"><div role="group" aria-label="Choose your companion">{explorers.map((name, i) => <button key={name} aria-label={name} aria-pressed={variant === i} onClick={() => select(i)} style={{ background: ['#0d6166', '#53402d'][i] }} />)}</div><button onClick={() => setWave(w => w ? 0 : 1)} aria-pressed={!!wave}><Hand size={16} /> {wave ? 'Relax pose' : 'Say hello'}</button><button onClick={() => setPaused(p => !p)} aria-label={paused ? 'Resume explorer motion' : 'Pause explorer motion'}>{paused ? <Play size={16} /> : <Pause size={16} />}</button><span>Drag to look around</span></div>}
  </section>
}

const challenges = [
  { question: 'You find a bottle in the playground. What happens next?', answers: ['Keep it until someone asks', 'Scan its tag and hand it to staff', 'Post the owner’s details online'], correct: 1, explanation: 'Exactly. Scan the tag, then hand the bottle to the Lost Property Office for a verified return.' },
  { question: 'Your QR label is getting hard to read. What should you do?', answers: ['Refresh the label in FindBox', 'Wait until the item gets lost', 'Use a friend’s QR label'], correct: 0, explanation: 'A fresh label keeps the belonging connected to the right record.' },
  { question: 'Who confirms a safe handover?', answers: ['Anyone who recognises the colour', 'The person with the most points', 'School staff, after checking ownership'], correct: 2, explanation: 'School staff check ownership and record the handover. That is when eligible return points are awarded.' },
]
export function ExplorerPractice() {
  const [step, setStep] = useState(0); const [answer, setAnswer] = useState<number | null>(null); const [score, setScore] = useState(0)
  const challenge = challenges[step]; const finished = step === challenges.length
  return <section className="fb-practice"><div className="fb-practice-top"><span className="fb-kicker">EXPLORER TRAINING</span><span>{finished ? 'Complete' : `${step + 1} / ${challenges.length}`}</span></div>
    <h2>{finished ? `Ready for the real adventure. ${score}/${challenges.length}` : challenge.question}</h2>
    {finished ? <button className="fb-black-link" onClick={() => { setStep(0); setScore(0); setAnswer(null) }}>Play again ↗</button> : <><div className="fb-practice-options">{challenge.answers.map((text, i) => <button key={text} disabled={answer !== null} className={answer !== null && i === challenge.correct ? 'is-correct' : answer === i ? 'is-incorrect' : ''} onClick={() => { setAnswer(i); if (i === challenge.correct) setScore(s => s + 1) }}><span>0{i + 1}</span>{text}</button>)}</div>{answer !== null && <div className="fb-practice-result" role="status"><p>{answer === challenge.correct ? challenge.explanation : `Good practice. ${challenge.explanation.replace('Exactly. ', '')}`}</p><button className="fb-black-link" onClick={() => { setStep(s => s + 1); setAnswer(null) }}>{step === 2 ? 'Finish training' : 'Next challenge'} ↗</button></div>}</>}
    <p className="fb-practice-note">Practice only. Build your daily rhythm with a check-in.</p>
  </section>
}
