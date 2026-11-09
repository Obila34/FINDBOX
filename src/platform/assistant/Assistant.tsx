import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowUp, Check, CircleStop, Copy, History, Loader2, MessageSquarePlus, ShieldCheck, Sparkles, Table2, Trash2, X, Zap } from 'lucide-react'
import { api, currentPortal } from '../api'
import { notify } from '../feedback'
import { SwirlMark } from '@/components/brand/Logo'
import { cx } from '@/lib/util'
import './assistant.css'

type Result = { tool: string; title: string; columns: [string, string][]; rows: Record<string, unknown>[] }
type Action = { id: string; summary: string; details: [string, string][]; status: 'pending' | 'done' | 'cancelled' | 'failed' | 'working'; error?: string }
type Msg = { id: string; role: 'user' | 'assistant'; text: string; steps?: string[]; result?: Result; action?: Action; error?: string; streaming?: boolean; offline?: boolean }
type Meta = { role: string; name: string; model: string; online: boolean; ready: boolean; suggestions: string[]; conversations: { id: string; title: string; updated_at: string }[]; tools: { name: string; kind: string; desc: string }[] }

const uid = () => Math.random().toString(36).slice(2)

/** Small, safe markdown: paragraphs, bullets and **bold**. Never renders HTML from the model. */
function Rich({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/)
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>)
  return <>{blocks.map((b, i) => {
    const lines = b.split('\n')
    if (lines.every(l => /^\s*([-*•]|\d+\.)\s+/.test(l))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ''))}</li>)}</ul>
    return <p key={i}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l)}</Fragment>)}</p>
  })}</>
}

function ResultTable({ result }: { result: Result }) {
  const [all, setAll] = useState(false)
  const rows = all ? result.rows : result.rows.slice(0, 8)
  function copy() {
    const csv = [result.columns.map(c => c[1]).join(','), ...result.rows.map(r => result.columns.map(([k]) => `"${String(r[k] ?? '').replaceAll('"', '""')}"`).join(','))].join('\n')
    void navigator.clipboard?.writeText(csv).then(() => notify('Copied as CSV')).catch(() => notify('Copy is not available here', 'error'))
  }
  return <div className="as-table">
    <header><span><Table2 size={15} />{result.title}<small>{result.rows.length} {result.rows.length === 1 ? 'row' : 'rows'}</small></span><button type="button" onClick={copy} title="Copy as CSV"><Copy size={14} /></button></header>
    {result.rows.length ? <div className="as-table-scroll"><table><thead><tr>{result.columns.map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{result.columns.map(([k]) => <td key={k}>{String(r[k] ?? '')}</td>)}</tr>)}</tbody></table></div>
      : <p className="as-table-empty">Nothing found.</p>}
    {result.rows.length > 8 && <button type="button" className="as-more" onClick={() => setAll(v => !v)}>{all ? 'Show fewer' : `Show all ${result.rows.length}`}</button>}
  </div>
}

function ActionCard({ action, onDecide }: { action: Action; onDecide: (id: string, d: 'confirm' | 'cancel') => void }) {
  return <motion.div className={cx('as-action', 'is-' + action.status)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
    <header><ShieldCheck size={16} /><span>{action.status === 'done' ? 'Done' : action.status === 'cancelled' ? 'Cancelled' : action.status === 'failed' ? 'Not done' : 'Needs your confirmation'}</span></header>
    <strong>{action.summary}</strong>
    <dl>{action.details.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>
    {action.error && <p className="as-action-error">{action.error}</p>}
    {(action.status === 'pending' || action.status === 'working') && <div className="as-action-buttons">
      <button type="button" className="as-confirm" disabled={action.status === 'working'} onClick={() => onDecide(action.id, 'confirm')}>{action.status === 'working' ? <Loader2 size={15} className="as-spin" /> : <Check size={15} />}Confirm</button>
      <button type="button" className="as-cancel" disabled={action.status === 'working'} onClick={() => onDecide(action.id, 'cancel')}><X size={15} />Cancel</button>
    </div>}
    <small>Recorded in the audit history with your name and this request.</small>
  </motion.div>
}

/** The operations assistant: chat, live steps, tables and confirm-before-change actions. */
export function Assistant() {
  const still = useReducedMotion()
  const [meta, setMeta] = useState<Meta | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [convo, setConvo] = useState<string | undefined>()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState(false)
  const ctl = useRef<AbortController | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)

  const loadMeta = () => api<Meta>('/company/assistant').then(setMeta).catch(e => notify(e.message, 'error'))
  useEffect(() => { void loadMeta() }, [])
  useEffect(() => { end.current?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'end' }) }, [msgs, still])

  const patch = (id: string, fn: (m: Msg) => Msg) => setMsgs(list => list.map(m => (m.id === id ? fn(m) : m)))

  async function send(text: string) {
    const message = text.trim(); if (!message || busy) return
    setInput(''); setBusy(true)
    const me: Msg = { id: uid(), role: 'user', text: message }, bot: Msg = { id: uid(), role: 'assistant', text: '', steps: [], streaming: true }
    setMsgs(l => [...l, me, bot])
    const abort = new AbortController(); ctl.current = abort
    try {
      const portal = currentPortal()
      const res = await fetch('/api/company/assistant/chat', { method: 'POST', credentials: 'same-origin', signal: abort.signal, headers: { 'Content-Type': 'application/json', 'X-FindBox-Request': '1', ...(portal ? { 'X-FindBox-Portal': portal } : {}) }, body: JSON.stringify({ message, ...(convo ? { conversationId: convo } : {}) }) })
      if (!res.ok || !res.body) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'The assistant is unavailable right now.') }
      const reader = res.body.getReader(), dec = new TextDecoder(); let buf = ''
      for (;;) {
        const { value, done } = await reader.read(); if (done) break
        buf += dec.decode(value, { stream: true })
        let cut
        while ((cut = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, cut); buf = buf.slice(cut + 2)
          const ev = block.match(/^event: (.+)$/m)?.[1], raw = block.match(/^data: (.+)$/m)?.[1]
          if (!ev || !raw) continue
          const data = JSON.parse(raw)
          if (ev === 'conversation') setConvo(data.id)
          else if (ev === 'status') patch(bot.id, m => ({ ...m, steps: [...(m.steps || []), data.text], offline: m.offline || !!data.offline }))
          else if (ev === 'result') patch(bot.id, m => ({ ...m, result: data }))
          else if (ev === 'proposal') patch(bot.id, m => ({ ...m, action: data }))
          else if (ev === 'token') patch(bot.id, m => ({ ...m, text: m.text + data.text }))
          else if (ev === 'error') patch(bot.id, m => ({ ...m, error: data.text }))
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') patch(bot.id, m => ({ ...m, error: (e as Error).message }))
    } finally {
      patch(bot.id, m => ({ ...m, streaming: false })); setBusy(false); ctl.current = null; void loadMeta(); box.current?.focus()
    }
  }

  async function decide(id: string, d: 'confirm' | 'cancel') {
    setMsgs(l => l.map(m => m.action?.id === id ? { ...m, action: { ...m.action, status: 'working' } } : m))
    try {
      const r = await api<{ status: Action['status']; summary?: string }>(`/company/assistant/actions/${id}/${d}`, {})
      setMsgs(l => l.map(m => m.action?.id === id ? { ...m, action: { ...m.action!, status: r.status } } : m))
      if (r.status === 'done') notify('Done: ' + (r.summary || 'change made'))
    } catch (e) {
      setMsgs(l => l.map(m => m.action?.id === id ? { ...m, action: { ...m.action!, status: 'failed', error: (e as Error).message } } : m))
    }
  }

  async function open(id: string) {
    try {
      const c = await api<{ id: string; messages: { id: string; role: 'user' | 'assistant'; content: string; data: { tool?: string; title?: string; columns?: [string, string][]; rows?: Record<string, unknown>[]; action?: Action | string } }[]; actions: { id: string; summary: string; details: [string, string][]; status: Action['status']; error?: string }[] }>(`/company/assistant/conversations/${id}`)
      setConvo(c.id); setHistory(false)
      setMsgs(c.messages.map(m => {
        const a = m.data?.action && typeof m.data.action === 'object' ? c.actions.find(x => x.id === (m.data.action as Action).id) : undefined
        return { id: m.id, role: m.role, text: m.content, result: m.data?.columns ? { tool: m.data.tool!, title: m.data.title!, columns: m.data.columns, rows: m.data.rows || [] } : undefined, action: a ? { ...a, details: a.details } : undefined }
      }))
    } catch (e) { notify((e as Error).message, 'error') }
  }
  async function remove(id: string) { await api(`/company/assistant/conversations/${id}/delete`, {}).catch(() => {}); if (id === convo) fresh(); void loadMeta() }
  function fresh() { ctl.current?.abort(); setMsgs([]); setConvo(undefined); setHistory(false); box.current?.focus() }
  function submit(e: FormEvent) { e.preventDefault(); void send(input) }
  function key(e: KeyboardEvent<HTMLTextAreaElement>) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input) } }

  const status = useMemo(() => !meta ? { tone: 'wait', text: 'Connecting' } : meta.ready ? { tone: 'ok', text: `On-server AI · ${meta.model.split(':')[0].replace('gemma4', 'Gemma 4')}` } : meta.online ? { tone: 'wait', text: 'Preparing the AI model' } : { tone: 'off', text: 'Rules mode · AI offline' }, [meta])
  const hello = meta ? `What can I do for you, ${meta.name.split(' ')[0]}?` : 'Opening the assistant'

  return <div className={cx('as-root', history && 'show-history')}>
    <aside className="as-history" aria-label="Conversations">
      <button type="button" className="as-new" onClick={fresh}><MessageSquarePlus size={16} />New chat</button>
      <p>Recent</p>
      <nav>{meta?.conversations.map(c => <div key={c.id} className={cx('as-history-row', c.id === convo && 'is-on')}>
        <button type="button" onClick={() => void open(c.id)}>{c.title || 'Conversation'}</button>
        <button type="button" aria-label="Delete conversation" onClick={() => void remove(c.id)}><Trash2 size={13} /></button>
      </div>)}{meta && !meta.conversations.length && <small>No conversations yet.</small>}</nav>
    </aside>
    <section className="as-main">
      <header className="as-top">
        <button type="button" className="as-icon as-history-toggle" aria-label="Show conversations" onClick={() => setHistory(v => !v)}><History size={17} /></button>
        <div className="as-title"><span className="as-orb"><SwirlMark size={22} /></span><div><strong>FindBox Assistant</strong><small className={'is-' + status.tone}><i />{status.text}</small></div></div>
        <span className="as-role">{meta?.role === 'developer' ? 'Developer' : meta?.role === 'admin' ? 'Admin' : ''}</span>
        <button type="button" className="as-icon" aria-label="New chat" onClick={fresh}><MessageSquarePlus size={17} /></button>
      </header>
      <div className="as-scroll">
        {!msgs.length ? <div className="as-empty">
          <motion.span className="as-hero-orb" animate={still ? undefined : { rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}><SwirlMark size={64} still /></motion.span>
          <h2>{hello}</h2>
          <p>Ask about {meta?.role === 'developer' ? 'system health, accounts, sessions, schools, emails and privacy requests' : 'orders, invoices, support, clients, schools and platform numbers'}. I look things up instantly and prepare changes for you to confirm.</p>
          <div className="as-suggest">{meta?.suggestions.map((s, i) => <motion.button key={s} type="button" onClick={() => void send(s)} initial={still ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}><Zap size={14} />{s}</motion.button>)}</div>
          <small className="as-privacy"><ShieldCheck size={13} />Runs on FindBox's own server. Nothing you ask leaves it.</small>
        </div> : <div className="as-thread">
          <AnimatePresence initial={false}>{msgs.map(m => <motion.div key={m.id} className={cx('as-msg', 'is-' + m.role)} initial={still ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            {m.role === 'assistant' && <span className="as-avatar"><SwirlMark size={18} still={!m.streaming} /></span>}
            <div className="as-bubble">
              {m.role === 'assistant' && !!m.steps?.length && <div className="as-steps">{m.steps.map((s, i) => { const last = i === m.steps!.length - 1 && m.streaming && !m.text; return <span key={i} className={cx(last && 'is-live')}>{last ? <Loader2 size={12} className="as-spin" /> : <Check size={12} />}{s}</span> })}</div>}
              {m.text ? <div className="as-text"><Rich text={m.text} />{m.streaming && <i className="as-caret" />}</div> : m.streaming && !m.steps?.length ? <div className="as-typing"><i /><i /><i /></div> : null}
              {m.result && <ResultTable result={m.result} />}
              {m.action && <ActionCard action={m.action} onDecide={(id, d) => void decide(id, d)} />}
              {m.error && <p className="as-error">{m.error}</p>}
            </div>
          </motion.div>)}</AnimatePresence>
          <div ref={end} />
        </div>}
      </div>
      <form className="as-composer" onSubmit={submit}>
        {!!msgs.length && meta && !busy && <div className="as-quick">{meta.suggestions.slice(0, 3).map(s => <button key={s} type="button" onClick={() => void send(s)}><Sparkles size={12} />{s}</button>)}</div>}
        <div className="as-input">
          <textarea ref={box} rows={1} value={input} onChange={e => setInput(e.target.value)} onKeyDown={key} placeholder="Ask anything about FindBox, or tell me what to change…" aria-label="Message the assistant" maxLength={2000} />
          {busy ? <button type="button" className="as-send is-stop" aria-label="Stop" onClick={() => ctl.current?.abort()}><CircleStop size={18} /></button>
            : <button type="submit" className="as-send" aria-label="Send" disabled={!input.trim()}><ArrowUp size={18} /></button>}
        </div>
        <small>Changes always wait for your confirmation. Answers can be wrong; check tables before acting.</small>
      </form>
    </section>
  </div>
}
