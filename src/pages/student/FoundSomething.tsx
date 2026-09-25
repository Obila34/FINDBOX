import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { HandHelping, MapPin, Check } from 'lucide-react'
import { usePerson, useStore, tryAction } from '@/store/useStore'
import { capabilities } from '@/domain/permissions'
import { CASE_STATUS } from '@/domain/labels'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tile, Note } from '@/components/ui/Tile'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Field'
import { StatusSeal } from '@/components/ui/StatusSeal'
import { EmptyState } from '@/components/ui/EmptyState'
import { QuestToken } from '@/components/ui/QuestToken'
import { fmtRelative } from '@/lib/util'

/** Helpful finder: the student reports the find and is told to hand it to staff. Only staff log custody. */
export function FoundSomething() {
  const person = usePerson()!
  const state = useStore()
  const caps = capabilities(person, state.school)
  const [f, setF] = useState({ description: '', location: '' })
  const [err, setErr] = useState<Record<string, string>>({})
  const [doneId, setDoneId] = useState<string | null>(null)
  const mine = state.cases.filter((c) => c.kind === 'handover' && c.handover?.reportedBy === person.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (!caps.has('report_found')) return <EmptyState title="Tell a grown-up" body="Young-student preview: hand what you found to a teacher or the office. They will take it from there." action={<Button to="/app/home">Home</Button>} />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (f.description.trim().length < 3) errs.description = 'What is it? e.g. “hardback atlas, blue spine”.'
    if (f.location.trim().length < 2) errs.location = 'Where did you find it?'
    setErr(errs)
    if (Object.keys(errs).length) return
    tryAction(() => { const id = state.studentReportFound(f); setDoneId(id); setF({ description: '', location: '' }) })
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back="/app/home" title="Found something?" lede="Nice one. Tell us what it is, then hand it to the Lost Property Office." compact />
      {doneId ? (
        <Tile className="fb-sheet-in">
          <div className="flex items-start gap-4">
            <span className="fb-settle flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700"><Check className="h-6 w-6" /></span>
            <div>
              <h2 className="fb-display text-[1.5rem] text-ink">Thanks. Now hand it in.</h2>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-[0.92rem] text-ink-2"><li>Take the item to the <strong>Lost Property Office</strong> (Admin block).</li><li>Say you reported it in FindBox. Staff will log it.</li><li>Staff confirm custody and update your report.</li></ol>
              <div className="mt-3 flex items-center gap-2 rounded-md bg-paper-2 p-2 text-[0.8rem] text-ink-3"><QuestToken kind="lantern" earned={false} size={30} /> Staff verify every handover. The owner’s details stay private.</div>
              <div className="mt-4 flex gap-2"><Button to={`/app/cases/${doneId}`}>View report</Button><Button variant="secondary" onClick={() => setDoneId(null)}>Report another</Button></div>
            </div>
          </div>
        </Tile>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Textarea label="What did you find?" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} error={err.description} placeholder="Hardback atlas, blue spine" required />
          <Input label="Where?" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} error={err.location} placeholder="Library, reading corner" required />
          <Note tone="info"><MapPin className="mr-1 inline h-3.5 w-3.5" />Do not try to find the owner yourself. Staff check the tag and contact the family.</Note>
          <Button type="submit" size="lg" icon={<HandHelping className="h-4 w-4" />}>I will hand it to staff</Button>
        </form>
      )}

      {!!mine.length && (
        <section className="mt-8" aria-labelledby="mine">
          <h2 id="mine" className="mb-2 font-semibold text-ink">Your finds</h2>
          <ul className="flex flex-col gap-2">
            {mine.map((c) => (
              <li key={c.id}><Link to={`/app/cases/${c.id}`} className="fb-tile fb-press flex items-center gap-3 p-3 hover:bg-paper-2"><QuestToken kind="lantern" earned={c.status === 'closed'} size={34} /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{c.handover?.description}</span><span className="block text-[0.75rem] text-ink-3">{c.handover?.location} · {fmtRelative(c.createdAt)}</span></span><StatusSeal tone={c.status === 'closed' ? 'done' : CASE_STATUS[c.status].tone} label={c.status === 'closed' ? 'Confirmed by staff' : CASE_STATUS[c.status].label} size="sm" /></Link></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
