import { createHash } from "node:crypto";
import { z } from "zod";
import {
  hash,
  secret,
  id,
  requireThat,
  passwordHash,
  publicUser,
} from "./security.mjs";
import { transaction } from "./db.mjs";
import { googleProvider } from "./google.mjs";
import { seal, unseal, newMfaSecret, validStep } from "./mfa.mjs";
export async function accountRoutes(app, { pool, cfg, user, session, google }) {
  const audit = (db, uid, action) =>
    db.query("INSERT INTO audit_log(id,user_id,action) VALUES($1,$2,$3)", [
      id(),
      uid,
      action,
    ]);
  const provider = google || googleProvider(cfg);
  app.get("/api/auth/options", async () => ({
    google: !!(cfg.googleClientId && cfg.googleClientSecret),
    email: true,
    mode: "server",
  }));
  app.get("/api/auth/google/start", async (req, reply) => {
    requireThat(
      cfg.googleClientId && cfg.googleClientSecret,
      503,
      "Google sign-in is not configured",
    );
    const u = req.query.link === "1" ? await user(req) : null;
    if (u) requireThat(Date.now()-new Date(u.session_created_at).getTime()<600000,403,"Sign in again before linking an account");
    const state = secret(),
      browser = secret(),
      nonce = secret(),
      verifier = secret();
    await pool.query(
      "INSERT INTO oauth_states(token_hash,browser_hash,nonce,verifier,link_user_id,expires_at) VALUES($1,$2,$3,$4,$5,$6)",
      [
        hash(state),
        hash(browser),
        nonce,
        verifier,
        u?.id || null,
        new Date(Date.now() + 600000),
      ],
    );
    reply.setCookie("findbox_oauth", browser, {
      httpOnly: true,
      secure: cfg.production,
      sameSite: "lax",
      path: "/api/auth/google",
      maxAge: 600,
    });
    const query = new URLSearchParams({
      client_id: cfg.googleClientId,
      redirect_uri: cfg.origin + "/api/auth/google/callback",
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
      prompt: "select_account",
    });
    return reply.redirect(
      "https://accounts.google.com/o/oauth2/v2/auth?" + query,
    );
  });
  app.get("/api/auth/google/callback", async (req, reply) => {
    try {
      const d = z
        .object({
          state: z.string().min(20).max(200),
          code: z.string().min(1).max(4096),
        })
        .parse(req.query);
      requireThat(req.cookies.findbox_oauth, 400, "Google sign-in expired");
      const s = (
        await pool.query(
          "DELETE FROM oauth_states WHERE token_hash=$1 AND browser_hash=$2 AND expires_at>now() RETURNING *",
          [hash(d.state), hash(req.cookies.findbox_oauth)],
        )
      ).rows[0];
      requireThat(s, 400, "Google sign-in expired");
      const profile = await provider.exchange(d.code, s);
      const linked = s.link_user_id ? await user(req) : null;
      requireThat(
        !s.link_user_id || linked?.id === s.link_user_id,
        403,
        "Sign in before linking Google",
      );
      const u = await transaction(pool, async (db) => {
        await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          "google:" + profile.subject,
        ]);
        const identity = (
          await db.query(
            "SELECT u.* FROM users u JOIN identities i ON i.user_id=u.id WHERE i.provider='google' AND i.subject=$1",
            [profile.subject],
          )
        ).rows[0];
        if (identity) {
          requireThat(
            !linked || linked.id === identity.id,
            409,
            "This Google account is linked elsewhere",
          );
          return identity;
        }
        let account = (
          await db.query("SELECT * FROM users WHERE email=$1 FOR UPDATE", [
            profile.email,
          ])
        ).rows[0];
        if (account)
          requireThat(
            linked && linked.id === account.id,
            409,
            "Sign in with email first, then link Google from account security",
          );
        if (linked) {
          requireThat(
            linked.email === profile.email,
            409,
            "Use the Google account matching your email",
          );
          account = linked;
        }
        if (!account)
          account = (
            await db.query(
              "INSERT INTO users(id,name,email,password_hash,role,verified) VALUES($1,$2,$3,$4,'parent',true) RETURNING *",
              [id(), profile.name, profile.email, await passwordHash(secret())],
            )
          ).rows[0];
        await db.query(
          "INSERT INTO identities(provider,subject,user_id) VALUES('google',$1,$2)",
          [profile.subject, account.id],
        );
        await audit(db, account.id, "google_linked");
        return account;
      });
      await session(reply, u);
      reply.clearCookie("findbox_oauth", { path: "/api/auth/google" });
      return reply.redirect("/app/sign-in?google=complete");
    } catch {
      reply.clearCookie("findbox_oauth", { path: "/api/auth/google" });
      return reply.redirect("/app/sign-in?google=failed");
    }
  });
  app.get("/api/account/security", async (req) => {
    const u = await user(req, true);
    const sessions = (
      await pool.query(
        "SELECT created_at,expires_at,token_hash FROM sessions WHERE user_id=$1 AND expires_at>now() ORDER BY created_at DESC",
        [u.id],
      )
    ).rows;
    return {
      companyAccess: !!u.company_role,
      mfaEnabled: !!u.mfa_secret,
      mfaRequired:
        !!u.company_role || !!u.mfa_secret ||
        (["staff", "manager"].includes(u.role) && cfg.production),
      mfaVerified: u.session_mfa_verified,
      googleAvailable:!!(cfg.googleClientId&&cfg.googleClientSecret),
      googleLinked: !!(
        await pool.query(
          "SELECT 1 FROM identities WHERE provider='google' AND user_id=$1",
          [u.id],
        )
      ).rowCount,
      sessions: sessions.map((s) => ({
        createdAt: s.created_at,
        expiresAt: s.expires_at,
        current: s.token_hash === hash(req.cookies.findbox_session),
      })),
    };
  });
  app.post("/api/account/mfa/setup", async (req) => {
    const u = await user(req, true);
    requireThat(
      !u.mfa_secret,
      409,
      "Two-factor authentication is already enabled",
    );
    requireThat(Date.now()-new Date(u.session_created_at).getTime()<600000,403,"Sign in again before changing account security");
    const value = newMfaSecret();
    await pool.query("UPDATE users SET mfa_pending=$1 WHERE id=$2", [
      seal(value, cfg),
      u.id,
    ]);
    return {
      secret: value,
      uri:
        "otpauth://totp/" +
        encodeURIComponent("FindBox:" + u.email) +
        "?secret=" +
        value +
        "&issuer=FindBox&algorithm=SHA1&digits=6&period=30",
    };
  });
  app.post("/api/account/mfa/confirm", async (req, reply) => {
    const u = await user(req, true);
    const { code } = z.object({ code: z.string().length(6) }).parse(req.body);
    const result = await transaction(pool, async (db) => {
      const row = (
        await db.query("SELECT * FROM users WHERE id=$1 FOR UPDATE", [u.id])
      ).rows[0];
      requireThat(
        row.mfa_pending && !row.mfa_secret,
        409,
        "Start two-factor setup first",
      );
      const step = validStep(unseal(row.mfa_pending, cfg), code);
      requireThat(step >= 0, 400, "Authenticator code is invalid");
      await db.query(
        "UPDATE users SET mfa_secret=mfa_pending,mfa_pending=NULL,mfa_step=$1 WHERE id=$2",
        [step, u.id],
      );
      const codes = Array.from({ length: 8 }, () => secret().slice(0, 16));
      for (const code of codes)
        await db.query(
          "INSERT INTO recovery_codes(user_id,code_hash) VALUES($1,$2)",
          [u.id, hash(code)],
        );
      await db.query(
        "DELETE FROM sessions WHERE user_id=$1",
        [u.id],
      );
      await audit(db, u.id, "mfa_enabled");
      return { recoveryCodes: codes };
    });
    await session(reply,u,{mfaVerified:true});
    return result;
  });
  app.post("/api/account/mfa/challenge", async (req, reply) => {
    const u = await user(req, true);
    const { code } = z
      .object({ code: z.string().min(6).max(32) })
      .parse(req.body);
    await transaction(pool, async (db) => {
      const row = (
        await db.query("SELECT * FROM users WHERE id=$1 FOR UPDATE", [u.id])
      ).rows[0];
      requireThat(
        row.mfa_secret,
        403,
        "Set up two-factor authentication first",
      );
      const step = validStep(unseal(row.mfa_secret, cfg), code, row.mfa_step);
      const recovery =
        step < 0
          ? (
              await db.query(
                "DELETE FROM recovery_codes WHERE user_id=$1 AND code_hash=$2 RETURNING user_id",
                [u.id, hash(code)],
              )
            ).rowCount
          : 0;
      requireThat(
        step >= 0 || recovery,
        401,
        "Code is invalid or has already been used",
      );
      if (step >= 0)
        await db.query("UPDATE users SET mfa_step=$1 WHERE id=$2", [
          step,
          u.id,
        ]);
      await db.query("DELETE FROM sessions WHERE token_hash=$1", [
        hash(req.cookies.findbox_session),
      ]);
      await audit(db, u.id, "mfa_verified");
    });
    return session(reply, u, { mfaVerified: true });
  });
  app.post("/api/account/sessions/revoke", async (req) => {
    const u = await user(req);
    await pool.query(
      "DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2",
      [u.id, hash(req.cookies.findbox_session)],
    );
    await audit(pool, u.id, "other_sessions_revoked");
    return { ok: true };
  });
  app.get("/api/account/schools", async (req) => {
    const u = await user(req);
    return {
      schools: (
        await pool.query(
          "SELECT s.id,s.name,m.role FROM schools s JOIN memberships m ON m.school_id=s.id WHERE m.user_id=$1",
          [u.id],
        )
      ).rows,
      activeSchoolId: u.school_id,
    };
  });
  app.post("/api/account/schools/join", async (req) => {
    const u = await user(req);
    requireThat(u.verified, 403, "Verify your email first");
    const d = z
      .object({ schoolCode: z.string().min(1).max(100) })
      .parse(req.body);
    const school = (
      await pool.query("SELECT id FROM schools WHERE join_hash=$1 AND lifecycle='active'", [
        hash(d.schoolCode),
      ])
    ).rows[0];
    requireThat(school, 400, "School invitation is not valid");
    const role = u.role === "student" ? "student" : "parent";
    await pool.query(
      "INSERT INTO memberships(user_id,school_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [u.id, school.id, role],
    );
    await audit(pool, u.id, "school_joined");
    return { ok: true };
  });
  app.post("/api/account/schools/select", async (req, reply) => {
    const u = await user(req);
    const d = z
      .object({ schoolId: z.string().min(1).max(100) })
      .parse(req.body);
    const m = (
      await pool.query(
        "SELECT role FROM memberships WHERE user_id=$1 AND school_id=$2",
        [u.id, d.schoolId],
      )
    ).rows[0];
    requireThat(m, 403, "You do not belong to this school");
    await pool.query("DELETE FROM sessions WHERE token_hash=$1", [
      hash(req.cookies.findbox_session),
    ]);
    return session(
      reply,
      { ...u, school_id: d.schoolId, role: m.role },
      { mfaVerified: u.session_mfa_verified },
    );
  });

  app.get("/api/items", async (req) => {
    const u = await user(req);
    const d = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).default(30),
        cursor: z.string().max(500).optional(),
      })
      .parse(req.query);
    let cursor = null;
    if (d.cursor) {
      try {
        cursor = z
          .object({
            date: z.string().datetime(),
            id: z.string().min(1).max(100),
          })
          .parse(JSON.parse(Buffer.from(d.cursor, "base64url").toString()));
      } catch {
        requireThat(false, 400, "Invalid page cursor");
      }
    }
    const staff = ["staff", "manager"].includes(u.role);
    const rows = (
      await pool.query(
        "SELECT i.id,i.name,i.category,i.color,i.status,i.created_at,t.code FROM items i JOIN tags t ON t.id=i.tag_id WHERE " +
          (staff
            ? "i.school_id=$1"
            : "(i.owner_id=$1 OR i.owner_id IN(SELECT id FROM users WHERE guardian_id=$1))") +
          " AND ($2::timestamptz IS NULL OR (i.created_at,i.id)<($2::timestamptz,$3::text)) ORDER BY i.created_at DESC,i.id DESC LIMIT $4",
        [
          staff ? u.school_id : u.id,
          cursor?.date || null,
          cursor?.id || null,
          d.limit + 1,
        ],
      )
    ).rows;
    const hasMore = rows.length > d.limit;
    if (hasMore) rows.pop();
    const last = rows.at(-1);
    return {
      items: rows,
      nextCursor: hasMore
        ? Buffer.from(
            JSON.stringify({
              date: last.created_at.toISOString(),
              id: last.id,
            }),
          ).toString("base64url")
        : null,
    };
  });
  app.get("/api/account/export", async (req) => {
    const u = await user(req);
    const items = (
      await pool.query(
        "SELECT id,name,category,color,status,school_id FROM items WHERE owner_id=$1",
        [u.id],
      )
    ).rows;
    const orders = (
      await pool.query(
        "SELECT id,amount_minor,currency,status,lines,created_at FROM orders WHERE user_id=$1",
        [u.id],
      )
    ).rows;
    await audit(pool, u.id, "personal_data_exported");
    return {
      account: publicUser(u),
      studentRecords:(await pool.query('SELECT id,school_id,school_reference,name,class_name,status FROM students WHERE guardian_id=$1 AND guardian_verified_at IS NOT NULL OR user_id=$1',[u.id])).rows,
      items,
      orders,
      streaks: (await pool.query('SELECT day FROM checkins WHERE user_id=$1 ORDER BY day',[u.id])).rows,
      support: (await pool.query('SELECT id,kind,subject,message,context,status,created_at FROM support_tickets WHERE user_id=$1',[u.id])).rows,
      supportReplies: (await pool.query('SELECT r.ticket_id,r.message,r.created_at FROM support_replies r JOIN support_tickets t ON t.id=r.ticket_id WHERE t.user_id=$1',[u.id])).rows,
      referral: (await pool.query('SELECT code FROM referral_codes WHERE user_id=$1',[u.id])).rows,
      exportedAt: new Date().toISOString(),
    };
  });
  app.post("/api/account/privacy-request", async (req) => {
    const u = await user(req);
    const { kind } = z
      .object({ kind: z.enum(["deletion", "correction"]) })
      .parse(req.body);
    await pool.query(
      "INSERT INTO privacy_requests(id,user_id,kind) VALUES($1,$2,$3) ON CONFLICT(user_id,kind) WHERE status='pending' DO NOTHING",
      [id(), u.id, kind],
    );
    await audit(pool, u.id, "privacy_request_" + kind);
    return {
      status: "pending",
      message:
        "Request recorded for review. Financial and safeguarding retention requirements will be assessed before deletion.",
    };
  });
}
