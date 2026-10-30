import { sendMail, mailReady } from './mail.mjs';
import { invoicePdf } from './invoice-pdf.mjs';
import { id } from "./security.mjs";
import { transaction } from "./db.mjs";
export async function notify(db, userId, message) {
  const guardian = (
    await db.query("SELECT guardian_id FROM users WHERE id=$1", [userId])
  ).rows[0]?.guardian_id;
  for (const recipient of [...new Set([userId, guardian].filter(Boolean))]) {
    await db.query(
      "INSERT INTO notifications(id,user_id,message) VALUES($1,$2,$3)",
      [id(), recipient, message],
    );
    const account=(await db.query('SELECT email FROM users WHERE id=$1',[recipient])).rows[0];
    if(account?.email.endsWith('@students.findbox.invalid')) continue;
    await db.query(
      "INSERT INTO outbox(id,user_id,subject,body) VALUES($1,$2,$3,$4)",
      [id(), recipient, "FindBox update", message],
    );
  }
}
export async function tick(pool, config) {
  await transaction(pool, async (db) => {
    const stale = (
      await db.query(
        "SELECT id FROM orders WHERE status='pending' AND created_at<$1 FOR UPDATE SKIP LOCKED",
        [new Date(Date.now() - 30 * 60000)],
      )
    ).rows;
    for (const order of stale) {
      await db.query(
        "UPDATE tags SET status='stock',order_id=NULL WHERE order_id=$1 AND status='reserved'",
        [order.id],
      );
      await db.query("UPDATE orders SET status='expired' WHERE id=$1", [
        order.id,
      ]);
    }
  });
  // Unique reminder records make repeated and concurrent worker ticks harmless.
  await transaction(pool, async (db) => {
    const { rows } = await db.query(
      "SELECT c.*,COALESCE(i.owner_id,cl.user_id) AS owner_id FROM cases c LEFT JOIN items i ON i.id=c.item_id LEFT JOIN claims cl ON cl.case_id=c.id AND cl.status='approved' WHERE c.status='awaiting_collection' AND c.due_at < $1",
      [new Date(Date.now() + 86400000)],
    );
    for (const c of rows) {
      const phase = new Date(c.due_at) < new Date() ? "overdue" : "due-soon";
      const result = await db.query(
        "INSERT INTO reminders(case_id,phase) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING case_id",
        [c.id, phase],
      );
      if (result.rowCount)
        await notify(
          db,
          c.owner_id,
          `${c.title}: ${phase === "overdue" ? "the collection deadline has passed. Contact school staff; your item has not been disposed of." : "please collect within 24 hours during the box opening hours."}`,
        );
    }
  });
  await pool.query('DELETE FROM throttle_buckets WHERE expires_at<now()');
  await pool.query('DELETE FROM oauth_states WHERE expires_at<now()');
  await pool.query('DELETE FROM sessions WHERE expires_at<now()');
  await pool.query('DELETE FROM auth_tokens WHERE expires_at<now()');
  if (!mailReady(config)) return;
  const jobs = await transaction(pool, async (db) => {
    const { rows } = await db.query(
      "SELECT o.*,COALESCE(o.recipient_email,u.email) AS email FROM outbox o LEFT JOIN users u ON u.id=o.user_id WHERE o.sent_at IS NULL AND o.attempts<8 AND o.next_at<now() AND (o.locked_until IS NULL OR o.locked_until<now()) ORDER BY o.created_at LIMIT 20 FOR UPDATE OF o SKIP LOCKED",
    );
    for (const job of rows)
      await db.query(
        "UPDATE outbox SET locked_until=$1,attempts=attempts+1 WHERE id=$2",
        [new Date(Date.now() + 600000), job.id],
      );
    return rows;
  });
  for (const job of jobs) {
    try {
      const attachments=[];
      if(job.invoice_id){const inv=(await pool.query('SELECT * FROM invoices WHERE id=$1',[job.invoice_id])).rows[0];if(!inv || !['issued','proforma'].includes(inv.status))throw new Error('Invoice is not issued');attachments.push({filename:inv.number+'.pdf',content:await invoicePdf(inv)});}
      await sendMail(config,{to:job.email,subject:job.subject,text:job.body,key:job.id,attachments});
      await pool.query(
        "UPDATE outbox SET sent_at=now(),locked_until=NULL WHERE id=$1",
        [job.id],
      );
    } catch {
      await pool.query(
        "UPDATE outbox SET next_at=$1,locked_until=NULL WHERE id=$2",
        [
          new Date(Date.now() + Math.min(3600000, 60000 * 2 ** job.attempts)),
          job.id,
        ],
      );
    }
  }
  await pool.query("DELETE FROM sessions WHERE expires_at<now()");
  await pool.query("DELETE FROM auth_tokens WHERE expires_at<now()");
}
