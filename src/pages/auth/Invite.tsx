import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, KeyRound } from 'lucide-react'
import { AuthFrame } from './AuthFrame'
import { Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Note } from '@/components/ui/Tile'
import { useStore } from '@/store/useStore'
import { homeFor } from '@/components/layout/guards'
import { useSimulatedWork } from '@/lib/hooks'
import { ROLE_LABEL } from '@/domain/labels'

/** Staff and managers enter via a simulated school invitation, never through public sign-up. */
export function Invite() {
  const people = useStore((s) => s.people)
  const accounts = useStore((s) => s.accounts)
  const signIn = useStore((s) => s.signIn)
  const nav = useNavigate()
  const { busy, run } = useSimulatedWork()
  const [code, setCode] = useState('')
  const [err, setErr] = useState<string>()
  const schoolAccounts = accounts.filter((a) => ['staff', 'manager'].includes(people.find((p) => p.id === a.personId)?.role ?? ''))

  const enter = async (personId: string) => { await run(600); signIn(personId); nav(homeFor(people.find((p) => p.id === personId)!.role)) }
  const redeem = async (e: FormEvent) => {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (c === 'STAFF-2026') return enter('st-daniel')
    if (c === 'MANAGE-2026') return enter('m-grace')
    setErr('Invitation not recognised. Check the code provided by your school.')
  }

  return (
    <AuthFrame tone="school" title="School workspace" lede="Staff and management accounts are issued by the school." back={{ to: '/app/welcome', label: 'Welcome' }}>
      <div className="flex flex-col gap-2" aria-label="Preseeded school accounts">
        {schoolAccounts.map((a) => {
          const p = people.find((x) => x.id === a.personId)!
          return (
            <button key={a.id} type="button" disabled={busy} onClick={() => enter(p.id)} className="fb-tile fb-press flex items-center gap-3 p-3 text-left hover:bg-paper-2 disabled:opacity-60">
              <Avatar person={p} size={36} />
              <span className="min-w-0 flex-1"><span className="block truncate font-medium text-ink">{p.name}</span><span className="block truncate text-[0.78rem] text-ink-3">{ROLE_LABEL[p.role]} · {p.title}</span></span>
              <ArrowRight className="h-4 w-4 text-ink-4" aria-hidden="true" />
            </button>
          )
        })}
      </div>
      <div className="my-5 flex items-center gap-3 text-[0.75rem] uppercase tracking-wider text-ink-4"><span className="h-px flex-1 bg-line" />or redeem an invitation<span className="h-px flex-1 bg-line" /></div>
      <form onSubmit={redeem} noValidate className="flex flex-col gap-3">
        <Input label="Invitation code" value={code} onChange={(e) => { setCode(e.target.value); setErr(undefined) }} error={err} placeholder="STAFF-2026" autoCapitalize="characters" autoComplete="one-time-code" />
        <Button type="submit" variant="dark" full loading={busy} icon={<KeyRound className="h-4 w-4" />}>Redeem invitation</Button>
      </form>
      <Note tone="demo" className="mt-6">Your school manages invitations and permission to verify a collection.</Note>
    </AuthFrame>
  )
}
