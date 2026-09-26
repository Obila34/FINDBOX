import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, GraduationCap, ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { AuthFrame, DemoAccountNote } from './AuthFrame'
import { Input, PasswordInput, Select, Checkbox } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { useStore } from '@/store/useStore'
import { saveLocalCredential } from '@/lib/localAuth'
import { cx } from '@/lib/util'

type Role = 'parent' | 'student'
const STEPS = ['Who you are', 'Your details', 'Your school', 'Done']

/** Short multi-step sign-up with a step indicator and reversible back navigation. Local demo identity only. */
export function SignUp() {
  const nav = useNavigate()
  const school = useStore((s) => s.school)
  const createLocalAccount = useStore((s) => s.createLocalAccount)
  const accounts = useStore((s) => s.accounts)
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState<'f' | 'b'>('f')
  const [role, setRole] = useState<Role | null>(null)
  const [f, setF] = useState({ name: '', email: '', password: '', childName: '', classLabel: '5B', yearGroup: '5', consent: false })
  const [err, setErr] = useState<Record<string, string>>({})

  const go = (n: number) => { setDir(n > step ? 'f' : 'b'); setStep(n) }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (step === 0 && !role) e.role = 'Choose one to continue.'
    if (step === 1) {
      if (f.name.trim().length < 2) e.name = 'Enter a display name (a first name is fine).'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Enter an email-shaped address. It is only used as a local label.'
      else if (accounts.some((a) => a.email === f.email.trim().toLowerCase())) e.email = 'That email already has an account on this device. Sign in instead.'
      if (f.password.length < 6) e.password = 'Use at least 6 characters.'
    }
    if (step === 2) {
      if (role === 'parent' && f.childName.trim().length < 2) e.childName = "Enter your child's first name or a nickname."
      if (!f.consent) e.consent = 'Please confirm that you are authorised to set up this account.'
    }
    setErr(e)
    return !Object.keys(e).length
  }

  const next = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    if (step < 2) { go(step + 1); return }
    setBusy(true)
    try {
    await saveLocalCredential(f.email, f.password)
    createLocalAccount({ role: role!, name: f.name, email: f.email, childName: role === 'parent' ? f.childName : undefined, classLabel: f.classLabel, yearGroup: Number(f.yearGroup) })
    go(3)
    } catch { setErr({ consent: 'Your account could not be saved. Check device storage and try again.' }) }
    finally { setBusy(false) }
  }

  const students = school.studentAccountsEnabled

  return (
    <AuthFrame title="Create account" lede="Four short steps. Reversible at any point." back={step === 0 ? { to: '/app/welcome', label: 'Welcome' } : undefined}>
      <ol className="mb-6 flex items-center gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 flex-col gap-1.5">
            <span className={cx('h-1 rounded-full transition-colors duration-base', i <= step ? 'bg-teal-600' : 'bg-line')} />
            <span className={cx('text-[0.68rem] font-medium', i === step ? 'text-teal-800' : 'text-ink-4')} aria-current={i === step ? 'step' : undefined}>{s}</span>
          </li>
        ))}
      </ol>

      <form onSubmit={next} noValidate>
        <div key={step} className={dir === 'f' ? 'fb-slide-l' : 'fb-slide-r'}>
          {step === 0 && (
            <fieldset>
              <legend className="mb-3 text-[0.9rem] font-medium text-ink-2">I am a…</legend>
              <div className="grid gap-2">
                {([['parent', 'Parent or guardian', 'Manage a child’s belongings and claims', Users], ['student', 'Student', students ? 'Manage my own belongings; school has enabled student access' : 'Student accounts are not enabled at this school', GraduationCap]] as const).map(([v, t, h, Icon]) => (
                  <button key={v} type="button" disabled={v === 'student' && !students} onClick={() => setRole(v)} aria-pressed={role === v}
                    className={cx('fb-tile fb-press flex items-center gap-3 p-4 text-left disabled:opacity-50', role === v && '!border-teal-500 !bg-teal-50')}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-paper-2 text-teal-700"><Icon className="h-5 w-5" /></span>
                    <span><span className="block font-medium text-ink">{t}</span><span className="block text-[0.8rem] text-ink-3">{h}</span></span>
                  </button>
                ))}
              </div>
              {err.role && <p role="alert" className="mt-2 text-[0.8rem] font-medium text-status-danger">{err.role}</p>}
              <p className="mt-3 text-[0.78rem] text-ink-3">School staff and managers join by invitation, not here.</p>
            </fieldset>
          )}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <Input label="Display name" name="name" autoComplete="name" value={f.name} onChange={set('name')} error={err.name} placeholder={role === 'parent' ? 'e.g. Amina' : 'e.g. Zuri'} required />
              <Input label="Email" type="email" name="email" autoComplete="email" inputMode="email" value={f.email} onChange={set('email')} error={err.email} hint="Use this email to sign in on this device." required />
              <PasswordInput label="Password" name="new-password" autoComplete="new-password" value={f.password} onChange={set('password')} error={err.password} hint="Use at least 6 characters. This account is saved on this device." required />
            </div>
          )}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div className="fb-tile p-3 text-[0.85rem]"><p className="text-ink-3">School</p><p className="font-medium text-ink">{school.name}, {school.town}</p><p className="mt-1 text-[0.75rem] text-ink-4">Add your school and family details to organise your belongings.</p></div>
              {role === 'parent' && <Input label="Child's first name" value={f.childName} onChange={set('childName')} error={err.childName} placeholder="e.g. Sam" hint="Use a sample name while setting up this frontend." required />}
              <div className="grid grid-cols-2 gap-3">
                <Select label="Year group" value={f.yearGroup} onChange={set('yearGroup')} options={[1, 2, 3, 4, 5, 6, 7, 8].map((y) => ({ value: String(y), label: `Year ${y}` }))} />
                <Input label="Class" value={f.classLabel} onChange={set('classLabel')} placeholder="5B" />
              </div>
              <Checkbox label="I am authorised to set up this account" hint="Your account details are saved on this device." checked={f.consent} onChange={set('consent')} />
              {err.consent && <p role="alert" className="-mt-2 text-[0.8rem] font-medium text-status-danger">{err.consent}</p>}
            </div>
          )}
          {step === 3 && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <span className="fb-settle flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f3ec] text-status-done"><Check className="h-8 w-8" /></span>
              <h2 className="fb-display text-2xl text-ink">Account created</h2>
              <p className="max-w-xs text-[0.9rem] text-ink-3">A quick onboarding sets up your first belonging{role === 'student' ? ' and your daily streak' : ''}.</p>
              <Button size="lg" full onClick={() => nav('/app/onboarding')} iconRight={<ArrowRight className="h-4 w-4" />}>Continue</Button>
            </div>
          )}
        </div>

        {step < 3 && (
          <div className="mt-6 flex gap-2">
            {step > 0 && <Button type="button" variant="secondary" onClick={() => go(step - 1)} icon={<ArrowLeft className="h-4 w-4" />}>Back</Button>}
            <Button type="submit" full loading={busy} iconRight={<ArrowRight className="h-4 w-4" />}>{step === 2 ? 'Create account' : 'Continue'}</Button>
          </div>
        )}
      </form>
      {step < 3 && <DemoAccountNote className="mt-6" />}
    </AuthFrame>
  )
}
