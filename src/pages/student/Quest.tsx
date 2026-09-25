import { useEffect, useMemo, useState } from 'react'
import { Check, Lock } from 'lucide-react'
import { usePerson, useStore } from '@/store/useStore'
import { QUEST_RULES, NO_POINTS_FOR, TIERS, BOARD, pointsFor, tierFor } from '@/domain/quest'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tile, Eyebrow, Note, InventorySlot } from '@/components/ui/Tile'
import { QuestToken } from '@/components/ui/QuestToken'
import { tokenFor } from '@/pages/family/Home'
import { fmtDate, cx } from '@/lib/util'
import { ExplorerExperience, ExplorerPractice } from '@/components/scene/ExplorerExperience'
import { Link } from 'react-router-dom'

/** Private progress view. Tokens settle into their slot once, the first time the page shows a new one. */
export function Quest() {
  const person = usePerson()!
  const state = useStore()
  const entries = useMemo(() => state.ledger.filter((e) => e.studentId === person.id).sort((a, b) => b.at.localeCompare(a.at)), [state.ledger, person.id])
  const points = pointsFor(state.ledger, person.id)
  const tier = tierFor(points)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  useEffect(() => {
    const k = `findbox.quest.seen.${person.id}`
    let seen: string[] = []
    try { seen = JSON.parse(localStorage.getItem(k) ?? '[]') } catch { seen = [] }
    setFresh(new Set(entries.map((e) => e.key).filter((x) => !seen.includes(x))))
    try { localStorage.setItem(k, JSON.stringify(entries.map((e) => e.key))) } catch { /* ignore */ }
  }, [entries, person.id])

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="FindBox Quest" title="Quest Board" lede="Recognition for helpful actions. Private to you; nobody is ranked." compact />
      <ExplorerExperience key={person.id} personId={person.id} />
      <ExplorerPractice />
      <Tile className="relative overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><Eyebrow>Your tier</Eyebrow><p className="fb-display text-[2.4rem] leading-none text-ink">{tier.current.name}</p><p className="mt-1 text-[0.85rem] text-ink-3">{points} points{tier.next ? ` · ${tier.next.min - points} to ${tier.next.name}` : ' · top tier'}</p></div>
          <ol className="flex gap-2" aria-label="Tiers">{TIERS.map((t) => <li key={t.name} className={cx('rounded-full border px-2.5 py-1 text-[0.72rem] font-medium', points >= t.min ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-line text-ink-4')}>{t.name} {t.min}</li>)}</ol>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-paper-3" role="progressbar" aria-valuenow={Math.round(tier.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to next tier"><div className="h-full rounded-full bg-teal-500 transition-[width] duration-slow ease-out" style={{ width: `${tier.progress * 100}%` }} /></div>
      </Tile>

      <section className="mt-6" aria-labelledby="board">
        <h2 id="board" className="mb-3 font-semibold text-ink">Quests</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {BOARD.map((b) => {
            const rule = QUEST_RULES[b.action]
            const done = entries.filter((e) => e.action === b.action)
            const isFresh = done.some((e) => fresh.has(e.key))
            return (
              <Tile key={b.action} pad="sm" className={cx('flex gap-3', done.length > 0 && '!border-teal-200')}>
                <InventorySlot size="sm" className="!h-16 !w-16 shrink-0"><QuestToken kind={tokenFor(b.action)} earned={done.length > 0} size={48} settle={isFresh} /></InventorySlot>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2"><p className="font-medium text-ink">{b.title}</p><span className="shrink-0 rounded-full bg-paper-3 px-2 py-0.5 text-[0.7rem] font-semibold text-ink-2">+{rule.points}</span></div>
                  <p className="text-[0.8rem] text-ink-3">{b.how}</p>
                  <Link className="fb-link text-sm" to={b.action === 'register_item' ? '/app/register' : b.action === 'label_refreshed' ? '/app/items' : '/app/found'}>{b.action === 'register_item' ? 'Tag a belonging' : b.action === 'label_refreshed' ? 'Choose a belonging' : 'Report a found item'} ↗</Link>
                  <p className="mt-1 flex items-center gap-1 text-[0.75rem] text-ink-4">{done.length ? <><Check className="h-3.5 w-3.5 text-status-done" /> Done {done.length > 1 ? `${done.length} times` : 'once'}</> : <><Lock className="h-3.5 w-3.5" /> {rule.explain}</>}</p>
                </div>
              </Tile>
            )
          })}
        </div>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Tile pad="sm"><Eyebrow>How points work</Eyebrow><ul className="mt-2 space-y-1.5 text-[0.85rem] text-ink-2">{Object.values(QUEST_RULES).map((r) => <li key={r.label} className="flex justify-between gap-2"><span>{r.label}</span><span className="font-semibold tabular-nums">+{r.points}</span></li>)}</ul><p className="mt-2 text-[0.75rem] text-ink-4">Each quest counts once per item or case. Repeating a tap never adds points.</p></Tile>
        <Tile pad="sm"><Eyebrow>Never any points for</Eyebrow><ul className="mt-2 space-y-1.5 text-[0.85rem] text-ink-2">{NO_POINTS_FOR.map((n) => <li key={n} className="flex gap-2"><span className="text-ink-4">·</span>{n}</li>)}</ul></Tile>
      </div>

      <section className="mt-6" aria-labelledby="ledger">
        <h2 id="ledger" className="mb-2 font-semibold text-ink">Your history</h2>
        {entries.length ? <ul className="divide-y divide-line rounded-md border border-line bg-paper">{entries.map((e) => <li key={e.key} className="flex items-center gap-3 px-3 py-2 text-[0.85rem]"><QuestToken kind={tokenFor(e.action)} earned size={26} /><span className="flex-1">{QUEST_RULES[e.action].label}{e.itemId ? ` · ${state.items.find((i) => i.id === e.itemId)?.name ?? ''}` : ''}</span><span className="text-ink-4">{fmtDate(e.at)}</span><span className="font-semibold tabular-nums text-teal-800">+{e.points}</span></li>)}</ul> : <p className="text-[0.85rem] text-ink-3">Nothing yet. Tag a belonging to start.</p>}
      </section>
      <Note tone="demo" className="mt-6">Future option (not active): a school could map verified contributions to existing house or class points. No public rankings exist in FindBox.</Note>
    </div>
  )
}
