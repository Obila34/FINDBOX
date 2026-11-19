import { z } from 'zod';
import { requireThat } from './security.mjs';
import { schoolStats } from './crm.mjs';
import { standings } from './houses.mjs';

// The school side of FindBox (docs/SCHOOL-WORKSPACE.md).
//  - The principal's workspace: what needs a decision, how the school is doing, and a term report.
//  - The staff app: every found item logged, stored, and handed back with a custody trail.
// Both read the same lost-and-found board. Changes go through the existing, audited staff endpoints.

const DAY = 864e5;
const HOLD_DAYS = 30; // unclaimed items wait this long before they may be donated
const days = (a, b = Date.now()) => (new Date(b).getTime() - new Date(a).getTime()) / DAY;
const STAGES = { reported_lost: 'Reported lost', awaiting_deposit: 'On its way', awaiting_collection: 'In the box', unclaimed: 'Unclaimed', returned: 'Returned', closed: 'Donated or closed' };
const EVENT = { reported_lost: 'Reported lost', deposit_reported: 'Found and reported', found_direct: 'Found; finder will hand it back', untagged_handed_in: 'Handed in without a QR', found_unclaimed: 'Logged without a QR', received: 'Received into the box', collected: 'Handed back', deadline_extended: 'Collection date extended', claim_approved: 'Claim approved', claim_rejected: 'Claim rejected', owner_scanned: 'Owner scanned it at home' };
const REVIEW = { dispute: 'Ownership dispute raised', collection_authorisation: 'Collection authorised', correction: 'Correction recorded', disposal_request: 'Donation requested', disposal_approved: 'Donation approved', reopen: 'Reopened' };

export async function schoolDeskRoutes(app, { pool, user }) {
  async function desk(req, managerOnly = false) {
    const u = await user(req);
    requireThat(['staff', 'manager'].includes(u.role) && u.school_id && u.verified, 403, 'School staff access required');
    requireThat(!u.session_portal || u.session_portal === 'school', 403, 'Sign in through the school portal to continue');
    if (managerOnly) requireThat(u.role === 'manager', 403, 'School administrator access required');
    return u;
  }
  const CASES = `SELECT c.id,c.title,c.category,c.status,c.due_at,c.collected_at,c.created_at,c.item_id,c.box_id,(c.photo IS NOT NULL) AS has_photo,b.name AS box,
    st.name AS child,st.class_name,st.house,i.name AS item_name
    FROM cases c LEFT JOIN boxes b ON b.id=c.box_id LEFT JOIN items i ON i.id=c.item_id LEFT JOIN students st ON st.id=i.student_id WHERE c.school_id=$1`;
  const overdue = (c) => c.status === 'awaiting_collection' && c.due_at && new Date(c.due_at).getTime() < Date.now();
  const holdOver = (c) => c.status === 'unclaimed' && days(c.created_at) >= HOLD_DAYS;
  async function pendingDisposals(sid) {
    return (await pool.query("SELECT r.case_id,r.note,r.created_at,a.name AS requested_by,c.title,c.status FROM case_reviews r JOIN cases c ON c.id=r.case_id JOIN users a ON a.id=r.actor_id WHERE r.school_id=$1 AND r.kind='disposal_request' AND c.status IN ('awaiting_collection','unclaimed') AND NOT EXISTS(SELECT 1 FROM case_reviews x WHERE x.case_id=r.case_id AND x.kind='disposal_approved' AND x.created_at>r.created_at) ORDER BY r.created_at", [sid])).rows;
  }

  // ---- Home: what needs a decision, and how the school is doing ----
  app.get('/api/school/desk/home', async (req) => {
    const u = await desk(req), sid = u.school_id, isManager = u.role === 'manager';
    const school = (await pool.query('SELECT id,name,collection_days,lifecycle FROM schools WHERE id=$1', [sid])).rows[0];
    const cases = (await pool.query(CASES + " AND (c.status NOT IN ('returned','closed') OR c.created_at>now()-interval '90 days') ORDER BY c.created_at DESC LIMIT 2000", [sid])).rows;
    const open = cases.filter((c) => !['returned', 'closed'].includes(c.status));
    const recent = cases.filter((c) => days(c.created_at) <= 90), returned = recent.filter((c) => c.status === 'returned');
    const bars = Array.from({ length: 7 }, (_, i) => { const d = new Date(Date.now() + 3 * 3600000 - (6 - i) * DAY), key = d.toISOString().slice(0, 10), same = (x) => x && new Date(new Date(x).getTime() + 3 * 3600000).toISOString().slice(0, 10) === key; return { day: key, label: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()], found: cases.filter((c) => same(c.created_at)).length, returned: cases.filter((c) => same(c.collected_at)).length }; });
    const claims = (await pool.query("SELECT count(*)::int n FROM claims cl JOIN cases c ON c.id=cl.case_id WHERE c.school_id=$1 AND cl.status='submitted' AND c.status='unclaimed'", [sid])).rows[0].n;
    const disposals = await pendingDisposals(sid);
    const counts = {
      lost: open.filter((c) => c.status === 'reported_lost').length, onWay: open.filter((c) => c.status === 'awaiting_deposit').length,
      inBox: open.filter((c) => c.status === 'awaiting_collection').length, overdue: open.filter(overdue).length,
      unclaimed: open.filter((c) => c.status === 'unclaimed').length, holdOver: open.filter(holdOver).length, claims, disposals: disposals.length,
      returned30: cases.filter((c) => c.status === 'returned' && c.collected_at && days(c.collected_at) <= 30).length,
    };
    const attention = [];
    const push = (title, page, tone, record) => attention.push({ title, page, tone, record });
    if (counts.onWay) push(`${counts.onWay} found item${counts.onWay === 1 ? '' : 's'} to receive into a box`, 'board', 'warn');
    for (const c of open.filter(overdue).slice(0, 4)) push(`${c.title} is past its collection date`, 'board', 'bad', c.id);
    if (claims) push(`${claims} claim${claims === 1 ? '' : 's'} on unclaimed items to review`, 'approvals', 'warn');
    if (counts.holdOver) push(`${counts.holdOver} unclaimed item${counts.holdOver === 1 ? ' has' : 's have'} waited over ${HOLD_DAYS} days`, 'board', 'warn');
    const out = { me: { id: u.id, name: u.name, role: u.role }, school, counts, bars, attention, holdDays: HOLD_DAYS,
      returnRate: { total: recent.length, returned: returned.length, pct: recent.length ? Math.round((returned.length / recent.length) * 100) : null },
      avgDays: returned.filter((c) => c.collected_at).length ? Math.round((returned.filter((c) => c.collected_at).reduce((n, c) => n + days(c.created_at, c.collected_at), 0) / returned.filter((c) => c.collected_at).length) * 10) / 10 : null,
      boxes: (await pool.query('SELECT id,name,directions,opening_hours FROM boxes WHERE school_id=$1 AND active=true ORDER BY name', [sid])).rows };
    if (isManager) {
      const requests = (await pool.query("SELECT count(*)::int n FROM child_requests WHERE school_id=$1 AND status='pending'", [sid])).rows[0].n;
      if (requests) attention.unshift({ title: `${requests} parent${requests === 1 ? '' : 's'} waiting for you to approve their child`, page: 'approvals', tone: 'warn' });
      for (const d of disposals.slice(0, 3)) push(`${d.requested_by} asked to donate: ${d.title}`, 'approvals', 'warn', d.case_id);
      const stats = await schoolStats(pool, sid);
      if (!stats.boxes) attention.unshift({ title: 'Add a collection box so found items have somewhere to go', page: 'boxes', tone: 'bad' });
      if (stats.students && stats.linked / stats.students < 0.5) push(`Only ${stats.linked} of ${stats.students} students are linked to a parent`, 'families', 'warn');
      out.counts.requests = requests;
      out.stats = { students: stats.students, linked: stats.linked, families: stats.families, items: stats.items, staff: stats.staff, health: stats.health };
      out.houses = await standings(pool, sid);
      out.team = (await pool.query("SELECT x.id,x.name,m.role,(SELECT max(last_seen_at) FROM sessions s WHERE s.user_id=x.id) AS last_seen,(SELECT count(*)::int FROM events e JOIN cases c ON c.id=e.case_id WHERE e.actor_id=x.id AND c.school_id=$1 AND e.created_at>now()-interval '30 days' AND e.action IN ('received','collected','found_unclaimed')) AS handled FROM memberships m JOIN users x ON x.id=m.user_id WHERE m.school_id=$1 AND m.role IN ('manager','staff') AND x.disabled_at IS NULL ORDER BY m.role,x.name LIMIT 60", [sid])).rows;
    }
    out.badges = { board: counts.onWay + counts.overdue, approvals: (out.counts.requests || 0) + claims + (isManager ? disposals.length : 0) };
    return out;
  });

  // ---- The lost-and-found board ----
  app.get('/api/school/desk/board', async (req) => {
    const u = await desk(req);
    const { q = '', filter = '', sort = 'recent' } = z.object({ q: z.string().max(100).optional(), filter: z.string().max(30).optional(), sort: z.string().max(20).optional() }).parse(req.query);
    const rows = (await pool.query(CASES + " AND (c.status NOT IN ('returned','closed') OR c.collected_at>now()-interval '14 days' OR c.created_at>now()-interval '14 days') ORDER BY c.created_at DESC LIMIT 600", [u.school_id])).rows
      .filter((c) => (!q || [c.title, c.child, c.class_name, c.box, c.category].join(' ').toLowerCase().includes(q.toLowerCase())) && (!filter || c.category === filter || (filter === 'overdue' && (overdue(c) || holdOver(c)))));
    rows.sort((a, b) => sort === 'oldest' ? new Date(a.created_at) - new Date(b.created_at) : sort === 'due' ? new Date(a.due_at || 8e15) - new Date(b.due_at || 8e15) : sort === 'name' ? a.title.localeCompare(b.title) : new Date(b.created_at) - new Date(a.created_at));
    const short = (d) => new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' });
    const card = (c) => ({
      id: c.id, status: c.status, title: c.title, category: c.category, hasPhoto: c.has_photo,
      line: [c.child ? `${c.child}${c.class_name ? ' · ' + c.class_name : ''}` : 'Owner not known', c.box].filter(Boolean).join(' · '),
      chip: c.status === 'awaiting_collection' && c.due_at ? { text: 'Collect by ' + short(c.due_at), tone: overdue(c) ? 'bad' : 'plain' } : c.status === 'returned' && c.collected_at ? { text: 'Returned ' + short(c.collected_at), tone: 'good' } : { text: short(c.created_at), tone: holdOver(c) ? 'warn' : 'plain' },
      flags: [overdue(c) && { text: 'Past collection date', tone: 'bad' }, holdOver(c) && { text: `Held over ${HOLD_DAYS} days`, tone: 'warn' }, !c.item_id && c.status !== 'unclaimed' && { text: 'No QR', tone: 'plain' }].filter(Boolean),
    });
    const order = ['reported_lost', 'awaiting_deposit', 'awaiting_collection', 'unclaimed', 'returned'];
    return { columns: order.map((s) => ({ id: s, title: STAGES[s], cards: rows.filter((c) => c.status === s).map(card) })) };
  });

  // ---- One item, with its full custody trail ----
  app.get('/api/school/desk/case/:id', async (req) => {
    const u = await desk(req);
    const c = (await pool.query(`SELECT c.*,b.name AS box,b.opening_hours,i.name AS item_name,i.color,st.name AS child,st.class_name,st.house,g.name AS guardian
      FROM cases c LEFT JOIN boxes b ON b.id=c.box_id LEFT JOIN items i ON i.id=c.item_id LEFT JOIN students st ON st.id=i.student_id LEFT JOIN users g ON g.id=COALESCE(st.guardian_id,i.owner_id) WHERE c.id=$1 AND c.school_id=$2`, [req.params.id, u.school_id])).rows[0];
    requireThat(c, 404, 'Item not found');
    const trail = [];
    for (const e of (await pool.query('SELECT e.action,e.note,e.created_at,a.name,a.role FROM events e LEFT JOIN users a ON a.id=e.actor_id WHERE e.case_id=$1 ORDER BY e.created_at', [c.id])).rows)
      trail.push({ at: e.created_at, text: EVENT[e.action] || e.action.replaceAll('_', ' '), note: e.note, who: e.name ? (e.role === 'student' ? e.name.split(' ')[0] + ' (student)' : e.name) : '' });
    const reviews = (await pool.query('SELECT r.kind,r.note,r.created_at,r.actor_id,a.name FROM case_reviews r JOIN users a ON a.id=r.actor_id WHERE r.case_id=$1 ORDER BY r.created_at', [c.id])).rows;
    for (const r of reviews) trail.push({ at: r.created_at, text: REVIEW[r.kind] || r.kind, note: r.note, who: r.name });
    trail.sort((a, b) => new Date(a.at) - new Date(b.at));
    const claims = (await pool.query("SELECT cl.id,cl.evidence,cl.status,p.name FROM claims cl JOIN users p ON p.id=cl.user_id WHERE cl.case_id=$1 ORDER BY cl.status DESC", [c.id])).rows;
    const lastRequest = [...reviews].reverse().find((r) => r.kind === 'disposal_request');
    const dispute = reviews.some((r, i) => r.kind === 'dispute' && !reviews.slice(i + 1).some((x) => x.kind === 'correction'));
    return {
      id: c.id, title: c.title, category: c.category, status: c.status, stage: STAGES[c.status], photo: c.photo, privateNote: c.private_note, box: c.box, boxId: c.box_id, hours: c.opening_hours,
      dueAt: c.due_at, createdAt: c.created_at, collectedAt: c.collected_at, tagged: !!c.item_id, color: c.color,
      owner: c.child ? { child: c.child, className: c.class_name, house: c.house, guardian: c.guardian } : null,
      overdue: !!overdue(c), holdOver: holdOver(c), holdDays: HOLD_DAYS, dispute, trail, claims,
      disposal: lastRequest ? { requestedBy: lastRequest.name, mine: lastRequest.actor_id === u.id, note: lastRequest.note } : null,
      can: { receive: ['reported_lost', 'awaiting_deposit'].includes(c.status), handBack: c.status === 'awaiting_collection', extend: c.status === 'awaiting_collection', requestDisposal: (overdue(c) || holdOver(c)) && !lastRequest, approveDisposal: u.role === 'manager' && !!lastRequest && lastRequest.actor_id !== u.id && (overdue(c) || holdOver(c)), reviewClaims: c.status === 'unclaimed' },
    };
  });

  // ---- Approvals in one place (principal) ----
  app.get('/api/school/desk/approvals', async (req) => {
    const u = await desk(req), sid = u.school_id;
    const claims = (await pool.query("SELECT cl.id,cl.evidence,cl.case_id,c.title,c.private_note,p.name FROM claims cl JOIN cases c ON c.id=cl.case_id JOIN users p ON p.id=cl.user_id WHERE c.school_id=$1 AND cl.status='submitted' AND c.status='unclaimed' ORDER BY c.created_at", [sid])).rows;
    return { claims, disposals: u.role === 'manager' ? await pendingDisposals(sid) : [] };
  });

  // ---- Term report (principal) ----
  app.get('/api/school/desk/report', async (req) => {
    const u = await desk(req, true), sid = u.school_id;
    const { days: span = '90' } = z.object({ days: z.enum(['30', '90', '365']).optional() }).parse(req.query);
    const rows = (await pool.query(CASES + " AND c.created_at>now()-($2||' days')::interval ORDER BY c.created_at", [sid, span])).rows;
    const group = (key, label = (v) => v) => { const m = new Map(); for (const c of rows) { const k = key(c) || 'Not known'; const g = m.get(k) || { name: label(k), found: 0, returned: 0 }; g.found++; if (c.status === 'returned') g.returned++; m.set(k, g); } return [...m.values()].sort((a, b) => b.found - a.found); };
    const back = rows.filter((c) => c.status === 'returned' && c.collected_at);
    const staff = (await pool.query("SELECT a.name,count(*) FILTER(WHERE e.action IN ('received','found_unclaimed'))::int received,count(*) FILTER(WHERE e.action='collected')::int handed FROM events e JOIN cases c ON c.id=e.case_id JOIN users a ON a.id=e.actor_id WHERE c.school_id=$1 AND e.created_at>now()-($2||' days')::interval AND e.action IN ('received','collected','found_unclaimed') GROUP BY a.name ORDER BY 2 DESC,3 DESC LIMIT 30", [sid, span])).rows;
    const finders = (await pool.query("SELECT house,count(*)::int stars FROM house_stars WHERE school_id=$1 AND created_at>now()-($2||' days')::interval GROUP BY house ORDER BY 2 DESC", [sid, span])).rows;
    return {
      days: Number(span), total: rows.length, returned: back.length, waiting: rows.filter((c) => c.status === 'awaiting_collection').length, unclaimed: rows.filter((c) => c.status === 'unclaimed').length, closed: rows.filter((c) => c.status === 'closed').length,
      returnRate: rows.length ? Math.round((back.length / rows.length) * 100) : null, avgDays: back.length ? Math.round((back.reduce((n, c) => n + days(c.created_at, c.collected_at), 0) / back.length) * 10) / 10 : null,
      byCategory: group((c) => c.category, (k) => k[0].toUpperCase() + k.slice(1)), byClass: group((c) => c.class_name), byHouse: group((c) => c.house, (k) => k[0].toUpperCase() + k.slice(1)), byBox: group((c) => c.box), staff, finders,
    };
  });
}
