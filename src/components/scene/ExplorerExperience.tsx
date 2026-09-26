import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Hand } from 'lucide-react'
export function ExplorerExperience({ compact = false }: { personId?: string; compact?: boolean }) {
 const [hello, setHello] = useState(false)
 return <section className={`fb-explorer-panel fb-image-companion ${compact ? 'is-compact' : ''}`} aria-label="Your companion"><div className="fb-explorer-copy"><p className="fb-kicker">YOUR NEXT LITTLE ADVENTURE</p><h2>Good things<br />start with you.</h2><p>Tag a belonging. Help it home.<br />Make a little difference, every day.</p><Link to="/app/streaks" className="fb-black-link">{compact ? 'Meet your companion' : 'Build your daily streak'}<ArrowUpRight size={18} /></Link></div><div className={`fb-avatar-stage ${hello ? 'is-greeting' : ''}`}><span className="fb-avatar-halo" /><img className="fb-companion-image" src="/media/avatars/findbox-explorer-640.webp" srcSet="/media/avatars/findbox-explorer-640.webp 640w, /media/avatars/findbox-explorer-1280.webp 1280w" sizes="(max-width: 767px) 200px, 360px" alt="Maya, your friendly FindBox explorer" width={640} height={960} /><button className="fb-open-3d" aria-pressed={hello} onClick={() => setHello(h => !h)}><Hand size={14} />{hello ? 'You’ve got this!' : 'Say hello'}</button><span className="sr-only" role="status">{hello ? 'Maya says: A little care makes a big difference. Have a great day!' : ''}</span></div></section>
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
