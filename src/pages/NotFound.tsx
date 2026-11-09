import { SiteNav } from '@/components/layout/SiteNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { Compass } from 'lucide-react'

export function NotFound() {
  return (
    <div className="cinema-root flex min-h-svh flex-col">
      <SiteNav />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <EmptyState icon={<Compass className="h-6 w-6" />} title="This page is not on the map" body="The link may be out of date. Head back to the landing page or open the app."
        action={<div className="flex gap-2"><Button to="/">Landing page</Button><Button variant="secondary" to="/app">Open the app</Button></div>} />
      </div>
    </div>
  )
}
