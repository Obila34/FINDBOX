// Explicit LOCAL fixture server. Never imported by the production entry point.
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { migrate, seedCatalog } from "./db.mjs";
import { passwordHash, hash } from "./security.mjs";
import { createApp } from "./app.mjs";
if (process.env.NODE_ENV === "production")
  throw new Error("Local fixtures cannot run in production");
const password = randomBytes(24).toString("hex");
const postgres = new EmbeddedPostgres({
  databaseDir: resolve("tmp/pg-preview-" + Date.now()),
  user: "findbox",
  password,
  port: Number(process.env.PREVIEW_DB_PORT || 55440),
  persistent: false,
  authMethod: "scram-sha-256",
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
await postgres.initialise();
await postgres.start();
await postgres.createDatabase("findbox_preview");
const pool = new pg.Pool({
  connectionString: `postgres://findbox:${password}@127.0.0.1:${process.env.PREVIEW_DB_PORT || 55440}/findbox_preview`,
});
await migrate(pool);
await seedCatalog(pool);
await pool.query("INSERT INTO schools(id,name,join_hash) VALUES($1,$2,$3)", [
  "preview-school",
  "Riverside Academy",
  hash("RIVERSIDE"),
]);
const pw = await passwordHash("FindBox-preview-2026");
for (const [uid, name, email, role] of [
  ["preview-parent", "Maya Otieno", "parent@findbox.test", "parent"],
  ["preview-student", "Amani Otieno", "student@findbox.test", "student"],
  ["preview-staff", "Daniel Kimani", "teacher@findbox.test", "staff"],
])
  await pool.query(
    "INSERT INTO users(id,name,email,password_hash,role,school_id,verified) VALUES($1,$2,$3,$4,$5,$6,true)",
    [uid, name, email, pw, role, "preview-school"],
  );
await pool.query(
  "UPDATE users SET guardian_id='preview-parent' WHERE id='preview-student'",
);
for (const [bid, name, directions, hours] of [
  [
    "office",
    "The welcome box",
    "Reception, beside the main entrance. Ask the office custodian.",
    "Mon–Fri, 7:30 am – 4:30 pm",
  ],
  [
    "library",
    "The reading corner",
    "Library desk, ground floor.",
    "Mon–Fri, 8 am – 4 pm",
  ],
  [
    "sports",
    "The playing field",
    "Sports office, next to changing rooms.",
    "Mon–Fri, 8 am – 5 pm",
  ],
])
  await pool.query(
    "INSERT INTO boxes(id,school_id,name,directions,opening_hours) VALUES($1,$2,$3,$4,$5)",
    [bid, "preview-school", name, directions, hours],
  );
await pool.query(
  "INSERT INTO orders(id,user_id,request_key,amount_minor,lines,school_id,status,payment_reference) VALUES('preview-order','preview-parent','local-fixture',49900,$1,'preview-school','fulfilled','LOCAL-NOT-A-PAYMENT')",
  [
    JSON.stringify([
      {
        productId: "everyday-12",
        name: "Everyday labels",
        quantity: 1,
        tagCount: 12,
        unitPrice: 49900,
      },
    ]),
  ],
);
for (let i = 0; i < 12; i++)
  await pool.query(
    "INSERT INTO tags(id,code,activation_hash,format,product_id,order_id,status,owner_id) VALUES($1,$2,$3,'sticker','everyday-12','preview-order',$4,'preview-parent')",
    [
      "preview-tag-" + i,
      "FB-PREVIEW-" + i,
      hash("ACTIVATE-" + i),
      i < 3 ? "active" : "allocated",
    ],
  );
for (const [i, name, category, color] of [
  [0, "The everyday bottle", "bottle", "Forest green"],
  [1, "Favourite school sweater", "clothing", "Sage green"],
  [2, "A little lunch companion", "lunchbox", "Sunny yellow"],
])
  await pool.query(
    "INSERT INTO items(id,tag_id,owner_id,school_id,name,category,child_name,color,status) VALUES($1,$2,'preview-student','preview-school',$3,$4,'Amani',$5,$6)",
    [
      "preview-item-" + i,
      "preview-tag-" + i,
      name,
      category,
      color,
      i === 1 ? "awaiting_collection" : "with_owner",
    ],
  );
await pool.query(
  "INSERT INTO cases(id,school_id,item_id,box_id,title,category,status,due_at) VALUES('preview-case','preview-school','preview-item-1','office','Favourite school sweater','clothing','awaiting_collection',$1)",
  [new Date(Date.now() + 3 * 86400000)],
);
await pool.query(
  "INSERT INTO notifications(id,user_id,message) VALUES('preview-note','preview-parent','Good news. Amani’s sweater is ready to collect at The welcome box. Bring your account details so staff can verify the handover.')",
);
const app = await createApp({ pool, config:{supportAdminIds:["preview-staff"],encryptionKey:randomBytes(32).toString("base64"),origin:process.env.APP_ORIGIN||"http://localhost:5173"} });
await app.listen({ port: Number(process.env.PORT || 3001), host: "127.0.0.1" });
console.log(
  "Local fixture API: http://127.0.0.1:3001. See docs/PLATFORM.md for sample accounts.",
);
async function stop() {
  await app.close();
  await pool.end();
  await postgres.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
