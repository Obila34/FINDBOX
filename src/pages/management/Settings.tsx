import { useState } from 'react'
import { Plus, X, Save } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tile, Eyebrow, Note } from '@/components/ui/Tile'
import { Checkbox, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import type { SchoolConfig } from '@/domain/types'

/** Demo-only configuration preview: which student actions are enabled, which staff may verify collection. */
export function Settings() {
  const state = useStore()
  const [cfg, setCfg] = useState<SchoolConfig>(state.school)
  const [loc, setLoc] = useState('')
  const staff = state.people.filter((p) => p.role === 'staff')
  const dirty = JSON.stringify(cfg) !== JSON.stringify(state.school)
  const toggle = (k: keyof SchoolConfig) => (e: React.ChangeEvent<HTMLInputElement>) => setCfg({ ...cfg, [k]: e.target.checked })
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Configuration" lede={`${state.school.name}. Changes apply immediately and are saved on this device.`} compact actions={<Button disabled={!dirty} icon={<Save className="h-4 w-4" />} onClick={() => { state.updateSchool(cfg); state.toast({ title: 'Configuration saved', tone: 'success' }) }}>Save changes</Button>} />
      <Note tone="demo" className="mb-4">Only authorised school administrators can change these settings.</Note>
      <div className="grid gap-4 md:grid-cols-2">
        <Tile>
          <Eyebrow>Student access</Eyebrow>
          <div className="mt-3 flex flex-col gap-2">
            <Checkbox label="Student accounts enabled" hint="Students can sign in and see their own belongings." checked={cfg.studentAccountsEnabled} onChange={toggle('studentAccountsEnabled')} />
            <Checkbox label="Students can register belongings" checked={cfg.studentsCanRegister} onChange={toggle('studentsCanRegister')} disabled={!cfg.studentAccountsEnabled} />
            <Checkbox label="Students can report their own items lost" checked={cfg.studentsCanReportLost} onChange={toggle('studentsCanReportLost')} disabled={!cfg.studentAccountsEnabled} />
            <Checkbox label="Students can submit gallery claims" hint="Off by default: claims come from a guardian." checked={cfg.studentsCanClaim} onChange={toggle('studentsCanClaim')} disabled={!cfg.studentAccountsEnabled} />
            <Checkbox label="Restricted preview for Years 1 to 3" hint="Younger students can look but not act." checked={cfg.youngStudentRestrictedPreview} onChange={toggle('youngStudentRestrictedPreview')} disabled={!cfg.studentAccountsEnabled} />
          </div>
        </Tile>
        <Tile>
          <Eyebrow>Who may record a release</Eyebrow>
          <p className="mt-1 text-[0.8rem] text-ink-3">Managers always can. Frontline staff need explicit authorisation.</p>
          <div className="mt-3 flex flex-col gap-2">
            {staff.map((p) => <Checkbox key={p.id} label={p.name} hint={p.title} checked={cfg.staffCanVerifyCollection.includes(p.id)} onChange={(e) => setCfg({ ...cfg, staffCanVerifyCollection: e.target.checked ? [...cfg.staffCanVerifyCollection, p.id] : cfg.staffCanVerifyCollection.filter((x) => x !== p.id) })} />)}
          </div>
          <div className="mt-4">
            <Input label="Uncollected reminder after (days)" type="number" min={1} max={30} value={cfg.uncollectedReminderDays} onChange={(e) => setCfg({ ...cfg, uncollectedReminderDays: Math.max(1, Number(e.target.value) || 1) })} />
          </div>
        </Tile>
        <Tile>
          <Eyebrow>Pickup locations</Eyebrow>
          <ul className="mt-2 flex flex-col gap-1.5">{cfg.pickupLocations.map((l) => <li key={l} className="flex items-center justify-between rounded-md border border-line bg-paper-2 px-3 py-2 text-[0.85rem]"><span>{l}</span><button type="button" aria-label={`Remove ${l}`} onClick={() => setCfg({ ...cfg, pickupLocations: cfg.pickupLocations.filter((x) => x !== l) })} className="rounded-sm p-1 text-ink-4 hover:text-status-danger"><X className="h-4 w-4" /></button></li>)}</ul>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (loc.trim() && !cfg.pickupLocations.includes(loc.trim())) { setCfg({ ...cfg, pickupLocations: [...cfg.pickupLocations, loc.trim()] }); setLoc('') } }}>
            <Input label="Add location" value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Library desk" className="flex-1" /><Button type="submit" variant="secondary" className="self-end" icon={<Plus className="h-4 w-4" />}>Add</Button>
          </form>
        </Tile>
        <Tile className="opacity-80">
          <Eyebrow>Future option</Eyebrow>
          <p className="mt-1 font-medium text-ink">Map verified Quest contributions to house points</p>
          <p className="text-[0.8rem] text-ink-3">Would export verified helpful actions (never losses or claims) to an existing house or class points system. Not implemented; shown for discussion.</p>
          <Checkbox className="mt-3" label="Enable house-points mapping" hint="Not connected yet" checked={false} disabled readOnly />
        </Tile>
      </div>
    </div>
  )
}
