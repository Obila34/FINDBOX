import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { PwaStatus } from '@/components/layout/PwaStatus'
import { LoadBoundary } from '@/components/ui/LoadBoundary'
import { AppShell } from '@/components/layout/AppShell'
import { ManageShell } from '@/components/layout/ManageShell'
import { AppEntry, RequireRole } from '@/components/layout/guards'
import { Toaster, Celebration } from '@/components/ui/Toaster'
import { usePauseWhenHidden } from '@/lib/hooks'
import { Skeleton } from '@/components/ui/EmptyState'

const Landing = lazy(() => import('@/pages/landing/Landing').then(m => ({ default: m.Landing })))
const TagLanding = lazy(() => import('@/pages/landing/TagLanding').then(m => ({ default: m.TagLanding })))
const Welcome = lazy(() => import('@/pages/auth/Welcome').then(m => ({ default: m.Welcome })))
import { SignIn } from '@/pages/auth/SignIn'
import { SignUp } from '@/pages/auth/SignUp'
const Forgot = lazy(() => import('@/pages/auth/Forgot').then(m => ({ default: m.Forgot })))
const Invite = lazy(() => import('@/pages/auth/Invite').then(m => ({ default: m.Invite })))
const Onboarding = lazy(() => import('@/pages/auth/Onboarding').then(m => ({ default: m.Onboarding })))
const Account = lazy(() => import('@/pages/auth/Account').then(m => ({ default: m.Account })))
const Home = lazy(() => import('@/pages/family/Home').then(m => ({ default: m.Home })))
const Items = lazy(() => import('@/pages/family/Items').then(m => ({ default: m.Items })))
const ItemDetail = lazy(() => import('@/pages/family/ItemDetail').then(m => ({ default: m.ItemDetail })))
const RegisterItem = lazy(() => import('@/pages/family/RegisterItem').then(m => ({ default: m.RegisterItem })))
const ReportLost = lazy(() => import('@/pages/family/ReportLost').then(m => ({ default: m.ReportLost })))
const Gallery = lazy(() => import('@/pages/family/Gallery').then(m => ({ default: m.Gallery })))
const ClaimForm = lazy(() => import('@/pages/family/ClaimForm').then(m => ({ default: m.ClaimForm })))
const Inbox = lazy(() => import('@/pages/family/Inbox').then(m => ({ default: m.Inbox })))
const CaseView = lazy(() => import('@/pages/family/CaseView').then(m => ({ default: m.CaseView })))
const Streaks = lazy(() => import('@/pages/student/Streaks').then(m => ({ default: m.Streaks })))
const FoundSomething = lazy(() => import('@/pages/student/FoundSomething').then(m => ({ default: m.FoundSomething })))
const Queue = lazy(() => import('@/pages/staff/Queue').then(m => ({ default: m.Queue })))
const Scan = lazy(() => import('@/pages/staff/Scan').then(m => ({ default: m.Scan })))
const LogFound = lazy(() => import('@/pages/staff/LogFound').then(m => ({ default: m.LogFound })))
const CaseDetail = lazy(() => import('@/pages/staff/CaseDetail').then(m => ({ default: m.CaseDetail })))
const StaffGallery = lazy(() => import('@/pages/staff/StaffGallery').then(m => ({ default: m.StaffGallery })))
const ActivityFeed = lazy(() => import('@/pages/staff/ActivityFeed').then(m => ({ default: m.ActivityFeed })))
const Settings = lazy(() => import('@/pages/management/Settings').then(m => ({ default: m.Settings })))
import { NotFound } from '@/pages/NotFound'

const Dashboard = lazy(() => import('@/pages/management/Dashboard').then((m) => ({ default: m.Dashboard })))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { if (!pathname.startsWith('/#')) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }) }, [pathname])
  return null
}

function RootEntry() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone
  return standalone ? <Navigate to="/app/sign-in" replace /> : <Landing />
}

export function App() {
  usePauseWhenHidden()

  return (
    <>
      <ScrollToTop />
      <LoadBoundary><Suspense fallback={<div className="fb-scene-load" role="status">Opening FindBox…</div>}><Routes>
        <Route path="/" element={<RootEntry />} />
        <Route path="/t/:code" element={<TagLanding />} />
        <Route path="/demo" element={<Navigate to="/app/sign-in" replace />} />

        <Route path="/app" element={<AppEntry />} />
        <Route path="/app/welcome" element={<Welcome />} />
        <Route path="/app/sign-in" element={<SignIn />} />
        <Route path="/app/sign-up" element={<SignUp />} />
        <Route path="/app/forgot" element={<Forgot />} />
        <Route path="/app/invite" element={<Invite />} />

        <Route element={<RequireRole roles={['parent', 'student']} />}>
          <Route path="/app/onboarding" element={<Onboarding />} />
          <Route element={<AppShell />}>
            <Route path="/app/home" element={<Home />} />
            <Route path="/app/items" element={<Items />} />
            <Route path="/app/items/:id" element={<ItemDetail />} />
            <Route path="/app/register" element={<RegisterItem />} />
            <Route path="/app/report" element={<ReportLost />} />
            <Route path="/app/report/:id" element={<ReportLost />} />
            <Route path="/app/gallery" element={<Gallery />} />
            <Route path="/app/gallery/:id/claim" element={<ClaimForm />} />
            <Route path="/app/cases/:id" element={<CaseView />} />
            <Route path="/app/inbox" element={<Inbox />} />
            <Route path="/app/quest" element={<Navigate to="/app/streaks" replace />} />
            <Route path="/app/streaks" element={<Streaks />} />
            <Route path="/app/found" element={<FoundSomething />} />
            <Route path="/app/account" element={<Account />} />
          </Route>
        </Route>

        <Route element={<RequireRole roles={['staff', 'manager']} />}>
          <Route element={<ManageShell />}>
            <Route path="/manage" element={<Queue />} />
            <Route path="/manage/scan" element={<Scan />} />
            <Route path="/manage/log" element={<LogFound />} />
            <Route path="/manage/cases/:id" element={<CaseDetail />} />
            <Route path="/manage/gallery" element={<StaffGallery />} />
            <Route path="/manage/activity" element={<ActivityFeed />} />
            <Route path="/manage/dashboard" element={<Suspense fallback={<div className="grid gap-4 md:grid-cols-4"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>}><Dashboard /></Suspense>} />
            <Route path="/manage/settings" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes></Suspense></LoadBoundary>
      <PwaStatus />
      <Toaster />
      <Celebration />
    </>
  )
}
