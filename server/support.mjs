import { z } from "zod";
import { id, hash, secret, requireThat } from "./security.mjs";
import { transaction } from "./db.mjs";
export async function supportRoutes(app, { pool, cfg, user }) {
  const operators = cfg.supportAdminIds || [];
  const isOperator = (u) =>
    operators.includes(u.id) &&
    ["staff", "manager"].includes(u.role) &&
    u.verified;
  async function operator(req) {
    const u = await user(req);
    requireThat(isOperator(u), 403, "Support operator access required");
    return u;
  }
  const text = (n) => z.string().trim().min(1).max(n);
  app.get("/api/support/access", async (req) => {
    const u = await user(req);
    return { operator: isOperator(u) };
  });
  app.post("/api/support/tickets", async (req) => {
    const d = z
      .object({
        name: text(100),
        email: z.string().trim().toLowerCase().email().max(254),
        kind: z.enum([
          "general",
          "school",
          "order",
          "bug",
          "suggestion",
          "feedback",
        ]),
        subject: text(140),
        message: text(4000),
        context: z.string().max(120).default(""),
        website: z.string().max(100).default(""),
        requestKey: z.string().uuid(),
        referralCode: z
          .string()
          .regex(/^[a-f0-9]{24}$/)
          .optional(),
      })
      .parse(req.body);
    requireThat(!d.website, 400, "Unable to submit this request");
    const u = req.cookies.findbox_session ? await user(req) : null;
    const scope = u ? "user:" + u.id : "email:" + hash(d.email);
    const ticket = await transaction(pool, async (db) => {
      await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [scope]);
      const old = (
        await db.query(
          "SELECT id,status FROM support_tickets WHERE scope=$1 AND request_key=$2",
          [scope, d.requestKey],
        )
      ).rows[0];
      if (old) return old;
      const key = hash(
        "support:" + req.ip + ":" + Math.floor(Date.now() / 3600000),
      );
      const bucket = (
        await db.query(
          "INSERT INTO throttle_buckets(key,hits,expires_at) VALUES($1,1,$2) ON CONFLICT(key) DO UPDATE SET hits=throttle_buckets.hits+1 RETURNING hits",
          [key, new Date(Date.now() + 3600000)],
        )
      ).rows[0];
      requireThat(
        bucket.hits <= 5,
        429,
        "Too many requests. Please try again later.",
      );
      const code = d.referralCode
        ? (
            await db.query("SELECT code FROM referral_codes WHERE code=$1", [
              d.referralCode,
            ])
          ).rows[0]?.code
        : null;
      const ticketId = "FB-" + id();
      await db.query(
        "INSERT INTO support_tickets(id,user_id,name,email,kind,subject,message,context,scope,request_key,referral_code) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        [
          ticketId,
          u?.id || null,
          u?.name || d.name,
          u?.email || d.email,
          d.kind,
          d.subject,
          d.message,
          d.context,
          scope,
          d.requestKey,
          code || null,
        ],
      );
      await db.query('INSERT INTO outbox(id,user_id,recipient_email,subject,body) VALUES($1,NULL,$2,$3,$4)',[id(),'hello@findbox.africa',`[${d.kind}] ${ticketId}: ${d.subject}`,`From: ${u?.name || d.name} <${u?.email || d.email}>\nSchool: ${u?.school_id || 'Public inquiry'}\n\n${d.message}\n\nReply through the support inbox to retain the audit trail.`]);
      // Acknowledgements only go to verified accounts, preventing anonymous email bombing.
      if (u?.verified)
        await db.query(
          "INSERT INTO outbox(id,user_id,subject,body) VALUES($1,$2,$3,$4)",
          [
            id(),
            u.id,
            "We received your FindBox request",
            `Your request ${ticketId} has been received. View updates in Help & Support.`,
          ],
        );
      return { id: ticketId, status: "new" };
    });
    return ticket;
  });
  app.get("/api/support/tickets", async (req) => {
    const u = await user(req);
    return {
      tickets: (
        await pool.query(
          "SELECT id,kind,subject,message,context,status,created_at FROM support_tickets WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",
          [u.id],
        )
      ).rows,
    };
  });
  app.get("/api/support/tickets/:id", async (req) => {
    const u = await user(req);
    const t = (
      await pool.query(
        "SELECT * FROM support_tickets WHERE id=$1 AND (user_id=$2 OR $3)",
        [req.params.id, u.id, isOperator(u)],
      )
    ).rows[0];
    requireThat(t, 404, "Request not found");
    return {
      ticket: t,
      replies: (
        await pool.query(
          "SELECT id,message,created_at FROM support_replies WHERE ticket_id=$1 ORDER BY created_at",
          [t.id],
        )
      ).rows,
    };
  });
  app.get("/api/support/inbox", async (req) => {
    await operator(req);
    const status = z
      .enum(["new", "in_progress", "resolved"])
      .parse(req.query.status || "new");
    return {
      tickets: (
        await pool.query(
          "SELECT * FROM support_tickets WHERE status=$1 ORDER BY created_at LIMIT 100",
          [status],
        )
      ).rows,
      operators: (
        await pool.query("SELECT id,name FROM users WHERE id=ANY($1::text[])", [
          operators,
        ])
      ).rows,
    };
  });
  app.post("/api/support/tickets/:id/update", async (req) => {
    const u = await operator(req);
    const d = z
      .object({
        status: z.enum(["new", "in_progress", "resolved"]),
        assignedTo: z.string().nullable(),
        reply: z.string().trim().max(4000).default(""),
      })
      .parse(req.body);
    requireThat(
      d.assignedTo === null || operators.includes(d.assignedTo),
      400,
      "Select a support operator",
    );
    await transaction(pool, async (db) => {
      const t = (
        await db.query("SELECT * FROM support_tickets WHERE id=$1 FOR UPDATE", [
          req.params.id,
        ])
      ).rows[0];
      requireThat(t, 404, "Request not found");
      await db.query(
        "UPDATE support_tickets SET status=$2,assigned_to=$3,updated_at=now() WHERE id=$1",
        [t.id, d.status, d.assignedTo],
      );
      if (d.reply) {
        await db.query(
          "INSERT INTO support_replies(id,ticket_id,actor_id,message) VALUES($1,$2,$3,$4)",
          [id(), t.id, u.id, d.reply],
        );
        await db.query(
          "INSERT INTO outbox(id,user_id,recipient_email,subject,body) VALUES($1,$2,$3,$4,$5)",
          [id(), t.user_id, t.email, "FindBox support " + t.id, d.reply],
        );
      }
      await db.query(
        "INSERT INTO audit_log(id,user_id,action) VALUES($1,$2,$3)",
        [id(), u.id, "support:" + t.id + ":" + d.status],
      );
    });
    return { ok: true };
  });
  app.get("/api/referrals", async (req) => {
    const u = await user(req);
    requireThat(
      u.verified && u.role !== "student",
      403,
      "Verified adult account required",
    );
    await pool.query(
      "INSERT INTO referral_codes(user_id,code) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING",
      [u.id, hash(secret()).slice(0, 24)],
    );
    const row = (
      await pool.query("SELECT code FROM referral_codes WHERE user_id=$1", [
        u.id,
      ])
    ).rows[0];
    const count = (
      await pool.query(
        "SELECT count(*)::int AS count FROM support_tickets WHERE referral_code=$1 AND kind='school'",
        [row.code],
      )
    ).rows[0].count;
    return { code: row.code, schoolEnquiries: count };
  });
}
