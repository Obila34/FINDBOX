import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, LogIn, UserPlus, School } from 'lucide-react'
import { AuthFrame, DemoAccountNote } from './AuthFrame'
import { Button } from '@/components/ui/Button'
import { useSession, useStore } from '@/store/useStore'
import { homeFor } from '@/components/layout/guards'
import { Avatar } from '@/components/ui/Avatar'

/** The installed app always starts here for a fresh visitor. Returning sessions can resume or sign out. */
export function Welcome() {
  const session = useSession()
  const people = useStore((s) => s.people)
  const signOut = useStore((s) => s.signOut)
  const nav = useNavigate()
  const person = session ? people.find((p) => p.id === session.personId) : null
  if (session && person && !session.presenter && session.onboarded) {
    return (
      <AuthFrame title={`Welcome back, ${person.firstName}`} lede="Continue where you left off, or switch account.">
        <div className="fb-tile flex items-center gap-3 p-3"><Avatar person={person} /><div className="min-w-0 flex-1"><p className="truncate font-medium">{person.name}</p><p className="text-[0.8rem] text-ink-3">Signed in on this device</p></div></div>
        <div className="mt-4 flex flex-col gap-2">
          <Button size="lg" full onClick={() => nav(homeFor(session.role))} iconRight={<ArrowRight className="h-4 w-4" />}>Continue</Button>
          <Button variant="secondary" full onClick={() => signOut()}>Sign out and use another account</Button>
        </div>
      </AuthFrame>
    )
  }
  if (session && session.presenter) return <Navigate to={homeFor(session.role)} replace />
  return (
    <AuthFrame title="Welcome to FindBox" lede="Your school's lost and found, in your pocket.">
      <div className="flex flex-col gap-2">
        <Button size="lg" full to="/app/sign-in" icon={<LogIn className="h-4 w-4" />}>Sign in</Button>
        <Button size="lg" full variant="secondary" to="/app/sign-up" icon={<UserPlus className="h-4 w-4" />}>Create account</Button>
      </div>
      <div className="mt-6 border-t border-line pt-4">
        <Button variant="ghost" full to="/app/invite" icon={<School className="h-4 w-4" />}>School staff? Sign in with your invitation</Button>
      </div>
      <DemoAccountNote className="mt-6" />
    </AuthFrame>
  )
}
