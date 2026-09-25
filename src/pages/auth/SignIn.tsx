import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, GraduationCap, Users, BookOpen, ShieldCheck } from 'lucide-react'
import { AuthFrame } from './AuthFrame'
import { Input, PasswordInput } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { useStore } from '@/store/useStore'
import { homeFor } from '@/components/layout/guards'
import type { Role } from '@/domain/types'
const roles = [{ id: 'student', name: 'Student', icon: GraduationCap }, { id: 'parent', name: 'Parent', icon: Users }, { id: 'staff', name: 'Teacher', icon: BookOpen }, { id: 'manager', name: 'School admin', icon: ShieldCheck }] as const
export function SignIn() {
 const { accounts, people, signIn } = useStore(); const nav = useNavigate(); const location = useLocation()
 const [role, setRole] = useState<Role>('student'); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState('')
 function enter(id: string) { const p = people.find(p => p.id === id)!; signIn(id, { presenter: false }); const from = location.state?.from; nav(typeof from === 'string' && from.startsWith('/app/') && !['staff', 'manager'].includes(p.role) ? from : homeFor(p.role)) }
 function submit(e: FormEvent) { e.preventDefault(); setError('Online sign-in is not connected yet. Continue with a sample account below to use the frontend.') }
 return <AuthFrame title="Your world, connected." lede="One FindBox. The right tools for you." back={{ to: '/', label: 'Back to FindBox' }}><div className="fb-role-picker" role="group" aria-label="Your role">{roles.map(r => <button key={r.id} aria-pressed={role === r.id} onClick={() => { setRole(r.id); setError('') }}><r.icon size={20} />{r.name}</button>)}</div><form className="flex flex-col gap-4" onSubmit={submit}><Input label="Email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@school.org" required /><PasswordInput label="Password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />{error && <p className="fb-auth-status" role="alert">{error}</p>}<Button type="submit" full size="lg" arrow>Sign in</Button><div className="flex justify-between text-sm"><Link to="/app/forgot" className="fb-link">Forgot password?</Link><Link to="/app/sign-up" className="fb-link">Create account</Link></div></form><div className="fb-sample-accounts"><p>Continue with a sample account</p>{accounts.filter(a => people.find(p => p.id === a.personId)?.role === role).map(a => { const p = people.find(p => p.id === a.personId)!; return <button key={a.id} onClick={() => enter(p.id)}><Avatar person={p} size={38} /><span><strong>{p.name}</strong><small>{role === 'staff' ? 'Teacher · Lost property' : a.displayHint.replace(/demo/gi, '').replace(/preview/gi, '')}</small></span><ArrowRight size={17} /></button> })}</div></AuthFrame>
}
