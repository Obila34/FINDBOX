import { isInstalledApp } from '@/lib/standalone'
import {PrivacyNotice} from './platform/PrivacyNotice'
import {useSearchMetadata} from './lib/useSearchMetadata'
import {SchoolInvitation,OwnershipTransfers} from './platform/SchoolWorkspace'
import {FamilyChildren} from './platform/FamilyChildren'
import {SchoolAdmin} from './platform/SchoolAdmin'
import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { LoadBoundary } from '@/components/ui/LoadBoundary'
import { Toaster, Celebration } from '@/components/ui/Toaster'
import { usePauseWhenHidden } from '@/lib/hooks'

const Support=lazy(()=>import('@/pages/support/Support').then(m=>({default:m.Support})))
// Portal builds: the ops build contains only the company workspace; once ops has its own address,
// the public build leaves the company workspace out entirely.
const TARGET=import.meta.env.VITE_TARGET as string|undefined
const OPS_URL=(import.meta.env.VITE_OPS_URL as string|undefined)||''
const SCHOOL_URL=(import.meta.env.VITE_SCHOOL_URL as string|undefined)||''
const Company=OPS_URL&&TARGET!=='ops'?null:lazy(()=>import('@/platform/Company').then(m=>({default:m.Company})))
const SCHOOL_PATHS=/^\/(school|manage)(\/|$)|^\/app\/(school-admin|school-invitation)$/
function MovedTo({url}:{url:string}){useEffect(()=>{window.location.replace(url)},[url]);return <p className="fb-scene-load" role="status">Opening <a href={url}>{new URL(url).host}</a>…</p>}
const ServerStorefront=lazy(()=>import('@/commerce/ServerStorefront').then(m=>({default:m.ServerStorefront})))
const ServerAuth=lazy(()=>import('@/platform/ServerAuth').then(m=>({default:m.ServerAuth})))
const ServerSecurity=lazy(()=>import('@/platform/ServerSecurity').then(m=>({default:m.ServerSecurity})))
const Platform=lazy(()=>import('@/platform/Platform').then(m=>({default:m.Platform})))
const Journey=lazy(()=>import('@/pages/landing/Journey').then(m=>({default:m.Journey})))
const Landing = lazy(() => import('@/pages/landing/Landing').then(m => ({ default: m.Landing })))
import { NotFound } from '@/pages/NotFound'


function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { if (!pathname.startsWith('/#')) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }) }, [pathname])
  return null
}

function RootEntry() {
  const {hash}=useLocation()
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone
  return standalone && !hash ? <Navigate to="/app/sign-in" replace /> : <Landing />
}

export function App() {
  usePauseWhenHidden()
  useSearchMetadata()
  const platformLocation = useLocation()
  const here=platformLocation.pathname+platformLocation.search+platformLocation.hash
  if(TARGET==='ops'){
    if(platformLocation.pathname==='/app/security') return <LoadBoundary><Suspense fallback={<p>Opening security…</p>}><ServerSecurity/></Suspense></LoadBoundary>
    return Company?<LoadBoundary><Suspense fallback={<p>Opening company workspace…</p>}><Company/></Suspense></LoadBoundary>:null
  }
  if(OPS_URL&&/^\/company(\/|$)/.test(platformLocation.pathname)) return <MovedTo url={OPS_URL}/>
  // The installed family app has no marketing pages: it opens on sign in, and signed-in people go on to their home.
  if(isInstalledApp()&&!/^\/(app|manage|t|shop|school|privacy)(\/|$)/.test(platformLocation.pathname)) return <Navigate to="/app/sign-in" replace/>
  if(SCHOOL_URL&&location.origin!==SCHOOL_URL&&SCHOOL_PATHS.test(platformLocation.pathname)) return <MovedTo url={SCHOOL_URL+here}/>
  if(SCHOOL_URL&&location.origin===SCHOOL_URL&&!SCHOOL_PATHS.test(platformLocation.pathname)&&!/^\/(app\/(security|help|feedback|inbox|boxes|forgot|reset|verify)|privacy)/.test(platformLocation.pathname)) return <Navigate to="/school/sign-in" replace/>
  if(['/privacy','/privacy/children'].includes(platformLocation.pathname)) return <PrivacyNotice/>
  if(['/app/school-invitation','/app/guardian-invitation'].includes(platformLocation.pathname)) return <SchoolInvitation/>
  if(platformLocation.pathname==='/app/transfers') return <OwnershipTransfers/>
  if(platformLocation.pathname==='/app/children') return <FamilyChildren/>
  if(platformLocation.pathname==='/app/school-admin') return <SchoolAdmin/>
  if(Company&&/^\/company(\/|$)/.test(platformLocation.pathname)) return <LoadBoundary><Suspense fallback={<p>Opening company workspace…</p>}><Company/></Suspense></LoadBoundary>
  if(['/contact','/refer','/app/help','/app/feedback','/app/refer','/manage/support'].includes(platformLocation.pathname)) return <LoadBoundary><Suspense fallback={<p>Opening support…</p>}><Support/></Suspense></LoadBoundary>
  if(/^\/school(\/sign-in)?\/?$/.test(platformLocation.pathname)){
    if(platformLocation.pathname!=='/school/sign-in') return <Navigate to="/school/sign-in" replace/>
    return <LoadBoundary><Suspense fallback={<div className="fb-scene-load">Opening the school portal…</div>}><ServerAuth portal="school"/></Suspense></LoadBoundary>
  }
  if(/^\/(app|manage|t)(\/|$)/.test(platformLocation.pathname) && !platformLocation.pathname.startsWith('/app/shop')){
    const p=platformLocation.pathname;
    const content=/^\/app\/(sign-in|sign-up|forgot|reset|verify)$/.test(p)?<ServerAuth/>:p==='/app/security'?<ServerSecurity/>:<Platform/>;
    return <LoadBoundary><Suspense fallback={<div className="fb-scene-load">Opening FindBox…</div>}>{content}</Suspense></LoadBoundary>
  }
  if (/^\/(shop|app\/shop)(\/|$)/.test(platformLocation.pathname)) return <LoadBoundary><Suspense fallback={<div className="fb-scene-load">Opening the store…</div>}><ServerStorefront/></Suspense></LoadBoundary>

  return (
    <>
      <ScrollToTop />
      <LoadBoundary><Suspense fallback={<div className="fb-scene-load" role="status">Opening FindBox…</div>}><Routes>
        <Route path="/" element={<RootEntry />} />
        <Route path="/how-it-works" element={<Navigate to="/#how-it-works" replace/>} />
        <Route path="/schools" element={<Journey/>} />
        <Route path="/demo" element={<Navigate to="/app/sign-in" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes></Suspense></LoadBoundary>
      <Toaster />
      <Celebration />
    </>
  )
}
