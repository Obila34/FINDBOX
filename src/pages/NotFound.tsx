import { Link } from 'react-router-dom'
import { Logo } from '@/components/brand/Logo'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { Compass } from 'lucide-react'

export function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <Link to="/" className="text-teal-700"><Logo height={22} /></Link>
      <EmptyState icon={<Compass className="h-6 w-6" />} title="This page is not on the map" body="The link may be out of date. Head back to the landing page or open the app."
        action={<div className="flex gap-2"><Button to="/">Landing page</Button><Button variant="secondary" to="/app">Open the app</Button></div>} />
    </div>
  )
}
