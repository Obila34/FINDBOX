import { z } from 'zod';
import { id, requireThat } from './security.mjs';
import { transaction } from './db.mjs';
import { operationAudit } from './operations.mjs';

// FindBox operations CRM. See docs/OPS-CRM.md for the requirements this implements.
//  - Leads are schools that are not partners yet; they move New > Contacted > Demo > Proposal > Won / Lost.
//  - Schools get a health score from live data; families are the contacts.
//  - Notes and tasks attach to any record; boards and the dashboard are read from the same data.
// Children's names never appear on boards or dashboards.

export const STAGES = ['new', 'contacted', 'demo', 'proposal', 'won', 'lost'];
const STAGE_TITLE = { new: 'New', contacted: 'Contacted', demo: 'Demo', proposal: 'Proposal', won: 'Won', lost: 'Lost' };
const PROBABILITY = { new: 0.1, contacted: 0.25, demo: 0.5, proposal: 0.75, won: 1, lost: 0 };
const SOURCES = ['website', 'referral', 'event', 'outreach', 'other'];
const DAY = 864e5;
const text = (n) => z.string().trim().max(n);
const days = (d) => Math.floor((Date.now() - new Date(d).getTime()) / DAY);
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

/** Lead score, 0 to 100: fit (size), intent (source, a booked next step) and engagement (notes, recency). */
export function leadScore(l, notes = 0) {
  const n = Number(l.est_students || 0);
  const fit = n >= 500 ? 35 : n >= 200 ? 25 : n >= 50 ? 15 : n > 0 ? 8 : 0;
  const source = { referral: 20, website: 15, event: 12, outreach: 6, other: 4 }[l.source] ?? 4;
  const booked = l.next_at && new Date(l.next_at).getTime() >= Date.now() - DAY ? 15 : 0;
  const engagement = Math.min(3, notes) * 6 + (days(l.updated_at) <= 7 ? 12 : 0);
  return Math.min(100, fit + source + booked + engagement);
}

/** School health, 0 to 100, weighted: adoption 35, usage 30, outcomes 15, setup 10, support 10. */
export function schoolHealth(s) {
  const adoption = s.students ? s.linked / s.students : 0;
  const perFamily = s.families ? Math.min(1, s.items / s.families / 3) : 0;
  const outcomes = s.items ? (s.cases90 ? s.returned90 / s.cases90 : 1) : 0;
  const parts = {
    adoption: Math.round(adoption * 35),
    usage: Math.round(perFamily * 20) + (s.activity30 > 0 ? 10 : 0),
    outcomes: Math.round(outcomes * 15),
    setup: (s.boxes > 0 ? 5 : 0) + (s.managers > 0 ? 5 : 0),
    support: s.stale_tickets > 0 ? 0 : 10,
  };
  const score = Object.values(parts).reduce((a, b) => a + b, 0);
  const band = days(s.created_at) < 14 ? 'new' : score >= 70 ? 'green' : score >= 40 ? 'amber' : 'red';
  const stage = s.lifecycle === 'pending' ? 'invited' : s.lifecycle !== 'active' ? 'paused' : !s.students ? 'setting_up' : adoption < 0.5 || !s.items ? 'rolling_out' : 'live';
  return { score, band, parts, stage };
}

const SCHOOL_SQL = `SELECT s.id,s.name,s.lifecycle,s.contact_name,s.contact_email,s.created_at,
 (SELECT count(*)::int FROM students st WHERE st.school_id=s.id AND st.status='active') AS students,
 (SELECT count(*)::int FROM students st WHERE st.school_id=s.id AND st.status='active' AND st.guardian_id IS NOT NULL) AS linked,
 (SELECT count(DISTINCT st.guardian_id)::int FROM students st WHERE st.school_id=s.id AND st.status='active' AND st.guardian_id IS NOT NULL) AS families,
 (SELECT count(*)::int FROM items i WHERE i.school_id=s.id) AS items,
 (SELECT count(*)::int FROM cases c WHERE c.school_id=s.id AND c.created_at>now()-interval '90 days') AS cases90,
 (SELECT count(*)::int FROM cases c WHERE c.school_id=s.id AND c.created_at>now()-interval '90 days' AND c.status='returned') AS returned90,
 (SELECT count(*)::int FROM events e JOIN cases c ON c.id=e.case_id WHERE c.school_id=s.id AND e.created_at>now()-interval '30 days') AS activity30,
 (SELECT count(*)::int FROM boxes b WHERE b.school_id=s.id AND b.active) AS boxes,
 (SELECT count(*)::int FROM memberships m WHERE m.school_id=s.id AND m.role='manager') AS managers,
 (SELECT count(*)::int FROM memberships m WHERE m.school_id=s.id AND m.role IN ('staff','manager')) AS staff,
 (SELECT count(*)::int FROM support_tickets t JOIN memberships m ON m.user_id=t.user_id WHERE m.school_id=s.id AND t.status<>'resolved' AND t.created_at<now()-interval '72 hours') AS stale_tickets
 FROM schools s`;

async function schools(db, where = '', params = []) {
  return (await db.query(SCHOOL_SQL + (where ? ' WHERE ' + where : '') + ' ORDER BY s.name', params)).rows.map((s) => ({ ...s, health: schoolHealth(s) }));
}
/** One school's live numbers and health, for the school's own workspace. */
export async function schoolStats(db, schoolId) { return (await schools(db, 's.id=$1', [schoolId]))[0]; }
async function counts(db, type) {
  const notes = new Map((await db.query("SELECT entity_id,count(*)::int n FROM crm_notes WHERE entity_type=$1 AND kind<>'stage' GROUP BY entity_id", [type])).rows.map((r) => [r.entity_id, r.n]));
  const tasks = new Map((await db.query("SELECT entity_id,count(*)::int n FROM crm_tasks WHERE entity_type=$1 AND status='open' GROUP BY entity_id", [type])).rows.map((r) => [r.entity_id, r.n]));
  return { notes, tasks };
}
const ticketOverdue = (t) => (t.status === 'new' && days(t.created_at) >= 1) || (t.status !== 'resolved' && days(t.created_at) >= 3);
const leadStalled = (l) => !['won', 'lost'].includes(l.stage) && days(l.updated_at) >= 7;
const leadOverdue = (l) => !['won', 'lost'].includes(l.stage) && l.next_at && new Date(l.next_at).getTime() < Date.now() - DAY;

// ---- System issues ----
export const ISSUE_STATUS = ['new', 'triaged', 'in_progress', 'fixed', 'closed'];
const ISSUE_TITLE = { new: 'New', triaged: 'Triaged', in_progress: 'In progress', fixed: 'Fixed', closed: 'Closed' };
const SEVERITY = { s1: 'S1 Critical', s2: 'S2 Major', s3: 'S3 Minor', s4: 'S4 Cosmetic' };
const AREAS = { family_app: 'Family app', school_portal: 'School portal', ops: 'Operations', sign_in: 'Sign-in', payments: 'Payments', email: 'Email', labels: 'Labels & QR', other: 'Other' };
// Hours allowed to acknowledge (triage) and to fix, by severity. Untriaged issues get one working day.
const TRIAGE_HOURS = { s1: 1, s2: 4, s3: 24, s4: 72 }, FIX_HOURS = { s1: 24, s2: 72, s3: 168, s4: 720 };
const hours = (d, to = Date.now()) => (new Date(to).getTime() - new Date(d).getTime()) / 36e5;
export function issueSla(i) {
  const open = !['fixed', 'closed'].includes(i.status);
  const triageLate = i.status === 'new' && hours(i.created_at) > (TRIAGE_HOURS[i.severity] ?? 24);
  const fixLate = open && i.severity && hours(i.created_at) > FIX_HOURS[i.severity];
  const onTime = i.fixed_at && i.severity ? hours(i.created_at, i.fixed_at) <= FIX_HOURS[i.severity] : null;
  return { triageLate, fixLate: !!fixLate, onTime };
}
/** Complaints sent through the app as "bug" become issues automatically, so nothing waits in the support queue. */
async function intakeBugTickets(db, actorId) {
  const fresh = (await db.query("SELECT t.* FROM support_tickets t WHERE t.kind='bug' AND NOT EXISTS(SELECT 1 FROM crm_issue_reports r WHERE r.ticket_id=t.id) ORDER BY t.created_at LIMIT 50")).rows;
  for (const t of fresh) {
    const iid = id();
    await db.query("INSERT INTO crm_issues(id,title,description,source,created_by,created_at,updated_at) VALUES($1,$2,$3,'support',$4,$5,$5)", [iid, t.subject.slice(0, 200), t.message, actorId, t.created_at]);
    await db.query('INSERT INTO crm_issue_reports(id,issue_id,ticket_id,name,email,created_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (ticket_id) DO NOTHING', [id(), iid, t.id, t.name, t.email, t.created_at]);
  }
}
/** What the system itself is reporting: worker, backups, email queue, alerts and privacy requests. */
async function systemSignals(db) {
  const out = [];
  const worker = (await db.query("SELECT last_ok FROM runtime_heartbeat WHERE name='worker'")).rows[0];
  const wAge = worker ? hours(worker.last_ok) * 60 : null;
  out.push({ name: 'Background worker', state: wAge === null ? 'warn' : wAge > 10 ? 'bad' : 'ok', detail: wAge === null ? 'Has not reported yet' : wAge < 2 ? 'Running' : `Last seen ${Math.round(wAge)} minutes ago`, page: 'legacy:overview' });
  const mail = (await db.query('SELECT count(*) FILTER(WHERE sent_at IS NULL AND attempts>=8)::int failed,count(*) FILTER(WHERE sent_at IS NULL AND attempts<8)::int pending FROM outbox')).rows[0];
  out.push({ name: 'Email delivery', state: mail.failed ? 'bad' : mail.pending > 20 ? 'warn' : 'ok', detail: mail.failed ? `${mail.failed} failed to send` : mail.pending ? `${mail.pending} waiting to send` : 'Queue is clear', page: 'legacy:mail' });
  const backup = (await db.query("SELECT last_ok FROM runtime_heartbeat WHERE name='offsite_backup'")).rows[0];
  const bAge = backup ? hours(backup.last_ok) : null;
  out.push({ name: 'Off-site backup', state: bAge === null ? 'warn' : bAge > 36 ? 'bad' : 'ok', detail: bAge === null ? 'No backup reported yet' : `Last copy ${Math.round(bAge)} hours ago`, page: 'legacy:overview' });
  for (const a of (await db.query("SELECT name,state FROM runtime_alerts WHERE state<>'ok' ORDER BY name LIMIT 10")).rows) out.push({ name: 'Alert: ' + a.name.replaceAll('_', ' '), state: 'bad', detail: 'State: ' + a.state, page: 'legacy:overview' });
  const privacy = (await db.query("SELECT count(*)::int n,min(created_at) oldest FROM privacy_requests WHERE status='pending'")).rows[0];
  out.push({ name: 'Privacy requests', state: privacy.n ? (hours(privacy.oldest) > 14 * 24 ? 'bad' : 'warn') : 'ok', detail: privacy.n ? `${privacy.n} waiting for review` : 'None waiting', page: 'legacy:privacy' });
  return out;
}
async function issueSummary(db) {
  const rows = (await db.query('SELECT status,severity,area,created_at,triaged_at,fixed_at FROM crm_issues')).rows;
  const open = rows.filter((i) => !['fixed', 'closed'].includes(i.status)), fixed = rows.filter((i) => i.fixed_at);
  const timed = fixed.map(issueSla).filter((s) => s.onTime !== null);
  const fixHours = fixed.map((i) => hours(i.created_at, i.fixed_at));
  return {
    open: open.length, fresh: open.filter((i) => i.status === 'new').length, critical: open.filter((i) => ['s1', 's2'].includes(i.severity)).length,
    overdue: open.filter((i) => { const s = issueSla(i); return s.triageLate || s.fixLate; }).length,
    mttrHours: fixHours.length ? Math.round(fixHours.reduce((a, b) => a + b, 0) / fixHours.length) : null,
    onTimePct: timed.length ? Math.round((timed.filter((s) => s.onTime).length / timed.length) * 100) : null, fixedCount: fixed.length,
    byArea: Object.entries(AREAS).map(([k, title]) => ({ area: k, title, count: open.filter((i) => i.area === k).length })).filter((a) => a.count),
    bySeverity: Object.entries(SEVERITY).map(([k, title]) => ({ severity: k, title, count: open.filter((i) => i.severity === k).length })),
  };
}

export async function crmRoutes(app, { pool, operator }) {
  const admin = (req) => operator(req, ['admin']);
  const leadInput = z.object({
    schoolName: text(150).min(2), contactName: text(120).default(''), contactEmail: z.union([z.literal(''), z.string().trim().toLowerCase().email().max(254)]).default(''),
    contactPhone: text(30).default(''), location: text(150).default(''), source: z.enum(SOURCES).default('other'),
    estStudents: z.number().int().min(1).max(100000).nullable().default(null), valueKes: z.number().min(0).max(1e9).default(0),
    nextStep: text(200).default(''), nextAt: dateOnly.default(null),
  }).strict();

  // ---- Dashboard, sidebar counts and team ----
  app.get('/api/company/crm/home', async (req) => {
    const u = await operator(req), isAdmin = u.companyRole === 'admin';
    const signups = (await pool.query("SELECT to_char(date_trunc('day',created_at AT TIME ZONE 'Africa/Nairobi'),'YYYY-MM-DD') AS day,count(*) FILTER(WHERE role='student')::int students,count(*) FILTER(WHERE role<>'student')::int parents FROM users WHERE created_at>now()-interval '7 days' AND NOT EXISTS(SELECT 1 FROM company_access c WHERE c.user_id=users.id) GROUP BY 1")).rows;
    const bars = Array.from({ length: 7 }, (_, i) => { const d = new Date(Date.now() + 3 * 3600000 - (6 - i) * DAY), key = d.toISOString().slice(0, 10), row = signups.find((r) => r.day === key); return { day: key, label: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()], parents: row?.parents || 0, students: row?.students || 0 }; });
    const cases = (await pool.query("SELECT count(*)::int total,count(*) FILTER(WHERE status='returned')::int returned FROM cases WHERE created_at>now()-interval '90 days'")).rows[0];
    const myTasks = (await pool.query("SELECT count(*)::int n FROM crm_tasks WHERE status='open' AND (assignee_id=$1 OR assignee_id IS NULL)", [u.id])).rows[0].n;
    const list = await schools(pool);
    const health = { total: list.length, green: 0, amber: 0, red: 0, new: 0 };
    for (const s of list) health[s.health.band]++;
    const out = {
      me: { id: u.id, name: u.name, role: u.companyRole }, generatedAt: new Date().toISOString(), bars,
      returnRate: { total: cases.total, returned: cases.returned, pct: cases.total ? Math.round((cases.returned / cases.total) * 100) : null },
      tasksOpen: myTasks, schools: health,
      customers: (await pool.query("SELECT (SELECT count(*)::int FROM schools WHERE lifecycle='active') schools,(SELECT count(*)::int FROM users u WHERE role='parent' AND NOT EXISTS(SELECT 1 FROM company_access c WHERE c.user_id=u.id)) families,(SELECT count(*)::int FROM students WHERE status='active') students")).rows[0],
      team: (await pool.query("SELECT u.id,u.name,c.role,(SELECT max(last_seen_at) FROM sessions s WHERE s.user_id=u.id) AS last_seen FROM company_access c JOIN users u ON u.id=c.user_id WHERE u.disabled_at IS NULL ORDER BY u.name")).rows,
      badges: { tasks: myTasks, onboarding: list.filter((s) => ['invited', 'setting_up', 'rolling_out'].includes(s.health.stage)).length },
    };
    await intakeBugTickets(pool, u.id);
    out.issues = await issueSummary(pool);
    out.badges.issues = out.issues.open;
    if (!isAdmin) out.signals = await systemSignals(pool);
    if (isAdmin) {
      const leads = (await pool.query('SELECT * FROM crm_leads')).rows, open = leads.filter((l) => !['won', 'lost'].includes(l.stage));
      const won = leads.filter((l) => l.stage === 'won'), lost = leads.filter((l) => l.stage === 'lost');
      const cycle = won.filter((l) => l.closed_at).map((l) => (new Date(l.closed_at) - new Date(l.created_at)) / DAY);
      out.pipeline = {
        open: open.length, valueMinor: open.reduce((n, l) => n + Number(l.value_minor), 0), weightedMinor: Math.round(open.reduce((n, l) => n + Number(l.value_minor) * PROBABILITY[l.stage], 0)),
        won: won.length, lost: lost.length, winRate: won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : null,
        avgCycleDays: cycle.length ? Math.round(cycle.reduce((a, b) => a + b, 0) / cycle.length) : null,
        byStage: STAGES.map((s) => ({ stage: s, title: STAGE_TITLE[s], count: leads.filter((l) => l.stage === s).length })),
        bySource: SOURCES.map((s) => ({ source: s, count: leads.filter((l) => l.source === s).length })).filter((s) => s.count),
        stalled: open.filter(leadStalled).length,
      };
      const o = (await pool.query("SELECT count(*) FILTER(WHERE status='paid')::int to_fulfil,count(*) FILTER(WHERE status='fulfilled' AND delivered_at IS NULL)::int to_deliver,COALESCE(sum(amount_minor) FILTER(WHERE status IN ('paid','fulfilled')),0)::text collected,COALESCE(sum(amount_minor) FILTER(WHERE status IN ('paid','fulfilled') AND created_at>now()-interval '30 days'),0)::text collected30 FROM orders")).rows[0];
      out.orders = { toFulfil: o.to_fulfil, toDeliver: o.to_deliver, collectedMinor: Number(o.collected), collected30Minor: Number(o.collected30) };
      const tickets = (await pool.query("SELECT status,created_at FROM support_tickets WHERE status<>'resolved'")).rows;
      out.support = { new: tickets.filter((t) => t.status === 'new').length, open: tickets.length, overdue: tickets.filter(ticketOverdue).length };
      Object.assign(out.badges, { leads: open.length, orders: o.to_fulfil + o.to_deliver, support: tickets.length });
    }
    return out;
  });

  // ---- Boards ----
  app.get('/api/company/crm/board/:kind', async (req) => {
    const kind = req.params.kind, u = await operator(req);
    const { q = '', mine = '', sort = 'recent', filter = '' } = z.object({ q: z.string().max(100).optional(), mine: z.string().max(1).optional(), sort: z.string().max(20).optional(), filter: z.string().max(30).optional() }).parse(req.query);
    const has = (...parts) => !q || parts.join(' ').toLowerCase().includes(q.toLowerCase());
    const order = (cards) => cards.sort((a, b) => sort === 'name' ? a.title.localeCompare(b.title) : sort === 'oldest' ? a.at - b.at : sort === 'value' ? (b.value || 0) - (a.value || 0) : sort === 'score' ? (b.score || 0) - (a.score || 0) : b.at - a.at);
    const column = (idc, title, cards, extra = {}) => ({ id: idc, title, cards: order(cards), ...extra });
    if (kind === 'leads') {
      requireThat(u.companyRole === 'admin', 403, 'Company admin access required');
      const c = await counts(pool, 'lead');
      const rows = (await pool.query('SELECT l.*,o.name AS owner FROM crm_leads l LEFT JOIN users o ON o.id=l.owner_id')).rows
        .filter((l) => has(l.school_name, l.contact_name, l.contact_email, l.location) && (!mine || l.owner_id === u.id) && (!filter || l.source === filter));
      const card = (l) => ({
        id: l.id, type: 'lead', revision: l.revision, title: l.school_name, at: new Date(l.updated_at).getTime(), value: Number(l.value_minor), score: leadScore(l, c.notes.get(l.id) || 0),
        line: [l.contact_name, l.est_students ? l.est_students + ' students' : '', l.location].filter(Boolean).join(' · ') || 'No contact yet',
        chip: l.next_at ? { text: new Date(l.next_at).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' }), tone: leadOverdue(l) ? 'bad' : 'plain' } : { text: 'No next step', tone: 'muted' },
        flags: [leadStalled(l) && { text: 'Stalled', tone: 'warn' }, leadOverdue(l) && { text: 'Overdue', tone: 'bad' }].filter(Boolean),
        notes: c.notes.get(l.id) || 0, tasks: c.tasks.get(l.id) || 0, owner: l.owner || '',
        detail: [l.contact_email, l.contact_phone, l.next_step && 'Next: ' + l.next_step].filter(Boolean),
      });
      return { kind, moves: STAGES, columns: STAGES.filter((s) => s !== 'lost' || filter === 'lost' || rows.some((l) => l.stage === 'lost')).map((s) => { const inStage = rows.filter((l) => l.stage === s); return column(s, STAGE_TITLE[s], inStage.map(card), { valueMinor: inStage.reduce((n, l) => n + Number(l.value_minor), 0) }); }) };
    }
    if (kind === 'onboarding') {
      const c = await counts(pool, 'school');
      const list = (await schools(pool)).filter((s) => has(s.name, s.contact_name) && (!filter || s.health.band === filter));
      const titles = { invited: 'Invited', setting_up: 'Setting up', rolling_out: 'Rolling out', live: 'Live', paused: 'Paused' };
      const card = (s) => ({
        id: s.id, type: 'school', title: s.name, at: new Date(s.created_at).getTime(), score: s.health.score,
        line: `${s.students} students · ${s.families} families · ${s.items} items`,
        chip: { text: s.health.band === 'new' ? 'New' : 'Health ' + s.health.score, tone: { green: 'good', amber: 'warn', red: 'bad', new: 'plain' }[s.health.band] },
        flags: [!s.boxes && { text: 'No collection box', tone: 'warn' }, !s.managers && { text: 'No manager', tone: 'warn' }, s.stale_tickets > 0 && { text: 'Ticket waiting', tone: 'bad' }].filter(Boolean),
        notes: c.notes.get(s.id) || 0, tasks: c.tasks.get(s.id) || 0, owner: '',
        detail: [s.contact_name, s.contact_email, `${s.linked} of ${s.students} students linked to a guardian`].filter(Boolean),
      });
      return { kind, moves: [], columns: Object.keys(titles).filter((k) => k !== 'paused' || list.some((s) => s.health.stage === 'paused')).map((k) => column(k, titles[k], list.filter((s) => s.health.stage === k).map(card))) };
    }
    if (kind === 'orders') {
      requireThat(u.companyRole === 'admin', 403, 'Company admin access required');
      const rows = (await pool.query("SELECT o.id,o.status,o.amount_minor,o.lines,o.delivery,o.delivered_at,o.created_at,p.name AS customer,s.name AS school FROM orders o JOIN users p ON p.id=o.user_id LEFT JOIN schools s ON s.id=o.school_id WHERE o.status IN ('pending','paid','fulfilled') AND (o.delivered_at IS NULL OR o.delivered_at>now()-interval '30 days') ORDER BY o.created_at DESC LIMIT 400")).rows.filter((o) => has(o.customer, o.school, o.id) && (!filter || o.delivery === filter));
      const stage = (o) => o.status === 'pending' ? 'pending' : o.status === 'paid' ? 'to_fulfil' : o.delivered_at ? 'delivered' : 'to_deliver';
      const labels = (o) => (o.lines || []).reduce((n, l) => n + Number(l.tagCount || 0) * Number(l.quantity || 1), 0);
      const card = (o) => ({
        id: o.id, type: 'order', title: o.customer, at: new Date(o.created_at).getTime(), value: Number(o.amount_minor),
        line: `${(o.lines || []).map((l) => l.name).join(', ') || 'Order'} · ${labels(o)} labels`,
        chip: { text: new Date(o.created_at).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' }), tone: 'plain' },
        flags: [{ text: o.delivery === 'home' ? 'Home delivery' : 'School pickup', tone: 'plain' }, stage(o) === 'to_fulfil' && days(o.created_at) >= 2 && { text: 'Waiting ' + days(o.created_at) + ' days', tone: 'bad' }].filter(Boolean),
        notes: 0, tasks: 0, owner: '', detail: [o.school, 'KSh ' + (Number(o.amount_minor) / 100).toLocaleString('en-KE')].filter(Boolean),
      });
      const titles = { pending: 'Awaiting payment', to_fulfil: 'To fulfil', to_deliver: 'To deliver', delivered: 'Delivered' };
      return { kind, moves: [], columns: Object.keys(titles).filter((k) => k !== 'pending' || rows.some((o) => stage(o) === 'pending')).map((k) => column(k, titles[k], rows.filter((o) => stage(o) === k).map(card))) };
    }
    if (kind === 'support') {
      requireThat(u.companyRole === 'admin', 403, 'Company admin access required');
      const c = await counts(pool, 'ticket');
      const rows = (await pool.query("SELECT id,name,kind,subject,status,created_at,updated_at FROM support_tickets WHERE status<>'resolved' OR updated_at>now()-interval '14 days' ORDER BY created_at DESC LIMIT 400")).rows.filter((t) => has(t.subject, t.name) && (!filter || t.kind === filter));
      const card = (t) => ({
        id: t.id, type: 'ticket', title: t.subject, at: new Date(t.created_at).getTime(), line: `${t.name} · ${t.kind}`,
        chip: { text: new Date(t.created_at).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' }), tone: ticketOverdue(t) ? 'bad' : 'plain' },
        flags: [ticketOverdue(t) && { text: 'Overdue', tone: 'bad' }, t.kind === 'school' && { text: 'School enquiry', tone: 'good' }].filter(Boolean),
        notes: c.notes.get(t.id) || 0, tasks: c.tasks.get(t.id) || 0, owner: '', detail: [],
      });
      const titles = { new: 'New', in_progress: 'In progress', resolved: 'Resolved' };
      return { kind, moves: [], columns: Object.keys(titles).map((k) => column(k, titles[k], rows.filter((t) => t.status === k).map(card))) };
    }
    if (kind === 'issues') {
      await intakeBugTickets(pool, u.id);
      const c = await counts(pool, 'issue');
      const rows = (await pool.query('SELECT i.*,a.name AS assignee,(SELECT count(*)::int FROM crm_issue_reports r WHERE r.issue_id=i.id) AS reports FROM crm_issues i LEFT JOIN users a ON a.id=i.assignee_id WHERE i.status NOT IN (\'fixed\',\'closed\') OR i.updated_at>now()-interval \'21 days\' ORDER BY i.created_at DESC LIMIT 400')).rows
        .filter((i) => has(i.title, i.description, AREAS[i.area]) && (!mine || i.assignee_id === u.id) && (!filter || i.severity === filter || i.area === filter));
      const rank = { s1: 4, s2: 3, s3: 2, s4: 1 };
      const card = (i) => { const sla = issueSla(i); return {
        id: i.id, type: 'issue', revision: i.revision, title: i.title, at: new Date(i.created_at).getTime(), score: rank[i.severity] || 0, value: i.reports,
        line: [AREAS[i.area], i.reports ? `${i.reports} report${i.reports === 1 ? '' : 's'}` : 'No reporter', i.source === 'monitor' ? 'from monitoring' : ''].filter(Boolean).join(' · '),
        chip: i.severity ? { text: SEVERITY[i.severity], tone: i.severity === 's1' ? 'bad' : i.severity === 's2' ? 'warn' : 'plain' } : { text: 'Needs triage', tone: 'muted' },
        flags: [sla.triageLate && { text: 'Acknowledge overdue', tone: 'bad' }, sla.fixLate && { text: 'Fix overdue', tone: 'bad' }, sla.onTime === false && { text: 'Fixed late', tone: 'warn' }].filter(Boolean),
        notes: c.notes.get(i.id) || 0, tasks: c.tasks.get(i.id) || 0, owner: i.assignee || '', detail: [i.description.slice(0, 140)].filter(Boolean),
      }; };
      return { kind, moves: u.companyRole === 'developer' ? ISSUE_STATUS : [], columns: ISSUE_STATUS.filter((s) => s !== 'closed' || rows.some((i) => i.status === 'closed')).map((s) => column(s, ISSUE_TITLE[s], rows.filter((i) => i.status === s).map(card))) };
    }
    requireThat(false, 404, 'Board not found');
  });

  // ---- Leads ----
  async function duplicate(db, d, except = '') {
    const r = (await db.query("SELECT id,school_name FROM crm_leads WHERE id<>$3 AND stage NOT IN ('lost') AND (lower(school_name)=lower($1) OR ($2<>'' AND lower(contact_email)=lower($2))) LIMIT 1", [d.schoolName, d.contactEmail, except])).rows[0];
    requireThat(!r, 409, r ? `"${r.school_name}" is already in the pipeline. Open that lead instead.` : '');
  }
  const leadValues = (d) => [d.schoolName, d.contactName, d.contactEmail, d.contactPhone, d.location, d.source, d.estStudents, Math.round(d.valueKes * 100), d.nextStep, d.nextAt];
  app.post('/api/company/crm/leads', async (req) => {
    const u = await admin(req), d = leadInput.extend({ ticketId: z.string().max(100).optional() }).strict().parse(req.body);
    return transaction(pool, async (db) => {
      await duplicate(db, d);
      const lid = id();
      await db.query('INSERT INTO crm_leads(school_name,contact_name,contact_email,contact_phone,location,source,est_students,value_minor,next_step,next_at,id,owner_id,created_by,ticket_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13)', [...leadValues(d), lid, u.id, d.ticketId || null]);
      await operationAudit(db, u, 'lead_created', lid, 'Lead added to the pipeline', { school: d.schoolName, source: d.source });
      return { id: lid };
    });
  });
  app.post('/api/company/crm/leads/from-ticket/:id', async (req) => {
    const u = await admin(req);
    return transaction(pool, async (db) => {
      const t = (await db.query('SELECT * FROM support_tickets WHERE id=$1', [req.params.id])).rows[0];
      requireThat(t, 404, 'Ticket not found');
      const existing = (await db.query('SELECT id FROM crm_leads WHERE ticket_id=$1', [t.id])).rows[0];
      if (existing) return { id: existing.id, existing: true };
      const d = { schoolName: (t.subject || t.name).slice(0, 150), contactName: t.name, contactEmail: t.email.toLowerCase() };
      await duplicate(db, d);
      const lid = id();
      await db.query("INSERT INTO crm_leads(id,school_name,contact_name,contact_email,source,owner_id,created_by,ticket_id) VALUES($1,$2,$3,$4,'website',$5,$5,$6)", [lid, d.schoolName, d.contactName, d.contactEmail, u.id, t.id]);
      await db.query("INSERT INTO crm_notes(id,entity_type,entity_id,kind,body,author_id) VALUES($1,'lead',$2,'email',$3,$4)", [id(), lid, 'Enquiry from the website: ' + t.message.slice(0, 1500), u.id]);
      await operationAudit(db, u, 'lead_created', lid, 'Lead created from a website enquiry', { ticket: t.id });
      return { id: lid };
    });
  });
  app.post('/api/company/crm/leads/:id', async (req) => {
    const u = await admin(req);
    // No defaults here: a field that is not sent keeps its current value.
    const d = z.object({
      schoolName: text(150).min(2), contactName: text(120), contactEmail: z.union([z.literal(''), z.string().trim().toLowerCase().email().max(254)]), contactPhone: text(30), location: text(150), source: z.enum(SOURCES),
      estStudents: z.number().int().min(1).max(100000).nullable(), valueKes: z.number().min(0).max(1e9), nextStep: text(200), nextAt: dateOnly,
      stage: z.enum(STAGES), lostReason: text(300), schoolId: z.string().max(100), ownerId: z.string().max(100).nullable(),
    }).partial().extend({ revision: z.number().int().min(1) }).strict().parse(req.body);
    return transaction(pool, async (db) => {
      const l = (await db.query('SELECT * FROM crm_leads WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
      requireThat(l, 404, 'Lead not found');
      requireThat(l.revision === d.revision, 409, 'This lead changed. Refresh and try again.');
      const next = {
        schoolName: d.schoolName ?? l.school_name, contactName: d.contactName ?? l.contact_name, contactEmail: d.contactEmail ?? l.contact_email, contactPhone: d.contactPhone ?? l.contact_phone,
        location: d.location ?? l.location, source: d.source ?? l.source, estStudents: d.estStudents === undefined ? l.est_students : d.estStudents,
        valueKes: d.valueKes === undefined ? Number(l.value_minor) / 100 : d.valueKes, nextStep: d.nextStep ?? l.next_step, nextAt: d.nextAt === undefined ? (l.next_at ? new Date(l.next_at).toISOString().slice(0, 10) : null) : d.nextAt,
      };
      if (d.schoolName || d.contactEmail) await duplicate(db, next, l.id);
      const stage = d.stage ?? l.stage, moved = stage !== l.stage;
      // Stage rules: what must be known before a lead can enter a stage.
      if (moved && ['proposal', 'won'].includes(stage)) requireThat(next.estStudents, 400, 'Add the estimated number of students before moving to ' + STAGE_TITLE[stage]);
      if (moved && ['contacted', 'demo', 'proposal', 'won'].includes(stage)) requireThat(next.contactName || next.contactEmail || next.contactPhone, 400, 'Add a contact person before moving this lead on');
      if (moved && stage === 'lost') requireThat((d.lostReason || '').length >= 3, 400, 'Say why this lead was lost');
      let schoolId = l.school_id;
      if (moved && stage === 'won' && d.schoolId) { requireThat((await db.query('SELECT 1 FROM schools WHERE id=$1', [d.schoolId])).rowCount, 400, 'School not found'); schoolId = d.schoolId; }
      const owner = d.ownerId === undefined ? l.owner_id : d.ownerId;
      if (owner) requireThat((await db.query('SELECT 1 FROM company_access WHERE user_id=$1', [owner])).rowCount, 400, 'Owner must be a company operator');
      await db.query('UPDATE crm_leads SET school_name=$1,contact_name=$2,contact_email=$3,contact_phone=$4,location=$5,source=$6,est_students=$7,value_minor=$8,next_step=$9,next_at=$10,stage=$11,lost_reason=$12,school_id=$13,owner_id=$14,updated_at=now(),stage_at=CASE WHEN $15 THEN now() ELSE stage_at END,closed_at=CASE WHEN $11 IN (\'won\',\'lost\') THEN COALESCE(closed_at,now()) ELSE NULL END,revision=revision+1 WHERE id=$16',
        [...leadValues(next), stage, stage === 'lost' ? d.lostReason || l.lost_reason : '', schoolId, owner, moved, l.id]);
      if (moved) {
        await db.query("INSERT INTO crm_notes(id,entity_type,entity_id,kind,body,author_id) VALUES($1,'lead',$2,'stage',$3,$4)", [id(), l.id, `Moved from ${STAGE_TITLE[l.stage]} to ${STAGE_TITLE[stage]}${stage === 'lost' ? ': ' + d.lostReason : ''}`, u.id]);
        await operationAudit(db, u, 'lead_stage_changed', l.id, `Lead moved to ${STAGE_TITLE[stage]}`, { from: l.stage, to: stage });
      }
      return { ok: true };
    });
  });

  // ---- Notes and tasks ----
  app.post('/api/company/crm/notes', async (req) => {
    const u = await operator(req);
    const d = z.object({ entityType: z.enum(['lead', 'school', 'family', 'ticket', 'order', 'issue']), entityId: z.string().min(1).max(100), kind: z.enum(['note', 'call', 'meeting', 'email']).default('note'), body: z.string().trim().min(2).max(4000) }).strict().parse(req.body);
    requireThat(['school', 'family', 'issue'].includes(d.entityType) || u.companyRole === 'admin', 403, 'Company admin access required');
    const nid = id();
    await pool.query('INSERT INTO crm_notes(id,entity_type,entity_id,kind,body,author_id) VALUES($1,$2,$3,$4,$5,$6)', [nid, d.entityType, d.entityId, d.kind, d.body, u.id]);
    if (d.entityType === 'lead') await pool.query('UPDATE crm_leads SET updated_at=now() WHERE id=$1', [d.entityId]);
    if (d.entityType === 'issue') await pool.query('UPDATE crm_issues SET updated_at=now() WHERE id=$1', [d.entityId]);
    return { id: nid };
  });
  app.get('/api/company/crm/tasks', async (req) => {
    const u = await operator(req), isAdmin = u.companyRole === 'admin';
    const { scope = 'mine' } = z.object({ scope: z.enum(['mine', 'all']).optional() }).parse(req.query);
    const tasks = (await pool.query("SELECT t.*,a.name AS assignee,c.name AS creator FROM crm_tasks t LEFT JOIN users a ON a.id=t.assignee_id JOIN users c ON c.id=t.created_by WHERE (t.status='open' OR t.done_at>now()-interval '7 days') AND ($1 OR t.assignee_id=$2 OR t.assignee_id IS NULL) ORDER BY t.status DESC,t.due_at NULLS LAST,t.created_at LIMIT 300", [scope === 'all', u.id])).rows;
    // The work queue is read from live data, so nothing has to be remembered by hand.
    const queue = [];
    if (isAdmin) {
      const o = (await pool.query("SELECT count(*) FILTER(WHERE status='paid')::int a,count(*) FILTER(WHERE status='fulfilled' AND delivered_at IS NULL)::int b FROM orders")).rows[0];
      if (o.a) queue.push({ title: `Fulfil ${o.a} paid order${o.a === 1 ? '' : 's'}`, page: 'orders', tone: 'warn' });
      if (o.b) queue.push({ title: `Mark ${o.b} order${o.b === 1 ? '' : 's'} delivered once labels arrive`, page: 'orders', tone: 'plain' });
      const tickets = (await pool.query("SELECT id,subject,status,created_at FROM support_tickets WHERE status<>'resolved'")).rows;
      for (const t of tickets.filter(ticketOverdue).slice(0, 5)) queue.push({ title: 'Overdue ticket: ' + t.subject, page: 'support', record: { type: 'ticket', id: t.id }, tone: 'bad' });
      const fresh = tickets.filter((t) => t.status === 'new' && !ticketOverdue(t)).length;
      if (fresh) queue.push({ title: `Reply to ${fresh} new ticket${fresh === 1 ? '' : 's'}`, page: 'support', tone: 'warn' });
      const leads = (await pool.query("SELECT * FROM crm_leads WHERE stage NOT IN ('won','lost')")).rows;
      for (const l of leads.filter(leadOverdue).slice(0, 5)) queue.push({ title: `Follow up with ${l.school_name}: ${l.next_step || 'next step is overdue'}`, page: 'leads', record: { type: 'lead', id: l.id }, tone: 'bad' });
      for (const l of leads.filter((x) => leadStalled(x) && !leadOverdue(x)).slice(0, 5)) queue.push({ title: `${l.school_name} has had no activity for ${days(l.updated_at)} days`, page: 'leads', record: { type: 'lead', id: l.id }, tone: 'warn' });
    } else {
      const issues = (await pool.query("SELECT * FROM crm_issues WHERE status NOT IN ('fixed','closed') ORDER BY created_at")).rows;
      for (const i of issues.filter((x) => issueSla(x).fixLate).slice(0, 5)) queue.push({ title: `Fix overdue (${SEVERITY[i.severity]}): ${i.title}`, page: 'issues', record: { type: 'issue', id: i.id }, tone: 'bad' });
      for (const i of issues.filter((x) => x.status === 'new').slice(0, 6)) queue.push({ title: `Triage: ${i.title}`, page: 'issues', record: { type: 'issue', id: i.id }, tone: issueSla(i).triageLate ? 'bad' : 'warn' });
      for (const s of (await systemSignals(pool)).filter((x) => x.state === 'bad' && !['Email delivery', 'Privacy requests'].includes(x.name))) queue.push({ title: `${s.name}: ${s.detail}`, page: s.page, tone: 'bad' });
      const p = (await pool.query("SELECT count(*)::int n FROM privacy_requests WHERE status='pending'")).rows[0].n;
      if (p) queue.push({ title: `Review ${p} privacy request${p === 1 ? '' : 's'}`, page: 'legacy:privacy', tone: 'bad' });
      const m = (await pool.query('SELECT count(*)::int n FROM outbox WHERE sent_at IS NULL AND attempts>=8')).rows[0].n;
      if (m) queue.push({ title: `${m} email${m === 1 ? '' : 's'} failed to send`, page: 'legacy:mail', tone: 'bad' });
    }
    for (const s of (await schools(pool)).filter((x) => x.health.band === 'red').slice(0, 5)) queue.push({ title: `Check in with ${s.name} (health ${s.health.score})`, page: 'onboarding', record: { type: 'school', id: s.id }, tone: 'bad' });
    return { tasks, queue };
  });
  app.post('/api/company/crm/tasks', async (req) => {
    const u = await operator(req);
    const d = z.object({ title: z.string().trim().min(2).max(200), dueAt: dateOnly.default(null), assigneeId: z.string().max(100).nullable().default(null), entityType: z.enum(['lead', 'school', 'family', 'ticket', 'order', 'issue']).nullable().default(null), entityId: z.string().max(100).nullable().default(null), entityLabel: text(160).default('') }).strict().parse(req.body);
    if (d.assigneeId) requireThat((await pool.query('SELECT 1 FROM company_access WHERE user_id=$1', [d.assigneeId])).rowCount, 400, 'Assign tasks to a company operator');
    const tid = id();
    await pool.query('INSERT INTO crm_tasks(id,title,due_at,assignee_id,entity_type,entity_id,entity_label,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [tid, d.title, d.dueAt, d.assigneeId ?? u.id, d.entityType, d.entityId, d.entityLabel, u.id]);
    return { id: tid };
  });
  app.post('/api/company/crm/tasks/:id', async (req) => {
    await operator(req);
    const d = z.object({ done: z.boolean() }).strict().parse(req.body);
    const r = await pool.query("UPDATE crm_tasks SET status=$1,done_at=CASE WHEN $2 THEN now() ELSE NULL END WHERE id=$3", [d.done ? 'done' : 'open', d.done, req.params.id]);
    requireThat(r.rowCount, 404, 'Task not found');
    return { ok: true };
  });

  // ---- Customers ----
  app.get('/api/company/crm/customers', async (req) => {
    await operator(req);
    const { type = 'schools', q = '', sort = 'name', filter = '' } = z.object({ type: z.enum(['schools', 'families']).optional(), q: z.string().max(100).optional(), sort: z.string().max(20).optional(), filter: z.string().max(30).optional() }).parse(req.query);
    if (type === 'schools') {
      const rows = (await schools(pool, "s.name ILIKE '%'||$1||'%'", [q])).filter((s) => !filter || s.health.band === filter)
        .map((s) => ({ id: s.id, type: 'school', name: s.name, sub: s.contact_name || s.contact_email || '', a: s.students, b: s.families, c: s.items, health: s.health, lifecycle: s.lifecycle, at: s.created_at }));
      rows.sort((x, y) => sort === 'health' ? x.health.score - y.health.score : sort === 'size' ? y.a - x.a : sort === 'recent' ? new Date(y.at) - new Date(x.at) : x.name.localeCompare(y.name));
      return { type, rows };
    }
    const order = { name: 'u.name', recent: 'u.created_at DESC', spend: 'spent DESC', size: 'children DESC' }[sort] || 'u.name';
    const rows = (await pool.query(`SELECT u.id,u.name,u.email,u.verified,u.created_at,
      (SELECT s.name FROM memberships m JOIN schools s ON s.id=m.school_id WHERE m.user_id=u.id ORDER BY s.name LIMIT 1) AS school,
      (SELECT count(*)::int FROM students st WHERE st.guardian_id=u.id AND st.status='active') AS children,
      (SELECT count(*)::int FROM items i WHERE i.owner_id=u.id OR i.student_id IN (SELECT id FROM students WHERE guardian_id=u.id)) AS items,
      (SELECT COALESCE(sum(amount_minor),0)::bigint FROM orders o WHERE o.user_id=u.id AND o.status IN ('paid','fulfilled')) AS spent
      FROM users u WHERE u.role='parent' AND u.disabled_at IS NULL AND NOT EXISTS(SELECT 1 FROM company_access c WHERE c.user_id=u.id) AND (u.name ILIKE '%'||$1||'%' OR u.email ILIKE '%'||$1||'%') ORDER BY ${order},u.id LIMIT 200`, [q])).rows
      .filter((f) => !filter || (filter === 'buyers' ? Number(f.spent) > 0 : filter === 'no_children' ? !f.children : true))
      .map((f) => ({ id: f.id, type: 'family', name: f.name, sub: f.email, school: f.school || '', a: f.children, b: f.items, c: Number(f.spent), verified: f.verified, at: f.created_at }));
    return { type, rows };
  });

  // ---- One record, everything linked ----
  app.get('/api/company/crm/record/:type/:id', async (req) => {
    const u = await operator(req), isAdmin = u.companyRole === 'admin', { type, id: rid } = req.params;
    requireThat(['lead', 'school', 'family', 'ticket', 'order', 'issue'].includes(type), 404, 'Record not found');
    requireThat(isAdmin || ['school', 'family', 'issue'].includes(type), 403, 'Company admin access required');
    const timeline = [];
    const push = (at, kind, textLine, who = '') => timeline.push({ at, kind, text: textLine, who });
    for (const n of (await pool.query('SELECT n.*,a.name AS author FROM crm_notes n JOIN users a ON a.id=n.author_id WHERE n.entity_type=$1 AND n.entity_id=$2 ORDER BY n.created_at DESC LIMIT 80', [type, rid])).rows) push(n.created_at, n.kind, n.body, n.author);
    for (const a of (await pool.query('SELECT a.action,a.reason,a.created_at,x.name AS actor FROM operation_audit a JOIN users x ON x.id=a.actor_id WHERE a.entity_id=$1 ORDER BY a.created_at DESC LIMIT 40', [rid])).rows) if (!['lead_stage_changed', 'issue_status_changed'].includes(a.action)) push(a.created_at, 'audit', a.action.replaceAll('_', ' ') + (a.reason ? ': ' + a.reason : ''), a.actor);
    const tasks = (await pool.query("SELECT t.id,t.title,t.due_at,t.status,a.name AS assignee FROM crm_tasks t LEFT JOIN users a ON a.id=t.assignee_id WHERE t.entity_type=$1 AND t.entity_id=$2 ORDER BY t.status DESC,t.due_at NULLS LAST LIMIT 50", [type, rid])).rows;
    let record;
    if (type === 'lead') {
      const l = (await pool.query('SELECT l.*,o.name AS owner,s.name AS school FROM crm_leads l LEFT JOIN users o ON o.id=l.owner_id LEFT JOIN schools s ON s.id=l.school_id WHERE l.id=$1', [rid])).rows[0];
      requireThat(l, 404, 'Lead not found');
      const notes = timeline.filter((t) => t.kind !== 'audit' && t.kind !== 'stage').length;
      record = { title: l.school_name, subtitle: STAGE_TITLE[l.stage] + ' · ' + l.source, lead: { ...l, value_kes: Number(l.value_minor) / 100, next_at: l.next_at ? new Date(l.next_at).toISOString().slice(0, 10) : null, score: leadScore(l, notes), probability: PROBABILITY[l.stage], stalled: leadStalled(l), overdue: !!leadOverdue(l) }, stages: STAGES.map((s) => ({ id: s, title: STAGE_TITLE[s] })) };
    } else if (type === 'school') {
      const s = (await schools(pool, 's.id=$1', [rid]))[0];
      requireThat(s, 404, 'School not found');
      const people = (await pool.query("SELECT x.name,x.email,m.role FROM memberships m JOIN users x ON x.id=m.user_id WHERE m.school_id=$1 AND m.role IN ('manager','staff') ORDER BY m.role,x.name LIMIT 40", [rid])).rows;
      const houses = (await pool.query("SELECT house,count(*)::int n FROM students WHERE school_id=$1 AND status='active' AND house IS NOT NULL GROUP BY house ORDER BY house", [rid])).rows;
      record = { title: s.name, subtitle: s.lifecycle === 'active' ? 'Partner school' : 'School · ' + s.lifecycle, school: { ...s, people, houses } };
      if (isAdmin) {
        const o = (await pool.query("SELECT count(*)::int n,COALESCE(sum(amount_minor),0)::bigint total FROM orders WHERE school_id=$1 AND status IN ('paid','fulfilled')", [rid])).rows[0];
        record.school.orders = { count: o.n, totalMinor: Number(o.total) };
        const lead = (await pool.query('SELECT id,created_at,closed_at,source FROM crm_leads WHERE school_id=$1 LIMIT 1', [rid])).rows[0];
        if (lead) push(lead.closed_at || lead.created_at, 'stage', 'Won from the lead pipeline (source: ' + lead.source + ')');
      }
    } else if (type === 'family') {
      const f = (await pool.query("SELECT u.id,u.name,u.email,u.verified,u.created_at,(SELECT max(last_seen_at) FROM sessions s WHERE s.user_id=u.id) AS last_seen FROM users u WHERE u.id=$1 AND u.role='parent' AND NOT EXISTS(SELECT 1 FROM company_access c WHERE c.user_id=u.id)", [rid])).rows[0];
      requireThat(f, 404, 'Family not found');
      const kids = (await pool.query("SELECT st.id,st.name,st.class_name,st.house,s.name AS school,(SELECT count(*)::int FROM items i WHERE i.student_id=st.id) AS items FROM students st JOIN schools s ON s.id=st.school_id WHERE st.guardian_id=$1 AND st.status='active' ORDER BY st.name", [rid])).rows;
      // Children's names are shown only to the role that fulfils their labels.
      record = { title: f.name, subtitle: 'Family · ' + (kids[0]?.school || 'no school yet'), family: { ...f, children: isAdmin ? kids : kids.map((k, i) => ({ ...k, name: 'Child ' + (i + 1) })) } };
      if (isAdmin) {
        record.family.orders = (await pool.query('SELECT id,status,amount_minor,delivered_at,created_at FROM orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20', [rid])).rows;
        record.family.tickets = (await pool.query('SELECT id,subject,status,created_at FROM support_tickets WHERE user_id=$1 OR lower(email)=lower($2) ORDER BY created_at DESC LIMIT 20', [rid, f.email])).rows;
        for (const o of record.family.orders) push(o.created_at, 'order', `Order ${o.status}: KSh ${(Number(o.amount_minor) / 100).toLocaleString('en-KE')}`);
        for (const t of record.family.tickets) push(t.created_at, 'ticket', 'Support: ' + t.subject);
      }
    } else if (type === 'issue') {
      const i = (await pool.query('SELECT i.*,a.name AS assignee,c.name AS logged_by FROM crm_issues i LEFT JOIN users a ON a.id=i.assignee_id JOIN users c ON c.id=i.created_by WHERE i.id=$1', [rid])).rows[0];
      requireThat(i, 404, 'Issue not found');
      const reports = (await pool.query('SELECT r.id,r.name,r.email,r.created_at,r.notified_at,r.ticket_id,t.subject FROM crm_issue_reports r LEFT JOIN support_tickets t ON t.id=r.ticket_id WHERE r.issue_id=$1 ORDER BY r.created_at', [rid])).rows;
      record = { title: i.title, subtitle: `Issue · ${ISSUE_TITLE[i.status]}${i.severity ? ' · ' + SEVERITY[i.severity] : ''}`, issue: { ...i, reports, sla: issueSla(i), canEdit: !isAdmin, targets: i.severity ? { triage: TRIAGE_HOURS[i.severity], fix: FIX_HOURS[i.severity] } : null }, stages: ISSUE_STATUS.map((s) => ({ id: s, title: ISSUE_TITLE[s] })), areas: AREAS, severities: SEVERITY };
    } else if (type === 'ticket') {
      const t = (await pool.query('SELECT * FROM support_tickets WHERE id=$1', [rid])).rows[0];
      requireThat(t, 404, 'Ticket not found');
      const replies = (await pool.query('SELECT r.message,r.created_at,a.name FROM support_replies r JOIN users a ON a.id=r.actor_id WHERE r.ticket_id=$1 ORDER BY r.created_at', [rid])).rows;
      for (const r of replies) push(r.created_at, 'email', 'Reply sent: ' + r.message, r.name);
      const lead = (await pool.query('SELECT id FROM crm_leads WHERE ticket_id=$1', [rid])).rows[0];
      const issue = (await pool.query('SELECT issue_id FROM crm_issue_reports WHERE ticket_id=$1', [rid])).rows[0];
      record = { title: t.subject, subtitle: `Ticket · ${t.kind} · ${t.status.replace('_', ' ')}`, ticket: { id: t.id, name: t.name, email: t.email, kind: t.kind, status: t.status, message: t.message, created_at: t.created_at, user_id: t.user_id, overdue: ticketOverdue(t), leadId: lead?.id || null, issueId: issue?.issue_id || null } };
    } else {
      const o = (await pool.query('SELECT o.*,p.name AS customer,s.name AS school,(SELECT name FROM students WHERE id=o.student_id) AS child FROM orders o JOIN users p ON p.id=o.user_id LEFT JOIN schools s ON s.id=o.school_id WHERE o.id=$1', [rid])).rows[0];
      requireThat(o, 404, 'Order not found');
      record = { title: 'Order for ' + o.customer, subtitle: `Order · ${o.status}${o.delivered_at ? ' · delivered' : ''}`, order: { id: o.id, status: o.status, amount_minor: Number(o.amount_minor), lines: o.lines, delivery: o.delivery, delivery_address: o.delivery_address, delivered_at: o.delivered_at, created_at: o.created_at, customer: o.customer, customer_id: o.user_id, school: o.school, child: o.child } };
    }
    timeline.sort((a, b) => new Date(b.at) - new Date(a.at));
    // Opening a customer record is itself recorded.
    await pool.query('INSERT INTO audit_log(id,user_id,action) VALUES($1,$2,$3)', [id(), u.id, 'crm_record_viewed']);
    return { type, id: rid, ...record, timeline: timeline.slice(0, 80), tasks };
  });

  // ---- System issues: intake, triage rules, and closing the loop with reporters ----
  const issueInput = z.object({
    title: text(200).min(3), description: text(6000).default(''), steps: text(3000).default(''), severity: z.enum(['s1', 's2', 's3', 's4']).nullable().default(null),
    area: z.enum(Object.keys(AREAS)).default('other'), source: z.enum(['email', 'support', 'monitor', 'internal']).default('internal'),
    reporterName: text(120).default(''), reporterEmail: z.union([z.literal(''), z.string().trim().toLowerCase().email().max(254)]).default(''),
  }).strict();
  app.post('/api/company/crm/issues', async (req) => {
    const u = await operator(req), d = issueInput.parse(req.body);
    return transaction(pool, async (db) => {
      const iid = id();
      await db.query('INSERT INTO crm_issues(id,title,description,steps,severity,area,source,created_by,status,triaged_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [iid, d.title, d.description, d.steps, d.severity, d.area, d.source, u.id, d.severity ? 'triaged' : 'new', d.severity ? new Date() : null]);
      if (d.reporterName || d.reporterEmail) await db.query('INSERT INTO crm_issue_reports(id,issue_id,name,email) VALUES($1,$2,$3,$4)', [id(), iid, d.reporterName, d.reporterEmail]);
      await operationAudit(db, u, 'issue_logged', iid, 'System issue logged', { title: d.title, source: d.source });
      return { id: iid };
    });
  });
  // Support hands a complaint to the developer: a new issue, or one more report on an existing issue.
  app.post('/api/company/crm/issues/from-ticket/:id', async (req) => {
    const u = await operator(req), d = z.object({ issueId: z.string().max(100).optional() }).strict().parse(req.body || {});
    return transaction(pool, async (db) => {
      const t = (await db.query('SELECT * FROM support_tickets WHERE id=$1', [req.params.id])).rows[0];
      requireThat(t, 404, 'Ticket not found');
      const linked = (await db.query('SELECT issue_id FROM crm_issue_reports WHERE ticket_id=$1', [t.id])).rows[0];
      if (linked) return { id: linked.issue_id, existing: true };
      let iid = d.issueId;
      if (iid) requireThat((await db.query('SELECT 1 FROM crm_issues WHERE id=$1', [iid])).rowCount, 404, 'Issue not found');
      else { iid = id(); await db.query("INSERT INTO crm_issues(id,title,description,source,created_by) VALUES($1,$2,$3,'support',$4)", [iid, t.subject.slice(0, 200), t.message, u.id]); }
      await db.query('INSERT INTO crm_issue_reports(id,issue_id,ticket_id,name,email) VALUES($1,$2,$3,$4,$5)', [id(), iid, t.id, t.name, t.email]);
      await db.query('UPDATE crm_issues SET updated_at=now() WHERE id=$1', [iid]);
      await operationAudit(db, u, 'issue_escalated', iid, 'Support ticket escalated to the developer', { ticket: t.id });
      return { id: iid };
    });
  });
  app.post('/api/company/crm/issues/:id/reports', async (req) => {
    const u = await operator(req), d = z.object({ name: text(120).default(''), email: z.string().trim().toLowerCase().email().max(254) }).strict().parse(req.body);
    requireThat((await pool.query('SELECT 1 FROM crm_issues WHERE id=$1', [req.params.id])).rowCount, 404, 'Issue not found');
    requireThat(!(await pool.query('SELECT 1 FROM crm_issue_reports WHERE issue_id=$1 AND lower(email)=$2', [req.params.id, d.email])).rowCount, 409, 'This person is already on the issue');
    await pool.query('INSERT INTO crm_issue_reports(id,issue_id,name,email) VALUES($1,$2,$3,$4)', [id(), req.params.id, d.name, d.email]);
    await pool.query('UPDATE crm_issues SET updated_at=now() WHERE id=$1', [req.params.id]);
    await operationAudit(pool, u, 'issue_report_added', req.params.id, 'Another report added to the issue', {});
    return { ok: true };
  });
  app.post('/api/company/crm/issues/:id', async (req) => {
    const u = await operator(req, ['developer']);
    const d = z.object({
      title: text(200).min(3), description: text(6000), steps: text(3000), severity: z.enum(['s1', 's2', 's3', 's4']).nullable(), area: z.enum(Object.keys(AREAS)),
      status: z.enum(ISSUE_STATUS), assigneeId: z.string().max(100).nullable(), resolution: text(3000), rootCause: text(3000), notify: z.boolean(),
    }).partial().extend({ revision: z.number().int().min(1) }).strict().parse(req.body);
    return transaction(pool, async (db) => {
      const i = (await db.query('SELECT * FROM crm_issues WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
      requireThat(i, 404, 'Issue not found');
      requireThat(i.revision === d.revision, 409, 'This issue changed. Refresh and try again.');
      const n = { title: d.title ?? i.title, description: d.description ?? i.description, steps: d.steps ?? i.steps, severity: d.severity === undefined ? i.severity : d.severity, area: d.area ?? i.area, status: d.status ?? i.status, resolution: d.resolution ?? i.resolution, rootCause: d.rootCause ?? i.root_cause };
      let assignee = d.assigneeId === undefined ? i.assignee_id : d.assigneeId;
      const moved = n.status !== i.status;
      // Triage rules: an issue is only acknowledged once its impact and area are known, and only fixed once the fix is written down.
      if (n.status !== 'new' && n.status !== 'closed') requireThat(n.severity, 400, 'Set the severity before moving this issue on');
      if (moved && n.status === 'in_progress' && !assignee) assignee = u.id;
      if (moved && n.status === 'fixed') requireThat(n.resolution.length >= 8, 400, 'Describe what was fixed before marking this issue fixed');
      if (moved && n.status === 'fixed' && ['s1', 's2'].includes(n.severity)) requireThat(n.rootCause.length >= 8, 400, 'Critical and major issues need a root cause before they are marked fixed');
      if (moved && n.status === 'closed' && !i.fixed_at) requireThat(n.resolution.length >= 8, 400, 'Say why this issue is being closed without a fix');
      if (assignee) requireThat((await db.query('SELECT 1 FROM company_access WHERE user_id=$1', [assignee])).rowCount, 400, 'Assign issues to a company operator');
      await db.query("UPDATE crm_issues SET title=$1,description=$2,steps=$3,severity=$4,area=$5,status=$6,resolution=$7,root_cause=$8,assignee_id=$9,updated_at=now(),triaged_at=CASE WHEN $6<>'new' THEN COALESCE(triaged_at,now()) ELSE triaged_at END,fixed_at=CASE WHEN $6='fixed' THEN COALESCE(fixed_at,now()) WHEN $6 IN ('new','triaged','in_progress') THEN NULL ELSE fixed_at END,revision=revision+1 WHERE id=$10",
        [n.title, n.description, n.steps, n.severity, n.area, n.status, n.resolution, n.rootCause, assignee, i.id]);
      let notified = 0;
      if (moved) {
        await db.query("INSERT INTO crm_notes(id,entity_type,entity_id,kind,body,author_id) VALUES($1,'issue',$2,'stage',$3,$4)", [id(), i.id, `Moved from ${ISSUE_TITLE[i.status]} to ${ISSUE_TITLE[n.status]}${n.status === 'fixed' ? ': ' + n.resolution : ''}`, u.id]);
        await operationAudit(db, u, 'issue_status_changed', i.id, `Issue moved to ${ISSUE_TITLE[n.status]}`, { from: i.status, to: n.status, severity: n.severity });
        // Close the loop: everyone who reported it hears that it is fixed.
        if (n.status === 'fixed' && d.notify !== false) {
          const people = (await db.query("SELECT id,name,email,ticket_id FROM crm_issue_reports WHERE issue_id=$1 AND email<>'' AND notified_at IS NULL", [i.id])).rows;
          for (const p of people) {
            await db.query('INSERT INTO outbox(id,user_id,recipient_email,subject,body) VALUES($1,$2,$3,$4,$5)', [id(), u.id, p.email, 'Fixed: ' + n.title, `Hello${p.name ? ' ' + p.name.split(' ')[0] : ''},\n\nThank you for telling us about this problem: "${n.title}".\n\nIt has now been fixed. ${n.resolution}\n\nIf you still see it, reply to this email and we will look again.\n\nFindBox`]);
            await db.query('UPDATE crm_issue_reports SET notified_at=now() WHERE id=$1', [p.id]);
            if (p.ticket_id) await db.query("UPDATE support_tickets SET status='resolved',updated_at=now() WHERE id=$1 AND status<>'resolved'", [p.ticket_id]);
            notified++;
          }
        }
      }
      return { ok: true, notified };
    });
  });

  // ---- Activity ----
  app.get('/api/company/crm/activity', async (req) => {
    const u = await operator(req);
    const { filter = '', q = '' } = z.object({ filter: z.string().max(20).optional(), q: z.string().max(100).optional() }).parse(req.query);
    const groups = { sales: ['lead_', 'order_', 'invoice', 'client_'], support: ['support_', 'announcement'], issues: ['issue_'], schools: ['school', 'child_', 'membership', 'family_', 'demo_'], system: ['account_', 'sessions_', 'profile_', 'mail_', 'privacy', 'item_', 'password'] };
    const rows = (await pool.query("SELECT a.id,a.action,a.actor_id,a.entity_id,a.reason,a.created_at,x.name AS actor,c.role FROM operation_audit a JOIN users x ON x.id=a.actor_id LEFT JOIN company_access c ON c.user_id=a.actor_id WHERE (a.action ILIKE '%'||$1||'%' OR a.reason ILIKE '%'||$1||'%' OR x.name ILIKE '%'||$1||'%') ORDER BY a.created_at DESC LIMIT 300", [q])).rows
      .filter((r) => !filter || (filter === 'mine' ? r.actor_id === u.id : (groups[filter] || []).some((p) => r.action.startsWith(p) || r.action.includes(p))));
    return { rows: rows.slice(0, 150).map((r) => ({ id: r.id, at: r.created_at, actor: r.actor, role: r.role || 'school', action: r.action.replaceAll('_', ' '), reason: r.reason, entity: r.entity_id })) };
  });
}
