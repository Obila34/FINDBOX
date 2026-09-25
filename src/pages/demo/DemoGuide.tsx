import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, RotateCcw, Users, GraduationCap, ClipboardList, BarChart3, Check } from 'lucide-react'
import type { Role } from '@/domain/types'
import { ROLE_LABEL } from '@/domain/labels'
import { MATRIX } from '@/domain/permissions'
import { ASSET_SOURCES } from '@/data/media'
import { StudioBrand } from '@/components/brand/StudioBrand'
import { Button } from '@/components/ui/Button'
import { Tile, Eyebrow, Note } from '@/components/ui/Tile'
import { useStore } from '@/store/useStore'
import { homeFor } from '@/components/layout/guards'
import { cx } from '@/lib/util'

export const SCENARIOS = [
  {
    id: 'bottle', title: 'Registered water bottle', summary: 'Parent reports it lost, staff scan its QR and confirm the match, parent gets the update, staff verify at pickup and record the return.',
    steps: [
      { role: 'parent' as Role, text: 'Open Items, choose Blue steel water bottle, Report lost. Last seen: Sports pavilion.' },
      { role: 'staff' as Role, text: 'Queue shows the new report. Open Scan tag, enter FB-7K2M-Q4 (or scan a printed tag). Log where it was found.' },
      { role: 'staff' as Role, text: 'On the case, compare found photo with the record and Confirm match. The family is notified.' },
      { role: 'parent' as Role, text: 'Inbox shows "found". Once staff assign a pickup, the timeline shows where and when to collect.' },
      { role: 'staff' as Role, text: 'Assign pickup, then at pickup record how ownership was verified and Confirm return.' },
      { role: 'manager' as Role, text: 'Dashboard: recovery rate and median time include the new case immediately.' },
    ],
  },
  {
    id: 'pencil', title: 'Unregistered pencil case', summary: 'A pencil case is already in the gallery. A guardian submits a claim; staff inspect the evidence, verify or reject; verified collection closes the case.',
    steps: [
      { role: 'parent' as Role, text: 'Open Gallery, find the grey pencil case (FB-0141), Claim. Describe a distinguishing detail. No owner details are shown.' },
      { role: 'staff' as Role, text: 'Queue: claim to review. Open the case, Start review, compare the claim with the item, then Verify or Reject with a note.' },
      { role: 'staff' as Role, text: 'If verified: Assign pickup, then Confirm return after verifying at the desk. If rejected: the item is relisted and the claimant is told.' },
    ],
  },
  {
    id: 'book', title: 'A student finds a book', summary: 'Zuri finds an atlas, reports the helpful action and hands it to staff. Staff scan the tag, confirm the handover, and Zuri receives recognition without learning who owns it.',
    steps: [
      { role: 'student' as Role, text: 'Tap Found something. Describe "hardback atlas, blue spine", found in the library. The app says: hand it to staff.' },
      { role: 'staff' as Role, text: 'Queue: student handover incoming. Open Scan tag with that handover selected, enter FB-4R8N-A2. Custody is confirmed and Zuri is credited (+25).' },
      { role: 'student' as Role, text: 'Quest shows the Helpful finder token settling into its slot. The owner is never shown.' },
      { role: 'staff' as Role, text: 'Confirm match, assign pickup, confirm return. Zuri gets "Full circle" (+15) only after the verified return.' },
    ],
  },
]

const roleIcon: Record<Role, typeof Users> = { parent: Users, student: GraduationCap, staff: ClipboardList, manager: BarChart3 }

export function DemoGuide() {
  const nav = useNavigate()
  const switchPersona = useStore((s) => s.switchPersona)
  const resetDemo = useStore((s) => s.resetDemo)
  const setScenario = useStore((s) => s.setScenario)
  const scenario = useStore((s) => s.scenario)
  const toast = useStore((s) => s.toast)
  const [open, setOpen] = useState<string>(scenario ?? 'bottle')

  const enter = (role: Role, sc?: string) => {
    if (sc) setScenario(sc)
    switchPersona(role)
    nav(homeFor(role))
  }

  return (
    <div className="min-h-svh bg-paper-2">
      <header className="border-b border-line bg-paper">
        <div className="fb-container flex h-[var(--nav-h)] items-center justify-between">
          <StudioBrand />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" icon={<RotateCcw className="h-4 w-4" />} onClick={() => { resetDemo(true); toast({ title: 'Demo reset', body: 'All three stories are back at the start.' }) }}>Reset demo</Button>
            <Button variant="secondary" size="sm" to="/app/welcome">Normal app entry</Button>
          </div>
        </div>
      </header>

      <main className="fb-container py-8 md:py-12">
        <Eyebrow>Presenter guide</Eyebrow>
        <h1 className="fb-display mt-1 text-[length:var(--t-display)] leading-tight text-ink">Choose a persona and a story.</h1>
        <p className="mt-2 max-w-2xl text-ink-3">Entering from here turns on presenter controls: a floating switcher to jump between Parent, Student, Staff and Manager while the same records move through their lifecycle. All data is invented and lives on this device.</p>

        <section aria-labelledby="personas" className="mt-8">
          <h2 id="personas" className="sr-only">Personas</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(['parent', 'student', 'staff', 'manager'] as Role[]).map((r, i) => {
              const Icon = roleIcon[r]
              const who = { parent: 'Amina Wekesa, guardian of Zuri (5B) and Kito (2A)', student: 'Zuri Wekesa, Year 5', staff: 'Daniel Kimani, Lost Property Office', manager: 'Grace Njoroge, Deputy Head' }[r]
              return (
                <button key={r} type="button" onClick={() => enter(r)} className="fb-tile fb-press fb-raise fb-enter flex flex-col items-start gap-3 p-4 text-left" style={{ ['--i' as string]: i }}>
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-50 text-teal-700"><Icon className="h-5 w-5" /></span>
                  <span><span className="block font-semibold text-ink">{ROLE_LABEL[r]}</span><span className="block text-[0.8rem] text-ink-3">{who}</span></span>
                  <span className="mt-auto inline-flex items-center gap-1 text-[0.82rem] font-medium text-teal-700">Enter <ArrowRight className="h-3.5 w-3.5" /></span>
                </button>
              )
            })}
          </div>
        </section>

        <section aria-labelledby="stories" className="mt-10">
          <h2 id="stories" className="fb-display text-[length:var(--t-h2)] text-ink">Three scripted stories</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-[300px_1fr]">
            <div className="flex flex-col gap-2">
              {SCENARIOS.map((s, i) => (
                <button key={s.id} type="button" onClick={() => setOpen(s.id)} aria-pressed={open === s.id} className={cx('fb-tile fb-press p-4 text-left', open === s.id && '!border-teal-500 !bg-teal-50')}>
                  <span className="block text-[0.7rem] font-semibold uppercase tracking-wider text-ink-4">Story {i + 1}</span>
                  <span className="block font-medium text-ink">{s.title}</span>
                </button>
              ))}
            </div>
            {SCENARIOS.filter((s) => s.id === open).map((s) => (
              <Tile key={s.id} className="fb-fade">
                <p className="text-ink-2">{s.summary}</p>
                <ol className="mt-4 space-y-3">
                  {s.steps.map((st, i) => {
                    const Icon = roleIcon[st.role]
                    return (
                      <li key={i} className="flex gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-paper-3 text-[0.75rem] font-semibold text-ink-2">{i + 1}</span>
                        <div className="flex-1">
                          <button type="button" onClick={() => enter(st.role, s.id)} className="inline-flex items-center gap-1 rounded-sm text-[0.75rem] font-semibold uppercase tracking-wider text-teal-700 hover:underline"><Icon className="h-3.5 w-3.5" /> {ROLE_LABEL[st.role]}</button>
                          <p className="text-[0.92rem] text-ink-2">{st.text}</p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button onClick={() => enter(s.steps[0].role, s.id)} iconRight={<ArrowRight className="h-4 w-4" />}>Start as {ROLE_LABEL[s.steps[0].role]}</Button>
                  <Button variant="secondary" icon={<RotateCcw className="h-4 w-4" />} onClick={() => { resetDemo(true); toast({ title: 'Demo reset' }) }}>Reset first</Button>
                </div>
              </Tile>
            ))}
          </div>
        </section>

        <section aria-labelledby="matrix" className="mt-12">
          <h2 id="matrix" className="fb-display text-[length:var(--t-h2)] text-ink">Role permission matrix</h2>
          <p className="mt-1 text-[0.9rem] text-ink-3">Derived from the proposal's roles and privacy rules. "If enabled" follows the school configuration (Management → Configuration).</p>
          <div className="fb-scroll-x mt-4 rounded-md border border-line bg-paper">
            <table className="w-full min-w-[640px] text-[0.85rem]">
              <thead className="bg-paper-2 text-left text-[0.72rem] uppercase tracking-wider text-ink-3"><tr><th className="px-3 py-2 font-semibold">Capability</th><th className="px-3 py-2 font-semibold">Parent</th><th className="px-3 py-2 font-semibold">Student</th><th className="px-3 py-2 font-semibold">Staff</th><th className="px-3 py-2 font-semibold">Manager</th></tr></thead>
              <tbody>
                {MATRIX.map((m) => (
                  <tr key={m.capability} className="border-t border-line">
                    <td className="px-3 py-2 font-medium text-ink">{m.label}</td>
                    {[m.parent, m.student, m.staff, m.manager].map((v, i) => <td key={i} className={cx('px-3 py-2', v === 'No' ? 'text-ink-4' : 'text-ink-2')}>{v === 'Yes' ? <span className="inline-flex items-center gap-1 text-status-done"><Check className="h-3.5 w-3.5" />Yes</span> : v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Note tone="demo" className="mt-4">Simulated in this prototype: sign-in, notifications (local inbox), NFC, email, hosting. Real: QR generation and camera scanning (where the browser permits), state machine, persistence on this device, installability.</Note>
        </section>

        <section aria-labelledby="assets" className="mt-12">
          <h2 id="assets" className="fb-display text-[length:var(--t-h2)] text-ink">Asset sources</h2>
          <p className="mt-1 text-[0.9rem] text-ink-3">Where the ambient media comes from, and where to get richer assets when the school invests in its own.</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ASSET_SOURCES.map((a) => (
              <li key={a.name}><a href={a.url} target="_blank" rel="noreferrer" className="fb-tile fb-press flex items-center justify-between gap-3 p-4 hover:bg-white"><span><span className="block font-medium text-ink">{a.name}</span><span className="block text-[0.78rem] text-ink-3">{a.use}</span></span><ArrowRight className="h-4 w-4 shrink-0 text-ink-4" /></a></li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}
