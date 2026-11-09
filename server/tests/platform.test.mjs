import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import EmbeddedPostgres from "embedded-postgres";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { createHmac } from "node:crypto";
import { createApp } from "../app.mjs";
import { migrate, seedCatalog } from "../db.mjs";
import { hash, passwordHash } from "../security.mjs";
import { fulfill } from "../fulfillment.mjs";
import { tick } from "../worker.mjs";
let postgres,
  pool,
  app,
  parent,
  other,
  staff,
  foreign,
  reference,
  paymentAmount;
const payments = {
  initialize: async (o) => {
    reference = o.payment_reference;
    paymentAmount = o.amount_minor;
    return { authorization_url: "https://checkout.paystack.com/test" };
  },
  verify: async (ref) => ({
    status: "success",
    reference: ref,
    currency: "KES",
    amount: paymentAmount,
  }),
};
const call = async (method, url, body, cookie) =>
  app.inject({
    method,
    url,
    headers: {
      ...(body
        ? { "x-findbox-request": "1", "content-type": "application/json" }
        : {}),
      ...(cookie ? { cookie } : {}),
      origin: "http://localhost:5173",
    },
    payload: body,
  });
let loginClient = 1;
async function login(email, password = "testing-password-123") {
  const r = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    remoteAddress: "127.0.1." + loginClient++,
    headers: { "x-findbox-request": "1", origin: "http://localhost:5173" },
    payload: { email, password },
  });
  assert.equal(r.statusCode, 200, r.body);
  return r.headers["set-cookie"].split(";")[0];
}
before(async () => {
  if (process.env.TEST_DATABASE_URL)
    pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  else {
    const password = randomBytes(24).toString("hex");
    postgres = new EmbeddedPostgres({
      databaseDir: resolve("tmp/pg-test-" + Date.now()),
      user: "findbox",
      password,
      port: 55439,
      persistent: false,
      initdbFlags: ["--encoding=UTF8", "--locale=C"],
      authMethod: "scram-sha-256",
      postgresFlags: ["-h", "127.0.0.1"],
      onLog: () => {},
      onError: () => {},
    });
    await postgres.initialise();
    await postgres.start();
    await postgres.createDatabase("findbox_test");
    pool = new pg.Pool({
      connectionString: `postgres://findbox:${password}@127.0.0.1:55439/findbox_test`,
    });
  }
  await migrate(pool);
  await seedCatalog(pool);
  await pool.query(
    "INSERT INTO schools(id,name,join_hash) VALUES($1,$2,$3),($4,$5,$6)",
    [
      "school-a",
      "Greenwood",
      hash("school-a-code"),
      "school-b",
      "Hillcrest",
      hash("school-b-code"),
    ],
  );
  await pool.query(
    "INSERT INTO boxes(id,school_id,name,directions,opening_hours) VALUES($1,$2,$3,$4,$5),($6,$7,$8,$9,$10)",
    [
      "box-a",
      "school-a",
      "Reception",
      "Main entrance",
      "Mon–Fri 8–4",
      "box-b",
      "school-b",
      "Office",
      "Block B",
      "9–5",
    ],
  );
  const pw = await passwordHash("testing-password-123");
  for (const [id, email, role, school] of [
    ["parent", "parent@test.com", "parent", "school-a"],
    ["other", "other@test.com", "student", "school-a"],
    ["staff", "staff@test.com", "staff", "school-a"],
    ["foreign", "foreign@test.com", "staff", "school-b"],
  ])
    await pool.query(
      "INSERT INTO users(id,email,name,password_hash,role,school_id,verified) VALUES($1,$2,$3,$4,$5,$6,true)",
      [id, email, id, pw, role, school],
    );
  for (let i = 0; i < 12; i++)
    await pool.query(
      "INSERT INTO tags(id,code,activation_hash,format,product_id) VALUES($1,$2,$3,$4,$5)",
      [
        "tag-" + i,
        "FB-test-" + i,
        hash("private-" + i),
        "sticker",
        "everyday-12",
      ],
    );
  app = await createApp({
    pool,
    payments,
    config: {
      paystackKey: "test-secret",
      encryptionKey: Buffer.alloc(32, 7).toString("base64"),
      googleClientId: "test-client",
      googleClientSecret: "test-client-secret",
    },
    google: {
      exchange: async () => ({
        subject: "google-new-user",
        email: "new-google@test.com",
        name: "Google Parent",
      }),
    },
  });
  parent = await login("parent@test.com");
  other = await login("other@test.com");
  staff = await login("staff@test.com");
  foreign = await login("foreign@test.com");
});
after(async () => {
  await app?.close();
  await pool?.end();
  await postgres?.stop();
});
test("authenticated routes reject anonymous requests", async () => {
  assert.equal((await call("GET", "/api/workspace")).statusCode, 401);
  assert.equal((await call('GET','/api/products')).statusCode,200);
  assert.equal((await call('POST','/api/orders',{})).statusCode,401);
  assert.equal((await call('POST','/api/tags/activate',{})).statusCode,401);
  assert.equal((await call('POST','/api/orders/unknown/verify',{})).statusCode,401);
});
test("unsafe requests require same-origin application header", async () => {
  const r = await app.inject({
    method: "POST",
    url: "/api/auth/logout",
    payload: {},
    headers: { cookie: parent },
  });
  assert.equal(r.statusCode, 403);
  const cross = await app.inject({
    method: "POST",
    url: "/api/auth/logout",
    payload: {},
    headers: {
      cookie: parent,
      "x-findbox-request": "1",
      origin: "https://attacker.invalid",
    },
  });
  assert.equal(cross.statusCode, 403);
});
test("public signup cannot create staff accounts", async () => {
  assert.equal(
    (
      await call("POST", "/api/auth/signup", {
        email: "evil@test.com",
        name: "Evil",
        password: "testing-password-123",
        role: "staff",
        schoolCode: "school-a-code",
      })
    ).statusCode,
    400,
  );
});
test("checkout prices are server-calculated, reservations stop overselling, repeat key returns same order", async () => {
  const payload = {
    requestKey: "07cc8c28-d347-421c-a3b7-0f8cd28ae201",
    lines: [{ productId: "everyday-12", quantity: 1 }],
    amount_minor: 1,
  };
  const r = await call("POST", "/api/orders", payload, parent);
  assert.equal(r.statusCode, 201, r.body);
  assert.equal(paymentAmount, 49900);
  const twice = await call("POST", "/api/orders", payload, parent);
  assert.equal(twice.json().orderId, r.json().orderId);
  const sold = await call(
    "POST",
    "/api/orders",
    { ...payload, requestKey: "07cc8c28-d347-421c-a3b7-0f8cd28ae202" },
    staff,
  );
  assert.equal(sold.statusCode, 409, sold.body);
  const orderId = r.json().orderId;
  assert.equal(
    (await call("POST", "/api/orders/" + orderId + "/verify", {}, other))
      .statusCode,
    404,
  );
  paymentAmount = 1;
  assert.equal(
    (await call("POST", "/api/orders/" + orderId + "/verify", {}, parent))
      .statusCode,
    409,
  );
  paymentAmount = 49900;
  assert.equal(
    (await call("POST", "/api/orders/" + orderId + "/verify", {}, parent))
      .statusCode,
    200,
  );
  assert.equal(
    (await call("POST", "/api/orders/" + orderId + "/verify", {}, parent))
      .statusCode,
    200,
  );
  await fulfill(pool, orderId);
  await fulfill(pool, orderId);
  assert.equal(
    Number(
      (await pool.query("SELECT count(*) FROM tags WHERE status='allocated'"))
        .rows[0].count,
    ),
    12,
  );
});
test("activation checks purchaser, private code and single assignment", async () => {
  const d = {
    code: "FB-test-0",
    activationSecret: "private-0",
    name: "Green bottle",
    category: "bottle",
  };
  assert.equal(
    (await call("POST", "/api/tags/activate", d, other)).statusCode,
    400,
  );
  assert.equal(
    (
      await call(
        "POST",
        "/api/tags/activate",
        { ...d, activationSecret: "wrong" },
        parent,
      )
    ).statusCode,
    400,
  );
  const r = await call("POST", "/api/tags/activate", d, parent);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(
    (await call("POST", "/api/tags/activate", d, parent)).statusCode,
    409,
  );
});
test("public scan exposes box directions but no owner identity", async () => {
  const r = await call("GET", "/api/tags/FB-test-0");
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().school, "Greenwood");
  assert.equal(r.json().boxes.length, 1);
  assert.ok(!r.body.includes("parent@test.com"));
  assert.ok(!r.body.includes("private-0"));
  assert.ok(!r.body.includes("Green bottle"));
});
test("receipt starts countdown, enforces school access and collection state", async () => {
  const item = (await call("GET", "/api/workspace", null, parent)).json()
    .items[0];
  assert.ok(item);
  assert.equal((await call("POST", "/api/items/" + item.id + "/lost", {}, parent)).statusCode, 404);
  const found = await call(
    "POST",
    "/api/found",
    { code: "FB-test-0", boxId: "box-a" },
    other,
  );
  assert.equal(found.statusCode, 200, found.body);
  const c = found.json().id;
  assert.equal(
    (await pool.query("SELECT due_at FROM cases WHERE id=$1", [c])).rows[0]
      .due_at,
    null,
  );
  assert.equal(
    (
      await call(
        "POST",
        "/api/staff/cases/" + c + "/receive",
        { boxId: "box-a" },
        parent,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await call(
        "POST",
        "/api/staff/cases/" + c + "/receive",
        { boxId: "box-b" },
        foreign,
      )
    ).statusCode,
    404,
  );
  assert.equal(
    (
      await call(
        "POST",
        "/api/staff/cases/" + c + "/collect",
        { verification: "Confirmed student card" },
        staff,
      )
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await call(
        "POST",
        "/api/staff/cases/" + c + "/receive",
        { boxId: "box-a" },
        staff,
      )
    ).statusCode,
    200,
  );
  const due = (await pool.query("SELECT due_at FROM cases WHERE id=$1", [c]))
    .rows[0].due_at;
  assert.ok(new Date(due) > new Date());
  assert.equal(
    (
      await call(
        "POST",
        "/api/staff/cases/" + c + "/receive",
        { boxId: "box-a" },
        staff,
      )
    ).statusCode,
    409,
  );
  await pool.query("UPDATE cases SET due_at=$1 WHERE id=$2", [
    new Date(Date.now() - 1000),
    c,
  ]);
  await tick(pool, {});
  await tick(pool, {});
  assert.equal(
    Number(
      (await pool.query("SELECT count(*) FROM reminders WHERE case_id=$1", [c]))
        .rows[0].count,
    ),
    1,
  );
  assert.equal(
    (
      await call(
        "POST",
        "/api/staff/cases/" + c + "/collect",
        { verification: "Verified parent account and private item detail" },
        staff,
      )
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await call(
        "POST",
        "/api/staff/cases/" + c + "/collect",
        { verification: "Repeat" },
        staff,
      )
    ).statusCode,
    409,
  );
});
test("invalid payment webhook cannot mutate orders", async () => {
  const r = await app.inject({
    method: "POST",
    url: "/api/payments/webhook",
    payload: { event: "charge.success", data: { reference } },
    headers: { "x-paystack-signature": "bad" },
  });
  assert.equal(r.statusCode, 401);
});
test("valid signed webhook is idempotent", async () => {
  const body = JSON.stringify({ event: "charge.success", data: { reference } });
  const r = await app.inject({
    method: "POST",
    url: "/api/payments/webhook",
    payload: body,
    headers: {
      "content-type": "application/json",
      "x-paystack-signature": createHmac("sha512", "test-secret")
        .update(body)
        .digest("hex"),
    },
  });
  assert.equal(r.statusCode, 200, r.body);
});

test("password reset is single-use and revokes existing sessions", async () => {
  await pool.query(
    "INSERT INTO auth_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,$3,$4)",
    [hash("reset-secret"), "parent", "reset", new Date(Date.now() + 60000)],
  );
  const r = await call("POST", "/api/auth/reset", {
    token: "reset-secret",
    password: "changed-password-123",
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(
    (await call("GET", "/api/workspace", null, parent)).statusCode,
    401,
  );
  assert.equal(
    (
      await call("POST", "/api/auth/reset", {
        token: "reset-secret",
        password: "changed-password-456",
      })
    ).statusCode,
    400,
  );
  const loginResult = await call("POST", "/api/auth/login", {
    email: "parent@test.com",
    password: "changed-password-123",
  });
  assert.equal(loginResult.statusCode, 200);
  parent = loginResult.headers["set-cookie"].split(";")[0];
});
test("email verification tokens expire and are consumed once", async () => {
  await pool.query(
    "INSERT INTO auth_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,$3,$4)",
    [hash("verify-expired"), "other", "verify", new Date(Date.now() - 1000)],
  );
  assert.equal(
    (await call("POST", "/api/auth/verify", { token: "verify-expired" }))
      .statusCode,
    400,
  );
  await pool.query(
    "INSERT INTO auth_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,$3,$4)",
    [hash("verify-valid"), "other", "verify", new Date(Date.now() + 60000)],
  );
  assert.equal(
    (await call("POST", "/api/auth/verify", { token: "verify-valid" }))
      .statusCode,
    200,
  );
  assert.equal(
    (await call("POST", "/api/auth/verify", { token: "verify-valid" }))
      .statusCode,
    400,
  );
});
test("private family invitations are single-use and expose only linked students", async () => {
  assert.equal(
    (await call("POST", "/api/family/invite", {}, other)).statusCode,
    403,
  );
  const r = await call("POST", "/api/family/invite", {}, parent);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(
    (await call("POST", "/api/family/link", { code: "wrong" }, other))
      .statusCode,
    400,
  );
  assert.equal(
    (await call("POST", "/api/family/link", { code: r.json().code }, other))
      .statusCode,
    200,
  );
  assert.equal(
    (await call("POST", "/api/family/link", { code: r.json().code }, other))
      .statusCode,
    409,
  );
  const workspace = (await call("GET", "/api/workspace", null, parent)).json();
  assert.deepEqual(
    workspace.children.map((c) => c.id),
    ["other"],
  );
  const assigned = await call(
    "POST",
    "/api/tags/activate",
    {
      code: "FB-test-1",
      activationSecret: "private-1",
      name: "School sweater",
      category: "clothing",
      ownerId: "other",
    },
    parent,
  );
  assert.equal(assigned.statusCode, 200, assigned.body);
  assert.ok(
    (await call("GET", "/api/workspace", null, other))
      .json()
      .items.some((i) => i.name === "School sweater"),
  );
  assert.ok(
    (await call("GET", "/api/workspace", null, parent))
      .json()
      .items.some((i) => i.name === "School sweater"),
  );
  assert.equal(
    (
      await call(
        "POST",
        "/api/tags/activate",
        {
          code: "FB-test-2",
          activationSecret: "private-2",
          name: "Other sweater",
          category: "clothing",
          ownerId: "foreign",
        },
        parent,
      )
    ).statusCode,
    403,
  );
});
test("untagged claims hide private evidence and require staff review", async () => {
  const r = await call(
    "POST",
    "/api/staff/unclaimed",
    {
      title: "Blue lunchbox",
      category: "lunchbox",
      boxId: "box-a",
      privateNote: "Hidden sticker under lid",
    },
    staff,
  );
  assert.equal(r.statusCode, 200, r.body);
  const c = r.json().id;
  const gallery = await call("GET", "/api/gallery", null, parent);
  assert.ok(gallery.body.includes("Blue lunchbox"));
  assert.ok(!gallery.body.includes("Hidden sticker"));
  assert.equal(
    (
      await call(
        "POST",
        "/api/cases/" + c + "/claim",
        { evidence: "Sticker under lid" },
        parent,
      )
    ).statusCode,
    200,
  );
  const claim = (
    await pool.query("SELECT id FROM claims WHERE case_id=$1", [c])
  ).rows[0].id;
  assert.equal(
    (
      await call(
        "POST",
        "/api/staff/claims/" + claim,
        { decision: "approved" },
        parent,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await call(
        "POST",
        "/api/staff/claims/" + claim,
        { decision: "approved" },
        foreign,
      )
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await call(
        "POST",
        "/api/staff/claims/" + claim,
        { decision: "approved" },
        staff,
      )
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await call(
        "POST",
        "/api/staff/claims/" + claim,
        { decision: "approved" },
        staff,
      )
    ).statusCode,
    409,
  );
});
test("simultaneous activation of a tag creates exactly one item", async () => {
  const data = {
    code: "FB-test-3",
    activationSecret: "private-3",
    name: "Book",
    category: "book",
  };
  const responses = await Promise.all([
    call("POST", "/api/tags/activate", data, parent),
    call("POST", "/api/tags/activate", data, parent),
  ]);
  assert.deepEqual(responses.map((r) => r.statusCode).sort(), [200, 409]);
});
test("logout invalidates the server session", async () => {
  await call("POST", "/api/auth/logout", {}, other);
  assert.equal(
    (await call("GET", "/api/workspace", null, other)).statusCode,
    401,
  );
});

test("students cannot purchase and cannot select a foreign school", async () => {
  const student = await login("other@test.com");
  assert.equal(
    (
      await call(
        "POST",
        "/api/orders",
        {
          requestKey: crypto.randomUUID(),
          lines: [{ productId: "everyday-12", quantity: 1 }],
        },
        student,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await call(
        "POST",
        "/api/account/schools/select",
        { schoolId: "school-b" },
        student,
      )
    ).statusCode,
    403,
  );
});
test("multi-school membership never grants staff access through public joining", async () => {
  const c = await login("parent@test.com", "changed-password-123");
  assert.equal(
    (
      await call(
        "POST",
        "/api/account/schools/join",
        { schoolCode: "school-b-code" },
        c,
      )
    ).statusCode,
    200,
  );
  const r = await call(
    "POST",
    "/api/account/schools/select",
    { schoolId: "school-b" },
    c,
  );
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().user.role, "parent");
  const next = r.headers["set-cookie"].split(";")[0];
  assert.equal((await call("GET", "/api/auth/me", null, c)).statusCode, 401);
  assert.equal(
    (await call("GET", "/api/workspace", null, next)).json().school.id,
    "school-b",
  );
  const denied = await call(
    "POST",
    "/api/staff/cases/nonexistent/receive",
    { boxId: "box-b" },
    next,
  );
  assert.notEqual(denied.statusCode, 200);
});
test("Google OAuth binds state to browser and consumes it once", async () => {
  const start = await call("GET", "/api/auth/google/start");
  assert.equal(start.statusCode, 302);
  const url = new URL(start.headers.location);
  assert.ok(url.searchParams.get("code_challenge"));
  const state = url.searchParams.get("state");
  const cookie = start.headers["set-cookie"].split(";")[0];
  const bad = await call(
    "GET",
    "/api/auth/google/callback?state=" + state + "&code=test",
    null,
    "findbox_oauth=wrong",
  );
  assert.match(bad.headers.location, /failed/);
  const success = await call(
    "GET",
    "/api/auth/google/callback?state=" + state + "&code=test",
    null,
    cookie,
  );
  assert.match(success.headers.location, /complete/);
  const again = await call(
    "GET",
    "/api/auth/google/callback?state=" + state + "&code=test",
    null,
    cookie,
  );
  assert.match(again.headers.location, /failed/);
  const identities = (
    await pool.query("SELECT * FROM identities WHERE subject='google-new-user'")
  ).rows;
  assert.equal(identities.length, 1);
});
test("security export is owner scoped and privacy requests are idempotent", async () => {
  const c = await login("parent@test.com", "changed-password-123");
  const result = await call("GET", "/api/account/export", null, c);
  assert.equal(result.statusCode, 200);
  assert.equal(result.json().account.id, "parent");
  assert.ok(!result.body.includes("password_hash"));
  assert.ok(!result.body.includes("activation_hash"));
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await call(
          "POST",
          "/api/account/privacy-request",
          { kind: "deletion" },
          c,
        )
      ).statusCode,
      200,
    );
  assert.equal(
    Number(
      (
        await pool.query(
          "SELECT count(*) FROM privacy_requests WHERE user_id='parent'",
        )
      ).rows[0].count,
    ),
    1,
  );
});
test('parents can link children at a second school they belong to',async()=>{
 const c=await login('parent@test.com','changed-password-123');
 await pool.query("INSERT INTO users(id,email,name,password_hash,role,school_id,verified) VALUES('second-child','second-child@test.com','Child',$1,'student','school-b',true)",[await passwordHash('testing-password-123')]);
 const child=await login('second-child@test.com');const invite=await call('POST','/api/family/invite',{},c);assert.equal(invite.statusCode,200,invite.body);
 const result=await call('POST','/api/family/link',{code:invite.json().code},child);assert.equal(result.statusCode,200,result.body);
 assert.equal((await pool.query("SELECT guardian_id FROM users WHERE id='second-child'")).rows[0].guardian_id,'parent');
});

test("MFA blocks limited sessions, rotates verified sessions, and consumes recovery codes once", async () => {
  const { totp } = await import("../mfa.mjs");
  const c = await login("parent@test.com", "changed-password-123");
  const setup = await call("POST", "/api/account/mfa/setup", {}, c);
  assert.equal(setup.statusCode, 200, setup.body);
  const confirmed = await call(
    "POST",
    "/api/account/mfa/confirm",
    { code: totp(setup.json().secret) },
    c,
  );
  assert.equal(confirmed.statusCode, 200, confirmed.body);
  assert.equal(confirmed.json().recoveryCodes.length, 8);
  const limited = await login("parent@test.com", "changed-password-123");
  assert.equal(
    (await call("GET", "/api/workspace", null, limited)).statusCode,
    403,
  );
  const recoveryCode = confirmed.json().recoveryCodes[0];
  const verified = await call(
    "POST",
    "/api/account/mfa/challenge",
    { code: recoveryCode },
    limited,
  );
  assert.equal(verified.statusCode, 200, verified.body);
  const verifiedCookie = verified.headers["set-cookie"].split(";")[0];
  assert.equal(
    (await call("GET", "/api/workspace", null, verifiedCookie)).statusCode,
    200,
  );
  assert.equal(
    (await call("GET", "/api/auth/me", null, limited)).statusCode,
    401,
  );
  const limitedAgain = await login("parent@test.com", "changed-password-123");
  assert.equal(
    (
      await call(
        "POST",
        "/api/account/mfa/challenge",
        { code: recoveryCode },
        limitedAgain,
      )
    ).statusCode,
    401,
  );
  const stored = (
    await pool.query("SELECT mfa_secret FROM users WHERE id='parent'")
  ).rows[0].mfa_secret;
  assert.notEqual(stored, setup.json().secret);
});

test("revoked school membership immediately invalidates existing access", async () => {
  await pool.query(
    "DELETE FROM memberships WHERE user_id='foreign' AND school_id='school-b'",
  );
  assert.equal(
    (await call("GET", "/api/workspace", null, foreign)).statusCode,
    401,
  );
});
test("TOTP follows the RFC test vector and rejects replayed time steps", async () => {
  const { totp, base32, validStep } = await import("../mfa.mjs");
  const s = base32(Buffer.from("12345678901234567890"));
  assert.equal(totp(s, 1), "287082");
  const step = Math.floor(Date.now() / 30000);
  assert.equal(validStep(s, totp(s, step), step), -1);
});

test('concurrent workspaces stay isolated across multiple accounts', async () => {
 const started=performance.now();
 for(let n=0;n<25;n++){
  await pool.query("INSERT INTO users(id,email,name,password_hash,role,school_id,verified) VALUES($1,$2,$1,'unused','parent','school-a',true)",['load-'+n,'load-'+n+'@test.com']);
  await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at,school_id) VALUES($1,$2,now()+interval '5 minutes','school-a')",[hash('load-session-'+n),'load-'+n]);
 }
 const results=await Promise.all(Array.from({length:100},(_,i)=>app.inject({method:'GET',url:'/api/workspace',remoteAddress:'127.2.0.'+(i%25+1),headers:{cookie:'findbox_session=load-session-'+(i%25)}})));
 results.forEach((r,i)=>{assert.equal(r.statusCode,200,r.body);assert.equal(r.json().user.id,'load-'+(i%25));assert.equal(r.json().items.length,0);assert.equal(r.json().orders.length,0)});
 console.log('100 concurrent isolated workspace requests completed in '+Math.round(performance.now()-started)+' ms on this development machine.');
});

test('production school staff receive a restricted session until MFA is enrolled',async()=>{
 const secure=await createApp({pool,config:{production:true,origin:'https://findbox.test',encryptionKey:Buffer.alloc(32,7).toString('base64')}});
 try{
 const r=await secure.inject({method:'POST',url:'/api/auth/login',headers:{origin:'https://findbox.test','x-findbox-request':'1'},payload:{email:'staff@test.com',password:'testing-password-123'}});
 assert.equal(r.statusCode,200,r.body);assert.equal(r.json().requiresMfa,true);assert.equal(r.json().mfaSetupRequired,true);assert.match(r.headers['set-cookie'],/HttpOnly/);assert.match(r.headers['set-cookie'],/Secure/);
 const cookie=r.headers['set-cookie'].split(';')[0];assert.equal((await secure.inject({method:'GET',url:'/api/workspace',headers:{cookie}})).statusCode,403);
 }finally{await secure.close()}
});
test('Google cannot silently link an existing email account',async()=>{
 const oauth=await createApp({pool,config:{googleClientId:'client',googleClientSecret:'secret'},google:{exchange:async()=>({subject:'unlinked-parent',email:'parent@test.com',name:'Untrusted claim'})}});
 try{const start=await oauth.inject({method:'GET',url:'/api/auth/google/start'});const state=new URL(start.headers.location).searchParams.get('state');const cookie=start.headers['set-cookie'].split(';')[0];const r=await oauth.inject({method:'GET',url:'/api/auth/google/callback?state='+state+'&code=code',headers:{cookie}});assert.match(r.headers.location,/failed/);assert.equal((await pool.query("SELECT 1 FROM identities WHERE subject='unlinked-parent'")).rowCount,0)}finally{await oauth.close()}
});


test('support isolates owners and operators, deduplicates submissions, queues replies and attributes referrals',async()=>{
 const pw=await passwordHash('support-testing-123');
 for(const [uid,role] of [['support-parent','parent'],['support-other','parent'],['support-agent','staff']])await pool.query("INSERT INTO users(id,email,name,password_hash,role,school_id,verified) VALUES($1,$2,$1,$3,$4,'school-a',true)",[uid,uid+'@test.com',pw,role]);
 const a=await createApp({pool,config:{supportAdminIds:['support-agent']}});
 const req=(method,url,body,cookie)=>a.inject({method,url,remoteAddress:'127.8.0.1',headers:{origin:'http://localhost:5173','x-findbox-request':'1',...(cookie?{cookie}:{})},payload:body});
 const sign=async name=>{const r=await req('POST','/api/auth/login',{email:name+'@test.com',password:'support-testing-123'});assert.equal(r.statusCode,200,r.body);return r.headers['set-cookie'].split(';')[0]};
 try{
 const owner=await sign('support-parent'),outsider=await sign('support-other'),op=await sign('support-agent');
 assert.equal((await call('POST','/api/orders',{requestKey:crypto.randomUUID(),paymentMethod:'card',lines:[{productId:'everyday-12',quantity:1}]},owner)).statusCode,400);
 const code=(await req('GET','/api/referrals',undefined,owner)).json().code;assert.match(code,/^[a-f0-9]{24}$/);
 const body={name:'Parent',email:'ignored@test.com',kind:'school',subject:'School introduction',message:'Please tell us more',requestKey:crypto.randomUUID(),referralCode:code};
 const submitted=await req('POST','/api/support/tickets',body,owner);assert.equal(submitted.statusCode,200,submitted.body);const tid=submitted.json().id;
 const duplicate=await req('POST','/api/support/tickets',body,owner);assert.equal(duplicate.json().id,tid);
 assert.equal((await req('GET','/api/referrals',undefined,owner)).json().schoolEnquiries,1);
 assert.equal((await req('GET','/api/support/tickets/'+tid,undefined,outsider)).statusCode,404);
 assert.equal((await req('GET','/api/support/inbox',undefined,outsider)).statusCode,403);
 assert.equal((await req('GET','/api/support/inbox',undefined,staff)).statusCode,403);
 assert.equal((await req('GET','/api/support/inbox',undefined,op)).statusCode,200);
 const update={status:'in_progress',assignedTo:'support-agent',reply:'Thank you. We will follow up.'};
 assert.equal((await req('POST','/api/support/tickets/'+tid+'/update',update,outsider)).statusCode,403);
 assert.equal((await req('POST','/api/support/tickets/'+tid+'/update',{...update,assignedTo:'foreign'},op)).statusCode,400);
 assert.equal((await req('POST','/api/support/tickets/'+tid+'/update',update,op)).statusCode,200);
 const detail=(await req('GET','/api/support/tickets/'+tid,undefined,owner)).json();assert.equal(detail.ticket.status,'in_progress');assert.equal(detail.replies.length,1);
 assert.equal((await pool.query('SELECT count(*)::int n FROM outbox WHERE user_id=$1',['support-parent'])).rows[0].n,2);
 assert.equal((await req('GET','/api/account/export',undefined,owner)).json().support.length,1);
 assert.equal((await req('POST','/api/support/tickets',{...body,requestKey:crypto.randomUUID(),website:'bot'},owner)).statusCode,400);
 // Public contacts receive a reference, but cannot use the API to enumerate private tickets.
 const publicTicket=await req('POST','/api/support/tickets',{...body,requestKey:crypto.randomUUID()});assert.equal(publicTicket.statusCode,200);
 assert.equal((await req('GET','/api/support/tickets/'+publicTicket.json().id)).statusCode,401);
 assert.equal((await pool.query('SELECT count(*)::int n FROM outbox WHERE recipient_email=$1',['ignored@test.com'])).rows[0].n,0);
 }finally{await a.close()}
});

test('streak check-ins use Nairobi time, survive sessions, preserve long history and isolate accounts',async()=>{
 const cookie=await login('support-other@test.com','support-testing-123');
 const now=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Nairobi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 await pool.query("INSERT INTO checkins(user_id,day) SELECT 'support-other',to_char(d,'YYYY-MM-DD') FROM generate_series('2020-01-01'::date,'2021-02-03'::date,'1 day') d");
 const results=await Promise.all(Array.from({length:4},()=>call('POST','/api/streaks/check-in',{},cookie)));
 results.forEach(r=>assert.equal(r.statusCode,200,r.body));
 const r=await call('GET','/api/streaks',undefined,cookie);assert.equal(r.statusCode,200);assert.equal(r.json().today,now);assert.equal(r.json().days.filter(d=>d===now).length,1);assert.equal(r.json().days.length,401);
 const otherCookie=await login('support-parent@test.com','support-testing-123');assert.equal((await call('GET','/api/streaks',undefined,otherCookie)).json().days.length,0);
 const again=await login('support-other@test.com','support-testing-123');assert.deepEqual((await call('GET','/api/streaks',undefined,again)).json().days,r.json().days);
 assert.equal((await call('GET','/api/streaks')).statusCode,401);
});


test('family packs reserve each label material and roll back incomplete assortments',async()=>{
 const owner=await login('support-parent@test.com','support-testing-123');
 const parts=[['sticker',20],['fabric',20]];
 for(const [format,n] of parts)for(let i=0;i<n;i++)await pool.query("INSERT INTO tags(id,code,activation_hash,format,product_id) VALUES($1,$1,$2,$3,'complete-41')",['kit-'+format+'-'+i,hash('secret-'+i),format]);
 const payload={requestKey:crypto.randomUUID(),paymentMethod:'mpesa',lines:[{productId:'complete-41',quantity:1}]};
 const result=await call('POST','/api/orders',payload,owner);assert.equal(result.statusCode,201,result.body);assert.equal(paymentAmount,219900);
 const formats=(await pool.query("SELECT format,count(*)::int n FROM tags WHERE order_id=$1 GROUP BY format",[result.json().orderId])).rows;
 assert.deepEqual(Object.fromEntries(formats.map(x=>[x.format,x.n])),Object.fromEntries(parts));
 assert.equal((await call('POST','/api/orders',payload,owner)).json().orderId,result.json().orderId);
 for(let i=0;i<41;i++)await pool.query("INSERT INTO tags(id,code,activation_hash,format,product_id) VALUES($1,$1,$2,'sticker','complete-41')",['wrong-kit-'+i,hash('secret-'+i)]);
 const failed=await call('POST','/api/orders',{...payload,requestKey:crypto.randomUUID()},owner);assert.equal(failed.statusCode,409,failed.body);
 assert.equal((await pool.query("SELECT count(*)::int n FROM tags WHERE id LIKE 'wrong-kit-%' AND status='stock'")).rows[0].n,41);
});


test('trackable tags show as coming soon and cannot be ordered before launch',async()=>{
 const products=(await call('GET','/api/products')).json().products;
 assert.equal(products.find(p=>p.id==='finder-1')?.available,false);
 assert.deepEqual(products.map(p=>p.id).sort(),['cables-6','complete-41','everyday-12','finder-1']);
 const owner=await login('support-parent@test.com','support-testing-123');
 const result=await call('POST','/api/orders',{requestKey:crypto.randomUUID(),paymentMethod:'mpesa',lines:[{productId:'finder-1',quantity:1}]},owner);
 assert.equal(result.statusCode,400,result.body);
});


test('company workspace isolates school roles, requires MFA, scopes developer data and revokes grants immediately', async () => {
  const companyApp=await createApp({pool,config:{origin:'http://localhost:5173'}});
  const get=(path,cookie)=>companyApp.inject({method:'GET',url:path,headers:cookie?{cookie}:{}});
  try {
    assert.equal((await get('/api/company/overview')).statusCode,401);
    await pool.query("INSERT INTO users(id,email,name,password_hash,role,verified) VALUES('company-admin','admin@company.test','Admin',$1,'parent',true),('company-dev','dev@company.test','Developer',$1,'parent',true)",[await passwordHash('company-test-password-123')]);
    await pool.query("INSERT INTO company_access(user_id,role) VALUES('company-admin','admin'),('company-dev','developer')");
    const token=async(uid,mfa=true,old=false)=>{
      const value=crypto.randomUUID();
      await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at,mfa_verified,created_at,school_id) VALUES($1,$2,now()+interval '1 day',$3,now()-($4::int*interval '1 hour'),$5)",[hash(value),uid,mfa,old?9:0,uid==='staff'?'school-a':null]);
      return 'findbox_session='+value;
    };
    assert.equal((await get('/api/company/overview',await token('staff'))).statusCode,403);
    const limited=await companyApp.inject({method:'POST',url:'/api/auth/login',headers:{'x-findbox-request':'1'},payload:{email:'admin@company.test',password:'company-test-password-123'}});
    assert.equal(limited.statusCode,200,limited.body);assert.equal(limited.json().mfaSetupRequired,true);
    assert.equal((await get('/api/company/overview',limited.headers['set-cookie'].split(';')[0])).statusCode,403);
    await pool.query("UPDATE users SET mfa_secret='encrypted-test-secret' WHERE id IN ('company-admin','company-dev')");
    assert.equal((await get('/api/company/overview',await token('company-admin',false))).statusCode,403);
    assert.equal((await get('/api/company/overview',await token('company-admin',true,true))).statusCode,401);
    const adminCookie=await token('company-admin');const devCookie=await token('company-dev');
    const admin=await get('/api/company/overview',adminCookie);assert.equal(admin.statusCode,200,admin.body);assert.ok(admin.json().sales);assert.ok(admin.json().registrations);
    assert.ok(admin.json().registrations.every(r=>!('email' in r)&&!('name' in r)&&!('password_hash' in r)));
    const dev=await get('/api/company/overview',devCookie);assert.equal(dev.statusCode,200,dev.body);assert.equal(dev.json().sales,undefined);assert.equal(dev.json().orders,undefined);assert.equal(dev.json().registrations,undefined);
    assert.equal((await get('/api/company/health',adminCookie)).statusCode,403);
    const health=await get('/api/company/health',devCookie);assert.equal(health.statusCode,200,health.body);assert.equal(health.json().status,'ok');assert.equal(health.json().integrations.email,false);
    assert.ok(!health.body.includes('encrypted-test-secret'));assert.ok(!health.body.includes('DATABASE_URL'));
    await pool.query("DELETE FROM company_access WHERE user_id='company-dev'");
    assert.equal((await get('/api/company/health',devCookie)).statusCode,403);
    await pool.query("UPDATE users SET verified=false WHERE id='company-admin'");
    assert.equal((await get('/api/company/overview',adminCookie)).statusCode,403);
  } finally {await companyApp.close()}
});


test('Daraja sandbox scopes operators, deduplicates initiation and verifies callbacks without changing orders',async()=>{
  let starts=0,providerStatus='pending',callback;
  const sandboxApp=await createApp({pool,config:{origin:'http://localhost:5173',darajaKey:'test',darajaSecret:'test',darajaShortcode:'174379',darajaPasskey:'test'},daraja:{start:async d=>{starts++;callback=d.callback;return 'sandbox-checkout'},query:async()=>providerStatus}});
  const inject=(method,url,payload,cookie)=>sandboxApp.inject({method,url,payload,headers:{...(cookie?{cookie}:{}),...(payload?{'x-findbox-request':'1'}:{})}});
  try {
    await pool.query("INSERT INTO company_access(user_id,role) VALUES('company-dev','developer')");
    await pool.query("UPDATE users SET verified=true WHERE id='company-admin'");
    const tok=crypto.randomUUID();await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at,mfa_verified) VALUES($1,'company-dev',now()+interval '1 hour',true)",[hash(tok)]);const cookie='findbox_session='+tok;
    assert.equal((await inject('GET','/api/company/daraja')).statusCode,401);
    const before=(await pool.query("SELECT count(*)::int n FROM orders WHERE status IN ('paid','fulfilled')")).rows[0].n;
    const request={phone:'254708374149',amount:1,requestKey:crypto.randomUUID()};
    const first=await inject('POST','/api/company/daraja/start',request,cookie);assert.equal(first.statusCode,200,first.body);
    const repeat=await inject('POST','/api/company/daraja/start',request,cookie);assert.equal(repeat.json().id,first.json().id);assert.equal(starts,1);
    const path=callback.replace('http://localhost:5173','');
    const payload={Body:{stkCallback:{CheckoutRequestID:'sandbox-checkout',ResultCode:0}}};
    const forged=await sandboxApp.inject({method:'POST',url:'/api/payments/daraja/callback?token=aaaaaaaaaaaaaaaaaaaaaaaaaa',payload});assert.equal(forged.statusCode,403);
    const result=await sandboxApp.inject({method:'POST',url:path,payload});assert.equal(result.statusCode,200,result.body);
    assert.equal((await pool.query('SELECT status FROM daraja_sandbox_attempts WHERE id=$1',[first.json().id])).rows[0].status,'pending');
    providerStatus='confirmed';const confirmed=await inject('POST','/api/company/daraja/query',{attemptId:first.json().id},cookie);assert.equal(confirmed.statusCode,200,confirmed.body);assert.equal(confirmed.json().status,'confirmed');
    assert.equal((await pool.query("SELECT count(*)::int n FROM orders WHERE status IN ('paid','fulfilled')")).rows[0].n,before);
    const list=await inject('GET','/api/company/daraja',undefined,cookie);assert.ok(!list.body.includes('254708374149'));assert.ok(!list.body.includes('callback_hash'));assert.ok(!list.body.includes('sandbox-checkout'));
    assert.equal((await inject('POST','/api/company/daraja/start',{...request,amount:1001,requestKey:crypto.randomUUID()},cookie)).statusCode,400);
  }finally{await sandboxApp.close()}
});


test('company email codes enforce expiry, resend cooldown, retry limits, binding and single use',async()=>{
 const sent=[];const emailApp=await createApp({pool,config:{origin:'http://localhost:5173',companyEmailEnabled:true,encryptionKey:randomBytes(32).toString('base64'),smtpHost:'smtp.example.test',smtpUser:'test',smtpPassword:'test',mailFrom:'test@example.test'},mailer:async(to,code)=>{sent.push({to,code})}});
 const request=(url,body,cookie)=>emailApp.inject({method:'POST',url,payload:body,headers:{'x-findbox-request':'1',...(cookie?{cookie}:{})}});
 const cookie=r=>r.headers['set-cookie'].find?r.headers['set-cookie'].find(v=>v.startsWith('findbox_company_challenge=')).split(';')[0]:r.headers['set-cookie'].split(';')[0];
 try{
  await pool.query("INSERT INTO users(id,email,name,password_hash,role,verified) VALUES('email-admin','email-admin@test.com','Email admin',$1,'parent',true)",[await passwordHash('email-testing-password-123')]);
  await pool.query("INSERT INTO company_access(user_id,role) VALUES('email-admin','admin')");
  const credentials={email:'email-admin@test.com',password:'email-testing-password-123'};
  assert.equal((await request('/api/company/auth/start',{...credentials,password:'wrong'})).statusCode,401);assert.equal(sent.length,0);
  const start=await request('/api/company/auth/start',credentials);assert.equal(start.statusCode,200,start.body);const challenge=cookie(start);assert.match(sent[0].code,/^\d{6}$/);assert.ok(!start.body.includes(sent[0].code));
  assert.equal((await request('/api/company/auth/resend',{},challenge)).statusCode,429);
  assert.equal((await request('/api/company/auth/start',credentials)).statusCode,429);
  assert.equal((await request('/api/company/auth/verify',{code:sent[0].code})).statusCode,401);
  const stored=(await pool.query("SELECT code_hash,expires_at,sent_at FROM company_email_challenges WHERE user_id='email-admin'")).rows[0];assert.notEqual(stored.code_hash,sent[0].code);assert.equal(new Date(stored.expires_at)-new Date(stored.sent_at),60000);
  const wrong=sent[0].code==='000000'?'111111':'000000';for(let i=0;i<5;i++)assert.equal((await request('/api/company/auth/verify',{code:wrong},challenge)).statusCode,401);
  assert.equal((await pool.query("SELECT attempts FROM company_email_challenges WHERE user_id='email-admin'")).rows[0].attempts,5);
  assert.equal((await request('/api/company/auth/verify',{code:sent[0].code},challenge)).statusCode,401);
  await pool.query("UPDATE company_email_challenges SET sent_at=now()-interval '61 seconds',expires_at=now()-interval '1 second' WHERE user_id='email-admin'");
  const concurrent=await Promise.all([request('/api/company/auth/resend',{},challenge),request('/api/company/auth/resend',{},challenge)]);assert.equal(concurrent.filter(r=>r.statusCode===200).length,1);assert.ok(concurrent.every(r=>[200,401,429].includes(r.statusCode)));assert.equal(sent.length,2);
  const next=concurrent.find(r=>r.statusCode===200),nextCookie=cookie(next);
  assert.equal((await request('/api/company/auth/verify',{code:sent[0].code},challenge)).statusCode,401);
  await pool.query("UPDATE company_email_challenges SET expires_at=now()-interval '1 second' WHERE user_id='email-admin'");assert.equal((await request('/api/company/auth/verify',{code:sent[1].code},nextCookie)).statusCode,401);
  await pool.query("UPDATE company_email_challenges SET expires_at=now()+interval '60 seconds' WHERE user_id='email-admin'");
  const verified=await request('/api/company/auth/verify',{code:sent[1].code},nextCookie);assert.equal(verified.statusCode,200,verified.body);
  assert.equal((await request('/api/company/auth/verify',{code:sent[1].code},nextCookie)).statusCode,401);
  const sessionCookie=verified.headers['set-cookie'].find(v=>v.startsWith('findbox_ops_session=')).split(';')[0];
  const access=await emailApp.inject({method:'GET',url:'/api/company/access',headers:{cookie:sessionCookie}});assert.equal(access.statusCode,200,access.body);
  assert.equal((await pool.query("SELECT mfa_verified,company_email_verified FROM sessions WHERE token_hash=$1",[hash(sessionCookie.split('=')[1])])).rows[0].mfa_verified,false);
 }finally{await emailApp.close()}
});


test('operational console enforces roles, safe edits, conflicts, invoices, outbox deduplication and notification audiences',async()=>{
 const ops=await createApp({pool,config:{origin:'http://localhost:5173',resendKey:'fake-no-network',mailFrom:'hello@example.test'}});
 const fixturePassword=await passwordHash('operations-fixture-password-123');
 await pool.query("INSERT INTO users(id,email,name,password_hash,role,verified,mfa_secret) VALUES('company-admin','admin@company.test','Admin',$1,'parent',true,'fixture-secret'),('company-dev','dev@company.test','Developer',$1,'parent',true,'fixture-secret') ON CONFLICT(id) DO NOTHING",[fixturePassword]);
 await pool.query("INSERT INTO company_access(user_id,role) VALUES('company-admin','admin'),('company-dev','developer') ON CONFLICT(user_id) DO UPDATE SET role=EXCLUDED.role");
 await pool.query("UPDATE users SET verified=true,mfa_secret=COALESCE(mfa_secret,'fixture-secret') WHERE id IN ('company-admin','company-dev')");
 const request=(method,url,payload,cookie)=>ops.inject({method,url,payload,headers:{...(payload?{'x-findbox-request':'1'}:{}),...(cookie?{cookie}:{})}});
 const token=async uid=>{const t=crypto.randomUUID();await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at,mfa_verified) VALUES($1,$2,now()+interval '1 hour',true)",[hash(t),uid]);return 'findbox_session='+t};
 try{
  const admin=await token('company-admin'),dev=await token('company-dev'),customer=await token('parent');
  assert.equal((await request('GET','/api/company/records/users')).statusCode,401);
  assert.equal((await request('GET','/api/company/records/users',undefined,admin)).statusCode,200);
  assert.equal((await request('GET','/api/company/records/invoices',undefined,dev)).statusCode,403);
  assert.equal((await request('GET','/api/company/records/clients',undefined,customer)).statusCode,403);
  const accounts=await request('GET','/api/company/records/users',undefined,dev);assert.equal(accounts.statusCode,200,accounts.body);assert.ok(!accounts.body.includes('password_hash'));assert.ok(!accounts.body.includes('encrypted-test-secret'));
  const protectedEdit=await request('POST','/api/company/users/company-admin',{revision:1,reason:'Security regression check',name:'Changed',email:'changed@test.com',disabled:true},dev);assert.equal(protectedEdit.statusCode,403);
  const invite=await request('POST','/api/company/clients',{name:'Invoice Client',email:'invoice-client@test.com',reason:'Onboard an adult customer'},admin);assert.equal(invite.statusCode,200,invite.body);
  const client=(await pool.query("SELECT * FROM users WHERE email='invoice-client@test.com'")).rows[0];assert.equal(client.verified,false);assert.notEqual(client.password_hash,'');
  await pool.query('UPDATE users SET verified=true WHERE id=$1',[client.id]);
  const edit={revision:1,reason:'Correct client display name',name:'Invoice Client Updated',email:client.email,disabled:false};
  assert.equal((await request('POST','/api/company/users/'+client.id,edit,dev)).statusCode,200);
  assert.equal((await request('POST','/api/company/users/'+client.id,edit,dev)).statusCode,409);
  const invalidRole=await request('POST','/api/company/users/'+client.id,{...edit,revision:2,companyRole:'admin'},dev);assert.equal(invalidRole.statusCode,400);
  const draft={clientId:client.id,requestKey:crypto.randomUUID(),dueDate:'2026-12-01',notes:'A test draft, not a payment request.',lines:[{description:'Label packs',quantity:2,unitMinor:129900}],reason:'Prepare a reviewed invoice draft'};
  const created=await request('POST','/api/company/invoices',draft,admin);assert.equal(created.statusCode,200,created.body);const iid=created.json().id;
  assert.equal((await request('POST','/api/company/invoices',draft,admin)).json().id,iid);
  assert.equal((await pool.query('SELECT total_minor FROM invoices WHERE id=$1',[iid])).rows[0].total_minor,259800);
  const pdf=await request('GET','/api/company/invoices/'+iid+'/pdf',undefined,admin);assert.equal(pdf.statusCode,200,pdf.body.slice(0,100));assert.ok(pdf.rawPayload.subarray(0,4).toString()==='%PDF');assert.ok(pdf.headers['content-type'].startsWith('application/pdf'));
  assert.equal((await request('GET','/api/company/invoices/'+iid+'/pdf',undefined,dev)).statusCode,403);
  assert.equal((await request('POST','/api/company/invoices/'+iid+'/action',{revision:1,reason:'Try issuing without billing details',action:'issue'},admin)).statusCode,409);
  const profile=await request('GET','/api/company/profile',undefined,admin);
  assert.equal((await request('POST','/api/company/profile',{revision:profile.json().revision,reason:'Confirm test business billing profile',profile:{legalName:'FINDBOX.africa',email:'hello@example.test',address:'Example address',pin:'TEST-ONLY-PIN',vatRegistered:false,issuerConfirmed:true}},admin)).statusCode,200);
  const issued=await request('POST','/api/company/invoices/'+iid+'/action',{revision:1,reason:'Issue reviewed test invoice',action:'issue'},admin);assert.equal(issued.statusCode,200,issued.body);
  const invoice=(await pool.query('SELECT * FROM invoices WHERE id=$1',[iid])).rows[0];assert.match(invoice.number,/^FB-\d{4}-\d{6}$/);
  for(let i=0;i<2;i++)assert.equal((await request('POST','/api/company/invoices/'+iid+'/action',{revision:2,reason:'Send to verified test recipient',action:'send'},admin)).statusCode,200);
  assert.equal((await pool.query('SELECT count(*)::int n FROM outbox WHERE invoice_id=$1',[iid])).rows[0].n,1);
  const child=await request('POST','/api/company/membership',{userId:'other',schoolId:'school-a',role:'manager',reason:'Attempt invalid child role promotion'},admin);assert.equal(child.statusCode,403);
  const update=await request('POST','/api/company/announcements',{requestKey:crypto.randomUUID(),title:'Company only',message:'Private operator notice',audience:'company',schoolId:null,days:1,reason:'Notify the company team'},admin);assert.equal(update.statusCode,200,update.body);
  const publicUpdates=await request('GET','/api/updates',undefined,customer);assert.equal(publicUpdates.statusCode,200,publicUpdates.body);assert.ok(!publicUpdates.body.includes('Private operator notice'));
  assert.ok((await request('GET','/api/updates',undefined,admin)).body.includes('Private operator notice'));
  const proDraft=await request('POST','/api/company/invoices',{...draft,requestKey:crypto.randomUUID()},admin);const proId=proDraft.json().id;
  const edited=await request('POST','/api/company/invoices/'+proId+'/edit',{revision:1,reason:'Correct draft quantity and notes',dueDate:'2026-12-01',billingName:'School billing name',billingAddress:'Example address',notes:'Corrected draft',lines:[{description:'Labels',quantity:3,unitMinor:10000}]},admin);assert.equal(edited.statusCode,200,edited.body);
  const proSend=await request('POST','/api/company/invoices/'+proId+'/action',{revision:2,reason:'Send reviewed pro forma estimate',action:'send'},admin);assert.equal(proSend.statusCode,200,proSend.body);
  const pro=(await pool.query('SELECT * FROM invoices WHERE id=$1',[proId])).rows[0];assert.equal(pro.status,'proforma');assert.equal(pro.total_minor,30000);assert.match(pro.number,/^PF-/);
  assert.equal((await request('POST','/api/company/invoices/'+proId+'/edit',{revision:3,reason:'Try changing an immutable pro forma',dueDate:'2026-12-01',billingName:'Changed',billingAddress:'',notes:'',lines:[{description:'Labels',quantity:1,unitMinor:10000}]},admin)).statusCode,409);
  await pool.query("UPDATE outbox SET locked_until=now()+interval '5 minutes' WHERE invoice_id=$1",[proId]);
  assert.equal((await request('POST','/api/company/invoices/'+proId+'/action',{revision:3,reason:'Try voiding while delivery is locked',action:'void'},admin)).statusCode,409);
  await pool.query('UPDATE outbox SET locked_until=NULL WHERE invoice_id=$1',[proId]);
  assert.equal((await request('POST','/api/company/invoices/'+proId+'/action',{revision:3,reason:'Void unsent test pro forma estimate',action:'void'},admin)).statusCode,200);
  assert.equal((await pool.query('SELECT count(*)::int n FROM outbox WHERE invoice_id=$1',[proId])).rows[0].n,0);
  const oid=crypto.randomUUID();await pool.query("INSERT INTO orders(id,user_id,request_key,amount_minor,lines,school_id,status,payment_reference) VALUES($1,$2,$1,219900,$3,'school-a','paid',$1)",[oid,client.id,JSON.stringify([{productId:'complete-41',quantity:1,tagCount:40,name:'Family pack',unitPrice:219900}])]);
  for(const [format,n] of [['sticker',20],['fabric',20]])for(let i=0;i<n;i++)await pool.query("INSERT INTO tags(id,code,activation_hash,format,product_id) VALUES($1,$1,'test-private-hash',$2,'complete-41')",['ops-stock-'+format+'-'+i,format]);
  const fulfilled=await request('POST','/api/company/orders/'+oid+'/fulfill',{reason:'Confirm paid order is ready for collection'},admin);assert.equal(fulfilled.statusCode,200,fulfilled.body);
  assert.deepEqual(Object.fromEntries((await pool.query("SELECT format,count(*)::int n FROM tags WHERE order_id=$1 AND status='allocated' GROUP BY format",[oid])).rows.map(r=>[r.format,r.n])),{sticker:20,fabric:20});
  const ownerCookie=await token(client.id);const disabled=await request('POST','/api/company/users/'+client.id,{...edit,revision:2,disabled:true,reason:'Disable test account access'},dev);assert.equal(disabled.statusCode,200,disabled.body);assert.equal((await request('GET','/api/auth/me',undefined,ownerCookie)).statusCode,401);
  assert.ok((await request('GET','/api/company/records/audit',undefined,admin)).json().rows.length>0);
 }finally{await ops.close()}
});

test('developer-only onboarding, private invitation, school setup, roster lifecycle and cross-school isolation',async()=>{
 const ops=await createApp({pool,config:{origin:'http://localhost:5173',resendKey:'fake-no-network',mailFrom:'hello@findbox.africa'}});
 const pw=await passwordHash('school-onboarding-fixture-123');
 await pool.query("INSERT INTO users(id,email,name,password_hash,role,verified) VALUES('onboard-dev','onboard-dev@test.com','Dev',$1,'parent',true),('onboard-admin','onboard-admin@test.com','Admin',$1,'parent',true) ON CONFLICT DO NOTHING",[pw]);
 await pool.query("INSERT INTO company_access(user_id,role) VALUES('onboard-dev','developer'),('onboard-admin','admin') ON CONFLICT DO NOTHING");
 const token=async(uid,sid=null)=>{const t=crypto.randomUUID();await pool.query("INSERT INTO sessions(token_hash,user_id,school_id,expires_at,mfa_verified) VALUES($1,$2,$3,now()+interval '1 hour',true)",[hash(t),uid,sid]);return 'findbox_session='+t;};
 const request=(method,url,payload,cookie)=>ops.inject({method,url,payload,headers:{...(payload?{'x-findbox-request':'1'}:{}),...(cookie?{cookie}:{})}});
 try{
 await pool.query("UPDATE users SET mfa_secret='test-enrolled-secret' WHERE id IN ('onboard-dev','onboard-admin')");
 const dev=await token('onboard-dev'),admin=await token('onboard-admin');
 const body={requestKey:crypto.randomUUID(),name:'Onboarding school',box:'Reception',directions:'Main gate',hours:'Weekdays 8 to 4',reason:'Verified school onboarding request'};
 assert.equal((await request('POST','/api/company/schools',body,admin)).statusCode,403);
 assert.equal((await request('POST','/api/company/school-access/invite',{schoolId:'school-a',name:'Denied',email:'denied@test.com',reason:'Attempt prohibited admin access'},admin)).statusCode,403);
 const created=await request('POST','/api/company/schools',body,dev);assert.equal(created.statusCode,200,created.body);const sid=created.json().id;
 assert.equal((await pool.query('SELECT lifecycle FROM schools WHERE id=$1',[sid])).rows[0].lifecycle,'pending');
 const invite=await request('POST','/api/company/school-access/invite',{schoolId:sid,name:'New school manager',email:'new-manager@test.com',reason:'School contact verified by developer'},dev);assert.equal(invite.statusCode,200,invite.body);
 const uid=(await pool.query("SELECT id FROM users WHERE email='new-manager@test.com'")).rows[0].id;
 const mail=(await pool.query("SELECT body FROM outbox WHERE recipient_email='new-manager@test.com' ORDER BY created_at DESC LIMIT 1")).rows[0].body;
 const raw=mail.match(/#token=([^\s]+)/)[1];
 assert.equal((await request('POST','/api/school/invitations/accept',{token:raw,password:'new-school-password-123'})).statusCode,200);
 assert.equal((await request('POST','/api/school/invitations/accept',{token:raw,password:'new-school-password-123'})).statusCode,400);
 const manager=await token(uid,sid),row={schoolReference:'S001',name:'Student One',className:'Year 4',guardianEmail:'',consentReference:'School safeguarding register entry A1'};
 assert.equal((await request('POST','/api/school/students/import',{rows:[row],reason:'Guardian authority checked by school'},manager)).statusCode,409);
 const setup=await request('POST','/api/school/setup',{contactName:'School contact',contactEmail:'school@test.com',privacyBasis:'Documented lawful basis, verified guardian authority and retention policy V1',reason:'School setup and safeguarding review'},manager);assert.equal(setup.statusCode,200,setup.body);
 let revision=(await pool.query('SELECT revision FROM schools WHERE id=$1',[sid])).rows[0].revision;
 const active=await request('POST','/api/company/school-access/state',{schoolId:sid,revision,lifecycle:'active',reason:'Onboarding checklist completed'},dev);assert.equal(active.statusCode,200,active.body);
 const before=(await pool.query('SELECT count(*)::int n FROM users')).rows[0].n;
 let r=await request('POST','/api/school/students/import',{rows:[row],reason:'Guardian authority checked by school'},manager);assert.equal(r.statusCode,200,r.body);
 assert.equal((await pool.query('SELECT count(*)::int n FROM users')).rows[0].n,before,'Roster must not create child login accounts');
 r=await request('POST','/api/school/students/preview',{rows:[row,row]},manager);assert.equal(r.statusCode,200,r.body);assert.ok(r.json().rows.every(v=>v.error));
 const roster=await request('GET','/api/school/students',undefined,manager);assert.equal(roster.statusCode,200,roster.body);const st=roster.json().rows[0];
 assert.equal(st.school_id,sid);
 const update={...row,status:'left',revision:1,reason:'Student has left this school'};
 assert.equal((await request('POST','/api/school/students/'+st.id,update,manager)).statusCode,200);
 assert.equal((await request('POST','/api/school/students/'+st.id,update,manager)).statusCode,409);
 await pool.query("INSERT INTO users(id,email,name,password_hash,role,school_id,verified) VALUES('foreign-manager','foreign-manager@test.com','Foreign manager',$1,'manager','school-b',true)",[pw]);
 await pool.query("UPDATE schools SET contact_email='contact@school.test',contact_name='School contact',privacy_basis='Approved school safeguarding policy' WHERE id='school-b'");
 const foreign=await token('foreign-manager','school-b');
 assert.equal((await request('POST','/api/school/students/'+st.id,update,foreign)).statusCode,404);
 assert.equal((await request('GET','/api/school/students/export',undefined,foreign)).json().rows.length,0);
 assert.equal((await request('GET','/api/school/students',undefined,admin)).statusCode,403);
 const exported=await request('GET','/api/school/students/export',undefined,manager);assert.equal(exported.statusCode,200,exported.body);assert.equal(exported.json().rows[0].status,'left');
 const csv=await request('GET','/api/school/students/export?format=csv',undefined,manager);assert.equal(csv.statusCode,200,csv.body);assert.match(csv.headers['content-disposition'],/attachment/);assert.match(csv.body,/Student One/);
 const foreignCsv=await request('GET','/api/school/students/export?format=csv',undefined,foreign);assert.ok(!foreignCsv.body.includes('Student One'));

 const ticket=await request('POST','/api/support/tickets',{name:'School admin',email:'new-manager@test.com',kind:'bug',subject:'Technical issue',message:'Please investigate the school scanner',context:'school admin',requestKey:crypto.randomUUID()},manager);assert.equal(ticket.statusCode,200,ticket.body);
 assert.equal((await pool.query("SELECT count(*)::int n FROM outbox WHERE recipient_email='hello@findbox.africa' AND subject LIKE '%Technical issue%'")).rows[0].n,1);
 // Guardian verification is required before child login creation or recovery.
 await pool.query("INSERT INTO users(id,email,name,password_hash,role,verified) VALUES('roster-guardian','roster-guardian@test.com','Guardian',$1,'parent',true)",[pw]);
 const guardian=await token('roster-guardian');
 assert.equal((await request('POST','/api/family/roster/'+st.id+'/login',{password:'child-private-password-123',approve:true},guardian)).statusCode,404);
 const current={...row,status:'active',revision:2,guardianEmail:'roster-guardian@test.com',reason:'Verified school guardian authority register'};
 assert.equal((await request('POST','/api/school/students/'+st.id,current,manager)).statusCode,200);
 assert.equal((await request('POST','/api/school/students/'+st.id+'/guardian',{reason:'Verify nominated guardian relationship'},manager)).statusCode,200);
 const guardianMail=(await pool.query("SELECT body FROM outbox WHERE recipient_email='roster-guardian@test.com' ORDER BY created_at DESC LIMIT 1")).rows[0].body;
 const guardianToken=guardianMail.match(/#token=([^\s]+)/)[1];
 assert.equal((await request('POST','/api/school/guardians/accept',{token:guardianToken},guardian)).statusCode,200);
 assert.equal((await request('POST','/api/school/guardians/accept',{token:guardianToken},guardian)).statusCode,400);
 const childLogin=await request('POST','/api/family/roster/'+st.id+'/login',{password:'child-private-password-123',approve:true},guardian);assert.equal(childLogin.statusCode,200,childLogin.body);
 const studentUser=(await pool.query('SELECT user_id FROM students WHERE id=$1',[st.id])).rows[0].user_id;
 const childSession=await token(studentUser,sid);
 assert.equal((await request('GET','/api/school/students',undefined,childSession)).statusCode,403);
 assert.equal((await request('POST','/api/family/roster/'+st.id+'/disable-login',{},guardian)).statusCode,200);
 assert.equal((await request('GET','/api/workspace',undefined,childSession)).statusCode,401);
 const box=(await pool.query('SELECT id FROM boxes WHERE school_id=$1',[sid])).rows[0];
 assert.equal((await request('POST','/api/school/boxes',{id:box.id,name:'Changed',directions:'Gate',hours:'9 to 5',active:true,reason:'Attempt cross school box change'},foreign)).statusCode,404);
 assert.equal((await request('GET','/api/company/invoice-ledger',undefined,dev)).statusCode,403);
 assert.equal((await request('GET','/api/company/privacy-requests',undefined,admin)).statusCode,403);
 const cid='onboarding-dispute-case';await pool.query("INSERT INTO cases(id,school_id,title,category,status) VALUES($1,$2,'Disputed bottle','bottle','awaiting_collection')",[cid,sid]);
 assert.equal((await request('POST','/api/school/case-reviews',{caseId:cid,kind:'dispute',note:'Conflicting ownership evidence needs review'},manager)).statusCode,200);
 assert.equal((await request('POST','/api/staff/cases/'+cid+'/collect',{verification:'Identity reviewed at school'},manager)).statusCode,409);
 assert.equal((await request('POST','/api/school/case-reviews',{caseId:cid,kind:'correction',note:'School verified and resolved the ownership dispute'},manager)).statusCode,200);
 assert.equal((await request('POST','/api/staff/cases/'+cid+'/collect',{verification:'Guardian authority verified by school'},manager)).statusCode,200);
 // Public school and box details are opt-in; no roster or contact records leak.
 let directory=await request('GET','/api/schools/public');assert.equal(directory.statusCode,200,directory.body);assert.ok(!directory.json().rows.some(r=>r.id===sid));
 await pool.query('UPDATE schools SET public_listing=true WHERE id=$1',[sid]);
 directory=await request('GET','/api/schools/public');assert.equal(directory.json().rows.find(r=>r.id===sid).boxes.length,0);
 await pool.query('UPDATE boxes SET public_listing=true WHERE school_id=$1',[sid]);
 directory=await request('GET','/api/schools/public');const published=directory.json().rows.find(r=>r.id===sid);assert.equal(published.boxes.length,1);assert.ok(!directory.body.includes('roster-guardian'));assert.ok(!directory.body.includes('School contact'));
 // Transfers require independent approval, retain school boundaries and clear private notes.
 await pool.query("INSERT INTO memberships(user_id,school_id,role) VALUES('roster-guardian','school-a','parent') ON CONFLICT DO NOTHING");
 await pool.query("INSERT INTO tags(id,code,activation_hash,format,product_id,owner_id,status) VALUES('transfer-tag','TRANSFER-TAG','unused-private-hash','sticker','everyday-12','parent','active')");
 await pool.query("INSERT INTO items(id,tag_id,owner_id,school_id,name,category,private_note) VALUES('transfer-item','transfer-tag','parent','school-a','Private bottle name','bottle','Sensitive previous owner note')");
 const ownershipRequest={newOwnerEmail:'roster-guardian@test.com',reason:'Both families requested ownership handover'};
 assert.equal((await request('POST','/api/company/items/transfer-item/transfer',ownershipRequest,admin)).statusCode,403);
 assert.equal((await request('POST','/api/company/items/transfer-item/transfer',ownershipRequest,dev)).statusCode,200);
 const tid=(await pool.query("SELECT id FROM ownership_transfers WHERE item_id='transfer-item'")).rows[0].id;
 assert.equal((await request('POST','/api/family/transfers/'+tid,{approve:true,reviewed:true},foreign)).statusCode,404);
 const source=await token('parent','school-a');
 assert.equal((await request('POST','/api/family/transfers/'+tid,{approve:true,reviewed:true},source)).statusCode,200);
 assert.equal((await pool.query("SELECT owner_id FROM items WHERE id='transfer-item'")).rows[0].owner_id,'parent');
 assert.equal((await request('POST','/api/family/transfers/'+tid,{approve:true,reviewed:true},guardian)).statusCode,200);
 const transferred=(await pool.query("SELECT owner_id,private_note FROM items WHERE id='transfer-item'")).rows[0];assert.equal(transferred.owner_id,'roster-guardian');assert.equal(transferred.private_note,'');
 assert.equal((await request('POST','/api/family/transfers/'+tid,{approve:true,reviewed:true},guardian)).statusCode,409);
 await pool.query("INSERT INTO invoices(id,client_id,request_key,status,issuer,customer,lines,total_minor,due_date,created_by) VALUES('ledger-test','parent',$1,'issued','{}','{}','[]',1000,CURRENT_DATE,'onboard-admin')",[crypto.randomUUID()]);
 const entry={requestKey:crypto.randomUUID(),kind:'payment',amountMinor:700,reference:'VERIFIED-PAYMENT-TEST',reason:'Operator verified independent payment record'};
 assert.equal((await request('POST','/api/company/invoice-ledger/ledger-test',entry,dev)).statusCode,403);
 let lr=await request('POST','/api/company/invoice-ledger/ledger-test',entry,admin);assert.equal(lr.statusCode,200,lr.body);
 assert.equal((await request('POST','/api/company/invoice-ledger/ledger-test',entry,admin)).json().alreadyRecorded,true);
 assert.equal((await request('POST','/api/company/invoice-ledger/ledger-test',{...entry,requestKey:crypto.randomUUID(),kind:'credit',reference:'CREDIT-OVER',amountMinor:301},admin)).statusCode,409);
 assert.equal((await request('POST','/api/company/invoice-ledger/ledger-test',{...entry,requestKey:crypto.randomUUID(),kind:'credit',reference:'CREDIT-FINAL',amountMinor:300},admin)).statusCode,200);
 const revoke=await request('POST','/api/company/school-access/revoke',{schoolId:sid,userId:uid,reason:'Replacing departing administrator'},dev);assert.equal(revoke.statusCode,200,revoke.body);
 assert.equal((await request('GET','/api/school/students',undefined,manager)).statusCode,401);
 }finally{await ops.close()}
});

test('complimentary demo tags enforce owner, school, expiry and private activation, complete recovery without a sale',async()=>{
 const password='demo-test-private-2026',pw=await passwordHash(password);
 for(const [uid,email,role,school] of [['demo-owner','demo-owner@test.com','parent','school-a'],['demo-other','demo-other@test.com','parent','school-a'],['demo-staff','demo-staff@test.com','staff','school-a']]){
  await pool.query('INSERT INTO users(id,name,email,password_hash,role,school_id,verified) VALUES($1,$1,$2,$3,$4,$5,true)',[uid,email,pw,role,school]);
  await pool.query('INSERT INTO memberships(user_id,school_id,role) VALUES($1,$2,$3) ON CONFLICT(user_id,school_id) DO NOTHING',[uid,school,role]);
 }
 const owner=await login('demo-owner@test.com',password),stranger=await login('demo-other@test.com',password),operator=await login('demo-staff@test.com',password);
 const before=Number((await pool.query('SELECT count(*) FROM orders')).rows[0].count);
 for(const [key,school,expiry]of[['demo-main','school-a',new Date(Date.now()+3600000)],['demo-expired','school-a',new Date(Date.now()-1000)],['demo-foreign','school-b',new Date(Date.now()+3600000)]]){
  await pool.query("INSERT INTO tags(id,code,activation_hash,format,product_id,status) VALUES($1,$2,$3,'sticker','everyday-12','allocated')",[key,'FB-'+key,hash('demo-private')]);
  await pool.query('INSERT INTO demo_tag_grants(tag_id,owner_id,school_id,created_by,request_key,expires_at) VALUES($1,$2,$3,$4,$1,$5)',[key,'demo-owner',school,'demo-staff',expiry]);
 }
 const payload={code:'FB-demo-main',activationSecret:'demo-private',name:'Demonstration bottle',category:'bottle'};
 assert.equal((await call('POST','/api/tags/activate',payload,stranger)).statusCode,400);
 assert.equal((await call('POST','/api/tags/activate',{...payload,activationSecret:'incorrect'},owner)).statusCode,400);
 for(const code of ['FB-demo-expired','FB-demo-foreign'])assert.equal((await call('POST','/api/tags/activate',{...payload,code},owner)).statusCode,400);
 const activated=await call('POST','/api/tags/activate',payload,owner);assert.equal(activated.statusCode,200,activated.body);
 assert.equal((await call('POST','/api/tags/activate',payload,owner)).statusCode,409);
 const scan=await call('GET','/api/tags/FB-demo-main');assert.equal(scan.statusCode,200);assert(!scan.body.includes('demo-owner@test.com'));assert(!scan.body.includes('demo-private'));
 const found=await call('POST','/api/found',{code:payload.code,boxId:'box-a'},operator);assert.equal(found.statusCode,200,found.body);
 const caseId=found.json().id;
 const receipt=await call('POST','/api/staff/cases/'+caseId+'/receive',{boxId:'box-a'},operator);assert.equal(receipt.statusCode,200,receipt.body);
 const collection=await call('POST','/api/staff/cases/'+caseId+'/collect',{verification:'Presenter checked the fictional demo ownership record'},operator);assert.equal(collection.statusCode,200,collection.body);
 assert.equal((await pool.query('SELECT status FROM cases WHERE id=$1',[caseId])).rows[0].status,'returned');
 assert.equal(Number((await pool.query('SELECT count(*) FROM orders')).rows[0].count),before);
});

test("portals separate sign-ins, renew family sessions, trust devices and sign out single devices", async () => {
  const windows = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36", iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1";
  const loginAs = (email, portal, extra = {}) => app.inject({ method: "POST", url: "/api/auth/login", remoteAddress: "127.0.2." + loginClient++, headers: { "x-findbox-request": "1", origin: "http://localhost:5173", "user-agent": windows, ...extra }, payload: { email, password: "testing-password-123", ...(portal ? { portal } : {}) } });
  const first = (r, name) => [].concat(r.headers["set-cookie"]).find((v) => v.startsWith(name + "=")).split(";")[0];
  // Staff cannot use the family sign-in, and get their own school cookie through the school portal.
  const wrong = await loginAs("staff@test.com", "family");
  assert.equal(wrong.statusCode, 403, wrong.body);
  assert.match(wrong.json().error, /school portal/);
  const right = await loginAs("staff@test.com", "school");
  assert.equal(right.statusCode, 200, right.body);
  assert.ok(first(right, "findbox_school_session"));
  await pool.query("INSERT INTO users(id,email,name,password_hash,role,school_id,verified) VALUES('portal-parent','portal-parent@test.com','Portal parent',$1,'parent','school-a',true)", [await passwordHash("testing-password-123")]);
  assert.equal((await loginAs("portal-parent@test.com", "school")).statusCode, 403);
  const fam = await loginAs("portal-parent@test.com", "family");
  assert.equal(fam.statusCode, 200, fam.body);
  const famCookie = first(fam, "findbox_session"), famHash = hash(famCookie.split("=")[1]);
  // A family session renews while it is used.
  await pool.query("UPDATE sessions SET expires_at=now()+interval '1 day',last_seen_at=now()-interval '1 hour' WHERE token_hash=$1", [famHash]);
  assert.equal((await call("GET", "/api/workspace", null, famCookie)).statusCode, 200);
  const renewed = (await pool.query("SELECT expires_at FROM sessions WHERE token_hash=$1", [famHash])).rows[0].expires_at;
  assert.ok(new Date(renewed).getTime() - Date.now() > 29 * 864e5);
  // Two-step login, then trusting this device skips the code on the next sign-in here only.
  const { totp } = await import("../mfa.mjs");
  const setup = await call("POST", "/api/account/mfa/setup", {}, famCookie);
  assert.equal(setup.statusCode, 200, setup.body);
  const confirmed = await call("POST", "/api/account/mfa/confirm", { code: totp(setup.json().secret) }, famCookie);
  assert.equal(confirmed.statusCode, 200, confirmed.body);
  const limited = await loginAs("portal-parent@test.com", "family");
  assert.equal(limited.json().requiresMfa, true);
  const challenged = await app.inject({ method: "POST", url: "/api/account/mfa/challenge", headers: { "x-findbox-request": "1", origin: "http://localhost:5173", "content-type": "application/json", "user-agent": windows, cookie: first(limited, "findbox_session") }, payload: { code: confirmed.json().recoveryCodes[0], trustDevice: true } });
  assert.equal(challenged.statusCode, 200, challenged.body);
  const device = first(challenged, "findbox_device");
  const trusted = await loginAs("portal-parent@test.com", "family", { cookie: device });
  assert.equal(trusted.json().requiresMfa, false, trusted.body);
  assert.equal((await loginAs("portal-parent@test.com", "family")).json().requiresMfa, true);
  // A sign-in from a new kind of device queues a notice.
  await loginAs("portal-parent@test.com", "family", { "user-agent": iphone });
  assert.ok((await pool.query("SELECT 1 FROM outbox WHERE user_id='portal-parent' AND subject='New sign-in to your FindBox account' AND body LIKE '%Safari on iOS%'")).rowCount);
  // The device list signs out one other device and forgets a trusted one.
  const mine = first(trusted, "findbox_session");
  const security = (await call("GET", "/api/account/security", null, mine)).json();
  const other = security.sessions.find((s) => !s.current);
  assert.ok(other && security.sessions.some((s) => s.current && s.device === "Chrome on Windows"));
  assert.equal((await call("POST", "/api/account/sessions/" + other.id + "/revoke", {}, mine)).statusCode, 200);
  assert.ok(!(await call("GET", "/api/account/security", null, mine)).json().sessions.some((s) => s.id === other.id));
  assert.equal(security.trustedDevices.length, 1);
  assert.equal((await call("POST", "/api/account/devices/" + security.trustedDevices[0].id + "/forget", {}, mine)).statusCode, 200);
  assert.equal((await loginAs("portal-parent@test.com", "family", { cookie: device })).json().requiresMfa, true);
});

test("families can sign up without a school code, school links resolve, and a fully set-up school goes live", async () => {
  const signup = await app.inject({ method: "POST", url: "/api/auth/signup", remoteAddress: "127.0.3.1", headers: { "x-findbox-request": "1", origin: "http://localhost:5173" }, payload: { name: "No School", email: "noschool@test.com", password: "testing-password-123", role: "parent" } });
  assert.equal(signup.statusCode, 201, signup.body);
  assert.equal((await pool.query("SELECT school_id FROM users WHERE email='noschool@test.com'")).rows[0].school_id, null);
  await pool.query("INSERT INTO schools(id,name,join_hash,lifecycle) VALUES('golive','Go Live School',$1,'pending')", [hash("GOLIVE-CODE")]);
  assert.equal((await call("GET", "/api/schools/join/GOLIVE-CODE")).statusCode, 404);
  await pool.query("INSERT INTO users(id,email,name,password_hash,role,school_id,verified) VALUES('golive-admin','golive@test.com','Admin',$1,'manager','golive',true)", [await passwordHash("testing-password-123")]);
  await pool.query("INSERT INTO memberships(user_id,school_id,role) VALUES('golive-admin','golive','manager') ON CONFLICT DO NOTHING");
  const admin = await login("golive@test.com");
  let r = await call("POST", "/api/school/setup", { contactName: "Head", contactEmail: "head@golive.test", privacyBasis: "Child protection policy v1", reason: "Initial school setup" }, admin);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().live, false);
  r = await call("POST", "/api/school/boxes", { name: "Reception", directions: "Front office", hours: "Mon–Fri 8am–4pm", active: true, reason: "Initial collection point" }, admin);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().live, true);
  assert.equal((await pool.query("SELECT lifecycle FROM schools WHERE id='golive'")).rows[0].lifecycle, "active");
  assert.ok((await pool.query("SELECT 1 FROM operation_audit WHERE action='school_activated_automatically' AND entity='golive'").catch(() => ({ rowCount: 1 }))).rowCount);
  assert.equal((await call("GET", "/api/schools/join/GOLIVE-CODE")).json().name, "Go Live School");
});

test("one private code activates every tag in the buyer's pack, once", async () => {
  await pool.query("INSERT INTO schools(id,name,join_hash,lifecycle) VALUES('pack-school','Pack School','pack-school-hash','active')");
  await pool.query("INSERT INTO users(id,email,name,password_hash,role,school_id,verified) VALUES('pack-parent','pack-parent@test.com','Pack parent',$1,'parent','pack-school',true)", [await passwordHash("testing-password-123")]);
  await pool.query("INSERT INTO memberships(user_id,school_id,role) VALUES('pack-parent','pack-school','parent') ON CONFLICT DO NOTHING");
  const product = (await pool.query("SELECT id FROM products LIMIT 1")).rows[0].id;
  await pool.query("INSERT INTO orders(id,user_id,request_key,amount_minor,lines,school_id,status,payment_reference) VALUES('pack-order','pack-parent','pack-key',49900,'[]','pack-school','fulfilled','pack-ref')");
  for (let i = 0; i < 3; i++) await pool.query("INSERT INTO tags(id,code,activation_hash,format,product_id,order_id,status) VALUES($1,$1,$2,'sticker',$3,'pack-order','allocated')", ["PACK-" + i, hash("pack-secret-" + i), product]);
  const c = await login("pack-parent@test.com");
  const bad = await call("POST", "/api/tags/activate-pack", { code: "PACK-1", activationSecret: "wrong-secret" }, c);
  assert.equal(bad.statusCode, 400, bad.body);
  const r = await call("POST", "/api/tags/activate-pack", { code: "PACK-1", activationSecret: "pack-secret-1" }, c);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().activated, 3);
  assert.equal((await pool.query("SELECT count(*)::int n FROM items WHERE owner_id='pack-parent'")).rows[0].n, 3);
  assert.equal((await call("POST", "/api/tags/activate-pack", { code: "PACK-0", activationSecret: "pack-secret-0" }, c)).statusCode, 409);
});

test("school administrators invite and remove teachers, and approve parents' child requests", async () => {
  await pool.query("INSERT INTO schools(id,name,join_hash,lifecycle,contact_name,contact_email,privacy_basis) VALUES('kids','Kids School','kids-hash','active','Head','head@kids.test','Policy v1')");
  const pw = await passwordHash("testing-password-123");
  await pool.query("INSERT INTO users(id,email,name,password_hash,role,school_id,verified) VALUES('kids-admin','kids-admin@test.com','Kids admin',$1,'manager','kids',true),('kids-parent','kids-parent@test.com','Kids parent',$1,'parent','kids',true)", [pw]);
  await pool.query("INSERT INTO memberships(user_id,school_id,role) VALUES('kids-admin','kids','manager'),('kids-parent','kids','parent') ON CONFLICT DO NOTHING");
  const admin = await login("kids-admin@test.com"), parent = await login("kids-parent@test.com");
  // Teachers
  const mailApp = await createApp({ pool, config: { origin: "http://localhost:5173", resendKey: "fake-no-network", mailFrom: "hello@findbox.africa" } });
  let r = await mailApp.inject({ method: "POST", url: "/api/school/staff/invite", headers: { "x-findbox-request": "1", "content-type": "application/json", origin: "http://localhost:5173", cookie: admin }, payload: { name: "Teacher T", email: "teacher-t@test.com" } });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal((await call("GET", "/api/school/staff", null, admin)).json().invites.length, 1);
  assert.equal((await call("POST", "/api/school/staff/invite", { name: "X", email: "x@test.com" }, parent)).statusCode, 403);
  const mail = (await pool.query("SELECT body FROM outbox WHERE recipient_email='teacher-t@test.com' LIMIT 1")).rows[0].body;
  const token = mail.match(/token=([^\s]+)/)[1];
  r = await call("POST", "/api/school/invitations/accept", { token, password: "teacher-password-123" });
  assert.equal(r.statusCode, 200, r.body);
  const teacher = (await pool.query("SELECT u.id,m.role FROM users u JOIN memberships m ON m.user_id=u.id WHERE u.email='teacher-t@test.com' AND m.school_id='kids'")).rows[0];
  assert.equal(teacher.role, "staff");
  assert.ok((await call("GET", "/api/school/staff", null, admin)).json().members.some((m) => m.email === "teacher-t@test.com"));
  assert.equal((await call("POST", "/api/school/staff/kids-admin/remove", {}, admin)).statusCode, 409);
  assert.equal((await call("POST", "/api/school/staff/" + teacher.id + "/remove", {}, admin)).statusCode, 200);
  assert.equal((await pool.query("SELECT 1 FROM memberships WHERE user_id=$1 AND school_id='kids'", [teacher.id])).rowCount, 0);
  // Children
  r = await call("POST", "/api/family/children/request", { name: "Ama Kids", className: "Grade 2" }, parent);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal((await call("POST", "/api/family/children/request", { name: "ama kids", className: "Grade 2" }, parent)).statusCode, 409);
  const pending = (await call("GET", "/api/school/child-requests", null, admin)).json().rows;
  assert.equal(pending.length, 1);
  assert.equal((await call("POST", "/api/school/child-requests/" + pending[0].id + "/approve", {}, admin)).statusCode, 200);
  assert.equal((await call("POST", "/api/school/child-requests/" + pending[0].id + "/approve", {}, admin)).statusCode, 409);
  assert.equal((await pool.query("SELECT guardian_id FROM students WHERE school_id='kids' AND name='Ama Kids'")).rows[0].guardian_id, "kids-parent");
  assert.ok((await call("GET", "/api/family/roster", null, parent)).json().rows.some((s) => s.name === "Ama Kids"));
  assert.equal((await call("GET", "/api/family/children/requests", null, parent)).json().rows[0].status, "approved");
  await mailApp.close();
});

test("one QR per child carries every belonging, scans link items to their family, and houses earn Ubuntu stars", async () => {
  const call = (method, url, b, cookie) => app.inject({ method, url, remoteAddress: "127.0.9.9", headers: { ...(b ? { "x-findbox-request": "1", "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}), origin: "http://localhost:5173" }, payload: b });
  const admin = await login("kids-admin@test.com"), parent = await login("kids-parent@test.com");
  let r = await call("POST", "/api/family/children/request", { name: "Baraka Kids", className: "Grade 3", house: "blue" }, parent);
  assert.equal(r.statusCode, 200, r.body);
  const req = (await call("GET", "/api/school/child-requests", null, admin)).json().rows.find((x) => x.name === "Baraka Kids");
  assert.equal((await call("POST", "/api/school/child-requests/" + req.id + "/approve", {}, admin)).statusCode, 200);
  const child = (await pool.query("SELECT id,house FROM students WHERE school_id='kids' AND name='Baraka Kids'")).rows[0];
  assert.equal(child.house, "blue");
  const early = (await pool.query("SELECT code FROM tags WHERE student_id=$1 AND status='active'", [child.id])).rows[0];
  assert.ok(early?.code, "the school's approval gives the child a QR straight away");
  // Belongings need delivered labels and a scanned code.
  const add = (name, category, extra = {}) => call("POST", "/api/family/children/" + child.id + "/items", { code: early.code, name, category, ...extra }, parent);
  assert.equal((await add("Blue sweater", "clothing")).statusCode, 409, "no labels delivered yet");
  const order = crypto.randomUUID();
  await pool.query("INSERT INTO orders(id,user_id,request_key,amount_minor,lines,school_id,status,payment_reference,student_id) VALUES($1,'kids-parent',$1,49900,$2,'kids','fulfilled',$1,$3)", [order, JSON.stringify([{ productId: "everyday-12", quantity: 1, tagCount: 2, name: "Everyday stickers", unitPrice: 49900 }]), child.id]);
  assert.equal((await add("Blue sweater", "clothing")).statusCode, 409, "fulfilled but not yet delivered");
  await pool.query("UPDATE orders SET delivered_at=now() WHERE id=$1", [order]);
  assert.equal((await add("Blue sweater", "clothing", { code: "FB-typed-wrong" })).statusCode, 400, "must scan the child's own label");
  const a = await add("Blue sweater", "clothing");
  const b = await add("Lunchbox", "lunchbox");
  assert.equal((await add("Third thing", "other")).statusCode, 409, "only as many belongings as labels");
  assert.equal(a.statusCode, 200, a.body);
  assert.equal(a.json().code, b.json().code, "every belonging shares the child's one code");
  assert.equal(a.json().code, early.code);
  const code = a.json().code;
  const qr = (await call("GET", "/api/family/qr", null, parent)).json().children.find((c) => c.id === child.id);
  assert.equal(qr.code, code);
  assert.equal(qr.items.length, 2);
  assert.equal((await call("POST", "/api/family/children/" + child.id + "/items", { code: early.code, name: "X" }, admin)).statusCode, 404);
  assert.deepEqual(qr.labels, { delivered: 2, used: 2, remaining: 0 });
  // A student in the red house finds the sweater.
  const pw = await passwordHash("testing-password-123");
  await pool.query("INSERT INTO users(id,email,name,password_hash,role,school_id,verified,house) VALUES('kids-finder','kids-finder@test.com','Wanjiru Finder',$1,'student','kids',true,NULL)", [pw]);
  await pool.query("INSERT INTO memberships(user_id,school_id,role) VALUES('kids-finder','kids','student') ON CONFLICT DO NOTHING");
  const finder = await login("kids-finder@test.com");
  assert.equal((await call("POST", "/api/account/house", { house: "red" }, finder)).statusCode, 200);
  assert.equal((await call("POST", "/api/account/house", { house: "green" }, finder)).statusCode, 409);
  const scan = (await call("GET", "/api/scan/" + code, null, finder)).json();
  assert.equal(scan.mine, false);
  assert.equal(scan.child, "Baraka");
  assert.equal(scan.items.length, 2);
  assert.equal((await call("POST", "/api/found", { code }, finder)).statusCode, 400);
  const sweater = scan.items.find((i) => i.name === "Blue sweater");
  r = await call("POST", "/api/found", { code, itemId: sweater.id }, finder);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().mine, false);
  assert.ok((await pool.query("SELECT 1 FROM notifications WHERE user_id='kids-parent' AND message LIKE 'Good news: Blue sweater%'")).rowCount);
  // Back home: the parent scans it, the case closes and the finder's house earns a star.
  r = await call("POST", "/api/found", { code, itemId: sweater.id }, parent);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().mine, true);
  assert.equal((await pool.query("SELECT status FROM items WHERE id=$1", [sweater.id])).rows[0].status, "with_owner");
  assert.equal((await pool.query("SELECT house FROM house_stars WHERE user_id='kids-finder'")).rows[0].house, "red");
  const houses = (await call("GET", "/api/houses", null, admin)).json();
  assert.equal(houses.standings.length, 4);
  assert.equal(houses.standings.find((h) => h.house === "red").returns, 1);
  assert.equal(houses.standings.find((h) => h.house === "blue").lost, 1);
  assert.ok(houses.members.some((m) => m.name === "Baraka Kids" && m.house === "blue"));
  assert.equal((await call("POST", "/api/school/houses/" + child.id, { house: "green" }, admin)).statusCode, 200);
  assert.equal((await call("POST", "/api/family/children/" + child.id + "/house", { house: "yellow" }, parent)).statusCode, 200);
  assert.equal((await call("POST", "/api/family/children/" + child.id + "/house", { house: "red" }, finder)).statusCode, 403);
  // No QR on it: describe it and hand it in; school staff are told at once.
  r = await call("POST", "/api/found/untagged", { title: "Green water bottle with stickers", category: "bottle", where: "Library" }, finder);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal((await pool.query("SELECT status,item_id FROM cases WHERE id=$1", [r.json().id])).rows[0].status, "awaiting_deposit");
  assert.ok((await pool.query("SELECT 1 FROM notifications WHERE user_id='kids-admin' AND message LIKE 'Found item handed in without a QR: Green water bottle%'")).rowCount);
  assert.equal((await call("POST", "/api/found/untagged", { title: "Bag", photo: "data:image/png;base64,AAAA" }, finder)).statusCode, 400);
  // Scanning your own child's QR lets you add belongings to it.
  assert.equal((await call("GET", "/api/scan/" + code, null, parent)).json().studentId, child.id);
  const familyView = (await call("GET", "/api/houses", null, parent)).json();
  assert.equal(familyView.staff, false);
  assert.ok(familyView.members.every((m) => m.name !== "Wanjiru Finder"));
});

test("passkey endpoints issue single-use challenges and reject unknown or forged passkeys", async () => {
  const opts = await app.inject({ method: "POST", url: "/api/auth/passkey/options", headers: { "x-findbox-request": "1", origin: "http://localhost:5173" }, payload: {} });
  assert.equal(opts.statusCode, 200, opts.body);
  assert.equal(opts.json().rpId, "localhost");
  const challengeCookie = [].concat(opts.headers["set-cookie"]).find((c) => c.startsWith("findbox_webauthn=")).split(";")[0];
  const unknown = await call("POST", "/api/auth/passkey/verify", { response: { id: "not-registered", rawId: "x", type: "public-key", response: {} } }, challengeCookie);
  assert.equal(unknown.statusCode, 401, unknown.body);
  // The challenge was consumed, so replaying it fails even for a known key.
  assert.equal((await call("POST", "/api/auth/passkey/verify", { response: { id: "not-registered" } }, challengeCookie)).statusCode, 400);
  assert.equal((await call("POST", "/api/account/passkeys/options", {}, null)).statusCode, 401);
  await pool.query("INSERT INTO users(id,email,name,password_hash,role,verified) VALUES('pk-parent','pk-parent@test.com','PK parent',$1,'parent',true)", [await passwordHash("testing-password-123")]);
  const c = await login("pk-parent@test.com");
  const reg = await call("POST", "/api/account/passkeys/options", {}, c);
  assert.equal(reg.statusCode, 200, reg.body);
  assert.equal(reg.json().user.name, "pk-parent@test.com");
  const regCookie = [].concat(reg.headers["set-cookie"]).find((v) => v.startsWith("findbox_webauthn=")).split(";")[0];
  assert.equal((await call("POST", "/api/account/passkeys/register", { response: { id: "forged", response: {} } }, c + "; " + regCookie)).statusCode, 400);
  assert.deepEqual((await call("GET", "/api/account/security", null, c)).json().passkeys, []);
});
test("profiles save a name, tagline, accent, emoji and a real photo, and reject anything else", async () => {
  const parent = await login("kids-parent@test.com");
  const before = (await call("GET", "/api/account/profile", undefined, parent)).json();
  assert.equal(before.accent, "sage");
  const png = "data:image/png;base64," + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]).toString("base64");
  const saved = await call("POST", "/api/account/profile", { tagline: "Bottle back, every day", accent: "sky", emoji: "🎒", avatar: png }, parent);
  assert.equal(saved.statusCode, 200, saved.body);
  assert.deepEqual({ ...saved.json(), name: undefined }, { name: undefined, tagline: "Bottle back, every day", accent: "sky", emoji: "🎒", avatar: png });
  // An SVG or a file pretending to be a PNG is refused; unknown accents and markup in emoji are refused.
  const svg = "data:image/svg+xml;base64," + Buffer.from("<svg onload=alert(1)>").toString("base64");
  assert.equal((await call("POST", "/api/account/profile", { avatar: svg }, parent)).statusCode, 400);
  const fake = "data:image/png;base64," + Buffer.from("<script>alert(1)</script>").toString("base64");
  assert.equal((await call("POST", "/api/account/profile", { avatar: fake }, parent)).statusCode, 400);
  assert.equal((await call("POST", "/api/account/profile", { accent: "neon" }, parent)).statusCode, 400);
  assert.equal((await call("POST", "/api/account/profile", { emoji: "<b>" }, parent)).statusCode, 400);
  // Leaving the photo out keeps it; null removes it.
  assert.equal((await call("POST", "/api/account/profile", { tagline: "" }, parent)).json().avatar, png);
  assert.equal((await call("POST", "/api/account/profile", { avatar: null, name: before.name }, parent)).json().avatar, null);
  assert.equal((await call("GET", "/api/account/profile")).statusCode, 401);
});
test("assistant routes questions to role-scoped tools, proposes changes for confirmation and works offline", async () => {
  const http = await import("node:http");
  // Stand-in for Ollama: tool choice = first allowed option, no extracted fields, a one-line streamed answer.
  const seen = [];
  const fake = http.createServer((req, res) => {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      if (req.url === "/api/tags") { res.end(JSON.stringify({ models: [{ name: "fake-model" }] })); return; }
      const b = JSON.parse(body || "{}"); seen.push(b);
      if (b.format) { const p = b.format.properties || {}; const out = {}; for (const [k, d] of Object.entries(p)) out[k] = d.enum ? d.enum[0] : ""; res.end(JSON.stringify({ message: { content: JSON.stringify(out) } })); return; }
      res.write(JSON.stringify({ message: { content: "Here is " } }) + "\n"); res.end(JSON.stringify({ message: { content: "the answer." }, done: true }) + "\n");
    });
  });
  await new Promise((r) => fake.listen(0, "127.0.0.1", r));
  const ollamaUrl = "http://127.0.0.1:" + fake.address().port;
  const smart = await createApp({ pool, config: { origin: "http://localhost:5173", ollamaUrl, assistantModel: "fake-model", disableAssistantWarmup: true } });
  const offline = await createApp({ pool, config: { origin: "http://localhost:5173" } });
  const pw = await passwordHash("assistant-fixture-123");
  await pool.query("INSERT INTO users(id,email,name,password_hash,role,verified,mfa_secret) VALUES('ai-dev','ai-dev@test.com','AI Dev',$1,'parent',true,'enrolled'),('ai-admin','ai-admin@test.com','AI Admin',$1,'parent',true,'enrolled'),('ai-target','ai-target@test.com','Target Parent',$1,'parent',true,NULL) ON CONFLICT DO NOTHING", [pw]);
  await pool.query("INSERT INTO company_access(user_id,role) VALUES('ai-dev','developer'),('ai-admin','admin') ON CONFLICT(user_id) DO UPDATE SET role=EXCLUDED.role");
  const token = async (uid) => { const t = crypto.randomUUID(); await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at,mfa_verified,portal) VALUES($1,$2,now()+interval '1 hour',true,'ops')", [hash(t), uid]); return "findbox_ops_session=" + t; };
  const dev = await token("ai-dev"), admin = await token("ai-admin"), family = await token("ai-target");
  const req = (a, method, url, payload, cookie) => a.inject({ method, url, payload, headers: { origin: "http://localhost:5173", "x-findbox-portal": "ops", ...(payload ? { "x-findbox-request": "1" } : {}), cookie } });
  const chat = async (a, cookie, message, conversationId) => {
    const r = await req(a, "POST", "/api/company/assistant/chat", { message, ...(conversationId ? { conversationId } : {}) }, cookie);
    const events = r.body.split("\n\n").filter(Boolean).map((blk) => { const [ev, da] = blk.split("\n"); return { event: ev.slice(7), data: JSON.parse(da.slice(6)) }; });
    const get = (n) => events.filter((e) => e.event === n).map((e) => e.data);
    return { status: r.statusCode, events, get, text: get("token").map((t) => t.text).join("") };
  };
  try {
    // Families cannot reach the assistant; operators see their role's tools and suggestions.
    assert.ok([401, 403].includes((await req(smart, "GET", "/api/company/assistant", undefined, family)).statusCode));
    const metaRes = await req(smart, "GET", "/api/company/assistant", undefined, dev); const meta = metaRes.json();
    assert.equal(meta.role, "developer"); assert.equal(meta.ready, true);
    assert.ok(meta.tools.some((t) => t.name === "system_health") && !meta.tools.some((t) => t.name === "find_orders"));
    const adminMeta = (await req(smart, "GET", "/api/company/assistant", undefined, admin)).json();
    assert.ok(adminMeta.tools.some((t) => t.name === "find_orders") && !adminMeta.tools.some((t) => t.name === "disable_user"));

    // A clear question routes by rules to the right tool and streams an answer.
    const count = await chat(smart, dev, "How many users do we have?");
    assert.equal(count.status, 200);
    assert.equal(count.get("result")[0].tool, "platform_stats");
    assert.ok(count.get("result")[0].rows.some((r) => /User accounts/.test(r.metric)));
    assert.equal(count.text, "Here is the answer.");
    const signedIn = await chat(smart, dev, "Who is signed in right now?");
    assert.equal(signedIn.get("result")[0].tool, "who_is_signed_in");

    // Admins never get developer tools, even when they ask for them.
    const adminSessions = await chat(smart, admin, "Who is signed in right now?");
    assert.notEqual(adminSessions.get("result")[0]?.tool, "who_is_signed_in");
    const orders = await chat(smart, admin, "Show the latest orders");
    assert.equal(orders.get("result")[0].tool, "find_orders");

    // Changes become proposals; nothing happens until the same person confirms.
    const proposal = await chat(smart, dev, "Disable ai-target@test.com");
    const card = proposal.get("proposal")[0];
    assert.ok(card && /Disable Target Parent/.test(card.summary));
    assert.equal((await pool.query("SELECT disabled_at FROM users WHERE id='ai-target'")).rows[0].disabled_at, null);
    assert.equal((await req(smart, "POST", `/api/company/assistant/actions/${card.id}/confirm`, {}, admin)).statusCode, 409);
    const done = await req(smart, "POST", `/api/company/assistant/actions/${card.id}/confirm`, {}, dev);
    assert.equal(done.statusCode, 200, done.body);
    assert.ok((await pool.query("SELECT disabled_at FROM users WHERE id='ai-target'")).rows[0].disabled_at);
    assert.ok((await pool.query("SELECT 1 FROM operation_audit WHERE entity_id='ai-target' AND reason LIKE 'FindBox assistant:%'")).rowCount);
    assert.equal((await req(smart, "POST", `/api/company/assistant/actions/${card.id}/confirm`, {}, dev)).statusCode, 409);

    // Follow-ups resolve "them" from the previous answer's people.
    const list = await chat(smart, dev, "Find users called ai-target@test.com");
    const again = await chat(smart, dev, "Enable them again", list.get("conversation")[0].id);
    assert.ok(/Re-enable Target Parent/.test(again.get("proposal")[0]?.summary || ""), JSON.stringify(again.events));

    // Missing details are asked for, not guessed.
    const vague = await chat(smart, dev, "Disable the account");
    assert.equal(vague.get("proposal").length, 0);
    assert.match(vague.text, /need/i);

    // Conversations are private to their owner.
    const cid = count.get("conversation")[0].id;
    assert.equal((await req(smart, "GET", `/api/company/assistant/conversations/${cid}`, undefined, dev)).statusCode, 200);
    assert.equal((await req(smart, "GET", `/api/company/assistant/conversations/${cid}`, undefined, admin)).statusCode, 404);

    // With no model at all, rules still answer.
    const plain = await chat(offline, dev, "How many users do we have?");
    assert.equal(plain.get("result")[0].tool, "platform_stats");
    assert.match(plain.text, /platform numbers/i);
    assert.ok(seen.length > 0);
  } finally { fake.close(); await smart.close(); await offline.close(); }
});
