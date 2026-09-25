import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronUp, RotateCcw, BookOpen, X, Presentation } from 'lucide-react'
import type { Role } from '@/domain/types'
import { ROLE_LABEL } from '@/domain/labels'
import { useStore, useSession } from '@/store/useStore'
import { homeFor } from './guards'
import { cx } from '@/lib/util'
import { Mark } from '@/components/brand/Logo'

const ROLES: Role[] = ['parent', 'student', 'staff', 'manager']

/** Floating presenter-only control: switch persona, reset the story, open the guide. Hidden unless the session was entered via the demo guide. */
export function PresenterSwitcher() {
  const session = useSession()
  const switchPersona = useStore((s) => s.switchPersona)
  const resetDemo = useStore((s) => s.resetDemo)
  const setPresenter = useStore((s) => s.setPresenter)
  const toast = useStore((s) => s.toast)
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  if (!session?.presenter) return null

  const go = (role: Role) => { switchPersona(role); setOpen(false); nav(homeFor(role)) }
  return (
    <div className="fixed bottom-[calc(var(--bottom-nav-h)+10px+env(safe-area-inset-bottom))] right-3 z-40 md:bottom-4 md:right-4">
      {open && (
        <div role="dialog" aria-label="Presenter controls" className="fb-sheet-in mb-2 w-64 rounded-md border border-teal-900 bg-teal-800 p-2 text-white shadow-raise">
          <div className="mb-1 flex items-center justify-between px-2 pt-1">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-teal-200">Presenter · switch persona</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-sm p-1 text-teal-200 hover:bg-teal-700"><X className="h-4 w-4" /></button>
          </div>
          {ROLES.map((r) => (
            <button key={r} type="button" onClick={() => go(r)} aria-current={session.role === r ? 'true' : undefined}
              className={cx('fb-press flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-[0.85rem]', session.role === r ? 'bg-teal-700 font-medium' : 'hover:bg-teal-700/60')}>
              <span className={cx('h-2 w-2 rounded-full', session.role === r ? 'bg-teal-300' : 'bg-teal-600')} aria-hidden="true" />{ROLE_LABEL[r]}
            </button>
          ))}
          <div className="mt-1 grid grid-cols-2 gap-1 border-t border-teal-700 pt-2">
            <button type="button" onClick={() => { resetDemo(true); toast({ title: 'Demo reset', body: 'All three stories are back at the start.', tone: 'info' }); setOpen(false) }} className="fb-press flex items-center justify-center gap-1.5 rounded-sm bg-teal-700 px-2 py-2 text-[0.8rem] hover:bg-teal-600"><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
            <button type="button" onClick={() => { setOpen(false); nav('/demo') }} className="fb-press flex items-center justify-center gap-1.5 rounded-sm bg-teal-700 px-2 py-2 text-[0.8rem] hover:bg-teal-600"><BookOpen className="h-3.5 w-3.5" /> Guide</button>
          </div>
          <button type="button" onClick={() => { setPresenter(false); setOpen(false) }} className="mt-1 w-full rounded-sm px-2 py-1.5 text-[0.72rem] text-teal-200 hover:bg-teal-700/60">Hide presenter controls</button>
        </div>
      )}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Presenter controls"
        className="fb-press flex items-center gap-2 rounded-full border border-teal-900 bg-teal-900 py-2 pl-2 pr-3 text-[0.8rem] font-medium text-white shadow-raise hover:bg-teal-700">
        <Mark size={22} variant="inverted" /> <Presentation className="h-4 w-4" aria-hidden="true" /> {ROLE_LABEL[session.role].split(' ')[0]} <ChevronUp className={cx('h-4 w-4 transition-transform duration-fast', open && 'rotate-180')} />
      </button>
    </div>
  )
}
