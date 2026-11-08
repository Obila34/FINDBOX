import {transferRoutes} from './transfers.mjs';
import { safeguardsRoutes } from './safeguards.mjs';
import { schoolCompanyRoutes } from './schools.mjs';
import { mailReady } from './mail.mjs';
import { operationsRoutes } from './operations.mjs';
import { requireThat, id } from './security.mjs';
import { darajaRoutes, darajaConfigured } from './daraja.mjs';

// Company privileges are independent of school membership and never accepted at signup.
export async function companyRoutes(app, { pool, cfg, user, daraja }) {
  const started = Date.now();
  const metrics = { requests: 0, errors: 0, totalMs: 0 };
  app.addHook('onRequest', async req => { req.companyStarted = performance.now(); });
  app.addHook('onResponse', async (req, reply) => {
    metrics.requests++;
    if (Number.isFinite(req.companyStarted)) metrics.totalMs += performance.now() - req.companyStarted;
    if (reply.statusCode >= 500) metrics.errors++;
  });
  async function operator(req, roles = ['admin', 'developer']) {
    const u = await user(req, true);
    requireThat(!u.session_portal || u.session_portal === 'ops', 403, 'Sign in through the FindBox operations sign-in to use this workspace');
    const grant = (await pool.query('SELECT role FROM company_access WHERE user_id=$1', [u.id])).rows[0];
    requireThat(grant && roles.includes(grant.role), 403, 'Company access required');
    requireThat(u.verified, 403, 'Verify your email before continuing');
    requireThat(cfg.companyEmailEnabled ? u.session_company_email_verified : (u.mfa_secret && u.session_mfa_verified), 403, cfg.companyEmailEnabled ? 'Sign in with your email verification code at /company' : 'Company access requires two-factor authentication');
    requireThat(Date.now() - new Date(u.session_created_at).getTime() < 8 * 3600000, 401, 'Sign in again to continue');
    return { ...u, companyRole: grant.role };
  }
  app.get('/api/company/access', async req => {
    const u = await operator(req);
    return { role: u.companyRole, name: u.name };
  });
  app.get('/api/company/overview', async req => {
    const u = await operator(req);
    const accounts = (await pool.query("SELECT count(*)::int total, count(*) FILTER(WHERE created_at>now()-interval '24 hours')::int new_today, count(*) FILTER(WHERE verified)::int verified FROM users")).rows[0];
    const activity = (await pool.query("SELECT action,count(*)::int count FROM audit_log WHERE created_at>now()-interval '24 hours' AND action IN ('login_success','login_failed','mfa_verified','mfa_enabled') GROUP BY action")).rows;
    const daily = (await pool.query("SELECT to_char(date_trunc('day',created_at AT TIME ZONE 'Africa/Nairobi'),'YYYY-MM-DD') AS \"day\",count(*)::int count FROM users WHERE created_at>now()-interval '30 days' GROUP BY 1 ORDER BY 1")).rows;
    const result = { generatedAt: new Date().toISOString(), accounts, activity, daily };
    if (u.companyRole === 'admin') {
      result.sales = (await pool.query("SELECT count(*)::int orders,COALESCE(sum(amount_minor) FILTER(WHERE status IN ('paid','fulfilled')),0)::text collected_minor,count(*) FILTER(WHERE status='paid')::int awaiting_fulfillment,count(*) FILTER(WHERE status='refunded')::int refunded FROM orders")).rows[0];
      result.orderStatuses = (await pool.query('SELECT status,count(*)::int count FROM orders GROUP BY status ORDER BY status')).rows;
      result.orders = (await pool.query('SELECT id,status,amount_minor,currency,payment_method,created_at FROM orders ORDER BY created_at DESC,id DESC LIMIT 50')).rows;
      result.schools = (await pool.query('SELECT count(*)::int count FROM schools')).rows[0].count;
      result.stock = (await pool.query('SELECT status,count(*)::int count FROM tags GROUP BY status ORDER BY status')).rows;
      result.support = (await pool.query('SELECT status,count(*)::int count FROM support_tickets GROUP BY status')).rows;
      // No names, emails, child details, addresses or payment credentials in dashboard feeds.
      result.registrations = (await pool.query('SELECT id,role,verified,created_at FROM users ORDER BY created_at DESC,id DESC LIMIT 50')).rows;
    }
    await pool.query('INSERT INTO audit_log(id,user_id,action) VALUES($1,$2,$3)', [id(), u.id, 'company_overview_viewed']);
    return result;
  });
  app.get('/api/company/health', async req => {
    await operator(req, ['developer']);
    const begin = performance.now();
    await pool.query('SELECT 1');
    const databaseMs = Math.round(performance.now() - begin);
    const queue = (await pool.query("SELECT count(*) FILTER(WHERE sent_at IS NULL)::int pending,count(*) FILTER(WHERE sent_at IS NULL AND attempts>=8)::int failed FROM outbox")).rows[0];
    return {
      generatedAt: new Date().toISOString(), status: 'ok', databaseMs,
      uptimeSeconds: Math.floor((Date.now()-started)/1000),
      memoryMb: Math.round(process.memoryUsage().rss/1048576),
      requests: metrics.requests, serverErrors: metrics.errors,
      averageResponseMs: metrics.requests ? Math.round(metrics.totalMs/metrics.requests) : 0,
      queue,
      offsiteBackup:(await pool.query("SELECT last_ok FROM runtime_heartbeat WHERE name='offsite_backup'")).rows[0]||null,
      alerts:(await pool.query('SELECT name,state,notified_at FROM runtime_alerts ORDER BY name')).rows,
      worker: (await pool.query("SELECT last_ok,now()-last_ok AS age FROM runtime_heartbeat WHERE name='worker'")).rows[0]||null,
      integrations: { payments: !!cfg.paystackKey, darajaSandbox: darajaConfigured(cfg), email: mailReady(cfg), google: !!(cfg.googleClientId && cfg.googleClientSecret) },
      note: 'Process metrics reset on restart. Email acceptance does not prove inbox delivery. Off-site laptop backups require sign-in, network and SSH agent; off-site backup, failed-email and disk checks send state-change alerts to hello@findbox.africa. This is not a 24/7 independent uptime service.'
    };
  });
  await darajaRoutes(app,{pool,cfg,operator,daraja});
  await transferRoutes(app,{pool,user,operator});
  await safeguardsRoutes(app,{pool,cfg,user,operator});
  await schoolCompanyRoutes(app,{pool,cfg,operator});
  await operationsRoutes(app,{pool,cfg,operator});
}
