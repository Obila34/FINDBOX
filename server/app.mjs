import {studentLoginRoutes} from './student-login.mjs';
import { schoolRoutes } from './schools.mjs';
import { notificationRoutes } from './operations.mjs';
import { companyEmailRoutes } from './company-email.mjs';
import { companyRoutes } from './company.mjs';
import { supportRoutes } from "./support.mjs";
import { accountRoutes } from "./account.mjs";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { z, ZodError } from "zod";
import {
  id,
  secret,
  hash,
  passwordHash,
  passwordMatches,
  publicUser,
  requireThat,
} from "./security.mjs";
import { transaction } from "./db.mjs";
import { paymentProvider, validSignature } from "./payments.mjs";
import { notify } from "./worker.mjs";
const text = (max = 160) => z.string().trim().min(1).max(max);
const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(12).max(128);
const categories = z.enum([
  "bottle",
  "book",
  "clothing",
  "lunchbox",
  "keys",
  "sports",
  "electronics",
  "other",
]);
const clean = (schema, input) => schema.parse(input);
const plusDays = (n) => new Date(Date.now() + n * 86400000);
const event = async (db, caseId, user, action, note = "") =>
  db.query(
    "INSERT INTO events(id,case_id,actor_id,action,note) VALUES($1,$2,$3,$4,$5)",
    [id(), caseId, user, action, note],
  );
export async function createApp({ pool, config = {}, payments, google, daraja, mailer } = {}) {
  const cfg = { origin: "http://localhost:5173", production: false, ...config };
  const app = Fastify({
    logger: cfg.production
      ? {
          serializers: {
            req: (r) => ({
              method: r.method,
              url: r.url?.split("?")[0],
              hostname: r.hostname,
            }),
          },
          redact: [
            "req.headers.cookie",
            "req.headers.authorization",
            "body.password",
            "body.activationSecret",
          ],
        }
      : false,
    bodyLimit: 32768,
    trustProxy: cfg.production && cfg.trustedProxy ? cfg.trustedProxy : false,
  });
  const pay = payments || paymentProvider(cfg);
  await app.register(cookie);
  await app.register(helmet);
  await app.register(rateLimit, { max: 150, timeWindow: "1 minute" });
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, done) => {
      req.rawBody = body;
      try {
        done(null, JSON.parse(body));
      } catch {
        done(Object.assign(new Error("Invalid JSON"), { statusCode: 400 }));
      }
    },
  );
  app.addHook("onRequest", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    if (
      req.url.startsWith("/api/auth/") || req.url.startsWith("/api/company/auth/") ||
      req.url.startsWith("/api/account/mfa/")
    ) {
      const key = hash(
        "auth:" + req.ip + ":" + Math.floor(Date.now() / 900000),
      );
      const bucket = (
        await pool.query(
          "INSERT INTO throttle_buckets(key,hits,expires_at) VALUES($1,1,$2) ON CONFLICT(key) DO UPDATE SET hits=throttle_buckets.hits+1 RETURNING hits",
          [key, new Date(Date.now() + 900000)],
        )
      ).rows[0];
      requireThat(
        bucket.hits <= 80,
        429,
        "Too many sign-in requests. Please wait and try again.",
      );
    }
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      !["/api/payments/webhook", "/api/payments/daraja/callback"].includes(req.url.split("?")[0])
    ) {
      requireThat(
        req.headers["x-findbox-request"] === "1",
        403,
        "Request verification failed",
      );
      if (req.headers.origin)
        requireThat(
          req.headers.origin === cfg.origin,
          403,
          "Origin is not allowed",
        );
    }
  });
  app.setErrorHandler((err, req, reply) => {
    const status =
      err instanceof ZodError
        ? 400
        : err.code === "23505"
          ? 409
          : err.statusCode || 500;
    if (status >= 500) {
      req.log.error({ err }, "Request failed");
      if (process.env.FINDBOX_TEST_DEBUG === "1") console.error(err);
    }
    reply.code(status).send({
      error:
        err instanceof ZodError
          ? "Please check the fields and try again."
          : err.code === "23505"
            ? "This record already exists."
            : status >= 500
              ? "The service is temporarily unavailable. Please retry."
              : err.message,
    });
  });
  async function user(req, allowLimited = false) {
    const token = req.cookies.findbox_session;
    requireThat(token, 401, "Please sign in");
    const result = await pool.query(
      "SELECT u.*,(SELECT role FROM company_access WHERE user_id=u.id) AS company_role,s.school_id AS school_id,COALESCE(m.role,CASE WHEN u.role='student' THEN 'student' ELSE 'parent' END) AS role,s.created_at AS session_created_at,s.mfa_verified AS session_mfa_verified,s.company_email_verified AS session_company_email_verified FROM users u JOIN sessions s ON u.id=s.user_id LEFT JOIN memberships m ON m.user_id=u.id AND m.school_id=s.school_id WHERE u.disabled_at IS NULL AND s.token_hash=$1 AND s.expires_at>$2 AND (s.school_id IS NULL OR m.user_id IS NOT NULL)",
      [hash(token), new Date()],
    );
    requireThat(
      result.rows[0],
      401,
      "Your session has expired. Please sign in.",
    );
    const u = result.rows[0];
    if(u.school_id&&!/^\/api\/(auth|account|support)\//.test(req.url)) requireThat((await pool.query("SELECT 1 FROM schools WHERE id=$1 AND lifecycle IN ('active','pending')",[u.school_id])).rowCount,403,"School access is suspended or archived");
    requireThat(
      allowLimited || (cfg.companyEmailEnabled && u.company_role && u.session_company_email_verified) ||
        u.session_mfa_verified ||
        (!u.company_role && !u.mfa_secret &&
          !(cfg.production && ["staff", "manager"].includes(u.role))),
      403,
      "Complete two-factor authentication",
    );
    return u;
  }
  async function staff(req) {
    const u = await user(req);
    requireThat(
      ["staff", "manager"].includes(u.role) && u.school_id,
      403,
      "School staff access required",
    );
    return u;
  }
  async function verified(req) {
    const u = await user(req);
    requireThat(u.verified, 403, "Verify your email before continuing");
    return u;
  }
  async function session(reply, u, { mfaVerified = false } = {}) {
    const membership = u.school_id
      ? (
          await pool.query(
            "SELECT role FROM memberships WHERE user_id=$1 AND school_id=$2",
            [u.id, u.school_id],
          )
        ).rows[0]
      : null;
    if (u.school_id && !membership)
      u = {
        ...u,
        school_id: null,
        role: u.role === "student" ? "student" : "parent",
      };
    else if (membership) u = { ...u, role: membership.role };
    const grant = (await pool.query('SELECT role FROM company_access WHERE user_id=$1', [u.id])).rows[0];
    const limited =
      !mfaVerified &&
      (!!grant || !!u.mfa_secret ||
        (cfg.production && ["staff", "manager"].includes(u.role)));
    const token = secret();
    await pool.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at,school_id,mfa_verified) VALUES($1,$2,$3,$4,$5)",
      [
        hash(token),
        u.id,
        limited ? new Date(Date.now() + 600000) : plusDays(7),
        u.school_id,
        mfaVerified,
      ],
    );
    reply.setCookie("findbox_session", token, {
      path: "/",
      httpOnly: true,
      secure: cfg.production,
      sameSite: "lax",
      maxAge: limited ? 600 : 604800,
    });
    return {
      user: publicUser(u),
      requiresMfa: limited,
      mfaSetupRequired: limited && !u.mfa_secret,
    };
  }
  async function sendToken(db, u, purpose) {
    const token = secret();
    await db.query("DELETE FROM auth_tokens WHERE user_id=$1 AND purpose=$2", [
      u.id,
      purpose,
    ]);
    await db.query(
      "INSERT INTO auth_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,$3,$4)",
      [hash(token), u.id, purpose, new Date(Date.now() + 3600000)],
    );
    const link =
      cfg.origin +
      "/app/" +
      (purpose === "reset" ? "reset" : "verify") +
      "#token=" +
      token;
    await db.query(
      "INSERT INTO outbox(id,user_id,subject,body) VALUES($1,$2,$3,$4)",
      [
        id(),
        u.id,
        purpose === "reset"
          ? "Reset your FindBox password"
          : "Verify your FindBox email",
        `Open this link within one hour: ${link}\nIf you did not request this, ignore this email.`,
      ],
    );
  }
  async function getCase(db, caseId, u) {
    const { rows } = await db.query(
      "SELECT * FROM cases WHERE id=$1 AND school_id=$2 FOR UPDATE",
      [caseId, u.school_id],
    );
    requireThat(rows[0], 404, "Case not found");
    return rows[0];
  }
  await studentLoginRoutes(app,{pool,user});
  await schoolRoutes(app, { pool, cfg, user });
  await accountRoutes(app, { pool, cfg, user, session, google });
  await supportRoutes(app, { pool, cfg, user });
  await companyEmailRoutes(app,{pool,cfg,mailer});
  await companyRoutes(app, { pool, cfg, user, daraja });
  await notificationRoutes(app,{pool,user});
  app.get("/api/health", async () => {
    await pool.query("SELECT 1");
    return { status: "ok" };
  });
  app.get("/api/products", async () => ({
    products: (
      await pool.query(
        "SELECT id,name,description,price_minor,tag_count,format,image,available FROM products WHERE active=true AND id<>'finder-1' ORDER BY price_minor",
      )
    ).rows,
    checkoutEnabled: !!cfg.paystackKey,
    currency: "KES",
  }));
  app.post(
    "/api/auth/signup",
    { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
    async (req, reply) => {
      const data = clean(
        z.object({
          name: text(100),
          email,
          password,
          role: z.enum(["parent", "student"]),
          schoolCode: text(100),
        }),
        req.body,
      );
      requireThat(data.role !== "student",403,"Students must be added by their school administrator. Ask your school or guardian for access.");
      const school = (
        await pool.query("SELECT id FROM schools WHERE join_hash=$1 AND lifecycle='active'", [
          hash(data.schoolCode),
        ])
      ).rows[0];
      requireThat(
        school,
        400,
        "School code is not valid. Ask your school for its invitation code.",
      );
      const pw = await passwordHash(data.password);
      const u = await transaction(pool, async (db) => {
        const u = (
          await db.query(
            "INSERT INTO users(id,name,email,password_hash,role,school_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
            [id(), data.name, data.email, pw, data.role, school.id],
          )
        ).rows[0];
        await sendToken(db, u, "verify");
        return u;
      });
      reply.code(201);
      return session(reply, u);
    },
  );
  const dummyHash = await passwordHash(secret());
  app.post(
    "/api/auth/login",
    { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
    async (req, reply) => {
      const d = clean(
        z.object({ email, password: z.string().min(1).max(128) }),
        req.body,
      );
      const u = (
        await pool.query("SELECT * FROM users WHERE email=$1", [d.email])
      ).rows[0];
      const valid = await passwordMatches(
        d.password,
        u?.password_hash || dummyHash,
      );
      await pool.query('INSERT INTO audit_log(id,user_id,action) VALUES($1,$2,$3)', [id(), valid && u ? u.id : null, valid && u ? 'login_success' : 'login_failed']);
      requireThat(u && valid && !u.disabled_at, 401, "Email or password is incorrect");
      return session(reply, u);
    },
  );
  app.get("/api/auth/me", async (req) => ({
    user: publicUser(await user(req, true)),
    security: await (async () => {
      const u = await user(req, true);
      return {
        requiresMfa:
          !(cfg.companyEmailEnabled && u.company_role && u.session_company_email_verified) && !u.session_mfa_verified &&
          (!!u.company_role || !!u.mfa_secret ||
            (cfg.production && ["staff", "manager"].includes(u.role))),
        mfaSetupRequired:
          !(cfg.companyEmailEnabled && u.company_role) && !u.mfa_secret &&
          (!!u.company_role || (cfg.production && ["staff", "manager"].includes(u.role))),
      };
    })(),
  }));
  app.post("/api/auth/logout", async (req, reply) => {
    if (req.cookies.findbox_session)
      await pool.query("DELETE FROM sessions WHERE token_hash=$1", [
        hash(req.cookies.findbox_session),
      ]);
    reply.clearCookie("findbox_session", { path: "/" });
    return { ok: true };
  });
  app.post(
    "/api/auth/forgot",
    { config: { rateLimit: { max: 3, timeWindow: "15 minutes" } } },
    async (req) => {
      const d = clean(z.object({ email }), req.body);
      await transaction(pool, async (db) => {
        const u = (
          await db.query("SELECT * FROM users WHERE email=$1 FOR UPDATE", [
            d.email,
          ])
        ).rows[0];
        if (u) await sendToken(db, u, "reset");
      });
      return {
        message: "If the account exists, a reset link will be emailed.",
      };
    },
  );
  app.post(
    "/api/auth/resend",
    { config: { rateLimit: { max: 2, timeWindow: "15 minutes" } } },
    async (req) => {
      const u = await user(req);
      if (!u.verified)
        await transaction(pool, (db) => sendToken(db, u, "verify"));
      return { ok: true };
    },
  );
  app.post("/api/auth/reset", async (req) => {
    const d = clean(z.object({ token: text(200), password }), req.body);
    const pw = await passwordHash(d.password);
    await transaction(pool, async (db) => {
      const t = (
        await db.query(
          "DELETE FROM auth_tokens WHERE token_hash=$1 AND purpose='reset' AND expires_at>$2 RETURNING user_id",
          [hash(d.token), new Date()],
        )
      ).rows[0];
      requireThat(t, 400, "Link is invalid or has expired");
      await db.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
        pw,
        t.user_id,
      ]);
      await db.query("DELETE FROM sessions WHERE user_id=$1", [t.user_id]);
      await db.query("DELETE FROM company_email_challenges WHERE user_id=$1", [t.user_id]);
    });
    return { ok: true };
  });
  app.post("/api/auth/verify", async (req) => {
    const d = clean(z.object({ token: text(200) }), req.body);
    await transaction(pool, async (db) => {
      const t = (
        await db.query(
          "DELETE FROM auth_tokens WHERE token_hash=$1 AND purpose='verify' AND expires_at>$2 RETURNING user_id",
          [hash(d.token), new Date()],
        )
      ).rows[0];
      requireThat(t, 400, "Link is invalid or has expired");
      await db.query("UPDATE users SET verified=true WHERE id=$1", [t.user_id]);
    });
    return { ok: true };
  });
  app.get("/api/workspace", async (req) => {
    const u = await user(req);
    const isStaff = ["staff", "manager"].includes(u.role);
    const [
      items,
      cases,
      boxes,
      notifications,
      tags,
      orders,
      school,
      claims,
      checkins,
      children,
    ] = await Promise.all([
      pool.query(
        "SELECT i.*,t.code FROM items i JOIN tags t ON t.id=i.tag_id WHERE " +
          (isStaff
            ? "i.school_id=$1"
            : "(i.owner_id=$1 OR i.owner_id IN (SELECT id FROM users WHERE guardian_id=$1))") +
          " ORDER BY i.created_at DESC LIMIT 100",
        [isStaff ? u.school_id : u.id],
      ),
      pool.query(
        isStaff
          ? "SELECT c.*,b.name AS box_name FROM cases c LEFT JOIN boxes b ON b.id=c.box_id WHERE c.school_id=$1 ORDER BY c.created_at DESC LIMIT 100"
          : "SELECT c.*,b.name AS box_name FROM cases c LEFT JOIN boxes b ON b.id=c.box_id LEFT JOIN items i ON i.id=c.item_id WHERE i.owner_id=$1 OR i.owner_id IN (SELECT id FROM users WHERE guardian_id=$1) OR c.id IN (SELECT case_id FROM claims WHERE user_id=$1) ORDER BY c.created_at DESC LIMIT 100",
        [isStaff ? u.school_id : u.id],
      ),
      pool.query("SELECT * FROM boxes WHERE school_id=$1 AND active=true", [
        u.school_id,
      ]),
      pool.query(
        "SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",
        [u.id],
      ),
      pool.query(
        "SELECT t.id,t.code,t.status,t.format FROM tags t JOIN orders o ON o.id=t.order_id WHERE o.user_id=$1 AND o.status='fulfilled' AND t.status IN ('allocated','active')",
        [u.id],
      ),
      pool.query(
        "SELECT id,amount_minor,currency,status,lines,payment_method,created_at FROM orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",
        [u.id],
      ),
      pool.query("SELECT id,name,collection_days FROM schools WHERE id=$1", [
        u.school_id,
      ]),
      pool.query(
        isStaff
          ? "SELECT cl.* FROM claims cl JOIN cases c ON c.id=cl.case_id WHERE c.school_id=$1 LIMIT 100"
          : "SELECT * FROM claims WHERE user_id=$1 LIMIT 100",
        [isStaff ? u.school_id : u.id],
      ),
      pool.query(
        "SELECT day FROM checkins WHERE user_id=$1 ORDER BY day DESC LIMIT 365",
        [u.id],
      ),
      pool.query("SELECT id,name FROM users WHERE guardian_id=$1 LIMIT 100", [
        u.id,
      ]),
    ]);
    return {
      user: publicUser(u),
      school: school.rows[0],
      items: items.rows,
      cases: cases.rows.map((c) =>
        isStaff ? c : (({ private_note, ...rest }) => rest)(c),
      ),
      boxes: boxes.rows,
      notifications: notifications.rows,
      tags: tags.rows,
      orders: orders.rows,
      claims: claims.rows,
      checkins: checkins.rows,
      children: children.rows,
    };
  });
  app.post("/api/orders", async (req, reply) => {
    const u = await verified(req);
    requireThat(cfg.paystackKey || payments, 503, "Checkout is not open yet.");
    requireThat(u.school_id, 400, "Join a school first");
    requireThat(
      u.role !== "student",
      403,
      "Ask your parent or guardian to purchase tags",
    );
    const d = clean(
      z.object({
        requestKey: z.string().uuid(),
        paymentMethod: z.enum(["mpesa"]).default("mpesa"),
        lines: z
          .array(
            z.object({
              productId: text(80),
              quantity: z.number().int().min(1).max(10),
            }),
          )
          .min(1)
          .max(8),
      }),
      req.body,
    );
    requireThat(
      new Set(d.lines.map((x) => x.productId)).size === d.lines.length,
      400,
      "Duplicate products",
    );
    const order = await transaction(pool, async (db) => {
      await db.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [u.id]);
      const existing = (
        await db.query(
          "SELECT * FROM orders WHERE user_id=$1 AND request_key=$2",
          [u.id, d.requestKey],
        )
      ).rows[0];
      if (existing) {
        const expected = d.lines
          .map((l) => l.productId + ":" + l.quantity)
          .sort()
          .join("|");
        const actual = existing.lines
          .map((l) => l.productId + ":" + l.quantity)
          .sort()
          .join("|");
        requireThat(
          expected === actual && existing.payment_method === d.paymentMethod,
          409,
          "This checkout key belongs to a different cart",
        );
        return existing;
      }
      const lines = [];
      for (const line of [...d.lines].sort((a, b) =>
        a.productId.localeCompare(b.productId),
      )) {
        const p = (
          await db.query(
            "SELECT * FROM products WHERE id=$1 AND active=true FOR UPDATE",
            [line.productId],
          )
        ).rows[0];
        requireThat(p && p.available, 400, "Product unavailable");
        const stock = Number(
          (
            await db.query(
              "SELECT count(*) FROM tags WHERE product_id=$1 AND status='stock'",
              [p.id],
            )
          ).rows[0].count,
        );
        requireThat(
          stock >= p.tag_count * line.quantity,
          409,
          p.name + " is currently out of stock",
        );
        lines.push({
          productId: p.id,
          name: p.name,
          quantity: line.quantity,
          unitPrice: p.price_minor,
          tagCount: p.tag_count,
        });
      }
      const result = (
        await db.query(
          "INSERT INTO orders(id,user_id,request_key,amount_minor,lines,school_id,payment_reference,payment_method) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
          [
            id(),
            u.id,
            d.requestKey,
            lines.reduce((sum, x) => sum + x.unitPrice * x.quantity, 0),
            JSON.stringify(lines),
            u.school_id,
            "fb_" + secret().slice(0, 28),
            d.paymentMethod,
          ],
        )
      ).rows[0];
      for (const line of lines) {
        const reserved = [];
        const parts = line.productId === 'complete-41' ? [['sticker',12],['compact',6],['fabric',12],['wrap',6],['engraved',2],['nfc',3]] : [[null,line.tagCount]];
        for (const [format,count] of parts) {
          const rows=(await db.query("SELECT id FROM tags WHERE product_id=$1 AND status='stock' AND ($3::text IS NULL OR format=$3) ORDER BY created_at,id LIMIT $2 FOR UPDATE SKIP LOCKED",[line.productId,count*line.quantity,format])).rows;
          requireThat(rows.length===count*line.quantity,409,'This pack is currently out of stock');
          reserved.push(...rows);
        }
        requireThat(
          reserved.length === line.tagCount * line.quantity,
          409,
          "Stock changed. Please retry.",
        );
        for (const t of reserved)
          await db.query(
            "UPDATE tags SET status='reserved',order_id=$1 WHERE id=$2",
            [result.id, t.id],
          );
      }
      return result;
    });
    requireThat(
      order.status === "pending",
      409,
      "This order has already been processed",
    );
    if (order.payment_url) return { orderId: order.id, url: order.payment_url };
    const payment = await pay.initialize(order, u.email);
    requireThat(
      payment.authorization_url?.startsWith("https://checkout.paystack.com/"),
      502,
      "Invalid checkout response",
    );
    await pool.query("UPDATE orders SET payment_url=$1 WHERE id=$2", [
      payment.authorization_url,
      order.id,
    ]);
    reply.code(201);
    return { orderId: order.id, url: payment.authorization_url };
  });
  async function reconcile(reference) {
    const data = await pay.verify(reference);
    return transaction(pool, async (db) => {
      const order = (
        await db.query(
          "SELECT * FROM orders WHERE payment_reference=$1 FOR UPDATE",
          [reference],
        )
      ).rows[0];
      requireThat(order, 404, "Order not found");
      requireThat(
        data.status === "success" &&
          data.reference === reference &&
          data.currency === order.currency &&
          data.amount === order.amount_minor,
        409,
        "Payment is not confirmed for this order",
      );
      if (["pending", "expired"].includes(order.status)) {
        await db.query("UPDATE orders SET status='paid' WHERE id=$1", [
          order.id,
        ]);
        await notify(
          db,
          order.user_id,
          "Payment received. Your tags are being prepared for school collection.",
        );
      }
      return {
        status: ["pending", "expired"].includes(order.status)
          ? "paid"
          : order.status,
      };
    });
  }
  app.post("/api/orders/:id/verify", async (req) => {
    const u = await user(req);
    const order = (
      await pool.query(
        "SELECT payment_reference FROM orders WHERE id=$1 AND user_id=$2",
        [req.params.id, u.id],
      )
    ).rows[0];
    requireThat(order, 404, "Order not found");
    return reconcile(order.payment_reference);
  });
  app.post("/api/payments/webhook", async (req) => {
    requireThat(
      validSignature(
        req.rawBody,
        req.headers["x-paystack-signature"],
        cfg.paystackKey,
      ),
      401,
      "Invalid signature",
    );
    if (req.body.event === "charge.success") {
      const ref = clean(text(100), req.body.data?.reference);
      await reconcile(ref);
    }
    return { ok: true };
  });
  app.post("/api/tags/activate", async (req) => {
    const u = await verified(req);
    const d = clean(
      z.object({
        code: text(100),
        activationSecret: text(200),
        name: text(100),
        category: categories,
        childName: z.string().trim().max(100).default(""),
        color: z.string().trim().max(60).default(""),
        privateNote: z.string().trim().max(500).default(""),
        ownerId: z.string().max(100).default(""),
      }),
      req.body,
    );
    return transaction(pool, async (db) => {
      const tag = (
        await db.query(
          "SELECT t.*,o.user_id AS purchaser,g.owner_id AS demo_owner,g.school_id AS demo_school,g.expires_at AS demo_expires FROM tags t LEFT JOIN orders o ON o.id=t.order_id LEFT JOIN demo_tag_grants g ON g.tag_id=t.id WHERE t.code=$1 FOR UPDATE OF t",
          [d.code],
        )
      ).rows[0];
      requireThat(
        tag &&
          (tag.purchaser === u.id || (tag.demo_owner === u.id && tag.demo_school === u.school_id && new Date(tag.demo_expires).getTime() > Date.now())) &&
          tag.activation_hash === hash(d.activationSecret),
        400,
        "Tag or activation code is not valid for your account",
      );
      requireThat(
        tag.status === "allocated",
        409,
        "This tag is already activated or unavailable",
      );
      const ownerId = d.ownerId || u.id;
      if (ownerId !== u.id) {
        const child = (
          await db.query(
            "SELECT id FROM users WHERE id=$1 AND guardian_id=$2 AND school_id=$3",
            [ownerId, u.id, u.school_id],
          )
        ).rows[0];
        requireThat(child, 403, "This child is not linked to your account");
      }
      const itemId = id();
      await db.query(
        "UPDATE tags SET status='active',owner_id=$1 WHERE id=$2",
        [u.id, tag.id],
      );
      await db.query(
        "INSERT INTO items(id,tag_id,owner_id,school_id,name,category,child_name,color,private_note) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          itemId,
          tag.id,
          ownerId,
          u.school_id,
          d.name,
          d.category,
          d.childName,
          d.color,
          d.privateNote,
        ],
      );
      return { id: itemId };
    });
  });
  app.get("/api/tags/:code", async (req) => {
    const tag = (
      await pool.query(
        "SELECT t.code,s.name AS school_name,s.id AS school_id FROM tags t JOIN items i ON i.tag_id=t.id JOIN schools s ON s.id=i.school_id WHERE t.code=$1 AND t.status='active'",
        [req.params.code],
      )
    ).rows[0];
    requireThat(
      tag,
      404,
      "This tag is not active. If it is yours, sign in to activate it.",
    );
    const boxes = (
      await pool.query(
        "SELECT id,name,directions,opening_hours FROM boxes WHERE school_id=$1 AND active=true",
        [tag.school_id],
      )
    ).rows;
    return { code: tag.code, school: tag.school_name, boxes };
  });
  app.post("/api/items/:id/lost", async (req) => {
    const u = await verified(req);
    return transaction(pool, async (db) => {
      const item = (
        await db.query(
          "SELECT * FROM items WHERE id=$1 AND (owner_id=$2 OR owner_id IN (SELECT id FROM users WHERE guardian_id=$2)) FOR UPDATE",
          [req.params.id, u.id],
        )
      ).rows[0];
      requireThat(item, 404, "Item not found");
      const existing = (
        await db.query(
          "SELECT id FROM cases WHERE item_id=$1 AND status NOT IN ('returned','closed')",
          [item.id],
        )
      ).rows[0];
      requireThat(
        !existing,
        409,
        "This item already has an open recovery case",
      );
      const caseId = id();
      await db.query(
        "INSERT INTO cases(id,school_id,item_id,title,category,status) VALUES($1,$2,$3,$4,$5,'reported_lost')",
        [caseId, item.school_id, item.id, item.name, item.category],
      );
      await db.query("UPDATE items SET status='reported_lost' WHERE id=$1", [
        item.id,
      ]);
      await event(db, caseId, u.id, "reported_lost");
      return { id: caseId };
    });
  });
  app.post("/api/found", async (req) => {
    const u = await verified(req);
    const d = clean(z.object({ code: text(100), boxId: text(100) }), req.body);
    return transaction(pool, async (db) => {
      const item = (
        await db.query(
          "SELECT i.* FROM items i JOIN tags t ON t.id=i.tag_id WHERE t.code=$1 AND t.status='active' FOR UPDATE OF i",
          [d.code],
        )
      ).rows[0];
      requireThat(
        item && item.school_id === u.school_id,
        404,
        "Tag not found in your school",
      );
      const box = (
        await db.query(
          "SELECT * FROM boxes WHERE id=$1 AND school_id=$2 AND active=true",
          [d.boxId, u.school_id],
        )
      ).rows[0];
      requireThat(box, 400, "Box is not available");
      let c = (
        await db.query(
          "SELECT * FROM cases WHERE item_id=$1 AND status NOT IN ('returned','closed') FOR UPDATE",
          [item.id],
        )
      ).rows[0];
      requireThat(
        !c || c.status === "reported_lost",
        409,
        "This item already has a deposit or collection in progress",
      );
      if (c)
        await db.query(
          "UPDATE cases SET status='awaiting_deposit',box_id=$1 WHERE id=$2",
          [box.id, c.id],
        );
      else
        c = (
          await db.query(
            "INSERT INTO cases(id,school_id,item_id,box_id,title,category,status) VALUES($1,$2,$3,$4,$5,$6,'awaiting_deposit') RETURNING *",
            [id(), u.school_id, item.id, box.id, item.name, item.category],
          )
        ).rows[0];
      await event(
        db,
        c.id,
        u.id,
        "deposit_reported",
        "Staff confirmation required",
      );
      return {
        id: c.id,
        message:
          "Thank you. Hand the item to the box custodian. Staff will confirm receipt.",
      };
    });
  });
  app.post("/api/staff/unclaimed", async (req) => {
    const u = await staff(req);
    const d = clean(
      z.object({
        title: text(100),
        category: categories,
        boxId: text(100),
        privateNote: text(500),
      }),
      req.body,
    );
    return transaction(pool, async (db) => {
      const box = (
        await db.query(
          "SELECT id FROM boxes WHERE id=$1 AND school_id=$2 AND active=true",
          [d.boxId, u.school_id],
        )
      ).rows[0];
      requireThat(box, 400, "Invalid box");
      const caseId = id();
      await db.query(
        "INSERT INTO cases(id,school_id,box_id,title,category,private_note,status) VALUES($1,$2,$3,$4,$5,$6,'unclaimed')",
        [caseId, u.school_id, box.id, d.title, d.category, d.privateNote],
      );
      await event(db, caseId, u.id, "found_unclaimed");
      return { id: caseId };
    });
  });
  app.get("/api/gallery", async (req) => {
    const u = await user(req);
    return {
      cases: (
        await pool.query(
          "SELECT c.id,c.title,c.category,b.name AS box_name,c.created_at FROM cases c LEFT JOIN boxes b ON b.id=c.box_id WHERE c.school_id=$1 AND c.status='unclaimed' ORDER BY c.created_at DESC",
          [u.school_id],
        )
      ).rows,
    };
  });
  app.post("/api/cases/:id/claim", async (req) => {
    const u = await verified(req);
    const d = clean(z.object({ evidence: text(1000) }), req.body);
    const c = (
      await pool.query(
        "SELECT id FROM cases WHERE id=$1 AND school_id=$2 AND status='unclaimed'",
        [req.params.id, u.school_id],
      )
    ).rows[0];
    requireThat(c, 404, "Item is not available for claiming");
    await pool.query(
      "INSERT INTO claims(id,case_id,user_id,evidence) VALUES($1,$2,$3,$4)",
      [id(), c.id, u.id, d.evidence],
    );
    return { ok: true };
  });
  app.post("/api/staff/claims/:id", async (req) => {
    const u = await staff(req);
    const d = clean(
      z.object({ decision: z.enum(["approved", "rejected"]) }),
      req.body,
    );
    return transaction(pool, async (db) => {
      const claim = (
        await db.query(
          "SELECT cl.* FROM claims cl JOIN cases c ON c.id=cl.case_id WHERE cl.id=$1 AND c.school_id=$2 FOR UPDATE OF cl",
          [req.params.id, u.school_id],
        )
      ).rows[0];
      requireThat(
        claim && claim.status === "submitted",
        409,
        "Claim cannot be reviewed",
      );
      const c = await getCase(db, claim.case_id, u);
      requireThat(
        c.status === "unclaimed",
        409,
        "Case is no longer open for claims",
      );
      if (d.decision === "approved") {
        const days = (
          await db.query("SELECT collection_days FROM schools WHERE id=$1", [
            u.school_id,
          ])
        ).rows[0].collection_days;
        await db.query(
          "UPDATE cases SET status='awaiting_collection',due_at=$1 WHERE id=$2",
          [plusDays(days), c.id],
        );
        await db.query(
          "UPDATE claims SET status='rejected' WHERE case_id=$1 AND status='submitted' AND id<>$2",
          [c.id, claim.id],
        );
      }
      await db.query("UPDATE claims SET status=$1 WHERE id=$2", [
        d.decision,
        claim.id,
      ]);
      await event(db, c.id, u.id, "claim_" + d.decision);
      await notify(
        db,
        claim.user_id,
        "Your claim for " + c.title + " was " + d.decision + ".",
      );
      return { ok: true };
    });
  });
  app.post("/api/staff/cases/:id/receive", async (req) => {
    const u = await staff(req);
    const d = clean(z.object({ boxId: text(100) }), req.body);
    return transaction(pool, async (db) => {
      const c = await getCase(db, req.params.id, u);
      requireThat(
        ["reported_lost", "awaiting_deposit"].includes(c.status) && c.item_id,
        409,
        "Case cannot be received",
      );
      const box = (
        await db.query(
          "SELECT * FROM boxes WHERE id=$1 AND school_id=$2 AND active=true",
          [d.boxId, u.school_id],
        )
      ).rows[0];
      requireThat(box, 400, "Invalid box");
      const school = (
        await db.query("SELECT collection_days FROM schools WHERE id=$1", [
          u.school_id,
        ])
      ).rows[0];
      const due = plusDays(school.collection_days);
      await db.query(
        "UPDATE cases SET status='awaiting_collection',due_at=$1,box_id=$2 WHERE id=$3",
        [due, box.id, c.id],
      );
      await db.query(
        "UPDATE items SET status='awaiting_collection' WHERE id=$1",
        [c.item_id],
      );
      const item = (
        await db.query("SELECT owner_id FROM items WHERE id=$1", [c.item_id])
      ).rows[0];
      await event(db, c.id, u.id, "received", box.name);
      await notify(
        db,
        item.owner_id,
        `${c.title} is ready at ${box.name}. Collect by ${due.toISOString().slice(0, 10)}. Opening hours: ${box.opening_hours}.`,
      );
      return { ok: true };
    });
  });
  app.post("/api/staff/cases/:id/collect", async (req) => {
    const u = await staff(req);
    const d = clean(z.object({ verification: text(500) }), req.body);
    return transaction(pool, async (db) => {
      const c = await getCase(db, req.params.id, u);
    const unresolved=(await db.query("SELECT 1 FROM case_reviews d WHERE d.case_id=$1 AND d.kind='dispute' AND NOT EXISTS(SELECT 1 FROM case_reviews r WHERE r.case_id=d.case_id AND r.kind='correction' AND r.created_at>d.created_at)",[req.params.id])).rowCount;
    requireThat(!unresolved,409,'Resolve the ownership dispute before collection');

      requireThat(
        c.status === "awaiting_collection",
        409,
        "Case is not awaiting collection",
      );
      await db.query(
        "UPDATE cases SET status='returned',collected_at=now() WHERE id=$1",
        [c.id],
      );
      if (c.item_id)
        await db.query("UPDATE items SET status='with_owner' WHERE id=$1", [
          c.item_id,
        ]);
      await event(db, c.id, u.id, "collected", d.verification);
      return { ok: true };
    });
  });
  app.post("/api/staff/cases/:id/extend", async (req) => {
    const u = await staff(req);
    const d = clean(
      z.object({ days: z.number().int().min(1).max(30), reason: text(500) }),
      req.body,
    );
    return transaction(pool, async (db) => {
      const c = await getCase(db, req.params.id, u);
      requireThat(
        c.status === "awaiting_collection",
        409,
        "Case is not awaiting collection",
      );
      await db.query("UPDATE cases SET due_at=$1 WHERE id=$2", [
        new Date(
          Math.max(Date.now(), new Date(c.due_at).getTime()) +
            d.days * 86400000,
        ),
        c.id,
      ]);
      await db.query("DELETE FROM reminders WHERE case_id=$1", [c.id]);
      await event(db, c.id, u.id, "deadline_extended", d.reason);
      return { ok: true };
    });
  });
  app.post("/api/notifications/read", async (req) => {
    const u = await user(req);
    await pool.query(
      "UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL",
      [u.id],
    );
    return { ok: true };
  });

  app.post("/api/family/invite", async (req) => {
    const u = await verified(req);
    requireThat(u.role === "parent", 403, "Parent account required");
    const code = secret().slice(0, 20);
    await pool.query(
      "INSERT INTO family_invites(token_hash,parent_id,expires_at) VALUES($1,$2,$3)",
      [hash(code), u.id, plusDays(1)],
    );
    return { code };
  });
  app.post("/api/family/link", async (req) => {
    const u = await verified(req);
    requireThat(u.role === "student", 403, "Student account required");
    const d = clean(z.object({ code: text(100) }), req.body);
    await transaction(pool, async (db) => {
      const student = (
        await db.query("SELECT * FROM users WHERE id=$1 FOR UPDATE", [u.id])
      ).rows[0];
      requireThat(
        !student.guardian_id,
        409,
        "This account already has a linked parent",
      );
      const invite = (
        await db.query(
          "SELECT f.*,m.school_id FROM family_invites f JOIN memberships m ON m.user_id=f.parent_id AND m.school_id=$3 AND m.role='parent' WHERE f.token_hash=$1 AND f.expires_at>$2 FOR UPDATE OF f",
          [hash(d.code), new Date(),u.school_id],
        )
      ).rows[0];
      requireThat(
        invite && invite.school_id === u.school_id,
        400,
        "Invitation is invalid, expired or for another school",
      );
      await db.query("UPDATE users SET guardian_id=$1 WHERE id=$2", [
        invite.parent_id,
        u.id,
      ]);
      await db.query("DELETE FROM family_invites WHERE token_hash=$1", [
        hash(d.code),
      ]);
    });
    return { ok: true };
  });

  app.get("/api/streaks", async req => { const u=await user(req); return { days:(await pool.query("SELECT day FROM checkins WHERE user_id=$1 ORDER BY day",[u.id])).rows.map(r=>r.day), today:new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Nairobi",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()) }; });
  app.post("/api/streaks/check-in", async (req) => {
    const u = await verified(req);
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Nairobi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    await pool.query(
      "INSERT INTO checkins(user_id,day) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [u.id, day],
    );
    return { ok: true, day };
  });
  return app;
}
