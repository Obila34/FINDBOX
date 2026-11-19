import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ease } from './fx'
import { ArrowUpDown, CalendarDays, ListChecks, MessageSquare, MoreVertical } from 'lucide-react'
import { api, money } from '../api'
import { notify } from '../feedback'

export type Row = Record<string, any>
export type RecordRef = { type: string; id: string }
type Card = { id: string; type: string; revision?: number; title: string; line: string; chip: { text: string; tone: string }; flags: { text: string; tone: string }[]; notes: number; tasks: number; owner: string; detail: string[]; value?: number; score?: number }
type Column = { id: string; title: string; cards: Card[]; valueMinor?: number }
type BoardData = { kind: string; moves: string[]; columns: Column[] }

const HINTS: Record<string, string> = {
  leads: 'Schools that are not partners yet. Drag a card to move it, or open it to add notes and a next step.',
  onboarding: 'Partner schools by how far their rollout has got. Stages follow live data.',
  orders: 'Label orders from payment to delivery. Open an order to fulfil it or mark it delivered.',
  support: 'Requests from families and schools. New tickets older than a day are flagged.',
  issues: 'Problems with the system, one card per problem. Every complaint about it is linked to the same card.',
}
export const BOARD_TITLES: Record<string, string> = { leads: 'School leads', onboarding: 'Onboarding', orders: 'Orders', support: 'Support', issues: 'System issues' }

/** A kanban board: columns with a count, cards with one line of context, a date chip and note/task counts. */
export function Board({ kind, query, open, onOpen, version, onChanged }: { kind: string; query: string; open: RecordRef | null; onOpen: (r: RecordRef) => void; version: number; onChanged: () => void }) {
  const still = useReducedMotion()
  const [data, setData] = useState<BoardData | null>(null), [menu, setMenu] = useState(''), [over, setOver] = useState(''), [flip, setFlip] = useState<Record<string, boolean>>({})
  useEffect(() => {
    let live = true
    setData((d) => (d?.kind === kind ? d : null))
    api<BoardData>(`/company/crm/board/${kind}?${query}`).then((d) => { if (live) setData(d) }).catch(() => { if (live) setData({ kind, moves: [], columns: [] }) })
    return () => { live = false }
  }, [kind, query, version])
  useEffect(() => { if (!menu) return; const close = () => setMenu(''); window.addEventListener('click', close); return () => window.removeEventListener('click', close) }, [menu])

  async function move(card: Card, stage: string) {
    setMenu('')
    if (card.type === 'issue') {
      if (['fixed', 'closed'].includes(stage)) { onOpen({ type: 'issue', id: card.id }); notify(stage === 'fixed' ? 'Write what was fixed in the panel, then choose Fixed.' : 'Say why in the panel, then choose Closed.', 'info'); return }
      try { await api('/company/crm/issues/' + card.id, { revision: card.revision, status: stage }); notify(`${card.title} moved.`); onChanged() } catch { onOpen({ type: 'issue', id: card.id }) }
      return
    }
    if (stage === 'lost') { onOpen({ type: 'lead', id: card.id }); notify('Add the reason in the panel, then choose Lost.', 'info'); return }
    try { await api('/company/crm/leads/' + card.id, { revision: card.revision, stage }); notify(`${card.title} moved.`); onChanged() } catch { onOpen({ type: 'lead', id: card.id }) }
  }
  if (!data) return <p role="status" className="crm-empty">Loading the board…</p>
  const movable = data.moves.length > 0
  return <>
    <div className="crm-head"><div><h1>{BOARD_TITLES[kind]}</h1><p>{HINTS[kind]}</p></div></div>
    <div className="crm-board">
      {data.columns.map((col, ci) => {
        const cards = flip[col.id] ? [...col.cards].reverse() : col.cards
        return <motion.section key={col.id} initial={still ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease, delay: ci * 0.05 }} className={'crm-col' + (over === col.id ? ' is-over' : '')}
          onDragOver={movable ? (e) => { e.preventDefault(); setOver(col.id) } : undefined} onDragLeave={movable ? () => setOver('') : undefined}
          onDrop={movable ? (e) => { e.preventDefault(); setOver(''); const raw = e.dataTransfer.getData('text/plain'); const card = data.columns.flatMap((c) => c.cards).find((c) => c.id === raw); if (card && !col.cards.includes(card)) void move(card, col.id) } : undefined}>
          <header>
            <div><h2>{col.title}</h2>{col.valueMinor ? <small>{money(col.valueMinor)}</small> : null}</div>
            <button type="button" className="crm-count" title="Reverse the order" onClick={() => setFlip((f) => ({ ...f, [col.id]: !f[col.id] }))}>{col.cards.length}<ArrowUpDown size={13} /></button>
          </header>
          {cards.map((card, n) => {
            const on = open?.id === card.id
            return <motion.div key={card.id} layout={!still} initial={still ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease, delay: Math.min(n, 8) * 0.04 }}><article className={'crm-card' + (on ? ' is-on' : '') + (['won', 'delivered', 'resolved', 'live', 'fixed', 'closed'].includes(col.id) && !on ? ' is-done' : '')} draggable={movable}
              onDragStart={(e) => e.dataTransfer.setData('text/plain', card.id)} onClick={() => onOpen({ type: card.type, id: card.id })}
              tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onOpen({ type: card.type, id: card.id }) }}>
              <h3>{card.title}</h3>
              <button type="button" className="crm-more" aria-label={`Actions for ${card.title}`} onClick={(e) => { e.stopPropagation(); setMenu(menu === card.id ? '' : card.id) }}><MoreVertical size={17} /></button>
              {menu === card.id && <div className="crm-menu" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => { setMenu(''); onOpen({ type: card.type, id: card.id }) }}>Open</button>
                {movable && data.columns.filter((c) => c.id !== col.id).map((c) => <button type="button" key={c.id} onClick={() => void move(card, c.id)}>Move to {c.title}</button>)}
                {movable && kind === 'leads' && !data.columns.some((c) => c.id === 'lost') && <button type="button" onClick={() => void move(card, 'lost')}>Mark lost</button>}
              </div>}
              <p>{card.line}</p>
              {on && card.detail.length > 0 && <ul>{card.detail.map((d) => <li key={d}>{d}</li>)}</ul>}
              {card.flags.length > 0 && <div className="crm-flags">{card.flags.map((f) => <span key={f.text} className={'crm-flag t-' + f.tone}>{f.text}</span>)}</div>}
              {on && card.owner && <small>Owner: {card.owner}</small>}
              <footer>
                <span className={'crm-chip t-' + card.chip.tone}><CalendarDays size={13} />{card.chip.text}</span>
                <span>{typeof card.score === 'number' && card.type === 'lead' && <i title="Lead score">{card.score}</i>}<i title="Notes"><MessageSquare size={13} />{card.notes}</i><i title="Open tasks"><ListChecks size={13} />{card.tasks}</i></span>
              </footer>
            </article></motion.div>
          })}
          {!col.cards.length && <p className="crm-empty">Nothing here</p>}
        </motion.section>
      })}
      {!data.columns.length && <p className="crm-empty">Nothing to show.</p>}
    </div>
  </>
}
