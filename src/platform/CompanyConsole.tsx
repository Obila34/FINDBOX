import {OperationsPanel} from './OperationsPanel'

import {SchoolAccessConsole} from './SchoolWorkspace'

import { Fragment,useEffect,useRef,useState,type ReactNode,type FormEvent } from 'react'

import { LayoutDashboard,Users,FileText,ShoppingBag,School,MessageSquare,Bell,Settings,Code2,Package,Mail,History,Search,Plus,Download,LoaderCircle,X,Check,ChevronLeft,ChevronRight,LogOut,RefreshCw,ShieldCheck } from 'lucide-react'

import { api,ApiError,money } from './api'

import './console.css'
import { useToastMessage } from './feedback'

type Row=Record<string,any>

const adminTabs=[['orders','Orders',ShoppingBag,'SALES'],['invoices','Invoices',FileText,'SALES'],['ledger','Balances & credits',FileText,'SALES'],['clients','Clients',Users,'PEOPLE'],['support','Support inbox',MessageSquare,'PEOPLE'],['announcements','Announcements',Bell,'PEOPLE'],['users','Accounts & access',ShieldCheck,'PEOPLE'],['schools','Schools',School,'SCHOOLS'],['reports','School reports',School,'SCHOOLS'],['settings','Business profile',Settings,'BUSINESS']] as const

const developerTabs=[['schools','Schools',School,'SCHOOLS'],['users','Users & accounts',Users,'ACCOUNTS'],['items','Items & labels',Package,'ACCOUNTS'],['mail','Mail delivery',Mail,'SYSTEM'],['privacy','Privacy requests',ShieldCheck,'SYSTEM']] as const

const labels:Record<string,string>={clients:'Clients',invoices:'Invoices',orders:'Orders',schools:'Schools',support:'Support inbox',announcements:'Announcements',settings:'Business profile',users:'Users & accounts',items:'Items & labels',mail:'Mail delivery',audit:'Audit history'}

export function CompanyConsole({access,children,onLogout}:{access:{role:string;name:string};children:ReactNode;onLogout:()=>void}){

 const [tab,setTab]=useState('overview'),[search,setSearch]=useState(''),[q,setQ]=useState(''),[page,setPage]=useState(0),[rows,setRows]=useState<Row[]>([]),[more,setMore]=useState(false),[profile,setProfile]=useState<Row|null>(null),[clients,setClients]=useState<Row[]>([]),[schools,setSchools]=useState<Row[]>([])

 const [form,setForm]=useState<{kind:string;row:Row}|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[download,setDownload]=useState<string|null>(null),[joinCode,setJoinCode]=useState('')

 const [lines,setLines]=useState([{description:'',quantity:'1',price:''}]),[requestKey,setRequestKey]=useState(()=>crypto.randomUUID())

 const snapshot=useRef('')
 const [rowsView,setRowsView]=useState('')
 const visibleRows=rowsView===tab+'|'+q+'|'+page?rows:[]

 const isAdmin=access.role==='admin',tabs=isAdmin?adminTabs:developerTabs

 useEffect(()=>{if(!form&&!joinCode)return;const previous=document.activeElement as HTMLElement|null;const old=document.body.style.overflow;document.body.style.overflow='hidden';const panel=document.querySelector<HTMLElement>('.cx-modal [role="dialog"]');const controls=()=>Array.from(panel?.querySelectorAll<HTMLElement>('button:not([disabled]),input,textarea,select,a[href]')||[]).filter(el=>!el.matches(':disabled'));controls()[0]?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy){setForm(null);setJoinCode('');window.dispatchEvent(new Event('findbox-form-saved'))}if(e.key==='Tab'){const list=controls(),first=list[0],last=list[list.length-1];if(!list.length){e.preventDefault();return}if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}};document.addEventListener('keydown',key);return()=>{document.body.style.overflow=old;document.removeEventListener('keydown',key);previous?.focus()}},[form,joinCode,busy])

 useEffect(()=>{const t=setTimeout(()=>{setQ(search);setPage(0)},300);return()=>clearTimeout(t)},[search])

 useToastMessage(message,setMessage)

 // Dashboard cards jump straight to the section that needs attention.
 useEffect(()=>{const go=(e:Event)=>{const {tab:next,form:kind}=(e as CustomEvent<{tab:string;form?:string}>).detail;setTab(next);setPage(0);setSearch('');setError('');if(kind)open(kind)};window.addEventListener('findbox-console-tab',go);return()=>window.removeEventListener('findbox-console-tab',go)},[])

 const viewRef=useRef(''),loadEpoch=useRef(0);viewRef.current=tab+'|'+q+'|'+page
 async function load(background=false){
  const view=tab+'|'+q+'|'+page;if(tab==='overview'||view!==viewRef.current)return
  const epoch=++loadEpoch.current,current=()=>epoch===loadEpoch.current&&view===viewRef.current
  setLoading(!background)
  try{
   const custom=['announcements','settings','ledger','reports','privacy'].includes(tab)
   const [p,result,options]=await Promise.all([api<Row>('/company/profile'),custom?Promise.resolve(null):api<{rows:Row[];hasMore:boolean}>(`/company/records/${tab}?q=${encodeURIComponent(q)}&page=${page}`),isAdmin?Promise.all([api<{rows:Row[]}>('/company/records/clients'),api<{rows:Row[]}>('/company/records/schools')]):Promise.resolve(null)])
   if(!current())return
   setProfile(p)
   if(result){const next=JSON.stringify(result.rows);if(background&&next!==snapshot.current)setMessage('Workspace records updated in the background.');snapshot.current=next;setRows(result.rows);setRowsView(view);setMore(result.hasMore)}
   if(options){setClients(options[0].rows);setSchools(options[1].rows)}
   setError('')
  }catch(e){if(current()){if(e instanceof ApiError&&[401,403].includes(e.status)){setRows([]);setProfile(null)};setError((e as Error).message)}}finally{if(current())setLoading(false)}
 }
 useEffect(()=>{setRows([]);void load()},[tab,q,page])

 useEffect(()=>{const t=setInterval(()=>{if(!document.hidden&&!form&&!['overview','settings','announcements'].includes(tab))void load(true)},30000);return()=>clearInterval(t)},[tab,q,page,form])

 function open(kind:string,row:Row={}){setError('');setMessage('');setForm({kind,row});setLines([{description:'',quantity:'1',price:''}]);setRequestKey(crypto.randomUUID())}

 async function act(path:string,body:unknown){setBusy(true);setError('');try{const r=await api<Row>(path,body);setForm(null);window.dispatchEvent(new Event('findbox-form-saved'));if(r.joinCode)setJoinCode(r.joinCode);setMessage(r.alreadyCreated?'This school already exists. Rotate its join code if you need a new one.':r.queued?'Email queued. Delivery status will update after processing.':'Saved. The change has been recorded in the audit history.');await load();return r}catch(e){setError((e as Error).message);return null}finally{setBusy(false)}}

 async function viewAudit(row:Row){try{open('audit',await api<Row>('/company/audit/'+row.id))}catch(e){setError((e as Error).message)}}

 async function editDraft(row:Row){setError('');try{const inv=await api<Row>('/company/invoices/'+row.id);open('invoice-edit',inv);setLines(inv.lines.map((l:Row)=>({description:l.description,quantity:String(l.quantity),price:(l.unitMinor/100).toFixed(2)})))}catch(e){setError((e as Error).message)}}

 async function pdf(row:Row){setDownload(row.id);setError('');try{const [r]=await Promise.all([fetch('/api/company/invoices/'+encodeURIComponent(row.id)+'/pdf',{credentials:'same-origin',cache:'no-store'}),new Promise<void>(resolve=>setTimeout(resolve,650))]);if(!r.ok)throw new Error((await r.json()).error||'Could not prepare invoice');const blob=await r.blob();const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(row.number||'FindBox-draft-'+row.id.slice(0,8))+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);setMessage('Invoice PDF downloaded.')}catch(e){setError((e as Error).message)}finally{setDownload(null)}}

 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!form)return;const f=Object.fromEntries(new FormData(e.currentTarget)),r=form.row,reason=String(f.reason),revision=r.revision;

  if(['invoice','invoice-edit'].includes(form.kind)){const converted=lines.map(l=>({description:l.description,quantity:Number(l.quantity),unitMinor:Math.round(Number(l.price)*100)}));if(form.kind==='invoice')await act('/company/invoices',{clientId:f.clientId,requestKey,dueDate:f.dueDate,billingName:f.billingName,billingAddress:f.billingAddress,notes:f.notes,lines:converted,reason});else await act('/company/invoices/'+r.id+'/edit',{revision,reason,dueDate:f.dueDate,billingName:f.billingName,billingAddress:f.billingAddress,notes:f.notes,lines:converted});}

  else if(form.kind==='invite')await act('/company/clients',{name:f.name,email:f.email,reason});

  else if(form.kind==='reset')await act('/company/users/'+r.id+'/reset',{reason});

  else if(form.kind==='users')await act('/company/users/'+r.id,{revision,reason,name:f.name,email:f.email,disabled:f.disabled==='on'});

  else if(form.kind==='transfer')await act('/company/items/'+r.id+'/transfer',{newOwnerEmail:f.newOwnerEmail,reason});
  else if(form.kind==='items')await act('/company/items/'+r.id,{revision,reason,name:f.name,category:f.category,color:f.color,private_note:f.private_note});

  else if(form.kind==='school-new'){const created=await act('/company/schools',{requestKey,name:f.name,box:f.box||'Reception',directions:f.directions||'Main school office',hours:f.hours||'Mon–Fri 8am–4pm',reason});if(created?.id&&!created.alreadyCreated&&f.adminEmail){try{await api('/company/school-access/invite',{schoolId:created.id,name:String(f.adminName||f.adminEmail),email:f.adminEmail,reason});setMessage(`${f.name} created. ${f.adminEmail} has been invited to set it up.`)}catch(err){setError(`${f.name} was created, but the invitation could not be sent: ${(err as Error).message} Send it from School access.`)}}}

  else if(form.kind==='schools')await act('/company/schools/'+r.id,{revision,reason,name:f.name,collectionDays:Number(f.collectionDays)});

  else if(form.kind==='code')await act('/company/schools/'+r.id+'/code',{reason,revision});

  else if(form.kind==='fulfill')await act('/company/orders/'+r.id+'/fulfill',{reason});

  else if(form.kind==='sessions')await act('/company/users/'+r.id+'/sessions',{reason});

  else if(form.kind==='mail')await act('/company/mail/'+r.id+'/retry',{reason});

  else if(form.kind==='support')await act('/company/support/'+r.id,{reason,status:f.status,reply:f.reply});

  else if(form.kind==='membership')await act('/company/membership',{reason,userId:r.id,schoolId:f.schoolId,role:f.role});

  else if(form.kind==='announcement')await act('/company/announcements',{requestKey,reason,title:f.title,message:f.message,audience:f.audience,schoolId:f.schoolId||null,days:Number(f.days)});

  else if(form.kind==='profile')await act('/company/profile',{revision:profile?.revision,reason,profile:{legalName:f.legalName,address:f.address,email:f.email,pin:f.pin,vatRegistered:f.vatRegistered==='on',issuerConfirmed:f.issuerConfirmed==='on'}});

  else if(['issue','send','void'].includes(form.kind))await act('/company/invoices/'+r.id+'/action',{revision,reason,action:form.kind});

 }

 const field=(name:string,label:string,value:any='',type='text',required=true)=><label key={name}>{label}<input name={name} type={type} defaultValue={value??''} required={required} maxLength={name==='email'?254:500}/></label>

 // Only actions that are hard to undo or affect someone's access ask for a written reason.
 const risky=['void','issue','sessions','code','users','transfer','membership','reset','mail']
 const routineReason=`Routine ${access.role==='admin'?'company':'developer'} update by ${access.name}`
 const reason=<><label>Reason for this action<textarea name="reason" required minLength={8} maxLength={500} placeholder="Describe what is changing and why."/></label><label className="cx-check"><input type="checkbox" required/> I have reviewed this action and its effect.</label></>

 function summary(r:Row){if(tab==='invoices')return [r.number||'Draft '+r.id.slice(0,8),r.customer?.name,money(r.total_minor),r.status];if(tab==='orders')return [r.id.slice(0,8),r.customer,money(r.amount_minor),r.status];if(tab==='audit')return [r.action,r.actor,r.reason,new Date(r.created_at).toLocaleString('en-KE')];if(tab==='mail')return [r.subject,r.sent_at?'Accepted by mail provider':r.attempts>=8?'Retries exhausted':'Queued',r.attempts+' attempts'];if(tab==='support')return [r.subject,r.name,r.status];if(tab==='schools')return [r.name,r.collection_days+' collection days'];if(tab==='items')return [r.name,r.category,r.school,r.status];return [r.name,r.email,r.disabled_at?'Disabled':r.verified?'Verified':'Unverified',r.role||'Client',...(r.last_sign_in?['Sign-in activity: '+new Date(r.last_sign_in).toLocaleString('en-KE')]:[])]}

 return <div className="cx-layout"><aside className="cx-sidebar"><div className="cx-workspace"><span><ShieldCheck size={22}/></span><strong>{isAdmin?'Company admin':'Developer studio'}</strong><small>{access.name}</small></div><button className={tab==='overview'?'active':''} onClick={()=>{setTab('overview');setPage(0)}}><LayoutDashboard size={18}/> Overview</button>{tabs.map(([id,label,Icon,group],i)=><Fragment key={id}>{(i===0||tabs[i-1][3]!==group)&&<p>{group}</p>}<button className={tab===id?'active':''} onClick={()=>{setTab(id);setPage(0);setSearch('');setError('');setMessage('')}}><Icon size={18}/>{label}</button></Fragment>)}<p>ACCOUNTABILITY</p><button className={tab==='audit'?'active':''} onClick={()=>{setTab('audit');setPage(0);setSearch('')}}><History size={18}/> Audit history</button><a href="/company"><Code2 size={18}/> Switch account</a><button onClick={onLogout}><LogOut size={18}/> Log out</button><div className="cx-sidebar-note">Every change has an owner.<br/>Sensitive actions require a recent sign-in.</div></aside>

 <div className="cx-content">{tab==='overview'?<>{children}</>:<div className="cx-section"><header className="cx-section-header"><div><p className="co-eyebrow">{isAdmin?'FINDBOX OPERATIONS':'DEVELOPER WORKSPACE'}</p><h1>{labels[tab]}</h1><p>{tab==='invoices'?'Branded PDFs, clear records and deliberate delivery.':tab==='users'?'Correct accounts without exposing passwords or bypassing verification.':'Search records, inspect details and take accountable action.'}</p></div><button onClick={()=>void load()} disabled={loading}><RefreshCw size={17}/> Refresh</button></header>

 {['ledger','privacy','reports'].includes(tab)?<OperationsPanel kind={tab as 'ledger'|'privacy'|'reports'}/>:tab==='settings'?<section className="co-panel"><h2>Business identity</h2><p>{profile?.data?.legalName}</p><p>{profile?.data?.email}</p><p>{profile?.data?.address||'Billing address pending'}</p><p>{profile?.data?.issuerConfirmed?'Issuing details confirmed':'Draft/pro forma invoices only until billing details are confirmed.'}</p><button className="co-button" onClick={()=>open('profile',profile?.data||{})}>Edit business profile</button></section>:tab==='announcements'?<section className="cx-banner"><div><p className="co-eyebrow">KEEP EVERYONE INFORMED</p><h2>A clear update goes a long way.</h2><p>Publish an in-app notification for everyone, your company team or a single school. Messages expire automatically.</p><button className="co-button" onClick={()=>open('announcement')}>Create announcement <Plus size={17}/></button></div><img src="/media/brand-v2/role-parent.webp" alt=""/></section>:<><div className="cx-toolbar"><label><Search size={17}/><input aria-label="Search workspace records" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search this section…"/></label>{tab==='clients'&&<button className="co-button" onClick={()=>open('invite')}>Invite client <Plus size={16}/></button>}{tab==='invoices'&&<button className="co-button" onClick={()=>open('invoice')}>New invoice <Plus size={16}/></button>}{tab==='schools'&&!isAdmin&&<button className="co-button" onClick={()=>open('school-new')}>Onboard school <Plus size={16}/></button>}</div>{loading?<p role="status">Loading records…</p>:<div className="cx-records">{visibleRows.map(r=><article className="cx-record" key={r.id}><div className="cx-record-icon">{tab==='invoices'?<FileText/>:tab==='schools'?<School/>:tab==='items'?<Package/>:tab==='mail'?<Mail/>:<Users/>}</div><div className="cx-record-data">{summary(r).map((v,i)=>i===0?<h2 key={i}>{String(v??'')}</h2>:<span key={i}>{String(v??'')}</span>)}</div><div className="cx-record-actions">

 {tab==='clients'&&<><button onClick={()=>open('invoice',r)}>Create invoice</button>{!isAdmin&&<button onClick={()=>open('membership',r)}>School access</button>}</>}

 {tab==='users'&&!isAdmin&&!r.company_account&&<><button onClick={()=>open('users',r)}>Edit account</button><button onClick={()=>open('sessions',r)}>Revoke sessions</button><button onClick={()=>open('reset',r)}>Password reset</button></>}{tab==='users'&&!isAdmin&&!r.company_account&&r.role!=='student'&&<button onClick={()=>open('membership',r)}>School access</button>}{tab==='users'&&r.company_account&&<small>Protected operator</small>}

 {tab==='audit'&&<button onClick={()=>void viewAudit(r)}>View changes</button>}

 {tab==='items'&&<><button onClick={()=>open('items',r)}>Edit item</button><button onClick={()=>open('transfer',r)}>Request ownership transfer</button></>}

 {tab==='schools'&&!isAdmin&&<><button onClick={()=>open('schools',r)}>Edit school</button><button onClick={()=>open('code',r)}>Rotate join code</button></>}

 {tab==='orders'&&r.status==='paid'&&<button onClick={()=>open('fulfill',r)}>Fulfil order</button>}

 {tab==='support'&&<button onClick={()=>open('support',r)}>Review & reply</button>}

 {tab==='mail'&&!r.sent_at&&r.attempts>=8&&<button onClick={()=>open('mail',r)}>Retry delivery</button>}

 {tab==='invoices'&&<><button disabled={!!download} onClick={()=>void pdf(r)}>{download===r.id?<LoaderCircle className="cx-spin" size={16}/>:<Download size={16}/>} PDF</button>{r.status==='draft'&&<button onClick={()=>void editDraft(r)}>Edit draft</button>}{r.status==='draft'&&<button disabled={!profile?.data?.issuerConfirmed} title="Complete billing details before issuing" onClick={()=>open('issue',r)}>Issue</button>}{['draft','proforma','issued'].includes(r.status)&&<button onClick={()=>open('send',r)}>{r.status==='draft'?'Send pro forma':'Send invoice'}</button>}{r.status!=='void'&&<button onClick={()=>open('void',r)}>Void</button>}</>}

 </div></article>)}{!visibleRows.length&&<div className="cx-empty"><Search/><h2>No records yet</h2><p>{q?'Try another search.':'Records will appear as your FindBox community grows.'}</p></div>}</div>}{tab==='schools'&&!isAdmin&&<div className="cx-access"><SchoolAccessConsole onReauthenticate={onLogout}/></div>}<div className="cx-pagination"><button disabled={!page||loading} onClick={()=>setPage(n=>n-1)}><ChevronLeft size={16}/> Previous</button><span>Page {page+1}</span><button disabled={!more||loading} onClick={()=>setPage(n=>n+1)}>Next <ChevronRight size={16}/></button></div></>}

 </div>}{error&&!form&&<p className="co-error" role="alert">{error}</p>}

 </div>

 {download&&<div className="cx-download" role="status"><div><LoaderCircle className="cx-spin" size={32}/><strong>Preparing your FindBox invoice</strong><span>Building a branded PDF…</span></div></div>}

 {joinCode&&<div className="cx-modal"><section role="dialog" aria-modal="true" aria-label="School join code"><button className="cx-close" aria-label="Close join code" onClick={()=>setJoinCode('')}><X/></button><h2>School join code</h2><p>Share privately with the school. The old code no longer works.</p><code>{joinCode}</code><button className="co-button" onClick={()=>void navigator.clipboard.writeText(joinCode)}>Copy code</button></section></div>}

 {form&&<div className="cx-modal"><section role="dialog" aria-modal="true" aria-labelledby="cx-dialog-title"><button className="cx-close" aria-label="Close action" disabled={busy} onClick={()=>{setForm(null);window.dispatchEvent(new Event('findbox-form-saved'))}}><X/></button><p className="co-eyebrow">REVIEW BEFORE SAVING</p><h2 id="cx-dialog-title">{({invoice:'Create draft invoice','invoice-edit':'Edit draft invoice',fulfill:'Fulfil this paid order',invite:'Invite a client',reset:'Request password reset',users:'Edit account',transfer:'Request ownership transfer',items:'Edit item',schools:'Edit school','school-new':'Onboard a school',code:'Rotate school join code',sessions:'Revoke account sessions',mail:'Retry failed email',support:'Review support request',membership:'Set school access',announcement:'Publish announcement',profile:'Business profile',issue:'Issue invoice',send:'Send invoice',void:'Void invoice'} as Record<string,string>)[form.kind]}</h2><p className="cx-form-note">{risky.includes(form.kind)?'This action is recorded with your reason.':'This change is recorded in the audit history.'}</p>{error&&<p className="co-error" role="alert">{error}</p>}<>{form.kind==='audit'?<div className="cx-audit-detail"><p>{form.row.action}</p><p>{form.row.reason}</p><pre>{JSON.stringify(form.row.changes,null,2)}</pre><p>{new Date(form.row.created_at).toLocaleString('en-KE')}</p></div>:<form onSubmit={submit}><fieldset className="cx-fieldset" disabled={busy}>

 {['invoice','invoice-edit'].includes(form.kind)&&<>{form.kind==='invoice'?<label>Adult client<select name="clientId" required defaultValue={form.row.id||''}><option value="">Choose a client</option>{(form.row.id?[form.row,...clients.filter(c=>c.id!==form.row.id)]:clients).map(c=><option key={c.id} value={c.id}>{c.name} · {c.email}</option>)}</select></label>:<p>Billed to {form.row.customer?.name} · {form.row.customer?.email}</p>}<p className="cx-form-note">First 25 clients shown. Use Clients search to invoice another account. Drafts do not record payment or reserve stock.</p>{field('billingName','Billing name (optional)',form.row.customer?.name||form.row.name||'','text',false)}{field('billingAddress','Billing address (optional)',form.row.customer?.address||'','text',false)}{field('dueDate','Due date',form.row.due_date?String(form.row.due_date).slice(0,10):new Date(Date.now()+14*86400000).toISOString().slice(0,10),'date')}{lines.map((line,i)=><div key={i} className="cx-invoice-line"><label>Description<input required maxLength={200} value={line.description} onChange={e=>setLines(s=>s.map((x,k)=>k===i?{...x,description:e.target.value}:x))}/></label><label>Quantity<input type="number" min={1} max={10000} required value={line.quantity} onChange={e=>setLines(s=>s.map((x,k)=>k===i?{...x,quantity:e.target.value}:x))}/></label><label>Unit price · KES<input type="number" min="0.01" max="1000000" step="0.01" required value={line.price} onChange={e=>setLines(s=>s.map((x,k)=>k===i?{...x,price:e.target.value}:x))}/></label><button type="button" disabled={lines.length===1} onClick={()=>setLines(s=>s.filter((_,k)=>i!==k))}>Remove</button></div>)}<button type="button" disabled={lines.length>=20} onClick={()=>setLines(s=>[...s,{description:'',quantity:'1',price:''}])}>Add line <Plus size={14}/></button><label>Notes<textarea name="notes" maxLength={1500} defaultValue={form.row.notes||''}/></label><strong>Total: {money(lines.reduce((s,l)=>s+Math.round(Number(l.price||0)*100)*Number(l.quantity||0),0))}</strong><p className="cx-form-note">No VAT is added. A draft PDF is not an eTIMS tax invoice.</p></>}

 {form.kind==='invite'&&<>{field('name','Client name')}{field('email','Client email address','','email')}<p>An invitation email will ask this adult client to set their own password and verify their address. No password is created or shown here.</p></>}

 {form.kind==='reset'&&<p>Send a one-hour password reset link to {form.row.email}? This does not reveal or change their password until they use the link.</p>}

 {form.kind==='users'&&<>{field('name','Name',form.row.name)}{field('email','Email address',form.row.email,'email')}<p className="cx-form-note">Changing the email removes verification and signs out every session. No password is exposed.</p><label className="cx-check"><input type="checkbox" name="disabled" defaultChecked={!!form.row.disabled_at}/> Disable account access</label></>}

 {form.kind==='items'&&<>{field('name','Item name',form.row.name)}<label>Category<select name="category" defaultValue={form.row.category}>{['bottle','book','clothing','lunchbox','keys','sports','electronics','other'].map(c=><option key={c}>{c}</option>)}</select></label>{field('color','Colour',form.row.color,'text',false)}<label>Private identifying note<textarea name="private_note" defaultValue={form.row.private_note} maxLength={1000}/></label><p className="cx-form-note">Ownership, tag activation and recovery status stay with their verified workflows.</p></>}

 {form.kind==='schools'&&<>{field('name','School name',form.row.name)}{field('collectionDays','Collection days',form.row.collection_days,'number')}</>}
 {form.kind==='school-new'&&<>{field('name','School name')}<p className="cx-form-note">Who will run FindBox at this school? They get an email to set a password and finish setup themselves.</p>{field('adminName','School administrator name','','text',false)}{field('adminEmail','School administrator email','','email',false)}<details className="cx-details"><summary>First collection point · Reception, Mon–Fri 8am–4pm</summary>{field('box','Collection point name','Reception')}{field('directions','Where is it?','Main school office')}{field('hours','Collection hours','Mon–Fri 8am–4pm')}</details><p className="cx-form-note">The school goes live on its own once its administrator adds a contact and safeguarding policy.</p></>}

 {form.kind==='support'&&<><blockquote>{form.row.message}</blockquote><label>Status<select name="status" defaultValue={form.row.status}>{['new','in_progress','resolved'].map(s=><option key={s}>{s}</option>)}</select></label><label>Reply to {form.row.email}<textarea name="reply" maxLength={4000}/></label><p className="cx-form-note">A non-empty reply will be queued for email delivery.</p></>}

 {form.kind==='transfer'&&<>{field('newOwnerEmail','New owner account email','','email')}<p>Both current and new owners or their verified guardians must approve. Items with recovery history require a safeguarding review.</p></>}{form.kind==='membership'&&<><p>{form.row.name} · {form.row.email}</p><label>School<select name="schoolId" required><option value="">Choose a school</option>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>School role<select name="role">{['parent','staff','manager'].map(s=><option key={s}>{s}</option>)}</select></label><p>Staff require verified email and their own MFA enrollment. Existing sessions will be revoked.</p></>}

 {form.kind==='announcement'&&<>{field('title','Title')}<label>Message<textarea name="message" required maxLength={1500}/></label><label>Audience<select name="audience" aria-label="Audience"><option value="all">Everyone signed in</option><option value="company">Company team</option><option value="school">One school</option></select></label><label>School (for school audience)<select name="schoolId"><option value="">Not selected</option>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>{field('days','Visible for days',7,'number')}</>}

 {form.kind==='profile'&&<>{field('legalName','Business name',form.row.legalName)}{field('email','Contact email',form.row.email,'email')}{field('address','Billing address',form.row.address,'text',false)}{field('pin','KRA PIN',form.row.pin,'text',false)}<label className="cx-check"><input name="vatRegistered" type="checkbox" defaultChecked={form.row.vatRegistered}/> VAT registered</label><label className="cx-check"><input name="issuerConfirmed" type="checkbox" defaultChecked={form.row.issuerConfirmed}/> Issuing details are complete and reviewed</label><p>VAT/eTIMS requires a separate integration. Until then use draft/pro forma PDFs.</p></>}

 {['issue','send','void'].includes(form.kind)&&<p>{form.kind==='send'?`Send ${form.row.number||'this draft as a pro forma estimate'} to ${form.row.customer?.email}? This queues a PDF email and preserves its contents. Pro forma documents are not tax invoices.`:form.kind==='issue'?'Issue an immutable commercial invoice with a permanent number?':'Void this invoice? It cannot be restored; sent invoices require a separate credit-note workflow.'}</p>}

 {form.kind==='fulfill'&&<p>Confirm this paid order is physically ready for collection. FindBox will allocate available tags and notify the buyer. This does not record a payment or refund.</p>}

 {form.kind==='sessions'&&<p>Sign out all sessions for {form.row.name}? The account password stays unchanged.</p>}{form.kind==='code'&&<p>The existing school join code will stop working. Current memberships are retained.</p>}{form.kind==='mail'&&<p>Retry this exhausted message? A previous ambiguous provider response may have delivered it already.</p>}

 {risky.includes(form.kind)?reason:<input type="hidden" name="reason" value={routineReason}/>}<button className="co-button" disabled={busy}>{busy?<LoaderCircle className="cx-spin" size={17}/>:<Check size={17}/>} {busy?'Saving…':'Confirm action'}</button>

 </fieldset></form>}</></section></div>}

 </div>

}

