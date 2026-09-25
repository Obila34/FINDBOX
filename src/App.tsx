import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { AppShell } from '@/components/layout/AppShell'
import { ManageShell } from '@/components/layout/ManageShell'
import { AppEntry, RequireRole } from '@/components/layout/guards'
import { Toaster, Celebration } from '@/components/ui/Toaster'
import { usePauseWhenHidden } from '@/lib/hooks'
import { Skeleton } from '@/components/ui/EmptyState'

import { Landing } from '@/pages/landing/Landing'
import { TagLanding } from '@/pages/landing/TagLanding'
import { Welcome } from '@/pages/auth/Welcome'
import { SignIn } from '@/pages/auth/SignIn'
import { SignUp } from '@/pages/auth/SignUp'
import { Forgot } from '@/pages/auth/Forgot'
import { Invite } from '@/pages/auth/Invite'
import { Onboarding } from '@/pages/auth/Onboarding'
import { Account } from '@/pages/auth/Account'
import { Home } from '@/pages/family/Home'
import { Items } from '@/pages/family/Items'
import { ItemDetail } from '@/pages/family/ItemDetail'
import { RegisterItem } from '@/pages/family/RegisterItem'
import { ReportLost } from '@/pages/family/ReportLost'
import { Gallery } from '@/pages/family/Gallery'
import { ClaimForm } from '@/pages/family/ClaimForm'
import { Inbox } from '@/pages/family/Inbox'
import { CaseView } from '@/pages/family/CaseView'
import { Streaks } from '@/pages/student/Streaks'
import { FoundSomething } from '@/pages/student/FoundSomething'
import { Queue } from '@/pages/staff/Queue'
import { Scan } from '@/pages/staff/Scan'
import { LogFound } from '@/pages/staff/LogFound'
import { CaseDetail } from '@/pages/staff/CaseDetail'
import { StaffGallery } from '@/pages/staff/StaffGallery'
import { ActivityFeed } from '@/pages/staff/ActivityFeed'
import { Settings } from '@/pages/management/Settings'
import { NotFound } from '@/pages/NotFound'

const Dashboard = lazy(() => import('@/pages/management/Dashboard').then((m) => ({ default: m.Dashboard })))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { if (!pathname.startsWith('/#')) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }) }, [pathname])
  return null
}

export function App() {
  usePauseWhenHidden()
  useEffect(() => { registerSW({ immediate: true }) }, [])
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
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
      </Routes>
      <Toaster />
      <Celebration />
    </>
  )
}
