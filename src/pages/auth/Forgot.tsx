import { useState, type FormEvent } from 'react'
import { MailCheck } from 'lucide-react'
import { AuthFrame } from './AuthFrame'
import { Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Note } from '@/components/ui/Tile'
import { useSimulatedWork } from '@/lib/hooks'

/** Preview of the reset flow. No email is sent; the UI says so plainly. */
export function Forgot() {
  const [email, setEmail] = useState('')
  const [err, setErr] = useState<string>()
  const [sent, setSent] = useState(false)
  const { busy, run } = useSimulatedWork()
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr('Enter an email address.'); return }
    setErr(undefined); await run(600); setSent(true)
  }
  return (
    <AuthFrame title="Forgot password" lede="Recover access to your FindBox account." back={{ to: '/app/sign-in', label: 'Sign in' }}>
      {sent ? (
        <div className="fb-fade flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-700"><MailCheck className="h-7 w-7" /></span>
          <p className="font-medium text-ink">Email recovery is not connected yet</p>
          <p className="text-[0.9rem] text-ink-3">Use one of the sample accounts on the sign-in screen to continue. No recovery email has been sent.</p>
          <Button to="/app/sign-in" full>Back to sign in</Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Input label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={err} required />
          <Button type="submit" full loading={busy}>Request reset link</Button>
          <Note tone="demo">Enter the email associated with your account.</Note>
        </form>
      )}
    </AuthFrame>
  )
}
