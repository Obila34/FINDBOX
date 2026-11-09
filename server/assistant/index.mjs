// FindBox operations assistant: chat for company admins and developers, backed by a self-hosted model.
// Reliability comes from structure, not from trusting a small model:
//   1. rules score every tool the person's role allows; clear matches skip the model entirely,
//   2. otherwise the model picks from a short candidate list, constrained by a JSON schema enum,
//   3. arguments are extracted by rules first, then by the model under the tool's own JSON schema,
//   4. reads run through the same company endpoints as the workspace; writes become proposals that
//      only run when the person taps Confirm (the stored request runs exactly as shown, and is audited).
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { toolsFor, byName, ToolError } from './tools.mjs'
import { structured, stream, status as llmStatus, ensureModel, warm } from './llm.mjs'

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g
const ROLE_WORDS = { teacher: 'staff', staff: 'staff', parent: 'parent', student: 'student', admin: 'manager', manager: 'manager' }
const SMALLTALK = /^(hi|hello|hey|thanks|thank you|ok|okay|good (morning|afternoon|evening)|who are you|what can you do|help)\b/i

const SUGGESTIONS = {
  admin: ['How many users do we have?', 'Show orders waiting to be fulfilled', "What's in the support inbox?", 'Show unpaid invoices', 'Give me today\'s overview', 'Draft an announcement to all families'],
  developer: ['Is everything healthy?', 'Who is signed in right now?', 'Any failed emails?', 'Show pending school admin invitations', 'How many students are on rosters?', 'Show the latest audit history'],
}

function systemPrompt(access) {
  // Kept short on purpose: the server reads about 24 tokens a second, so every word here costs time.
  return `You are the FindBox assistant for ${access.name} (company ${access.role}). FindBox is a school lost-and-found platform in Kenya.
Use only the DATA and conversation; never invent names, numbers or events. Start with a one-sentence answer, then at most three short bullets. The table is shown below your answer. Never say you changed anything. Money is KSh; times are Nairobi.`
}

function compact(result, limit = 10) {
  if (!result) return ''
  const cols = result.columns || []
  const lines = (result.rows || []).slice(0, limit).map(r => cols.map(([k, l]) => `${l}: ${r[k] ?? ''}`).join(' | '))
  const more = (result.rows || []).length > limit ? `\n(and ${(result.rows || []).length - limit} more rows)` : ''
  return `${result.title} (${(result.rows || []).length} rows)\n${lines.join('\n')}${more}`
}

/** Rule score for each tool. Higher means a clearer match. */
function score(message, tools, schools = []) {
  const m = message.toLowerCase()
  const hasEmail = /[\w.+-]+@[\w-]+(\.[\w-]+)+/.test(message)
  const hasSchool = schools.some(s => m.includes(s.toLowerCase()))
  const command = /^(please |can you |could you |kindly )?(disable|enable|re-?enable|block|unblock|suspend|archive|activate|reactivate|invite|create|add|onboard|rename|rotate|reset|retry|resend|send|issue|void|record|fulfil|fulfill|reply|mark|announce|post|sign|log|make|set|change|restore)\b/i.test(m)
  const question = /^(how many|show|list|what|who|which|find|search|look|is |are |any |give me|get )/i.test(m)
  return tools.map(t => {
    let s = 0
    for (const re of t.keywords) if (re.test(message)) s += 2
    if (!s) return { tool: t, s }
    for (const w of t.name.split('_')) if (w.length > 3 && m.includes(w)) s += 1
    if (t.kind === 'write' && command) s += 2
    if (t.kind === 'read' && question) s += 1
    if (hasEmail && t.params?.email) s += 2
    if (hasSchool && t.params?.school) s += 2
    return { tool: t, s }
  }).filter(x => x.s > 0).sort((a, b) => b.s - a.s)
}

/** Rule-based argument extraction: emails, schools, ids, amounts, quoted text, enums. */
function extract(message, tool, ctx) {
  const args = {}, p = tool.params || {}
  const emails = message.match(EMAIL) || []
  const quoted = [...message.matchAll(/["“']([^"”']{2,120})["”']/g)].map(x => x[1])
  const hex = [...message.matchAll(/\b([0-9a-f]{8}(?:-[0-9a-f]{4}){0,4}[0-9a-f]*)\b/gi)].map(x => x[1])
  const school = ctx.schools.find(s => message.toLowerCase().includes(s.toLowerCase()))
  const pronoun = /\b(him|her|them|this (user|account|person)|that (user|account|person)|the same (user|account))\b/i.test(message)
  for (const [k, def] of Object.entries(p)) {
    if (k === 'email' && (emails[0] || (pronoun && ctx.memory.emails?.[0]))) args.email = emails[0] || ctx.memory.emails[0]
    if (k === 'school' && (school || (/\b(that|this|the same) school\b/i.test(message) && ctx.memory.schools?.[0]))) args.school = school || ctx.memory.schools[0]
    if (['order', 'ticket', 'email_id', 'request'].includes(k) && hex[0]) args[k] = hex[0]
    if (k === 'invoice') { const inv = message.match(/\b(INV[-\w]*\d+|\d{3,}-\d{2,})\b/i); if (inv) args.invoice = inv[1] }
    if (k === 'amount_kes') { const a = message.match(/(?:ksh|kes|sh)\.?\s*([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*(?:ksh|kes|shillings)/i); if (a) args.amount_kes = Number((a[1] || a[2]).replaceAll(',', '')) }
    if (k === 'collection_days') { const d = message.match(/(\d{1,2})\s*days?/i); if (d) args.collection_days = Number(d[1]) }
    if (k === 'days') { const d = message.match(/for (\d{1,2}) days?/i); if (d) args.days = Number(d[1]) }
    if (def.enum) { const hit = def.enum.find(e => new RegExp(`\\b${e.replace('_', '[ _]')}\\b`, 'i').test(message)); if (hit) args[k] = hit }
    if (k === 'role') { const w = Object.keys(ROLE_WORDS).find(w => new RegExp(`\\b${w}s?\\b`, 'i').test(message)); if (w) args.role = ROLE_WORDS[w] }
    if (k === 'lifecycle') { if (/suspend|pause/i.test(message)) args.lifecycle = 'suspended'; else if (/archive/i.test(message)) args.lifecycle = 'archived'; else if (/activate|go live|make live|reactivate/i.test(message)) args.lifecycle = 'active' }
    if (k === 'action') { const a = message.match(/\b(issue|send|void)\b/i); if (a) args.action = a[1].toLowerCase() }
    if (k === 'kind' && /credit/i.test(message)) args.kind = 'credit'; else if (k === 'kind' && /pay/i.test(message)) args.kind = 'payment'
    if (k === 'query' && (emails[0] || quoted[0])) args.query = emails[0] || quoted[0]
    if (k === 'query' && !args.query) { const n = message.match(/\b(?:named|called)\s+([A-Za-z][\w.'-]*(?:\s+[A-Z][\w.'-]*)?)/); if (n) args.query = n[1] }
    if (k === 'audience' && /\b(everyone|everybody|all (families|parents|users|schools))\b/i.test(message)) args.audience = 'all'
    if (k === 'status' && !args.status && /\bresolv/i.test(message)) args.status = tool.params.status.enum?.includes('resolved') ? 'resolved' : args.status
    if (k === 'name' && tool.name === 'create_school' && quoted[0]) args.name = quoted[0]
    if (k === 'new_name' && quoted[0]) args.new_name = quoted[quoted.length - 1]
  }
  return args
}

const missingRequired = (tool, args) => Object.entries(tool.params || {}).filter(([k, d]) => d.required && (args[k] === undefined || args[k] === '')).map(([k]) => k)

function argSchema(tool, keys) {
  const properties = {}
  for (const k of keys) { const d = tool.params[k]; properties[k] = d.enum ? { type: 'string', enum: d.enum, description: d.desc } : { type: d.type === 'number' ? 'number' : 'string', description: d.desc } }
  return { type: 'object', properties, required: keys }
}

function validate(tool, args) {
  for (const [k, d] of Object.entries(tool.params || {})) {
    const v = args[k]
    if (v === undefined || v === '') continue
    if (d.enum && !d.enum.includes(v)) throw new ToolError(`"${v}" is not a valid ${k.replace('_', ' ')}.`)
    if (d.type === 'number' && !Number.isFinite(Number(v))) throw new ToolError(`${k.replace('_', ' ')} must be a number.`)
    if (k === 'email' && !/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(String(v))) throw new ToolError(`"${v}" is not an email address.`)
    if (d.type === 'number') args[k] = Number(v)
  }
  return args
}


/** Decide which tool to use and with what details. Rules first; the model only chooses among
 *  short candidate lists and fills fields under a JSON schema. `ask` wraps model calls (null = offline). */
export async function plan({ message, tools, history = [], memory = {}, schools = [], ask, cfg, signal, onStatus = () => {} }) {
  onStatus('Understanding your question')
  const ranked = score(message, tools, schools)
  let tool = null
  if (!SMALLTALK.test(message)) {
    if (ranked.length === 1 || (ranked[0] && ranked[0].s >= 3 && ranked[0].s >= (ranked[1]?.s ?? 0) + 2)) tool = ranked[0].tool
    else {
      const candidates = ranked.length ? ranked.slice(0, 5).map(x => x.tool) : tools
      const pick = await ask(() => structured(cfg, [
        { role: 'system', content: `Pick the single best tool for the request, or "none" if no tool is needed (greetings, general questions about how FindBox works).
Tools:
${candidates.map(t => `- ${t.name}: ${t.desc}`).join('\n')}` },
        ...history.slice(-4, -1).map(h => ({ role: h.role, content: String(h.content).slice(0, 300) })),
        { role: 'user', content: message },
      ], { type: 'object', properties: { tool: { type: 'string', enum: [...candidates.map(t => t.name), 'none'] } }, required: ['tool'] }, { signal }))
      tool = pick ? (pick.tool === 'none' ? null : tools.find(t => t.name === pick.tool) || null) : ranked[0]?.tool ?? null
    }
  }
  if (!tool) return { tool: null, args: {} }
  const ctx = { schools, memory }
  const args = extract(message, tool, ctx)
  const free = Object.entries(tool.params || {}).filter(([k, d]) => args[k] === undefined && (d.required || ['query', 'reply', 'message', 'title', 'name', 'new_name', 'resolution', 'reference', 'box', 'directions', 'hours'].includes(k))).map(([k]) => k)
  if (free.length) {
    onStatus('Reading the details')
    const got = await ask(() => structured(cfg, [
      { role: 'system', content: `Fill in the fields for "${tool.name}" (${tool.desc}) from the request. Use only what the person said or the recent context. Never invent emails, names or ids; use "" when a field was not given.${Object.keys(memory).length ? `
Recent context: ${JSON.stringify(memory).slice(0, 600)}` : ''}${schools.length ? `
Known schools: ${schools.join(', ')}` : ''}` },
      { role: 'user', content: message },
    ], argSchema(tool, free), { signal }))
    for (const [k, v] of Object.entries(got || {})) if (v !== '' && v !== null && v !== undefined && args[k] === undefined) args[k] = v
  }
  // Never trust an email the person did not write or see.
  if (args.email && !message.includes(args.email) && !(memory.emails || []).includes(args.email)) delete args.email
  const missing = missingRequired(tool, args)
  if (missing.length) return { tool, args, missing, question: `To ${tool.desc.charAt(0).toLowerCase() + tool.desc.slice(1).replace(/\.$/, '')}, I need: ${missing.map(m => tool.params[m].desc.replace(/\.$/, '').toLowerCase()).join('; ')}.` }
  return { tool, args: validate(tool, args) }
}

export async function assistantRoutes(app, { pool, cfg, user }) {
  const call = (req) => async (method, url, body) => {
    const r = await app.inject({ method, url, payload: body, remoteAddress: req.ip, headers: {
      cookie: req.headers.cookie || '', 'user-agent': req.headers['user-agent'] || 'FindBox assistant',
      'x-findbox-portal': 'ops', origin: req.headers.origin || cfg.opsOrigin || cfg.origin,
      ...(body ? { 'x-findbox-request': '1', 'content-type': 'application/json' } : {}),
    } })
    let data = {}; try { data = r.json() } catch { /* empty */ }
    if (r.statusCode >= 400) throw new ToolError(data.error || 'That did not work. Please try again.', r.statusCode)
    return data
  }
  // The company access endpoint enforces the ops portal, MFA and company role; user() gives the session's account.
  async function access(req) {
    const a = await call(req)('GET', '/api/company/access')
    const u = await user(req)
    return { ...a, userId: u.id }
  }
  const schoolNames = async () => (await pool.query("SELECT name FROM schools WHERE lifecycle<>'archived' ORDER BY length(name) DESC")).rows.map(r => r.name)

  // Download and warm the model in the background after a deploy; the app works without it meanwhile.
  if (cfg.ollamaUrl && !cfg.disableAssistantWarmup) setTimeout(() => { ensureModel(cfg, (m) => app.log.info(m)).then(s => s.ready && warm(cfg)).catch(() => {}) }, 5000)

  app.get('/api/company/assistant', async (req) => {
    const a = await access(req)
    const st = await llmStatus(cfg)
    const conversations = (await pool.query('SELECT id,title,updated_at FROM assistant_conversations WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 30', [a.userId])).rows
    return { role: a.role, name: a.name, model: st.model, online: st.online, ready: st.ready, suggestions: SUGGESTIONS[a.role] || [], conversations, tools: toolsFor(a.role).map(t => ({ name: t.name, kind: t.kind, desc: t.desc })) }
  })

  app.get('/api/company/assistant/conversations/:id', async (req) => {
    const a = await access(req)
    const c = (await pool.query('SELECT id,title FROM assistant_conversations WHERE id=$1 AND user_id=$2', [req.params.id, a.userId])).rows[0]
    if (!c) throw new ToolError('Conversation not found', 404)
    const messages = (await pool.query('SELECT id,role,content,data,created_at FROM assistant_messages WHERE conversation_id=$1 ORDER BY created_at,id', [c.id])).rows
    const actions = (await pool.query('SELECT id,tool,summary,details,status,error,created_at FROM assistant_actions WHERE conversation_id=$1', [c.id])).rows
    return { ...c, messages, actions }
  })

  app.post('/api/company/assistant/conversations/:id/delete', async (req) => {
    const a = await access(req)
    await pool.query('DELETE FROM assistant_conversations WHERE id=$1 AND user_id=$2', [req.params.id, a.userId])
    return { ok: true }
  })

  app.post('/api/company/assistant/actions/:id/:decision', async (req) => {
    const a = await access(req)
    const decision = z.enum(['confirm', 'cancel']).parse(req.params.decision)
    const act = (await pool.query("SELECT * FROM assistant_actions WHERE id=$1 AND user_id=$2 AND status='pending' AND created_at>now()-interval '30 minutes'", [req.params.id, a.userId])).rows[0]
    if (!act) throw new ToolError('This action has expired or was already handled. Ask again to prepare a fresh one.', 409)
    if (decision === 'cancel') { await pool.query("UPDATE assistant_actions SET status='cancelled',decided_at=now() WHERE id=$1", [act.id]); return { status: 'cancelled' } }
    const tool = byName(act.tool)
    if (!tool || !tool.roles.includes(a.role)) throw new ToolError('Your role cannot do this.', 403)
    try {
      const result = await call(req)(act.request.method, act.request.url, act.request.body)
      await pool.query("UPDATE assistant_actions SET status='done',result=$2,decided_at=now() WHERE id=$1", [act.id, JSON.stringify(result ?? {})])
      await pool.query("INSERT INTO assistant_messages(id,conversation_id,role,content,data) VALUES($1,$2,'assistant',$3,$4)", [randomUUID(), act.conversation_id, `Done: ${act.summary}.`, JSON.stringify({ action: act.id })])
      return { status: 'done', summary: act.summary }
    } catch (e) {
      const msg = e.status === 403 && /sign in again/i.test(e.message) ? 'For safety, changes need a sign-in within the last 10 minutes. Sign out and back in, then ask again.' : e.message
      await pool.query("UPDATE assistant_actions SET status='failed',error=$2,decided_at=now() WHERE id=$1", [act.id, msg])
      throw new ToolError(msg, e.status || 400)
    }
  })

  app.post('/api/company/assistant/chat', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const a = await access(req)
    const { message, conversationId } = z.object({ message: z.string().trim().min(1).max(2000), conversationId: z.string().uuid().optional() }).strict().parse(req.body)
    let convo = conversationId ? (await pool.query('SELECT id FROM assistant_conversations WHERE id=$1 AND user_id=$2', [conversationId, a.userId])).rows[0] : null
    if (!convo) { convo = { id: randomUUID() }; await pool.query('INSERT INTO assistant_conversations(id,user_id,title) VALUES($1,$2,$3)', [convo.id, a.userId, message.slice(0, 80)]) }
    await pool.query("INSERT INTO assistant_messages(id,conversation_id,role,content) VALUES($1,$2,'user',$3)", [randomUUID(), convo.id, message])
    const history = (await pool.query("SELECT role,content,data FROM assistant_messages WHERE conversation_id=$1 ORDER BY created_at DESC,id DESC LIMIT 9", [convo.id])).rows.reverse()
    const memory = {}
    for (const h of history) for (const [k, v] of Object.entries(h.data?.entities || {})) if (v?.length) memory[k] = v

    reply.hijack()
    const res = reply.raw
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' })
    const send = (event, data) => { if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`) }
    const abort = new AbortController()
    req.raw.on('close', () => abort.abort())
    send('conversation', { id: convo.id })
    const tools = toolsFor(a.role)
    const ctx = { pool, api: call(req), role: a.role, memory, schools: await schoolNames(), reason: ('FindBox assistant: ' + message).slice(0, 480), requestKey: randomUUID() }
    let online = true
    const llm = async (fn) => { if (!online) return null; try { return await fn() } catch (e) { if (abort.signal.aborted) throw e; online = false; send('status', { text: 'The AI model is offline, so I am answering from rules only.', offline: true }); return null } }
    let text = '', data = {}
    try {
      const planned = await plan({ message, tools, history, memory, schools: ctx.schools, ask: llm, cfg, signal: abort.signal, onStatus: (t) => send('status', { text: t }) })
      let tool = planned.tool, args = planned.args
      if (planned.missing?.length) { text = planned.question; send('token', { text }); tool = null }
      // 3. Act.
      let result = null
      if (tool?.kind === 'read') {
        send('status', { text: tool.label })
        result = await tool.run(ctx, args)
        data = { tool: tool.name, title: result.title, columns: result.columns, rows: result.rows.slice(0, 200), entities: result.entities }
        send('result', data)
      } else if (tool?.kind === 'write') {
        send('status', { text: tool.label })
        const prep = await tool.prepare(ctx, args)
        const id = randomUUID()
        await pool.query("INSERT INTO assistant_actions(id,conversation_id,user_id,tool,summary,details,request,status) VALUES($1,$2,$3,$4,$5,$6,$7,'pending')", [id, convo.id, a.userId, tool.name, prep.summary, JSON.stringify(prep.details), JSON.stringify(prep.request)])
        data = { tool: tool.name, action: { id, summary: prep.summary, details: prep.details, status: 'pending' } }
        send('proposal', data.action)
        text = `I've prepared this for you: ${prep.summary}. Check the details, then tap Confirm to do it.`
        send('token', { text })
      }
      // 4. Answer.
      if (!text) {
        send('status', { text: 'Writing the answer' })
        const msgs = [{ role: 'system', content: systemPrompt(a) }, ...history.slice(-7, -1).map(h => ({ role: h.role, content: h.content.slice(0, 600) }))]
        msgs.push({ role: 'user', content: result ? `DATA from ${tool.name}:\n${compact(result)}\n\nQuestion: ${message}` : `${message}\n\n(You can look up: ${tools.filter(t => t.kind === 'read').map(t => t.desc.split(':')[0].split('.')[0].toLowerCase()).slice(0, 8).join('; ')}. You can also prepare changes for confirmation.)` })
        const streamed = await llm(() => stream(cfg, msgs, (piece) => send('token', { text: piece }), { signal: abort.signal }))
        if (streamed) text = streamed
        else {
          text = result ? (result.rows.length ? `Here is ${result.title.toLowerCase()}: ${result.rows.length} ${result.rows.length === 1 ? 'row' : 'rows'}.` : `I found nothing for ${result.title.toLowerCase()}.`)
            : `I can help with ${a.role === 'admin' ? 'orders, invoices, support, clients, announcements and platform numbers' : 'system health, accounts, sessions, schools, emails, privacy requests and platform numbers'}. Try one of the suggestions.`
          send('token', { text })
        }
      }
    } catch (e) {
      if (abort.signal.aborted) { res.end(); return }
      text = e instanceof ToolError ? e.message : 'Something went wrong while answering. Please try again.'
      if (!(e instanceof ToolError)) app.log.error({ err: e }, 'assistant failed')
      send('error', { text })
    }
    await pool.query("INSERT INTO assistant_messages(id,conversation_id,role,content,data) VALUES($1,$2,'assistant',$3,$4)", [randomUUID(), convo.id, text, JSON.stringify(data)])
    await pool.query('UPDATE assistant_conversations SET updated_at=now() WHERE id=$1', [convo.id])
    send('done', {}); res.end()
  })
}
