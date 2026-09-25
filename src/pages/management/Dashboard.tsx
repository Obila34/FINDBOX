import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import { ArrowRight, Table2, BarChart3 } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { CASE_STATUS, CATEGORY, CATEGORY_ORDER } from '@/domain/labels'
import type { Case, ItemCategory } from '@/domain/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Stat } from '@/components/ui/Stat'
import { Tile, Eyebrow, Note } from '@/components/ui/Tile'
import { Segmented } from '@/components/ui/Tabs'
import { StatusSeal } from '@/components/ui/StatusSeal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { Mark } from '@/components/brand/Logo'
import { daysBetween, median, fmtRelative, fmtDate, cx, prefersReducedMotion } from '@/lib/util'
import { caseTitle } from '@/pages/staff/Queue'

/* Chart palette: validated with the dataviz skill. Two series, fixed order, direct labels + 2px gaps as secondary encoding. */
const SERIES = { opened: '#073847', returned: '#33bab7' }

type Range = '7' | '30' | '90'
type StatusFilter = 'all' | 'open' | 'closed'
type Origin = 'all' | 'family' | 'staff'

export function Dashboard() {
  const state = useStore()
  const nav = useNavigate()
  const [range, setRange] = useState<Range>('90')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [origin, setOrigin] = useState<Origin>('all')
  const [drill, setDrill] = useState<{ title: string; cases: Case[] } | null>(null)
  const [catView, setCatView] = useState<'chart' | 'table'>('chart')
  const anim = !prefersReducedMotion()

  const now = new Date().toISOString()
  const inRange = (c: Case) => daysBetween(c.createdAt, now) <= Number(range)
  const real = (c: Case) => c.kind !== 'handover'
  const byStatus = (c: Case) => status === 'all' || (status === 'open' ? !['returned', 'closed'].includes(c.status) : ['returned', 'closed'].includes(c.status))
  const byOrigin = (c: Case) => origin === 'all' || (origin === 'family' ? c.kind === 'lost' : c.kind !== 'lost')
  const cases = useMemo(() => state.cases.filter((c) => real(c) && inRange(c) && byStatus(c) && byOrigin(c)), [state.cases, range, status, origin]) // eslint-disable-line react-hooks/exhaustive-deps

  const open = cases.filter((c) => !['returned', 'closed'].includes(c.status))
  const returned = cases.filter((c) => c.status === 'returned')
  const resolved = cases.filter((c) => ['returned', 'closed'].includes(c.status))
  const recoveryRate = cases.length ? Math.round((returned.length / cases.length) * 100) : 0
  const recoveryDays = returned.filter((c) => c.returnedAt).map((c) => daysBetween(c.createdAt, c.returnedAt!))
  const medianDays = median(recoveryDays)
  const uncollected = state.cases.filter((c) => c.status === 'awaiting_collection')
  const stale = uncollected.filter((c) => daysBetween(c.updatedAt, now) >= state.school.uncollectedReminderDays)
  const backlog = state.cases.filter((c) => c.kind === 'found_unregistered' && ['found_unregistered', 'claim_submitted', 'claim_under_review'].includes(c.status))

  // Adoption: share of students with at least one registered item
  const students = state.people.filter((p) => p.role === 'student')
  const withItems = students.filter((s) => state.items.some((i) => i.ownerId === s.id)).length
  const adoption = students.length ? Math.round((withItems / students.length) * 100) : 0

  // Weekly series: opened vs returned, last N days bucketed by week
  const weeks = useMemo(() => {
    const n = Math.max(1, Math.ceil(Number(range) / 7))
    const buckets = Array.from({ length: n }, (_, i) => ({ i, label: i === n - 1 ? 'This wk' : `${n - 1 - i} wk ago`, opened: 0, returned: 0 }))
    for (const c of state.cases.filter((c) => real(c) && byOrigin(c))) {
      const wOpen = n - 1 - Math.floor(daysBetween(c.createdAt, now) / 7)
      if (wOpen >= 0 && wOpen < n) buckets[wOpen].opened += 1
      if (c.returnedAt) { const wRet = n - 1 - Math.floor(daysBetween(c.returnedAt, now) / 7); if (wRet >= 0 && wRet < n) buckets[wRet].returned += 1 }
    }
    return buckets
  }, [state.cases, range, origin, now]) // eslint-disable-line react-hooks/exhaustive-deps

  const categories = useMemo(() => CATEGORY_ORDER.map((k) => ({ key: k, label: CATEGORY[k].label, count: cases.filter((c) => (c.itemId ? state.items.find((i) => i.id === c.itemId)?.category : c.foundRecord?.category) === k).length })).filter((c) => c.count > 0).sort((a, b) => b.count - a.count), [cases, state.items])

  const activity = useMemo(() => state.cases.flatMap((c) => c.events.map((e) => ({ ...e, ref: c.ref, caseId: c.id, title: caseTitle(c, state.items) }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8), [state.cases, state.items])

  const drillTo = (title: string, list: Case[]) => setDrill({ title, cases: list })

  return (
    <div>
      <PageHeader eyebrow={`${state.school.name} · Management`} title="School overview" lede="Every number below is computed from the live case data on this device. Click a metric to see the cases behind it." compact />

      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
        <Segmented ariaLabel="Date range" value={range} onChange={setRange} options={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]} />
        <Segmented ariaLabel="Status" value={status} onChange={setStatus} options={[{ value: 'all', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }]} />
        <Segmented ariaLabel="Origin" value={origin} onChange={setOrigin} options={[{ value: 'all', label: 'Any origin' }, { value: 'family', label: 'Family reports' }, { value: 'staff', label: 'Staff finds' }]} />
        <span className="ml-auto text-[0.8rem] text-ink-3">{cases.length} case{cases.length === 1 ? '' : 's'} in view</span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat index={0} label="Active cases" value={open.length} hint={`${cases.length} in range`} onClick={() => drillTo('Active cases', open)} tone={open.length > 6 ? 'attention' : 'neutral'} />
        <Stat index={1} label="Recovery rate" value={recoveryRate} unit="%" hint={`${returned.length} of ${cases.length} returned`} onClick={() => drillTo('Returned cases', returned)} tone={recoveryRate >= 75 ? 'good' : 'neutral'} />
        <Stat index={2} label="Median recovery" value={recoveryDays.length ? medianDays.toFixed(1) : '—'} unit={recoveryDays.length ? 'days' : ''} hint={recoveryDays.length ? 'report to return' : 'no returns in range'} onClick={() => drillTo('Returned cases', returned)} />
        <Stat index={3} label="Uncollected" value={uncollected.length} hint={stale.length ? `${stale.length} over ${state.school.uncollectedReminderDays} days` : 'none overdue'} onClick={() => drillTo('Awaiting collection', uncollected)} tone={stale.length ? 'attention' : 'neutral'} />
        <Stat index={4} label="Gallery backlog" value={backlog.length} hint="unregistered, unclaimed" onClick={() => drillTo('Gallery backlog', backlog)} />
      </div>

      {drill && (
        <Tile className="fb-sheet-in mt-4 !border-teal-500">
          <div className="flex items-center justify-between gap-3"><div><Eyebrow>Drill-down</Eyebrow><h2 className="font-semibold text-ink">{drill.title} · {drill.cases.length}</h2></div><Button size="sm" variant="secondary" onClick={() => setDrill(null)}>Close</Button></div>
          {drill.cases.length ? (
            <ul className="mt-3 divide-y divide-line rounded-md border border-line">
              {drill.cases.map((c) => <li key={c.id}><button type="button" onClick={() => nav(`/manage/cases/${c.id}`)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-[0.85rem] hover:bg-paper-2"><span className="font-mono text-[0.72rem] text-ink-3">{c.ref}</span><span className="flex-1 truncate font-medium">{caseTitle(c, state.items)}</span><StatusSeal tone={CASE_STATUS[c.status].tone} label={CASE_STATUS[c.status].label} size="sm" /><span className="hidden text-ink-3 md:inline">{fmtRelative(c.updatedAt)}</span><ArrowRight className="h-4 w-4 text-ink-4" /></button></li>)}
            </ul>
          ) : <p className="mt-3 text-[0.85rem] text-ink-3">No cases match this view.</p>}
        </Tile>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Tile>
          <div>
            <Eyebrow>Trend</Eyebrow>
            <h2 className="font-semibold text-ink">Cases opened and returned per week</h2>
            <div className="mt-1 flex items-center gap-4 text-[0.75rem] text-ink-3" aria-label="Legend"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: SERIES.opened }} />Opened</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: SERIES.returned }} />Returned</span></div>
            <div className="mt-3 h-56" role="img" aria-label={`Weekly cases: ${weeks.map((w) => `${w.label} ${w.opened} opened, ${w.returned} returned`).join('; ')}`}>
              {weeks.some((w) => w.opened || w.returned) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeks} barGap={2} barCategoryGap="28%" margin={{ top: 16, right: 4, left: -22, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--fb-line)" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
                    <Tooltip cursor={{ fill: 'var(--fb-teal-50)' }} contentStyle={{ borderRadius: 8, border: '1px solid var(--fb-line)', fontSize: 12 }} />
                    <Bar dataKey="opened" name="Opened" fill={SERIES.opened} radius={[4, 4, 0, 0]} isAnimationActive={anim} animationDuration={600}><LabelList dataKey="opened" position="top" fontSize={11} fill="var(--fb-ink-3)" formatter={(v: number) => (v ? v : '')} /></Bar>
                    <Bar dataKey="returned" name="Returned" fill={SERIES.returned} radius={[4, 4, 0, 0]} isAnimationActive={anim} animationDuration={600}><LabelList dataKey="returned" position="top" fontSize={11} fill="var(--fb-ink-3)" formatter={(v: number) => (v ? v : '')} /></Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState compact title="No cases in this range" body="Widen the date range or clear the origin filter." />}
            </div>
          </div>
        </Tile>

        <Tile>
          <div className="flex items-start justify-between gap-2">
            <div><Eyebrow>Categories</Eyebrow><h2 className="font-semibold text-ink">What goes missing</h2></div>
            <Segmented ariaLabel="View" value={catView} onChange={setCatView} options={[{ value: 'chart', label: 'Chart' }, { value: 'table', label: 'Table' }]} />
          </div>
          {categories.length ? catView === 'chart' ? (
            <ul className="mt-3 flex flex-col gap-2" aria-label="Cases by category">
              {categories.map((c, i) => {
                const max = categories[0].count
                return (
                  <li key={c.key} className="grid grid-cols-[92px_1fr_28px] items-center gap-2 text-[0.8rem]">
                    <span className="truncate text-ink-2">{c.label}</span>
                    <span className="h-3.5 overflow-hidden rounded-[3px] bg-paper-3"><span className="block h-full rounded-[3px] transition-[width] duration-slow ease-out" style={{ width: `${(c.count / max) * 100}%`, background: i === 0 ? SERIES.opened : SERIES.returned }} /></span>
                    <span className="text-right font-medium tabular-nums text-ink">{c.count}</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <table className="mt-3 w-full text-[0.85rem]"><thead className="text-left text-[0.7rem] uppercase tracking-wider text-ink-3"><tr><th className="py-1 font-semibold">Category</th><th className="py-1 text-right font-semibold">Cases</th><th className="py-1 text-right font-semibold">Share</th></tr></thead><tbody>{categories.map((c) => <tr key={c.key} className="border-t border-line"><td className="py-1.5">{c.label}</td><td className="py-1.5 text-right tabular-nums">{c.count}</td><td className="py-1.5 text-right tabular-nums text-ink-3">{Math.round((c.count / cases.length) * 100)} %</td></tr>)}</tbody></table>
          ) : <EmptyState compact title="Nothing in range" className="mt-3" />}
        </Tile>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Tile>
          <Eyebrow>Adoption</Eyebrow>
          <p className="fb-display mt-1 text-[2.4rem] leading-none text-ink">{adoption}<span className="ml-1 font-sans text-[0.85rem] font-medium text-ink-3">%</span></p>
          <p className="text-[0.8rem] text-ink-3">{withItems} of {students.length} students have at least one tagged belonging. {state.items.length} items registered in total.</p>
          <div className="mt-3 flex gap-0.5" aria-hidden="true">{students.map((s) => <span key={s.id} className={cx('h-3 flex-1 rounded-[2px]', state.items.some((i) => i.ownerId === s.id) ? 'bg-teal-500' : 'bg-paper-3')} />)}</div>
          <p className="mt-1 text-[0.72rem] text-ink-4">One block per student; no names shown.</p>
        </Tile>
        <Tile className="relative overflow-hidden">
          <Mark size={150} variant="outline" className="pointer-events-none absolute -right-10 -bottom-12 text-teal-100" />
          <Eyebrow>Resolution</Eyebrow>
          <dl className="mt-2 space-y-1.5 text-[0.85rem]">
            {[['Returned', returned.length], ['Closed without return', resolved.length - returned.length], ['Still open', open.length]].map(([l, v]) => <div key={l as string} className="flex justify-between"><dt className="text-ink-2">{l}</dt><dd className="font-medium tabular-nums">{v}</dd></div>)}
          </dl>
          <p className="mt-3 text-[0.72rem] text-ink-4">Median recovery uses report-to-return time on returned cases in range.</p>
        </Tile>
        <Tile>
          <div className="flex items-center justify-between"><Eyebrow>Activity</Eyebrow><Button size="sm" variant="ghost" to="/manage/activity">All</Button></div>
          <ol className="mt-2 space-y-2">{activity.map((e) => <li key={e.id} className="flex gap-2 text-[0.8rem]"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" /><button type="button" onClick={() => nav(`/manage/cases/${e.caseId}`)} className="min-w-0 flex-1 text-left hover:underline"><span className="font-medium text-ink">{e.title}</span><span className="text-ink-3"> · {e.type.replace(/_/g, ' ')} · {fmtDate(e.at)}</span></button></li>)}</ol>
        </Tile>
      </div>
      <Note tone="demo" className="mt-4"><BarChart3 className="mr-1 inline h-3.5 w-3.5" />Aggregates never show student names. Drill-down opens staff-authorised case records. <Table2 className="ml-2 mr-1 inline h-3.5 w-3.5" />Every chart has a table alternative.</Note>
    </div>
  )
}

export type { ItemCategory }
