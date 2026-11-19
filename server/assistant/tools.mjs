// Everything the assistant can look up or change. Reads and writes go through the same company API
// endpoints the workspace uses (app.inject with the operator's own session), so the assistant can never do
// more than the signed-in person: the endpoints enforce admin vs developer, recent sign-in, reasons and audit.
// A few aggregate reads use read-only SQL and are gated by role here.

const ksh = (minor) => 'KSh ' + (Number(minor || 0) / 100).toLocaleString('en-KE', { maximumFractionDigits: 2 })
const day = (v) => (v ? new Date(v).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')
const short = (id) => String(id || '').slice(0, 8)
export class ToolError extends Error { constructor(message, status = 400) { super(message); this.status = status; this.statusCode = status } }

// ---------- lookups used to turn human references (emails, school names) into ids ----------
async function userByEmail(ctx, email) {
  const r = (await ctx.pool.query('SELECT id,name,email,role,disabled_at,revision FROM users WHERE lower(email)=lower($1)', [email])).rows[0]
  if (!r) throw new ToolError(`No account uses ${email}.`, 404)
  return r
}
async function schoolByName(ctx, name) {
  const rows = (await ctx.pool.query("SELECT id,name,lifecycle,revision FROM schools WHERE name ILIKE '%'||$1||'%' ORDER BY (lower(name)=lower($1)) DESC,name LIMIT 6", [name])).rows
  if (!rows.length) throw new ToolError(`No school matches "${name}".`, 404)
  if (rows.length > 1 && rows[0].name.toLowerCase() !== name.toLowerCase()) throw new ToolError(`Several schools match "${name}": ${rows.map(r => r.name).join(', ')}. Which one?`, 409)
  return rows[0]
}
async function byPrefix(ctx, table, column, value, label) {
  const rows = (await ctx.pool.query(`SELECT * FROM ${table} WHERE ${column}::text ILIKE $1||'%' LIMIT 3`, [String(value).trim()])).rows
  if (!rows.length) throw new ToolError(`No ${label} starts with "${value}".`, 404)
  if (rows.length > 1) throw new ToolError(`More than one ${label} starts with "${value}". Give a few more characters.`, 409)
  return rows[0]
}
const records = async (ctx, kind, q = '') => (await ctx.api('GET', `/api/company/records/${kind}?q=${encodeURIComponent(q || '')}`)).rows

// ---------- tool catalogue ----------
// params: { name: { type: 'string'|'number', desc, enum?, required? } }
// read tools: run(ctx, args) -> { title, columns, rows, facts?, entities? }
// write tools: prepare(ctx, args) -> { summary, details, request: { method, url, body } }
export const TOOLS = [
  // ===== shared reads =====
  { name: 'platform_stats', roles: ['admin', 'developer'], kind: 'read', label: 'Counting accounts, schools and tags',
    desc: 'Totals: how many users, accounts by role, schools, students, belongings, tags, open recoveries, orders, support and email queue.',
    keywords: [/how many|\bcount\b|totals?\b|number of|\bstats\b|statistics|\bnumbers\b|sign-?ups/i], params: {},
    async run(ctx) {
      const one = async (sql) => (await ctx.pool.query(sql)).rows
      const [roles, company, schools, students, items, tags, cases, outbox, recent] = await Promise.all([
        one("SELECT role,count(*)::int n FROM users u WHERE NOT EXISTS(SELECT 1 FROM company_access c WHERE c.user_id=u.id) GROUP BY role ORDER BY role"),
        one('SELECT role,count(*)::int n FROM company_access GROUP BY role'),
        one('SELECT lifecycle,count(*)::int n FROM schools GROUP BY lifecycle'),
        one("SELECT count(*)::int n, count(*) FILTER(WHERE user_id IS NOT NULL)::int with_login FROM students WHERE status='active'"),
        one('SELECT count(*)::int n FROM items'),
        one('SELECT status,count(*)::int n FROM tags GROUP BY status'),
        one("SELECT count(*) FILTER(WHERE status NOT IN ('returned','closed'))::int open, count(*) FILTER(WHERE status='returned')::int returned FROM cases"),
        one('SELECT count(*) FILTER(WHERE sent_at IS NULL)::int pending, count(*) FILTER(WHERE sent_at IS NULL AND attempts>=8)::int failed FROM outbox'),
        one("SELECT count(*)::int n FROM users WHERE created_at>now()-interval '7 days'"),
      ])
      const people = roles.reduce((n, r) => n + r.n, 0), staff = company.reduce((n, r) => n + r.n, 0)
      const rows = [
        { metric: 'User accounts (all)', value: people + staff },
        ...roles.map(r => ({ metric: `· ${r.role === 'manager' ? 'school admin (manager)' : r.role} accounts`, value: r.n })),
        ...company.map(r => ({ metric: `· company ${r.role}`, value: r.n })),
        { metric: 'New accounts, last 7 days', value: recent[0].n },
        ...schools.map(r => ({ metric: `Schools ${r.lifecycle}`, value: r.n })),
        { metric: 'Students on rosters', value: students[0].n }, { metric: '· with their own login', value: students[0].with_login },
        { metric: 'Belongings registered', value: items[0].n },
        ...tags.map(r => ({ metric: `Tags ${r.status}`, value: r.n })),
        { metric: 'Open recoveries', value: cases[0].open }, { metric: 'Items returned', value: cases[0].returned },
        { metric: 'Emails waiting', value: outbox[0].pending }, { metric: 'Emails failed', value: outbox[0].failed },
      ]
      return { title: 'Platform numbers', columns: [['metric', 'Metric'], ['value', 'Value']], rows }
    } },
  { name: 'overview', roles: ['admin', 'developer'], kind: 'read', label: 'Reading the company overview',
    desc: 'Today at a glance: new accounts today, sign-in activity, and for admins sales, orders awaiting fulfilment and support.',
    keywords: [/overview|today|dashboard|at a glance|summary|how are we doing|sales|revenue|collected/i], params: {},
    async run(ctx) {
      const o = await ctx.api('GET', '/api/company/overview')
      const rows = [
        { metric: 'Accounts', value: o.accounts.total }, { metric: 'New today', value: o.accounts.new_today }, { metric: 'Verified', value: o.accounts.verified },
        ...(o.activity || []).map(a => ({ metric: a.action.replaceAll('_', ' ') + ' (24h)', value: a.count })),
      ]
      if (o.sales) rows.push({ metric: 'Orders', value: o.sales.orders }, { metric: 'Collected', value: ksh(o.sales.collected_minor) }, { metric: 'Paid, awaiting fulfilment', value: o.sales.awaiting_fulfillment }, { metric: 'Schools', value: o.schools }, ...(o.support || []).map(s => ({ metric: 'Support ' + s.status, value: s.count })))
      return { title: 'Overview', columns: [['metric', 'Metric'], ['value', 'Value']], rows }
    } },
  { name: 'find_users', roles: ['admin', 'developer'], kind: 'read', label: 'Searching accounts',
    desc: 'Find accounts by name or email, with role, verification, disabled state and last sign-in.',
    keywords: [/\b(find|search|look ?up|who is|show|details for)\b.*\b(user|account|parent|person|people)|\b(user|account|person)\b.*\b(named|called)\b|list (all )?(users|accounts|parents)|^(find|search|look ?up)\b/i],
    params: { query: { type: 'string', desc: 'Name or email to search for. Empty lists everyone.' } },
    async run(ctx, { query = '' }) {
      const rows = (await records(ctx, 'users', query)).map(r => ({ name: r.name, email: r.email, role: r.role, verified: r.verified ? 'yes' : 'no', status: r.disabled_at ? 'disabled' : 'active', last_sign_in: day(r.last_sign_in || r.last_login) || '—', joined: day(r.created_at) }))
      return { title: `Accounts${query ? ` matching "${query}"` : ''}`, columns: [['name', 'Name'], ['email', 'Email'], ['role', 'Role'], ['status', 'Status'], ['verified', 'Verified'], ['joined', 'Joined']], rows, entities: { emails: rows.map(r => r.email) } }
    } },
  { name: 'find_schools', roles: ['admin', 'developer'], kind: 'read', label: 'Searching schools',
    desc: 'List or search schools with their status and collection days.',
    keywords: [/^(?!.*\b(how many|number of|count|totals?|report|invit|code|recover|health|healthy|at risk|struggling|pipeline|leads?|prospects?)).*\bschools?\b/i], params: { query: { type: 'string', desc: 'School name to search for. Empty lists all.' } },
    async run(ctx, { query = '' }) {
      const rows = (await records(ctx, 'schools', query)).map(r => ({ school: r.name, status: r.lifecycle, collection_days: r.collection_days }))
      return { title: 'Schools', columns: [['school', 'School'], ['status', 'Status'], ['collection_days', 'Collection days']], rows, entities: { schools: rows.map(r => r.school) } }
    } },
  { name: 'school_reports', roles: ['admin', 'developer'], kind: 'read', label: 'Building school reports',
    desc: 'Per-school activity: active students, registered belongings, items recovered and open cases.',
    keywords: [/report|per school|by school|which school|recover(ed|y) rate|performance|activity/i], params: {},
    async run(ctx) {
      const rows = (await ctx.api('GET', '/api/company/school-reports')).rows.map(r => ({ school: r.name, status: r.lifecycle, students: r.students, belongings: r.registered_items, recovered: r.recovered, open: r.open_cases ?? r.open ?? '' }))
      return { title: 'School reports', columns: [['school', 'School'], ['status', 'Status'], ['students', 'Students'], ['belongings', 'Belongings'], ['recovered', 'Recovered'], ['open', 'Open cases']], rows, entities: { schools: rows.map(r => r.school) } }
    } },
  { name: 'audit_history', roles: ['admin', 'developer'], kind: 'read', label: 'Searching the audit history',
    desc: 'Who changed what and why: company operations audit trail, searchable by action or record id.',
    keywords: [/audit|history|who (changed|did|disabled|approved)|log of changes|trail/i], params: { query: { type: 'string', desc: 'Action or record id to search for, e.g. "school" or "order_fulfilled".' } },
    async run(ctx, { query = '' }) {
      const rows = (await records(ctx, 'audit', query)).map(r => ({ when: day(r.created_at), by: r.actor, action: r.action.replaceAll('_', ' '), record: short(r.entity_id), reason: r.reason }))
      return { title: 'Audit history', columns: [['when', 'When'], ['by', 'By'], ['action', 'Action'], ['record', 'Record'], ['reason', 'Reason']], rows }
    } },
  { name: 'who_is_signed_in', roles: ['developer'], kind: 'read', label: 'Checking active sessions',
    desc: 'Who is signed in right now: active sessions with portal, device and last activity.',
    keywords: [/signed[ -]?in|logged[ -]?in|online|active sessions?|sessions?\b|who is (on|using)/i], params: {},
    async run(ctx) {
      const rows = (await ctx.pool.query("SELECT u.name,u.email,COALESCE(s.portal,'legacy') portal,s.user_agent,s.last_seen_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.expires_at>now() ORDER BY s.last_seen_at DESC LIMIT 50")).rows
        .map(r => ({ name: r.name, email: r.email, portal: r.portal, device: /iphone/i.test(r.user_agent) ? 'iPhone' : /android/i.test(r.user_agent) ? 'Android' : /windows/i.test(r.user_agent) ? 'Windows' : /mac os/i.test(r.user_agent) ? 'Mac' : r.user_agent ? 'Browser' : 'Not recorded', last_active: day(r.last_seen_at) }))
      return { title: 'Signed in now', columns: [['name', 'Name'], ['email', 'Email'], ['portal', 'Portal'], ['device', 'Device'], ['last_active', 'Last active']], rows, entities: { emails: rows.map(r => r.email) } }
    } },
  // ===== admin reads =====
  { name: 'find_orders', roles: ['admin'], kind: 'read', label: 'Searching orders',
    desc: 'Orders with status, amount, payment method and customer. Search by order id.',
    keywords: [/orders?\b|purchas|bought|checkout|fulfil|fulfill|deliver/i], params: { query: { type: 'string', desc: 'Order id (or its first characters). Empty lists recent orders.' } },
    async run(ctx, { query = '' }) {
      const rows = (await records(ctx, 'orders', query)).map(r => ({ order: short(r.id), customer: r.customer, status: r.status, amount: ksh(r.amount_minor), method: r.payment_method || '', placed: day(r.created_at) }))
      return { title: 'Orders', columns: [['order', 'Order'], ['customer', 'Customer'], ['status', 'Status'], ['amount', 'Amount'], ['method', 'Paid by'], ['placed', 'Placed']], rows, entities: { orders: rows.map(r => r.order) } }
    } },
  { name: 'support_inbox', roles: ['admin'], kind: 'read', label: 'Opening the support inbox',
    desc: 'Support tickets from families and schools with status. Search by subject or email.',
    keywords: [/support|tickets?|inbox|complain|messages? from|enquir|feedback/i], params: { query: { type: 'string', desc: 'Subject words or email. Empty lists recent tickets.' } },
    async run(ctx, { query = '' }) {
      const rows = (await records(ctx, 'support', query)).map(r => ({ ticket: short(r.id), from: `${r.name} <${r.email}>`, subject: r.subject, status: r.status, updated: day(r.updated_at), message: String(r.message || '').slice(0, 160) }))
      return { title: 'Support inbox', columns: [['ticket', 'Ticket'], ['from', 'From'], ['subject', 'Subject'], ['status', 'Status'], ['updated', 'Updated']], rows, entities: { tickets: rows.map(r => r.ticket) } }
    } },
  { name: 'find_invoices', roles: ['admin'], kind: 'read', label: 'Searching invoices',
    desc: 'Invoices with number, customer, status, total and due date, plus payments recorded.',
    keywords: [/invoices?|billing|bills?\b|owed|unpaid|due date|payments? (recorded|received)/i], params: { query: { type: 'string', desc: 'Invoice number or customer. Empty lists all.' } },
    async run(ctx) {
      const rows = (await ctx.api('GET', '/api/company/invoice-ledger')).rows.map(r => ({ invoice: r.number || short(r.id), customer: r.customer, status: r.status, total: ksh(r.total_minor), paid: ksh(r.paid_minor), due: r.due_date || '' }))
      return { title: 'Invoices', columns: [['invoice', 'Invoice'], ['customer', 'Customer'], ['status', 'Status'], ['total', 'Total'], ['paid', 'Paid'], ['due', 'Due']], rows, entities: { invoices: rows.map(r => r.invoice) } }
    } },
  { name: 'find_clients', roles: ['admin'], kind: 'read', label: 'Searching clients',
    desc: 'Family (parent) customer accounts, searchable by name or email.',
    keywords: [/clients?|customers?|famil(y|ies)/i], params: { query: { type: 'string', desc: 'Name or email.' } },
    async run(ctx, { query = '' }) {
      const rows = (await records(ctx, 'clients', query)).map(r => ({ name: r.name, email: r.email, verified: r.verified ? 'yes' : 'no', status: r.disabled_at ? 'disabled' : 'active', joined: day(r.created_at) }))
      return { title: 'Clients', columns: [['name', 'Name'], ['email', 'Email'], ['verified', 'Verified'], ['status', 'Status'], ['joined', 'Joined']], rows, entities: { emails: rows.map(r => r.email) } }
    } },
  // ===== developer reads =====
  { name: 'system_health', roles: ['developer'], kind: 'read', label: 'Checking system health',
    desc: 'API and database health, response times, errors, memory, uptime and the email queue.',
    keywords: [/health|status|uptime|errors?|slow|latency|response time|database|server|memory|is (it|the site) (up|down)|down\b/i], params: {},
    async run(ctx) {
      const h = await ctx.api('GET', '/api/company/health')
      const flat = (o, p = '') => Object.entries(o || {}).flatMap(([k, v]) => v && typeof v === 'object' && !Array.isArray(v) ? flat(v, p + k + ' ') : [{ metric: (p + k).replaceAll('_', ' '), value: Array.isArray(v) ? v.length + ' entries' : String(v) }])
      return { title: 'System health', columns: [['metric', 'Metric'], ['value', 'Value']], rows: flat(h).slice(0, 40) }
    } },
  { name: 'email_queue', roles: ['developer'], kind: 'read', label: 'Checking the email queue',
    desc: 'Outgoing emails: waiting, sent and failed, with attempts.',
    keywords: [/e-?mails?|mail queue|outbox|not (sent|delivered)|bounced|deliver(y|ed)/i], params: { query: { type: 'string', desc: 'Subject words. Empty lists recent.' } },
    async run(ctx, { query = '' }) {
      const rows = (await records(ctx, 'mail', query)).map(r => ({ email: short(r.id), subject: r.subject, state: r.sent_at ? 'sent' : r.attempts >= 8 ? 'failed' : 'waiting', attempts: r.attempts, sent: day(r.sent_at) }))
      return { title: 'Email queue', columns: [['email', 'Email'], ['subject', 'Subject'], ['state', 'State'], ['attempts', 'Attempts'], ['sent', 'Sent']], rows, entities: { mails: rows.filter(r => r.state === 'failed').map(r => r.email) } }
    } },
  { name: 'find_belongings', roles: ['developer'], kind: 'read', label: 'Searching belongings',
    desc: 'Registered belongings (items) with category, status and school. Search by name.',
    keywords: [/belongings?|items?\b|bottles?|sweaters?|lunchbox|tagged item/i], params: { query: { type: 'string', desc: 'Item name or colour.' } },
    async run(ctx, { query = '' }) {
      const rows = (await records(ctx, 'items', query)).map(r => ({ item: r.name, category: r.category, colour: r.color, status: r.status.replaceAll('_', ' '), school: r.school }))
      return { title: 'Belongings', columns: [['item', 'Item'], ['category', 'Category'], ['colour', 'Colour'], ['status', 'Status'], ['school', 'School']], rows }
    } },
  { name: 'school_access', roles: ['developer'], kind: 'read', label: 'Reading school access',
    desc: 'Schools with contacts, privacy basis and lifecycle, plus pending and accepted school admin invitations.',
    keywords: [/school (admin|access|invite|invitation|contact|onboard)|invitations?|pending invite|who (runs|manages) .*school/i], params: {},
    async run(ctx) {
      const d = await ctx.api('GET', '/api/company/school-access')
      const rows = [...d.schools.map(s => ({ kind: 'School', name: s.name, detail: `${s.lifecycle} · ${s.contact_name || 'no contact'} ${s.contact_email ? '<' + s.contact_email + '>' : ''}` })),
        ...d.invites.map(i => ({ kind: 'Invite', name: i.school, detail: `${i.email} · ${i.accepted_at ? 'accepted' : i.cancelled_at ? 'cancelled' : 'pending until ' + day(i.expires_at)}` }))]
      return { title: 'School access', columns: [['kind', 'Type'], ['name', 'School'], ['detail', 'Detail']], rows, entities: { schools: d.schools.map(s => s.name) } }
    } },
  { name: 'privacy_requests', roles: ['developer'], kind: 'read', label: 'Reading privacy requests',
    desc: 'Data deletion and correction requests from users, with status.',
    keywords: [/privacy|deletion|delete (my|their) data|correction|gdpr|data request/i], params: {},
    async run(ctx) {
      const rows = (await ctx.api('GET', '/api/company/privacy-requests')).rows.map(r => ({ request: short(r.id), from: r.email, kind: r.kind, status: r.status, received: day(r.created_at) }))
      return { title: 'Privacy requests', columns: [['request', 'Request'], ['from', 'From'], ['kind', 'Kind'], ['status', 'Status'], ['received', 'Received']], rows, entities: { privacy: rows.map(r => r.request) } }
    } },
  { name: 'payment_tests', roles: ['developer'], kind: 'read', label: 'Reading M-Pesa sandbox tests',
    desc: 'Daraja (M-Pesa) sandbox payment test attempts and whether Daraja is configured.',
    keywords: [/daraja|m-?pesa|sandbox|stk|payment tests?/i], params: {},
    async run(ctx) {
      const d = await ctx.api('GET', '/api/company/daraja')
      return { title: `M-Pesa sandbox (${d.configured ? 'configured' : 'not configured'})`, columns: [['when', 'When'], ['amount', 'KES'], ['phone', 'Phone ends'], ['status', 'Status']], rows: d.attempts.map(a => ({ when: day(a.created_at), amount: a.amount_kes, phone: a.phone_suffix, status: a.status })) }
    } },

  // ===== admin actions =====
  { name: 'fulfill_order', roles: ['admin'], kind: 'write', label: 'Preparing order fulfilment',
    desc: 'Mark a paid order as fulfilled and allocate its tags.', keywords: [/fulfil+ (the |order )?|mark .*fulfil|ship order|allocate tags/i],
    params: { order: { type: 'string', desc: 'Order id or its first 8 characters.', required: true } },
    async prepare(ctx, { order }) {
      const o = await byPrefix(ctx, 'orders', 'id', order, 'order')
      return { summary: `Fulfil order ${short(o.id)} (${ksh(o.amount_minor)}, ${o.status})`, details: [['Order', short(o.id)], ['Amount', ksh(o.amount_minor)], ['Current status', o.status]], request: { method: 'POST', url: `/api/company/orders/${o.id}/fulfill`, body: { reason: ctx.reason } } }
    } },
  { name: 'reply_support', roles: ['admin'], kind: 'write', label: 'Drafting a support reply',
    desc: 'Reply to a support ticket by email and set its status.', keywords: [/reply|respond|answer .*ticket|resolve .*ticket|close .*ticket/i],
    params: { ticket: { type: 'string', desc: 'Ticket id or its first 8 characters.', required: true }, reply: { type: 'string', desc: 'The reply to send to the person. Polite, short, signed "The FindBox team".', required: true }, status: { type: 'string', enum: ['in_progress', 'resolved'], desc: 'New status. Use resolved if the reply settles it.', required: true } },
    async prepare(ctx, { ticket, reply, status }) {
      const t = await byPrefix(ctx, 'support_tickets', 'id', ticket, 'ticket')
      return { summary: `Reply to ${t.name} about "${t.subject}" and mark it ${status.replace('_', ' ')}`, details: [['To', `${t.name} <${t.email}>`], ['Subject', t.subject], ['Reply', reply], ['New status', status.replace('_', ' ')]], request: { method: 'POST', url: `/api/company/support/${t.id}`, body: { status, reply, reason: ctx.reason } } }
    } },
  { name: 'invoice_action', roles: ['admin'], kind: 'write', label: 'Preparing an invoice action',
    desc: 'Issue, send or void an invoice.', keywords: [/(issue|send|void|cancel) (the )?invoice/i],
    params: { invoice: { type: 'string', desc: 'Invoice number or id.', required: true }, action: { type: 'string', enum: ['issue', 'send', 'void'], desc: 'What to do.', required: true } },
    async prepare(ctx, { invoice, action }) {
      const inv = (await ctx.pool.query('SELECT * FROM invoices WHERE number=$1 OR id::text ILIKE $1||\'%\' LIMIT 2', [invoice])).rows
      if (inv.length !== 1) throw new ToolError(inv.length ? 'More than one invoice matches. Use the full number.' : `No invoice matches "${invoice}".`, 404)
      const i = inv[0]
      return { summary: `${action[0].toUpperCase() + action.slice(1)} invoice ${i.number || short(i.id)} for ${i.customer} (${ksh(i.total_minor)})`, details: [['Invoice', i.number || short(i.id)], ['Customer', i.customer], ['Total', ksh(i.total_minor)], ['Status now', i.status]], request: { method: 'POST', url: `/api/company/invoices/${i.id}/action`, body: { action, revision: i.revision, reason: ctx.reason } } }
    } },
  { name: 'record_payment', roles: ['admin'], kind: 'write', label: 'Preparing a payment record',
    desc: 'Record a payment or credit against an invoice.', keywords: [/record (a )?(payment|credit)|paid (us|invoice)|mark .*paid|credit note/i],
    params: { invoice: { type: 'string', desc: 'Invoice number.', required: true }, kind: { type: 'string', enum: ['payment', 'credit'], desc: 'payment or credit.', required: true }, amount_kes: { type: 'number', desc: 'Amount in Kenya shillings.', required: true }, reference: { type: 'string', desc: 'M-Pesa code, bank reference or note (3+ characters).', required: true } },
    async prepare(ctx, { invoice, kind, amount_kes, reference }) {
      const i = (await ctx.pool.query('SELECT * FROM invoices WHERE number=$1 OR id::text ILIKE $1||\'%\' LIMIT 1', [invoice])).rows[0]
      if (!i) throw new ToolError(`No invoice matches "${invoice}".`, 404)
      return { summary: `Record a ${kind} of ${ksh(amount_kes * 100)} on invoice ${i.number || short(i.id)}`, details: [['Invoice', i.number || short(i.id)], ['Customer', i.customer], ['Amount', ksh(amount_kes * 100)], ['Reference', reference]], request: { method: 'POST', url: `/api/company/invoice-ledger/${i.id}`, body: { requestKey: ctx.requestKey, kind, amountMinor: Math.round(amount_kes * 100), reference, reason: ctx.reason } } }
    } },
  { name: 'invite_client', roles: ['admin'], kind: 'write', label: 'Preparing a client invitation',
    desc: 'Create a family client account and email them an invitation.', keywords: [/invite (a )?(client|customer|parent|family)|add (a )?(client|customer)/i],
    params: { name: { type: 'string', desc: 'Full name.', required: true }, email: { type: 'string', desc: 'Email address.', required: true } },
    async prepare(ctx, { name, email }) {
      return { summary: `Invite ${name} <${email}> as a FindBox client`, details: [['Name', name], ['Email', email]], request: { method: 'POST', url: '/api/company/clients', body: { name, email, reason: ctx.reason } } }
    } },
  { name: 'announce', roles: ['admin'], kind: 'write', label: 'Drafting an announcement',
    desc: 'Post an in-app announcement to everyone, company staff or one school.', keywords: [/announce|announcement|broadcast|notify (all|everyone)|post a (notice|message) to/i],
    params: { title: { type: 'string', desc: 'Short headline.', required: true }, message: { type: 'string', desc: 'The announcement text.', required: true }, audience: { type: 'string', enum: ['all', 'company', 'school'], desc: 'Who sees it.', required: true }, school: { type: 'string', desc: 'School name when audience is school.' }, days: { type: 'number', desc: 'How many days to show it (1-30).' } },
    async prepare(ctx, { title, message, audience, school, days = 7 }) {
      const s = audience === 'school' ? await schoolByName(ctx, school || '') : null
      return { summary: `Announce "${title}" to ${s ? s.name : audience === 'all' ? 'everyone' : 'company staff'} for ${days} days`, details: [['Title', title], ['Message', message], ['Audience', s ? s.name : audience], ['Days', String(days)]], request: { method: 'POST', url: '/api/company/announcements', body: { requestKey: ctx.requestKey, title, message, audience, schoolId: s?.id ?? null, days: Math.min(30, Math.max(1, Math.round(days))), reason: ctx.reason } } }
    } },

  // ===== developer actions =====
  { name: 'disable_user', roles: ['developer'], kind: 'write', label: 'Preparing to disable an account',
    desc: 'Disable an account so it can no longer sign in.', keywords: [/\b(disable|block|deactivate|lock)\b/i],
    params: { email: { type: 'string', desc: 'Email of the account.', required: true } },
    async prepare(ctx, { email }) {
      const u = await userByEmail(ctx, email)
      if (u.disabled_at) throw new ToolError(`${u.email} is already disabled.`, 409)
      return { summary: `Disable ${u.name} <${u.email}>`, details: [['Account', `${u.name} <${u.email}>`], ['Role', u.role]], request: { method: 'POST', url: `/api/company/users/${u.id}`, body: { name: u.name, email: u.email, disabled: true, revision: u.revision, reason: ctx.reason } } }
    } },
  { name: 'enable_user', roles: ['developer'], kind: 'write', label: 'Preparing to re-enable an account',
    desc: 'Re-enable a disabled account.', keywords: [/\b(re-?enable|enable|unblock|reactivate|restore|unlock)\b/i],
    params: { email: { type: 'string', desc: 'Email of the account.', required: true } },
    async prepare(ctx, { email }) {
      const u = await userByEmail(ctx, email)
      if (!u.disabled_at) throw new ToolError(`${u.email} is already active.`, 409)
      return { summary: `Re-enable ${u.name} <${u.email}>`, details: [['Account', `${u.name} <${u.email}>`]], request: { method: 'POST', url: `/api/company/users/${u.id}`, body: { name: u.name, email: u.email, disabled: false, revision: u.revision, reason: ctx.reason } } }
    } },
  { name: 'sign_out_user', roles: ['developer'], kind: 'write', label: 'Preparing to sign someone out',
    desc: 'Sign an account out on every device.', keywords: [/\bsign\b.*\bout\b|\blog\b.*\bout\b|end (their )?sessions?|\bkick\b/i],
    params: { email: { type: 'string', desc: 'Email of the account.', required: true } },
    async prepare(ctx, { email }) {
      const u = await userByEmail(ctx, email)
      return { summary: `Sign ${u.name} <${u.email}> out everywhere`, details: [['Account', `${u.name} <${u.email}>`]], request: { method: 'POST', url: `/api/company/users/${u.id}/sessions`, body: { reason: ctx.reason } } }
    } },
  { name: 'send_password_reset', roles: ['developer'], kind: 'write', label: 'Preparing a password reset',
    desc: 'Email a password reset link to an account.', keywords: [/password reset|reset (their |the )?password|forgot (their )?password|new password/i],
    params: { email: { type: 'string', desc: 'Email of the account.', required: true } },
    async prepare(ctx, { email }) {
      const u = await userByEmail(ctx, email)
      return { summary: `Email a password reset link to ${u.email}`, details: [['Account', `${u.name} <${u.email}>`]], request: { method: 'POST', url: `/api/company/users/${u.id}/reset`, body: { reason: ctx.reason } } }
    } },
  { name: 'create_school', roles: ['developer'], kind: 'write', label: 'Preparing a new school',
    desc: 'Onboard a new school with its first collection point.', keywords: [/(create|add|onboard|set ?up|register) (a )?(new )?school/i],
    params: { name: { type: 'string', desc: 'School name.', required: true }, box: { type: 'string', desc: 'First collection point name, e.g. Reception.' }, directions: { type: 'string', desc: 'Where the collection point is.' }, hours: { type: 'string', desc: 'Opening hours.' } },
    async prepare(ctx, { name, box = 'Reception', directions = 'Main school office', hours = 'Weekdays during school hours' }) {
      return { summary: `Create the school "${name}" with a collection point at ${box}`, details: [['School', name], ['Collection point', box], ['Directions', directions], ['Hours', hours]], request: { method: 'POST', url: '/api/company/schools', body: { requestKey: ctx.requestKey, name, box, directions, hours, reason: ctx.reason } } }
    } },
  { name: 'update_school', roles: ['developer'], kind: 'write', label: 'Preparing a school update',
    desc: 'Rename a school or change how many days items wait for collection.', keywords: [/rename .*school|collection days|change .*school (name|days)/i],
    params: { school: { type: 'string', desc: 'Current school name.', required: true }, new_name: { type: 'string', desc: 'New name, if renaming.' }, collection_days: { type: 'number', desc: 'Days items wait for collection (1-90).' } },
    async prepare(ctx, { school, new_name, collection_days }) {
      const s = await schoolByName(ctx, school)
      const cur = (await ctx.pool.query('SELECT collection_days FROM schools WHERE id=$1', [s.id])).rows[0]
      const name = new_name || s.name, days = Math.round(collection_days || cur.collection_days)
      return { summary: `Update ${s.name}: name "${name}", ${days} collection days`, details: [['School', s.name], ['New name', name], ['Collection days', String(days)]], request: { method: 'POST', url: `/api/company/schools/${s.id}`, body: { name, collectionDays: days, revision: s.revision, reason: ctx.reason } } }
    } },
  { name: 'rotate_school_code', roles: ['developer'], kind: 'write', label: 'Preparing a new school code',
    desc: "Replace a school's join code; old posters and links stop working.", keywords: [/(rotate|reset|new|change|regenerate) .*(join )?code/i],
    params: { school: { type: 'string', desc: 'School name.', required: true } },
    async prepare(ctx, { school }) {
      const s = await schoolByName(ctx, school)
      return { summary: `Replace the join code for ${s.name} (old links and posters stop working)`, details: [['School', s.name]], request: { method: 'POST', url: `/api/company/schools/${s.id}/code`, body: { revision: s.revision, reason: ctx.reason } } }
    } },
  { name: 'invite_school_admin', roles: ['developer'], kind: 'write', label: 'Preparing a school admin invitation',
    desc: 'Invite someone to be the administrator of a school.', keywords: [/invite .*(school )?admin|make .* (the )?admin of|add (a )?(school )?admin/i],
    params: { school: { type: 'string', desc: 'School name.', required: true }, name: { type: 'string', desc: "Admin's full name.", required: true }, email: { type: 'string', desc: "Admin's email.", required: true } },
    async prepare(ctx, { school, name, email }) {
      const s = await schoolByName(ctx, school)
      return { summary: `Invite ${name} <${email}> to administer ${s.name}`, details: [['School', s.name], ['Name', name], ['Email', email]], request: { method: 'POST', url: '/api/company/school-access/invite', body: { schoolId: s.id, name, email, reason: ctx.reason } } }
    } },
  { name: 'set_school_state', roles: ['developer'], kind: 'write', label: 'Preparing a school status change',
    desc: 'Set a school pending, active (live), suspended or archived.', keywords: [/\b(suspend|archive|go live|pause)\b|make .* live|school .*(suspend|archive|live|status)/i],
    params: { school: { type: 'string', desc: 'School name.', required: true }, lifecycle: { type: 'string', enum: ['pending', 'active', 'suspended', 'archived'], desc: 'New status.', required: true } },
    async prepare(ctx, { school, lifecycle }) {
      const s = await schoolByName(ctx, school)
      if (s.lifecycle === lifecycle) throw new ToolError(`${s.name} is already ${lifecycle}.`, 409)
      return { summary: `Set ${s.name} to ${lifecycle} (now ${s.lifecycle})`, details: [['School', s.name], ['From', s.lifecycle], ['To', lifecycle]], request: { method: 'POST', url: '/api/company/school-access/state', body: { schoolId: s.id, revision: s.revision, lifecycle, reason: ctx.reason } } }
    } },
  { name: 'add_membership', roles: ['developer'], kind: 'write', label: 'Preparing a school membership',
    desc: 'Add an existing account to a school as parent, student, teacher (staff) or manager.', keywords: [/\badd\b.*\bto\b.*\bas (a |an )?(parent|student|teacher|staff|manager|admin)|add .* to (the )?school|membership|make .* (a )?(teacher|staff)\b/i],
    params: { email: { type: 'string', desc: 'Account email.', required: true }, school: { type: 'string', desc: 'School name.', required: true }, role: { type: 'string', enum: ['parent', 'student', 'staff', 'manager'], desc: 'Role at the school.', required: true } },
    async prepare(ctx, { email, school, role }) {
      const u = await userByEmail(ctx, email), s = await schoolByName(ctx, school)
      return { summary: `Add ${u.email} to ${s.name} as ${role === 'staff' ? 'teacher' : role}`, details: [['Account', `${u.name} <${u.email}>`], ['School', s.name], ['Role', role]], request: { method: 'POST', url: '/api/company/membership', body: { userId: u.id, schoolId: s.id, role, reason: ctx.reason } } }
    } },
  { name: 'retry_email', roles: ['developer'], kind: 'write', label: 'Preparing an email retry',
    desc: 'Retry a failed email.', keywords: [/retry .*(e-?mail|mail)|resend (the )?(failed )?e-?mail/i],
    params: { email_id: { type: 'string', desc: 'Email id or its first 8 characters from the email queue.', required: true } },
    async prepare(ctx, { email_id }) {
      const m = await byPrefix(ctx, 'outbox', 'id', email_id, 'email')
      return { summary: `Retry the email "${m.subject}"`, details: [['Subject', m.subject], ['Attempts so far', String(m.attempts)]], request: { method: 'POST', url: `/api/company/mail/${m.id}/retry`, body: { reason: ctx.reason } } }
    } },
  { name: 'update_privacy_request', roles: ['developer'], kind: 'write', label: 'Preparing a privacy request update',
    desc: 'Mark a privacy request reviewing, resolved or declined with a resolution note.', keywords: [/(resolve|decline|review) .*privacy|privacy request .*(done|resolved|declined)/i],
    params: { request: { type: 'string', desc: 'Privacy request id or its first 8 characters.', required: true }, status: { type: 'string', enum: ['reviewing', 'resolved', 'declined'], desc: 'New status.', required: true }, resolution: { type: 'string', desc: 'What was done, for the record (8+ characters).', required: true } },
    async prepare(ctx, { request, status, resolution }) {
      const p = await byPrefix(ctx, 'privacy_requests', 'id', request, 'privacy request')
      return { summary: `Mark privacy request ${short(p.id)} ${status}`, details: [['Request', short(p.id)], ['Kind', p.kind], ['Status', status], ['Resolution', resolution]], request: { method: 'POST', url: `/api/company/privacy-requests/${p.id}`, body: { status, resolution } } }
    } },
]

// ===== principal (school administrator): everything is scoped to their own school by the school endpoints =====
const desk = (ctx, path) => ctx.api('GET', '/api/school/desk/' + path)
const PRINCIPAL = [
  { name: 'school_overview', roles: ['principal'], kind: 'read', label: 'Checking your school',
    desc: 'School overview: items in the box, overdue, unclaimed, returned, return rate, students, parents linked and what needs a decision.',
    keywords: [/overview|summary|how (are|is) (we|the school) doing|today|status|dashboard|what needs|attention|decision/i], params: {},
    async run(ctx) {
      const h = await desk(ctx, 'home'), c = h.counts
      const rows = [['Not yet home', c.notHome], ['In the box', c.inBox], ['Past collection date', c.overdue], ['Unclaimed', c.unclaimed], ['Returned in 30 days', c.returned30], ['Return rate', h.returnRate.pct === null ? 'No items yet' : h.returnRate.pct + '%'], ['Students', h.stats.students], ['Students with a parent linked', h.stats.linked], ['Waiting for your approval', h.badges.approvals]].map(([measure, value]) => ({ measure, value }))
      return { title: `${h.school.name} overview`, columns: [['measure', 'Measure'], ['value', 'Value']], rows, facts: h.attention.map((a) => a.title) }
    } },
  { name: 'items_not_home', roles: ['principal'], kind: 'read', label: 'Listing items not yet home',
    desc: 'Items not yet home: everything lost or found that has not reached its owner, where it is and how long it has waited. Optional search by item, student, class or box.',
    keywords: [/not (yet )?home|in the box|waiting|unclaimed|overdue|lost (and|&) found|lost items?|found items?|collection point|where is|which items/i],
    quick: true, looseQuery: true, params: { query: { type: 'string', desc: 'Item, student, class or box to look for.' } },
    async run(ctx, a) {
      const d = await desk(ctx, 'log?q=' + encodeURIComponent(a.query || ''))
      return { title: 'Items not yet home', columns: [['item', 'Item'], ['owner', 'Owner'], ['where', 'Where'], ['stage', 'Stage'], ['days', 'Days waiting']], rows: d.rows.map((r) => ({ item: r.title, owner: r.owner, where: r.where, stage: r.stage, days: r.ageDays })) }
    } },
  { name: 'class_progress', roles: ['principal'], kind: 'read', label: 'Checking each class',
    desc: 'Classes: students, parents linked, items labelled, items not yet home and losses in 90 days, per class.',
    keywords: [/class(es)?\b|grade|which class|per class|teachers? to nudge|linked/i], params: {},
    async run(ctx) {
      const d = await desk(ctx, 'classes')
      return { title: 'Classes', columns: [['name', 'Class'], ['students', 'Students'], ['linked', 'Parents linked'], ['items', 'Items labelled'], ['open', 'Not yet home'], ['lost90', 'Lost in 90 days']], rows: d.rows }
    } },
  { name: 'term_report', roles: ['principal'], kind: 'read', label: 'Preparing the report',
    desc: 'Report: items logged and returned, return rate and days to return, by kind of item, over 30, 90 or 365 days.',
    keywords: [/report|term|this year|statistics|stats|return rate|how many (items|things)|most (lost|common)|what gets lost/i],
    params: { days: { type: 'string', desc: 'Period in days.', enum: ['30', '90', '365'] } },
    async run(ctx, a) {
      const r = await desk(ctx, 'report?days=' + (a.days || '90'))
      return { title: `Lost and found, last ${r.days} days`, columns: [['name', 'Kind of item'], ['found', 'Logged'], ['returned', 'Returned']], rows: r.byCategory, facts: [`${r.total} items logged, ${r.returned} returned`, r.returnRate === null ? 'No return rate yet' : `Return rate ${r.returnRate}%`, r.avgDays === null ? '' : `${r.avgDays} days on average to return`].filter(Boolean) }
    } },
  { name: 'staff_activity', roles: ['principal'], kind: 'read', label: 'Checking staff activity',
    desc: 'Staff: who received and handed back items, and when they were last active.',
    keywords: [/staff|teachers?|who (received|handed|logged)|team|activity/i], params: {},
    async run(ctx) {
      const h = await desk(ctx, 'home')
      return { title: 'Staff', columns: [['name', 'Name'], ['role', 'Role'], ['handled', 'Items handled in 30 days'], ['last', 'Last active']], rows: h.team.map((t) => ({ name: t.name, role: t.role === 'manager' ? 'Administrator' : 'Teacher', handled: t.handled, last: t.last_seen ? new Date(t.last_seen).toLocaleDateString('en-KE') : 'Not yet' })) }
    } },
  { name: 'house_standings', roles: ['principal'], kind: 'read', label: 'Checking the houses',
    desc: 'Houses: standings, members, stars and items lost per house.',
    keywords: [/houses?\b|standings|stars|ubuntu|which house|green|red|blue|yellow/i], params: {},
    async run(ctx) {
      const h = await desk(ctx, 'home')
      return { title: 'House standings', columns: [['rank', '#'], ['name', 'House'], ['members', 'Members'], ['stars', 'Stars'], ['lost', 'Lost'], ['score', 'Score']], rows: h.houses }
    } },
  { name: 'pending_approvals', roles: ['principal'], kind: 'read', label: 'Checking approvals',
    desc: 'Approvals: claims on unclaimed items and donation requests waiting for a decision.',
    keywords: [/approv|claims?|donat|waiting for me|pending|decide/i, /approv|waiting for me/i], params: {},
    async run(ctx) {
      const d = await desk(ctx, 'approvals')
      const rows = [...d.claims.map((c) => ({ kind: 'Claim', item: c.title, who: c.name, note: c.evidence })), ...d.disposals.map((x) => ({ kind: 'Donation request', item: x.title, who: x.requested_by, note: x.note }))]
      return { title: 'Waiting for your decision', columns: [['kind', 'Kind'], ['item', 'Item'], ['who', 'From'], ['note', 'Note']], rows }
    } },
  { name: 'remind_families', roles: ['principal'], kind: 'write', label: 'Preparing a reminder to families',
    desc: 'Remind all families that items are waiting at the collection points (fixed message, at most once a week).',
    keywords: [/remind (all |the )?(families|parents)|tell (all |the )?(parents|families)|send (a )?reminder/i], params: {},
    async prepare(ctx) {
      const h = await desk(ctx, 'home')
      return { summary: `Remind every family at ${h.school.name} that items are waiting`, details: [['Items at collection points', String(h.counts.inBox + h.counts.unclaimed)], ['Message', 'Fixed FindBox reminder; unclaimed items are donated after 30 days'], ['Limit', 'At most once a week']], request: { method: 'POST', url: '/api/school/desk/remind-families', body: {} } }
    } },
  { name: 'invite_teacher', roles: ['principal'], kind: 'write', label: 'Preparing a teacher invitation',
    desc: 'Invite a teacher or office staff member to use the staff app.',
    keywords: [/invite (a )?(teacher|staff)|add (a )?(teacher|staff member)/i],
    params: { name: { type: 'string', desc: 'Their full name.', required: true }, email: { type: 'string', desc: 'Their work email.', required: true } },
    async prepare(ctx, a) {
      return { summary: `Invite ${a.name} (${a.email}) as a teacher`, details: [['Name', a.name], ['Email', a.email], ['What happens', 'They get an email to set a password and use the staff app']], request: { method: 'POST', url: '/api/school/staff/invite', body: { name: a.name, email: a.email } } }
    } },
]
TOOLS.push(...PRINCIPAL)

// ===== more tools: the CRM, system issues, tasks, and deeper school tools =====
// Flags read by the planner: quick = optional fields are filled by rules only (no model call),
// looseQuery / ruleTitle / ruleName = the planner may read that field straight from the sentence.
const crm = (ctx, path) => ctx.api('GET', '/api/company/crm/' + path)
const cards = (board) => board.columns.flatMap((c) => c.cards.map((x) => ({ ...x, column: c.title, columnId: c.id })))
const pickOne = (list, query, label) => {
  const q = String(query || '').toLowerCase().trim(), hits = list.filter((x) => x.title.toLowerCase().includes(q))
  if (!hits.length) throw new ToolError(`No ${label} matches "${query}".`, 404)
  const exact = hits.find((x) => x.title.toLowerCase() === q)
  if (hits.length > 1 && !exact) throw new ToolError(`Several ${label}s match "${query}": ${hits.slice(0, 5).map((x) => x.title).join(', ')}. Which one?`, 409)
  return exact || hits[0]
}
const SEVERITIES = ['s1', 's2', 's3', 's4'], LEAD_STAGES = ['contacted', 'demo', 'proposal', 'won', 'new']
const MORE_TOOLS = [
  { name: 'what_can_you_do', roles: ['admin', 'developer', 'principal'], kind: 'read', label: 'Listing what I can do', plain: true,
    desc: 'Help: everything this assistant can look up or prepare for you.',
    keywords: [/^help\b|what can you (do|help)|what do you do|your (tools|abilities|capabilities)|how (do|can) (i|you) use (you|this)/i], params: {},
    async run(ctx) {
      const mine = TOOLS.filter((t) => t.roles.includes(ctx.role) && t.name !== 'what_can_you_do')
      const needs = (t) => Object.entries(t.params || {}).filter(([, d]) => d.required).map(([k]) => k.replaceAll('_', ' ')).join(', ') || 'Nothing'
      return { title: 'What I can do', columns: [['kind', 'Type'], ['what', 'What'], ['needs', 'I need from you']], rows: mine.map((t) => ({ kind: t.kind === 'read' ? 'Look up' : 'Prepare a change', what: t.desc.split(':')[0].replace(/\.$/, ''), needs: needs(t) })), facts: [`${mine.filter((t) => t.kind === 'read').length} things I can look up`, `${mine.filter((t) => t.kind === 'write').length} changes I can prepare for you to confirm`] }
    } },
  { name: 'school_health', roles: ['admin', 'developer'], kind: 'read', label: 'Checking school health', quick: true, looseQuery: true,
    desc: 'School health: each partner school with students, families, items and a health score; shows which are at risk.',
    keywords: [/school health|health scores?|at risk|struggling|healthy schools?|roll-?out/i, /\b(health|at risk|struggling)\b.*\bschools?\b|\bschools?\b.*\b(health|at risk|struggling|need (attention|help))\b/i], params: { query: { type: 'string', desc: 'School name to look for.' } },
    async run(ctx, a) {
      const d = await crm(ctx, 'customers?type=schools&sort=health&q=' + encodeURIComponent(a.query || ''))
      return { title: 'School health', columns: [['name', 'School'], ['students', 'Students'], ['families', 'Families'], ['items', 'Items'], ['health', 'Health']], rows: d.rows.map((s) => ({ name: s.name, students: s.a, families: s.b, items: s.c, health: s.health.band === 'new' ? 'New' : `${s.health.score} (${s.health.band})` })), entities: { schools: d.rows.map((s) => s.name) }, facts: [`${d.rows.filter((s) => s.health.band === 'red').length} at risk`, `${d.rows.filter((s) => s.health.band === 'green').length} healthy`] }
    } },
  { name: 'my_tasks', roles: ['admin', 'developer'], kind: 'read', label: 'Checking your tasks',
    desc: 'Tasks: your open tasks and the work queue (orders to fulfil, overdue tickets, stalled leads, issues to triage).',
    keywords: [/my tasks?|to-?do list|work queue|what should i (do|work on)|what('s| is) next|priorit/i, /my tasks?|work queue|what should i (do|work on)/i], params: {},
    async run(ctx) {
      const d = await crm(ctx, 'tasks?scope=mine')
      const rows = [...d.queue.map((x) => ({ kind: 'Queue', what: x.title, due: x.tone === 'bad' ? 'Now' : 'Soon' })), ...d.tasks.filter((t) => t.status === 'open').map((t) => ({ kind: 'Task', what: t.title + (t.entity_label ? ' (' + t.entity_label + ')' : ''), due: t.due_at ? new Date(t.due_at).toISOString().slice(0, 10) : 'No date' }))]
      return { title: 'Your work', columns: [['kind', 'Kind'], ['what', 'What'], ['due', 'When']], rows, facts: [`${rows.filter((r) => r.due === 'Now').length} need attention now`] }
    } },
  { name: 'system_issues', roles: ['admin', 'developer'], kind: 'read', label: 'Checking system issues', quick: true,
    desc: 'System issues: problems reported with FindBox, with severity, status, area and how many people reported each.',
    keywords: [/\bissues\b|\bbugs?\b|system (issue|complaint|problem)s?|what('s| is) broken|incidents?/i, /system issues|open issues|known issues|\bbugs\b/i], params: { query: { type: 'string', desc: 'Words from the issue title.' } },
    async run(ctx, a) {
      const list = cards(await crm(ctx, 'board/issues?q=' + encodeURIComponent(a.query || '')))
      return { title: 'System issues', columns: [['title', 'Issue'], ['severity', 'Severity'], ['status', 'Status'], ['detail', 'Area and reports'], ['flags', 'Flags']], rows: list.map((i) => ({ title: i.title, severity: i.chip.text, status: i.column, detail: i.line, flags: i.flags.map((f) => f.text).join(', ') })), facts: [`${list.filter((i) => !['fixed', 'closed'].includes(i.columnId)).length} open`, `${list.filter((i) => i.columnId === 'new').length} waiting for triage`] }
    } },
  { name: 'family_accounts', roles: ['admin'], kind: 'read', label: 'Looking up families', quick: true,
    desc: 'Families: parents and guardians with their school, number of children, items and what they have spent.',
    keywords: [/top (spend\w*|famil\w*|customers)|famil(y|ies) (by|with|who|that)|which famil|biggest (spenders|customers)|family spend/i, /top (spend\w*|famil\w*|customers)|famil(y|ies) (by|with|who|that)|which famil|biggest (spenders|customers)|family spend/i], params: { query: { type: 'string', desc: 'Name or email.' } },
    async run(ctx, a) {
      const d = await crm(ctx, 'customers?type=families&sort=spend&q=' + encodeURIComponent(a.query || ''))
      return { title: 'Families', columns: [['name', 'Name'], ['email', 'Email'], ['school', 'School'], ['children', 'Children'], ['items', 'Items'], ['spent', 'Spent']], rows: d.rows.map((f) => ({ name: f.name, email: f.sub, school: f.school || '', children: f.a, items: f.b, spent: f.c ? ksh(f.c) : '' })), entities: { emails: d.rows.slice(0, 5).map((f) => f.sub) }, facts: [`${d.rows.filter((f) => f.c > 0).length} have bought labels`] }
    } },
  { name: 'lead_pipeline', roles: ['admin'], kind: 'read', label: 'Checking the school pipeline', quick: true, looseQuery: true,
    desc: 'School leads: every prospect school with its stage, contact, value, score, next step and whether it is stalled.',
    keywords: [/\bleads?\b|pipeline|prospects?|\bdeals?\b|forecast|sales funnel/i, /pipeline|\bleads\b|prospects/i], params: { query: { type: 'string', desc: 'School name to look for.' } },
    async run(ctx, a) {
      const list = cards(await crm(ctx, 'board/leads?q=' + encodeURIComponent(a.query || '')))
      const open = list.filter((l) => !['won', 'lost'].includes(l.columnId))
      return { title: 'School leads', columns: [['title', 'School'], ['stage', 'Stage'], ['who', 'Contact and size'], ['value', 'Value'], ['score', 'Score'], ['next', 'Next step due'], ['flags', 'Flags']], rows: list.map((l) => ({ title: l.title, stage: l.column, who: l.line, value: l.value ? ksh(l.value) : '', score: l.score, next: l.chip.text, flags: l.flags.map((f) => f.text).join(', ') })), facts: [`${open.length} open, worth ${ksh(open.reduce((n, l) => n + (l.value || 0), 0))}`, `${list.filter((l) => l.flags.some((f) => f.text === 'Stalled')).length} stalled`] }
    } },
  { name: 'system_signals', roles: ['developer'], kind: 'read', label: 'Reading system signals',
    desc: 'System signals: background worker, email delivery, off-site backup, alerts and privacy requests, each good or needing a check.',
    keywords: [/signals?\b|\bworker\b|backups?|monitoring|\balerts?\b/i], params: {},
    async run(ctx) {
      const h = await crm(ctx, 'home')
      return { title: 'System signals', columns: [['name', 'Signal'], ['state', 'State'], ['detail', 'Detail']], rows: (h.signals || []).map((s) => ({ name: s.name, state: s.state === 'ok' ? 'Good' : s.state === 'warn' ? 'Check' : 'Problem', detail: s.detail })), facts: [`${(h.signals || []).filter((s) => s.state !== 'ok').length} need attention`] }
    } },
  { name: 'add_task', roles: ['admin', 'developer'], kind: 'write', label: 'Preparing a task', ruleTitle: true,
    desc: 'Add a task for yourself, with an optional due date.',
    keywords: [/add (a |an )?(task|reminder|to-?do)|remind me to|create (a )?task|new task/i],
    params: { title: { type: 'string', desc: 'What needs doing.', required: true }, due: { type: 'string', desc: 'Due date as YYYY-MM-DD.' } },
    async prepare(ctx, a) {
      const due = /^\d{4}-\d{2}-\d{2}$/.test(a.due || '') ? a.due : null
      return { summary: `Add a task: ${a.title}`, details: [['Task', a.title], ['Due', due || 'No date'], ['Assigned to', 'You']], request: { method: 'POST', url: '/api/company/crm/tasks', body: { title: String(a.title).slice(0, 200), dueAt: due } } }
    } },
  { name: 'log_issue', roles: ['admin', 'developer'], kind: 'write', label: 'Preparing a system issue', ruleTitle: true,
    desc: 'Log a system issue (a problem with FindBox), with an optional severity and the reporter\'s email.',
    keywords: [/log (an? )?(\w+ )?(issue|bug|problem|complaint)|report (an? )?(\w+ )?(bug|problem|issue)|raise (an? )?issue/i],
    params: { title: { type: 'string', desc: 'What is going wrong.', required: true }, severity: { type: 'string', desc: 'Severity by customer impact.', enum: SEVERITIES }, email: { type: 'string', desc: 'Email of the person who reported it.' } },
    async prepare(ctx, a) {
      return { summary: `Log a system issue: ${a.title}`, details: [['Issue', a.title], ['Severity', a.severity ? a.severity.toUpperCase() : 'For the developer to set'], ['Reporter', a.email || 'Not given']], request: { method: 'POST', url: '/api/company/crm/issues', body: { title: String(a.title).slice(0, 200), description: 'Logged through the FindBox assistant.', source: 'internal', severity: a.severity || null, reporterEmail: a.email || '' } } }
    } },
  { name: 'add_lead', roles: ['admin'], kind: 'write', label: 'Preparing a school lead', ruleName: true,
    desc: 'Add a school lead to the pipeline.',
    keywords: [/add (a |an )?(new )?(school )?(lead|prospect)|new lead/i],
    params: { name: { type: 'string', desc: 'The school\'s name.', required: true }, email: { type: 'string', desc: 'Contact email.' }, source: { type: 'string', desc: 'Where the lead came from.', enum: ['website', 'referral', 'event', 'outreach'] } },
    async prepare(ctx, a) {
      return { summary: `Add ${a.name} as a school lead`, details: [['School', a.name], ['Contact email', a.email || 'Not given'], ['Source', a.source || 'other']], request: { method: 'POST', url: '/api/company/crm/leads', body: { schoolName: String(a.name).slice(0, 150), contactEmail: a.email || '', source: a.source || 'other' } } }
    } },
  { name: 'move_lead', roles: ['admin'], kind: 'write', label: 'Preparing to move a lead', looseQuery: true,
    desc: 'Move a school lead to another stage (contacted, demo, proposal, won).',
    keywords: [/\bmove\b.*\b(lead|to (new|contacted|demo|proposal|won))\b|mark .*\b(as )?(contacted|won)\b|lead .* (to|is) (contacted|demo|proposal|won)/i],
    params: { query: { type: 'string', desc: 'The school\'s name.', required: true }, stage: { type: 'string', desc: 'The new stage.', enum: LEAD_STAGES, required: true } },
    async prepare(ctx, a) {
      const lead = pickOne(cards(await crm(ctx, 'board/leads')), a.query, 'lead')
      if (lead.columnId === a.stage) throw new ToolError(`${lead.title} is already at ${lead.column}.`, 409)
      return { summary: `Move ${lead.title} from ${lead.column} to ${a.stage}`, details: [['Lead', lead.title], ['From', lead.column], ['To', a.stage], ['Note', 'Stage rules still apply: a contact is needed, and a size before Proposal']], request: { method: 'POST', url: '/api/company/crm/leads/' + lead.id, body: { revision: lead.revision, stage: a.stage } } }
    } },
  { name: 'mark_order_delivered', roles: ['admin'], kind: 'write', label: 'Preparing to mark an order delivered',
    desc: 'Mark a fulfilled order as delivered, so the family can start adding belongings.',
    keywords: [/mark .*delivered|order .*(has been |was |is )?delivered|labels? (have |has )?(arrived|been delivered)/i],
    params: { order: { type: 'string', desc: 'First characters of the order number.', required: true } },
    async prepare(ctx, a) {
      const o = await byPrefix(ctx, 'orders', 'id', a.order, 'order')
      if (o.status !== 'fulfilled') throw new ToolError('Only a fulfilled order can be marked delivered. This one is ' + o.status + '.', 409)
      if (o.delivered_at) throw new ToolError('That order is already marked delivered.', 409)
      return { summary: `Mark order ${short(o.id)} delivered`, details: [['Order', short(o.id)], ['Amount', ksh(o.amount_minor)], ['Effect', 'The family is told and can scan labels to add belongings']], request: { method: 'POST', url: '/api/company/orders/' + o.id + '/delivered', body: { reason: ctx.reason } } }
    } },
  { name: 'triage_issue', roles: ['developer'], kind: 'write', label: 'Preparing to triage an issue', looseQuery: true,
    desc: 'Triage a system issue: set its severity so it is acknowledged.',
    keywords: [/\btriage\b|set (the )?severity|acknowledge (the )?(issue|bug)/i],
    params: { query: { type: 'string', desc: 'Words from the issue title.', required: true }, severity: { type: 'string', desc: 'Severity by customer impact.', enum: SEVERITIES, required: true } },
    async prepare(ctx, a) {
      const issue = pickOne(cards(await crm(ctx, 'board/issues')), a.query, 'issue')
      return { summary: `Triage "${issue.title}" as ${a.severity.toUpperCase()}`, details: [['Issue', issue.title], ['Severity', a.severity.toUpperCase()], ['Status', issue.columnId === 'new' ? 'New to Triaged' : issue.column]], request: { method: 'POST', url: '/api/company/crm/issues/' + issue.id, body: { revision: issue.revision, severity: a.severity, ...(issue.columnId === 'new' ? { status: 'triaged' } : {}) } } }
    } },

  // ----- the principal -----
  { name: 'find_student', roles: ['principal'], kind: 'read', label: 'Looking up students', quick: true, looseQuery: true,
    desc: 'Students: find a student by name, class or admission number, with their house and whether a parent is linked.',
    keywords: [/find (a |the )?(student|pupil|learner)|(student|pupil|learner)s? (named|called)|look ?up .*(student|pupil|learner)|admission (no|number)|\bstudents? in\b/i], params: { query: { type: 'string', desc: 'Name, class or admission number.' } },
    async run(ctx, a) {
      const d = await ctx.api('GET', '/api/school/students?status=all&page=0&q=' + encodeURIComponent(a.query || ''))
      return { title: 'Students', columns: [['name', 'Student'], ['ref', 'Admission no.'], ['cls', 'Class'], ['house', 'House'], ['parent', 'Parent'], ['status', 'Status']], rows: d.rows.map((s) => ({ name: s.name, ref: s.school_reference, cls: s.class_name, house: s.house || '', parent: s.guardian_id ? 'Linked' : s.guardian_email ? 'Email on file' : 'Not linked', status: s.status })), facts: d.hasMore ? ['Showing the first 50'] : [] }
    } },
  { name: 'unlinked_students', roles: ['principal'], kind: 'read', label: 'Listing students with no parent linked',
    desc: 'Students with no parent linked yet, so you know whom to invite.',
    keywords: [/unlinked|not (yet )?linked|no parent|without (a )?parent|who (has not|hasn't|have not|haven't) joined|still to (join|invite)/i, /unlinked|not (yet )?linked|no parent|without (a )?parent/i], params: {},
    async run(ctx) {
      const d = await ctx.api('GET', '/api/school/students?status=unlinked&page=0&q=')
      return { title: 'Students with no parent linked', columns: [['name', 'Student'], ['cls', 'Class'], ['email', 'Parent email on file']], rows: d.rows.map((s) => ({ name: s.name, cls: s.class_name, email: s.guardian_email || 'None' })), facts: [d.hasMore ? 'Showing the first 50' : '', `${d.rows.filter((s) => s.guardian_email).length} have an email you can invite`].filter(Boolean) }
    } },
  { name: 'collection_points', roles: ['principal'], kind: 'read', label: 'Checking the collection points',
    desc: 'Collection points: each box, how many items are in it and how long the oldest has waited.',
    keywords: [/collection (points|boxes?)|\bboxes\b|how full|which box|what('s| is) in (the |each )?(box|boxes|library|office|reception)/i], params: {},
    async run(ctx) {
      const h = await desk(ctx, 'home')
      return { title: 'Collection points', columns: [['name', 'Box'], ['count', 'Items inside'], ['oldest', 'Oldest item'], ['hours', 'Open']], rows: h.boxes.map((b) => ({ name: b.name, count: b.count, oldest: b.count ? b.oldestDays + ' days' : '', hours: b.opening_hours })), facts: [`${h.boxes.reduce((n, b) => n + b.count, 0)} items inside in total`] }
    } },
  { name: 'overdue_items', roles: ['principal'], kind: 'read', label: 'Listing overdue items',
    desc: 'Overdue: items past their collection date or held over 30 days, ready for a reminder or donation.',
    keywords: [/overdue|past (their |its |the )?collection|held (too long|over)|end of term clear/i, /overdue|ready to donate|clear.?out/i], params: {},
    async run(ctx) {
      const d = await desk(ctx, 'log')
      const rows = d.rows.filter((r) => r.overdue || r.holdOver).map((r) => ({ item: r.title, owner: r.owner, where: r.where, days: r.ageDays, why: r.holdOver ? 'Held over ' + d.holdDays + ' days' : 'Past collection date' }))
      return { title: 'Overdue items', columns: [['item', 'Item'], ['owner', 'Owner'], ['where', 'Where'], ['days', 'Days waiting'], ['why', 'Why']], rows, facts: [`${rows.filter((r) => r.why.startsWith('Held')).length} can go to donation approval`] }
    } },
  { name: 'valuables_held', roles: ['principal'], kind: 'read', label: 'Listing valuables',
    desc: 'Valuables: phones, money, glasses and watches currently held by the school.',
    keywords: [/valuables?|\bphones?\b|\bmoney\b|\bwatch(es)?\b|\bglasses\b|expensive/i, /valuables?/i], params: {},
    async run(ctx) {
      const d = await desk(ctx, 'log')
      return { title: 'Valuables held', columns: [['item', 'Item'], ['owner', 'Owner'], ['where', 'Where'], ['days', 'Days waiting']], rows: d.rows.filter((r) => r.valuable).map((r) => ({ item: r.title, owner: r.owner, where: r.where, days: r.ageDays })) }
    } },
  { name: 'loss_hotspots', roles: ['principal'], kind: 'read', label: 'Finding where things get lost',
    desc: 'Hotspots: the places where items are most often found, and which classes lose most.',
    keywords: [/hot ?spots?|where (do|are) (things|items|belongings) (get |getting |being )?(lost|found)|which (place|area)s?|most (often )?found/i], params: {},
    async run(ctx) {
      const r = await desk(ctx, 'report?days=90')
      const rows = [...r.byPlace.map((p) => ({ kind: 'Place', name: p.name, found: p.found, returned: p.returned })), ...r.byClass.slice(0, 8).map((c) => ({ kind: 'Class', name: c.name, found: c.found, returned: c.returned }))]
      return { title: 'Where things are found, last 90 days', columns: [['kind', 'Kind'], ['name', 'Name'], ['found', 'Logged'], ['returned', 'Returned']], rows }
    } },
  { name: 'recent_activity', roles: ['principal'], kind: 'read', label: 'Reading recent activity',
    desc: 'Activity: who received, handed back, reminded or decided what, most recent first.',
    keywords: [/recent activity|what (has )?happened|activity log|\baudit\b|latest (activity|actions|changes)/i, /recent activity|what (has )?happened|activity log/i], params: {},
    async run(ctx) {
      const d = await desk(ctx, 'activity')
      return { title: 'Recent activity', columns: [['when', 'When'], ['who', 'Who'], ['what', 'What'], ['item', 'Item']], rows: d.rows.slice(0, 40).map((r) => ({ when: day(r.at), who: r.who, what: r.text, item: r.title })) }
    } },
  { name: 'parents_waiting', roles: ['principal'], kind: 'read', label: 'Checking parents waiting',
    desc: 'Parents waiting for you to approve the child they added.',
    keywords: [/parents? (are |is )?waiting|child(ren)? requests?|join requests?|waiting to be approved|who (wants|asked) to (join|add)/i], params: {},
    async run(ctx) {
      const d = await ctx.api('GET', '/api/school/child-requests')
      return { title: 'Parents waiting for approval', columns: [['child', 'Child'], ['cls', 'Class'], ['parent', 'Parent'], ['match', 'On your roster']], rows: d.rows.map((r) => ({ child: r.name, cls: r.class_name, parent: r.guardian, match: r.match_id ? 'Yes' : 'No: approving adds them' })), facts: ['Approve or decline these in Approvals'] }
    } },
  { name: 'notify_family', roles: ['principal'], kind: 'write', label: 'Preparing a reminder for one family', looseQuery: true,
    desc: 'Tell one family to collect an item that is waiting in a box.',
    keywords: [/notify (the )?(family|parents?)|tell (the )?(family|parent) (of|to|about)|remind (the )?(family|parent) (of|about|to)/i],
    params: { query: { type: 'string', desc: 'The item or the student\'s name.', required: true } },
    async prepare(ctx, a) {
      const d = await desk(ctx, 'log?q=' + encodeURIComponent(a.query))
      const ready = d.rows.filter((r) => r.status === 'awaiting_collection' && r.owner !== 'Owner not known')
      if (!ready.length) throw new ToolError(`Nothing waiting in a box with a known owner matches "${a.query}".`, 404)
      if (ready.length > 1) throw new ToolError(`${ready.length} items match "${a.query}": ${ready.slice(0, 5).map((r) => r.title + ' (' + r.owner + ')').join(', ')}. Which one?`, 409)
      const item = ready[0]
      return { summary: `Tell the family to collect ${item.title} (${item.owner})`, details: [['Item', item.title], ['Owner', item.owner], ['Where', item.where], ['Waiting', item.ageDays + ' days'], ['Limit', 'Once a day per item']], request: { method: 'POST', url: '/api/school/desk/case/' + item.id + '/remind', body: {} } }
    } },
  { name: 'add_collection_box', roles: ['principal'], kind: 'write', label: 'Preparing a collection box', ruleName: true,
    desc: 'Add a collection box where found items wait.',
    keywords: [/add (a |another )?(new )?(collection )?(box|point)|new (collection )?(box|point)/i],
    params: { name: { type: 'string', desc: 'The box\'s name, for example Reception.', required: true }, directions: { type: 'string', desc: 'Where it is.' }, hours: { type: 'string', desc: 'When parents can collect.' } },
    async prepare(ctx, a) {
      return { summary: `Add a collection box called ${a.name}`, details: [['Name', a.name], ['Where', a.directions || 'Main school office'], ['Open', a.hours || 'School days, 8am to 4pm']], request: { method: 'POST', url: '/api/school/boxes', body: { name: String(a.name).slice(0, 100), directions: a.directions || 'Main school office', hours: a.hours || 'School days, 8am to 4pm', active: true, publicListing: false, reason: 'Added through the FindBox assistant' } } }
    } },
]
TOOLS.push(...MORE_TOOLS)

export const toolsFor = (role) => TOOLS.filter(t => t.roles.includes(role))
export const byName = (name) => TOOLS.find(t => t.name === name)
