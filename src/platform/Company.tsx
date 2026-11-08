import { useBackgroundRefresh } from '@/lib/useBackgroundRefresh'
import { CompanyConsole } from './CompanyConsole'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react'
import { api, ApiError } from './api'
import './company.css'
import { CompanyDashboard, type Overview, type Health } from './CompanyDashboard'
import { notify } from './feedback'

export function Company() {
  const [backgroundNotice,setBackgroundNotice]=useState('')
    const [securityInfo,setSecurityInfo]=useState(false)
  const [emailEnabled,setEmailEnabled]=useState(false),[emailChallenge,setEmailChallenge]=useState(false)
  const [deadline,setDeadline]=useState(0),[now,setNow]=useState(Date.now())
  useEffect(()=>{if(!emailChallenge)return;const timer=window.setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(timer)},[emailChallenge])
  const remaining=Math.max(0,Math.ceil((deadline-now)/1000))
  function emailTiming(r:{resendAt:string;serverNow:string}){setDeadline(Date.now()+Math.max(0,Date.parse(r.resendAt)-Date.parse(r.serverNow)));setNow(Date.now());setEmailChallenge(true);setChallenge(false)}
  const [access,setAccess]=useState<{role:string;name:string}|null>(null)
  const [overview,setOverview]=useState<Overview|null>(null)
  const [health,setHealth]=useState<Health|null>(null)
  const [daraja,setDaraja]=useState<{mode:string;configured:boolean;attempts:{id:string;amount_kes:number;phone_suffix:string;status:string;created_at:string}[]}|null>(null)
  const [requestKey,setRequestKey]=useState(()=>crypto.randomUUID())
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true)
  const [challenge,setChallenge]=useState(false),[setup,setSetup]=useState(false),[denied,setDenied]=useState(false)
  async function load() {
    setBusy(true);setError('')
    try {
      const options=await api<{emailCodeEnabled:boolean}>('/company/auth/options');setEmailEnabled(options.emailCodeEnabled)
      const a=await api<{role:string;name:string}>('/company/access');setAccess(a);setDenied(false);setSetup(false)
      const o=await api<Overview>('/company/overview');setOverview(o)
      if(a.role==='developer') {setHealth(await api<Health>('/company/health'));setDaraja(await api('/company/daraja'))}
    } catch(e) {
      setAccess(null);setOverview(null);setHealth(null);setDaraja(null)
      if(e instanceof ApiError && e.status===403){setDenied(true);setError(e.message)}
      else if(!(e instanceof ApiError && e.status===401))setError((e as Error).message)
    } finally {setBusy(false);setLoading(false)}
  }
  useEffect(()=>{ document.title='FindBox · Company workspace';const meta=document.createElement('meta');meta.name='robots';meta.content='noindex, nofollow';document.head.appendChild(meta);void load();return()=>{meta.remove()} },[])
  async function login(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();setBusy(true);setError('');setDenied(false)
    const f=new FormData(e.currentTarget)
    try {
      const r=await api<{requiresMfa?:boolean;mfaSetupRequired?:boolean;emailChallenge?:boolean;resendAt:string;serverNow:string}>(emailChallenge?'/company/auth/verify':challenge?'/account/mfa/challenge':emailEnabled?'/company/auth/start':'/auth/login',(challenge||emailChallenge)?{code:f.get('code')}:emailEnabled?{email:f.get('email'),password:f.get('password')}:{email:f.get('email'),password:f.get('password'),portal:'ops'})
      if(r.emailChallenge){emailTiming(r);return}
      if(r.mfaSetupRequired){setSetup(true);setChallenge(false)}
      else if(r.requiresMfa)setChallenge(true)
      else {setChallenge(false);setEmailChallenge(false);await load()}
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  async function resend(){setBusy(true);setError('');try{emailTiming(await api('/company/auth/resend',{}))}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  async function logout(){try{await api('/auth/logout',{});setAccess(null);setOverview(null);setHealth(null);setChallenge(false);setEmailChallenge(false);setSetup(false);setDenied(false)}catch(e){setError((e as Error).message)}}
  async function sandbox(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();setBusy(true);setError('');const f=new FormData(e.currentTarget)
    try {await api('/company/daraja/start',{phone:String(f.get('phone')),amount:Number(f.get('amount')),requestKey});setRequestKey(crypto.randomUUID());await load()}
    catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  async function query(attemptId:string){setBusy(true);setError('');try{await api('/company/daraja/query',{attemptId});await load()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  useBackgroundRefresh(async()=>{
    try{const next=await api<Overview>('/company/overview');const difference=JSON.stringify({...next,generatedAt:''})!==JSON.stringify({...overview,generatedAt:''});setOverview(next);if(access?.role==='developer')setHealth(await api<Health>('/company/health'));return difference}
    catch(e){if(e instanceof ApiError&&[401,403].includes(e.status)){setAccess(null);setOverview(null);setHealth(null)}throw e}
  },!!access,'company',()=>setBackgroundNotice('Company records updated in the background.'))
  useEffect(()=>{if(!backgroundNotice)return;notify(backgroundNotice,'info');setBackgroundNotice('')},[backgroundNotice])
  return <div className="co-root"><header className="co-header"><Link to="/" className="co-brand">FINDBOX <span>Company</span></Link><span><ShieldCheck size={16}/> Restricted workspace</span></header>
    {loading?<main className="co-login" role="status">Checking access…</main>:!access?<div className="co-signin-layout"><aside className="co-signin-story"><img src="/media/journey/collection-concept.webp" alt="Illustrative school collection point"/><div><p>THE PEOPLE BEHIND EVERY REUNION.</p><h2>A clearer view.<br/>A more connected FindBox.</h2><span>Business oversight. Thoughtful operations.</span></div></aside><main className="co-login"><div className="co-emblem"><LockKeyhole/></div><p className="co-eyebrow">FINDBOX OPERATIONS</p><h1>Your company workspace.</h1><p>Provisioned company administrators and developers only. {emailEnabled?'Sign in with your website password, then verify the six-digit code sent to your email.':'Two-factor authentication is required.'}</p>
      {error&&<p role="alert" className="co-error">{error}</p>}
      {setup?<div className="co-panel"><h2>Secure your account first</h2><p>Enroll an authenticator and save your recovery codes privately. Then return here.</p><Link className="co-button" to="/app/security">Set up two-factor authentication <ArrowRight size={16}/></Link><button disabled={busy} onClick={()=>void load()}>I’ve completed setup — check access</button></div>:<form onSubmit={login}>
      {emailChallenge?<><p role="status">{remaining>0?`Code expires in ${remaining} seconds.`:'Your code has expired. Request a new code.'}</p><label>Six-digit email code<input key={deadline} name="code" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="one-time-code" required/></label></>:challenge?<label>Authenticator or recovery code<input name="code" required autoComplete="one-time-code" maxLength={100}/></label>:<><label>Company email<input name="email" type="email" autoComplete="username" required maxLength={254}/></label><label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={128}/></label></>}
      <button className="co-button" disabled={busy || (emailChallenge && remaining===0)}>{busy?'Checking…':(challenge||emailChallenge)?'Verify and continue':emailEnabled?'Send sign-in code':'Sign in'} <ArrowRight size={16}/></button>
      {emailChallenge&&<button type="button" disabled={busy||remaining>0} onClick={()=>void resend()}>{remaining>0?`Resend available in ${remaining}s`:'Resend code'}</button>}
      {(challenge||emailChallenge)&&<button type="button" onClick={()=>{setChallenge(false);setEmailChallenge(false)}}>Use a different account</button>}</form>}
      {denied&&<Link to="/app/security">Manage two-factor authentication</Link>}<Link to="/">Back to FindBox</Link>
    </main></div>:<CompanyConsole access={access} onLogout={()=>void logout()}><CompanyDashboard role={access.role} name={access.name} overview={overview} health={health} busy={busy} onRefresh={()=>void load()} onLogout={()=>void logout()} security={emailEnabled?<button type="button" onClick={()=>setSecurityInfo(v=>!v)} aria-expanded={securityInfo}><ShieldCheck size={16}/> Security</button>:<Link to="/app/security"><ShieldCheck size={16}/> Security</Link>}>
    {error&&<p className="co-error" role="alert">{error}</p>}
    {securityInfo&&<section className="co-panel"><h2>Password + email verification</h2><p>Every sign-in requires your website password and a single-use six-digit email code. Codes expire after 60 seconds; resends are available after 60 seconds. Five incorrect attempts block that code. Company sessions expire after eight hours.</p></section>}
    {daraja&&<section className="co-panel"><h2>Daraja sandbox</h2><p>Test environment only. These attempts never affect sales, orders or tag stock. Use a Safaricom sandbox test number. Sign in within the last 10 minutes before starting a test.</p>{daraja.configured?<form className="co-sandbox" onSubmit={sandbox}><label>Test phone<input name="phone" type="tel" pattern="254[17][0-9]{8}" placeholder="2547XXXXXXXX" required/></label><label>Amount · KES<input name="amount" type="number" min={1} max={1000} defaultValue={1} required/></label><button className="co-button" disabled={busy}>Start sandbox test</button></form>:<p>Waiting for your sandbox consumer key, consumer secret, shortcode and passkey. Credentials are configured on the server, never in this page.</p>}{daraja.attempts.map(a=><div className="co-row" key={a.id}><span>{a.id.slice(0,8)} · KES {a.amount_kes} · phone ending {a.phone_suffix} · {a.status}</span><button disabled={busy} onClick={()=>void query(a.id)}>Check provider status</button></div>)}</section>}
    <p className="co-note">Company access is audited. Counts reflect recorded activity; password sign-ins are separate from two-factor completion.</p>
    </CompanyDashboard></CompanyConsole>}</div>
}
