import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowLeft, QrCode, Bell, ShieldCheck, Compass } from 'lucide-react'
import { AuthFrame } from './AuthFrame'
import { Button } from '@/components/ui/Button'
import { QuestToken } from '@/components/ui/QuestToken'
import { usePerson, useStore } from '@/store/useStore'
import { cx } from '@/lib/util'

export function Onboarding() {
  const person = usePerson()
  const complete = useStore((s) => s.completeOnboarding)
  const toast = useStore((s) => s.toast)
  const nav = useNavigate()
  const [i, setI] = useState(0)
  const [dir, setDir] = useState<'f' | 'b'>('f')
  if (!person) return null
  const student = person.role === 'student'
  const slides = [
    { icon: QrCode, title: 'Tag what matters', body: student ? 'Add a belonging with a photo. You get a QR tag to stick on it. The tag holds no personal details.' : 'Register each child’s belongings with a photo and a QR tag. Print or share the tag from the item page.' },
    { icon: Bell, title: 'Hear about it here', body: 'If something is reported lost and turns up, updates land in your inbox: found, ready to collect, returned.' },
    { icon: ShieldCheck, title: 'Staff verify every release', body: 'A match is confirmed by staff and ownership is checked at pickup. Look-alikes are never released on a photo alone.' },
    ...(student ? [{ icon: Compass, title: 'Daily streaks', body: 'Check your belongings and build a daily streak. Small habits help things stay where they belong.' }] : []),
  ]
  const last = i === slides.length - 1
  const S = slides[i]
  const finish = () => { complete(); if (student) toast({ title: 'Onboarding complete', body: 'Your account is ready. Start your first daily check-in.', tone: 'reward' }); nav('/app/home') }
  return (
    <AuthFrame title={`Hi ${person.firstName}`} lede={student ? 'Three quick things before your inventory.' : 'Three quick things before your dashboard.'}>
      <div key={i} className={cx('fb-tile p-6', dir === 'f' ? 'fb-slide-l' : 'fb-slide-r')}>
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-700">{S.icon === Compass ? <QuestToken kind="compass" earned size={44} /> : <S.icon className="h-7 w-7" />}</span>
          <h2 className="fb-display text-[1.5rem] leading-tight text-ink">{S.title}</h2>
        </div>
        <p className="mt-4 text-[0.95rem] text-ink-2">{S.body}</p>
      </div>
      <div className="mt-4 flex items-center justify-center gap-1.5" aria-label={`Step ${i + 1} of ${slides.length}`}>
        {slides.map((_, k) => <span key={k} className={cx('h-1.5 rounded-full transition-all duration-base', k === i ? 'w-6 bg-teal-700' : 'w-1.5 bg-line-strong')} />)}
      </div>
      <div className="mt-6 flex gap-2">
        {i > 0 && <Button variant="secondary" onClick={() => { setDir('b'); setI(i - 1) }} icon={<ArrowLeft className="h-4 w-4" />}>Back</Button>}
        <Button full onClick={() => (last ? finish() : (setDir('f'), setI(i + 1)))} iconRight={<ArrowRight className="h-4 w-4" />}>{last ? (student ? 'Open my inventory' : 'Open my dashboard') : 'Next'}</Button>
      </div>
      {!last && <button type="button" onClick={finish} className="mt-3 w-full text-center text-[0.82rem] text-ink-3 hover:text-ink">Skip</button>}
    </AuthFrame>
  )
}
