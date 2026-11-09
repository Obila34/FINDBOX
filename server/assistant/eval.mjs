// Routing evaluation for the assistant: how often does it pick the right tool and details?
// Run inside the API container: node assistant/eval.mjs   (uses OLLAMA_URL and ASSISTANT_MODEL)
// Add --rules to measure rules alone, without the model.
import { plan } from './index.mjs'
import { toolsFor } from './tools.mjs'
import { structured } from './llm.mjs'

const cfg = { ollamaUrl: process.env.OLLAMA_URL || 'http://ollama:11434', assistantModel: process.env.ASSISTANT_MODEL || 'gemma4:e2b-it-qat' }
const rulesOnly = process.argv.includes('--rules')
const schools = ['Braside', 'Riverside Academy', 'Hillcrest Primary']
const C = (role, q, tool, args = {}) => ({ role, q, tool, args })
export const CASES = [
  // shared
  C('admin', 'How many users do we have?', 'platform_stats'), C('developer', 'how many accounts are there', 'platform_stats'),
  C('admin', 'number of schools and students?', 'platform_stats'), C('developer', 'Give me the totals', 'platform_stats'),
  C('admin', "What's our overview today?", 'overview'), C('admin', 'How much have we collected in sales?', 'overview'),
  C('developer', 'find the account for samallela86@gmail.com', 'find_users', { query: 'samallela86@gmail.com' }),
  C('admin', 'look up the user called Peter', 'find_users', { query: 'Peter' }), C('developer', 'list all users', 'find_users'),
  C('admin', 'which schools do we have', 'find_schools'), C('developer', 'show me all schools', 'find_schools'),
  C('admin', 'school reports please', 'school_reports'), C('developer', 'which school has recovered the most items', 'school_reports'),
  C('admin', 'show the audit history', 'audit_history'), C('developer', 'who changed the school code recently', 'audit_history'),
  // admin
  C('admin', 'show orders waiting to be fulfilled', 'find_orders'), C('admin', 'any new purchases?', 'find_orders'),
  C('admin', "What's in the support inbox?", 'support_inbox'), C('admin', 'any complaints from parents', 'support_inbox'),
  C('admin', 'show unpaid invoices', 'find_invoices'), C('admin', 'list our clients', 'find_clients'),
  C('admin', 'fulfil order 3f2a9c1d', 'fulfill_order', { order: '3f2a9c1d' }),
  C('admin', 'issue invoice INV-0042', 'invoice_action', { invoice: 'INV-0042', action: 'issue' }),
  C('admin', 'void invoice INV-0007', 'invoice_action', { invoice: 'INV-0007', action: 'void' }),
  C('admin', 'record a payment of KSh 2,199 on invoice INV-0042 reference QWE123ABC', 'record_payment', { invoice: 'INV-0042', kind: 'payment', amount_kes: 2199 }),
  C('admin', 'invite a client named Jane Wanjiru jane@example.com', 'invite_client', { email: 'jane@example.com' }),
  C('admin', 'post an announcement to everyone that the shop is closed on Friday', 'announce', { audience: 'all' }),
  C('admin', 'reply to ticket 9ab3c2d1 saying we have shipped it and resolve it', 'reply_support', { ticket: '9ab3c2d1', status: 'resolved' }),
  // developer
  C('developer', 'Is everything healthy?', 'system_health'), C('developer', 'is the site down?', 'system_health'),
  C('developer', 'Who is signed in right now?', 'who_is_signed_in'), C('developer', 'show active sessions', 'who_is_signed_in'),
  C('developer', 'Any failed emails?', 'email_queue'), C('developer', 'were the invite emails delivered', 'email_queue'),
  C('developer', 'search belongings for blue bottle', 'find_belongings'), C('developer', 'Show pending school admin invitations', 'school_access'),
  C('developer', 'any privacy requests?', 'privacy_requests'), C('developer', 'show the M-Pesa sandbox tests', 'payment_tests'),
  C('developer', 'disable peter@test.ke', 'disable_user', { email: 'peter@test.ke' }), C('developer', 'block the account obilasam3@gmail.com', 'disable_user', { email: 'obilasam3@gmail.com' }),
  C('developer', 'reactivate peter@test.ke', 'enable_user', { email: 'peter@test.ke' }), C('developer', 'sign samallela86@gmail.com out of every device', 'sign_out_user', { email: 'samallela86@gmail.com' }),
  C('developer', 'send a password reset to samallela86@gmail.com', 'send_password_reset', { email: 'samallela86@gmail.com' }),
  C('developer', 'create a new school called "Hillview Academy"', 'create_school', { name: 'Hillview Academy' }),
  C('developer', 'rotate the join code for Braside', 'rotate_school_code', { school: 'Braside' }),
  C('developer', 'suspend Riverside Academy', 'set_school_state', { school: 'Riverside Academy', lifecycle: 'suspended' }),
  C('developer', 'invite Mary Achieng mary@school.ke as admin of Braside', 'invite_school_admin', { school: 'Braside', email: 'mary@school.ke' }),
  C('developer', 'make grace@school.ke a teacher at Braside', 'add_membership', { email: 'grace@school.ke', school: 'Braside', role: 'staff' }),
  C('developer', 'set collection days at Braside to 14 days', 'update_school', { school: 'Braside', collection_days: 14 }),
  // no tool
  C('admin', 'hello', null), C('developer', 'thanks!', null),
]

const ask = rulesOnly ? async () => null : async (fn) => { try { return await fn() } catch (e) { console.error('model error:', e.message); return null } }
let ok = 0, toolOk = 0, total = 0, ms = 0
const fails = []
for (const c of CASES) {
  const tools = toolsFor(c.role), t0 = Date.now()
  let r
  try { r = await plan({ message: c.q, tools, schools, ask, cfg }) } catch (e) { r = { tool: null, args: {}, error: e.message } }
  const took = Date.now() - t0; ms += took; total++
  const got = r.tool?.name ?? null
  const toolRight = got === c.tool
  const argsRight = toolRight && Object.entries(c.args).every(([k, v]) => String(r.args?.[k] ?? '').toLowerCase() === String(v).toLowerCase())
  if (toolRight) toolOk++
  if (argsRight) ok++; else fails.push({ q: c.q, want: c.tool, got, args: r.args, missing: r.missing, error: r.error })
  console.log(`${argsRight ? 'PASS' : toolRight ? 'ARGS' : 'FAIL'}  ${String(took).padStart(6)}ms  ${c.role.padEnd(9)} ${c.q}  ->  ${got}`)
}
console.log(`\nTool right: ${toolOk}/${total} (${Math.round(100 * toolOk / total)}%)  ·  Tool and details right: ${ok}/${total} (${Math.round(100 * ok / total)}%)  ·  Average ${Math.round(ms / total)} ms per request  ·  ${rulesOnly ? 'rules only' : 'model ' + cfg.assistantModel}`)
if (fails.length) console.log('\nMisses:\n' + fails.map(f => `- "${f.q}": wanted ${f.want}, got ${f.got} ${JSON.stringify(f.args || {})}${f.missing ? ' missing ' + f.missing.join(',') : ''}${f.error ? ' error ' + f.error : ''}`).join('\n'))
void structured
