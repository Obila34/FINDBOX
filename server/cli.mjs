import { connect, migrate, seedCatalog, transaction } from "./db.mjs";
import { id, secret, hash, passwordHash, requireThat } from "./security.mjs";
import { fulfill } from "./fulfillment.mjs";
import { mkdir, writeFile } from "node:fs/promises";
const pool = connect();
const [command, ...args] = process.argv.slice(2);
try {
  if (['school','staff'].includes(command)) {
    const actor=(await pool.query("SELECT u.id FROM users u JOIN company_access c ON c.user_id=u.id WHERE u.email=$1 AND c.role='developer' AND u.disabled_at IS NULL AND u.verified",[process.env.FINDBOX_OPERATOR_EMAIL||''])).rows[0];
    requireThat(actor,403,'A registered developer actor is required: set FINDBOX_OPERATOR_EMAIL. Prefer the audited developer invitation workflow.');
    requireThat(command!=='staff' || args[3]!=='manager',403,'Create school administrators through developer invitations, not password-based CLI provisioning');
  }
  if (command === "migrate") {
    await migrate(pool);
    await seedCatalog(pool);
    console.log("Schema and catalog ready.");
  } else if (command === "company") {
    const [email, name, role] = args;
    requireThat(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && name && ['admin','developer'].includes(role), 400, 'Usage: company email name admin|developer; INITIAL_PASSWORD required for new accounts');
    await transaction(pool, async db => {
      let u = (await db.query('SELECT * FROM users WHERE email=$1 FOR UPDATE', [email.toLowerCase()])).rows[0];
      if (!u) {
        requireThat(process.env.INITIAL_PASSWORD?.length >= 16,400,'Set INITIAL_PASSWORD to at least 16 characters');
        u = (await db.query("INSERT INTO users(id,email,name,password_hash,role,verified) VALUES($1,$2,$3,$4,'parent',true) RETURNING *", [id(),email.toLowerCase(),name,await passwordHash(process.env.INITIAL_PASSWORD)])).rows[0];
      }
      requireThat(u.role !== 'student' && u.verified,403,'Only verified adult accounts can receive company access');
      await db.query('INSERT INTO company_access(user_id,role) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET role=EXCLUDED.role', [u.id,role]);
      await db.query('DELETE FROM sessions WHERE user_id=$1',[u.id]);
      await db.query('DELETE FROM company_email_challenges WHERE user_id=$1',[u.id]);
      await db.query('INSERT INTO audit_log(id,user_id,action) VALUES($1,$2,$3)',[id(),u.id,'company_access_granted_'+role]);
    });
    console.log('Company account provisioned. Two-factor enrollment required.');
  } else if (command === "company-password") {
    requireThat(args[0] && process.env.INITIAL_PASSWORD?.length>=16 && process.env.INITIAL_PASSWORD.length<=128,400,'Company email and INITIAL_PASSWORD (16–128 characters) required');
    await transaction(pool,async db=>{
      const u=(await db.query('SELECT u.id FROM users u JOIN company_access c ON c.user_id=u.id WHERE u.email=$1 FOR UPDATE OF u',[args[0].toLowerCase()])).rows[0];
      requireThat(u,404,'Company account not found');
      await db.query('UPDATE users SET password_hash=$1 WHERE id=$2',[await passwordHash(process.env.INITIAL_PASSWORD),u.id]);
      await db.query('DELETE FROM sessions WHERE user_id=$1',[u.id]);
      await db.query('DELETE FROM company_email_challenges WHERE user_id=$1',[u.id]);
      await db.query('INSERT INTO audit_log(id,user_id,action) VALUES($1,$2,$3)',[id(),u.id,'company_password_changed_by_operator']);
    });
    console.log('Password updated; all sessions revoked.');
  } else if (command === "company-revoke") {
    requireThat(args[0],400,'Usage: company-revoke email');
    await transaction(pool, async db => {
      const u=(await db.query('SELECT id FROM users WHERE email=$1',[args[0].toLowerCase()])).rows[0];
      requireThat(u,404,'Account not found');
      await db.query('DELETE FROM company_access WHERE user_id=$1',[u.id]);
      await db.query('DELETE FROM sessions WHERE user_id=$1',[u.id]);
      await db.query('DELETE FROM company_email_challenges WHERE user_id=$1',[u.id]);
      await db.query('INSERT INTO audit_log(id,user_id,action) VALUES($1,$2,$3)',[id(),u.id,'company_access_revoked']);
    });
    console.log('Company access revoked and sessions invalidated.');
  } else if (command === "school") {
    const [name, boxName, directions, hours] = args;
    requireThat(
      name && boxName && directions && hours,
      400,
      'Usage: school "School name" "Box name" "Directions" "Opening hours"',
    );
    const schoolId = id(),
      joinCode = secret().slice(0, 16);
    await transaction(pool, async (db) => {
      await db.query(
        "INSERT INTO schools(id,name,join_hash) VALUES($1,$2,$3)",
        [schoolId, name, hash(joinCode)],
      );
      await db.query(
        "INSERT INTO boxes(id,school_id,name,directions,opening_hours) VALUES($1,$2,$3,$4,$5)",
        [id(), schoolId, boxName, directions, hours],
      );
    });
    console.log(JSON.stringify({ schoolId, joinCode }));
  } else if (command === "staff") {
    const [email, name, schoolId, role = "staff"] = args;
    requireThat(
      email &&
        name &&
        schoolId &&
        ["staff", "manager"].includes(role) &&
        process.env.INITIAL_PASSWORD?.length >= 12,
      400,
      "Set INITIAL_PASSWORD (12+ chars), then: staff email name schoolId [staff|manager]",
    );
    await pool.query(
      "INSERT INTO users(id,email,name,password_hash,role,school_id,verified) VALUES($1,$2,$3,$4,$5,$6,true)",
      [
        id(),
        email.toLowerCase(),
        name,
        await passwordHash(process.env.INITIAL_PASSWORD),
        role,
        schoolId,
      ],
    );
    console.log("Staff account created.");
  } else if (command === "box") {
    const [schoolId, name, directions, hours] = args;
    requireThat(
      schoolId && name && directions && hours,
      400,
      "Usage: box schoolId name directions hours",
    );
    await pool.query(
      "INSERT INTO boxes(id,school_id,name,directions,opening_hours) VALUES($1,$2,$3,$4,$5)",
      [id(), schoolId, name, directions, hours],
    );
    console.log("Box created.");
  } else if (command === "batch") {
    const [productId, countText] = args;
    const count = Number(countText);
    requireThat(
      Number.isInteger(count) && count > 0 && count <= 10000,
      400,
      "Batch size must be 1â€“10000",
    );
    const product = (
      await pool.query("SELECT * FROM products WHERE id=$1", [productId])
    ).rows[0];
    requireThat(product, 404, "Product not found");
    requireThat(product.format !== "mixed" || count % 41 === 0, 400, "Complete kits must be generated in multiples of 41 tags");
    const kitFormats=[...Array(20).fill("sticker"),...Array(20).fill("fabric")];
    const codes = [];
    await transaction(pool, async (db) => {
      for (let i = 0; i < count; i++) {
        const tagId = id(),
          code = "FB-" + secret().slice(0, 18),
          activationSecret = secret().slice(0, 24);
        await db.query(
          "INSERT INTO tags(id,code,activation_hash,format,product_id) VALUES($1,$2,$3,$4,$5)",
          [tagId, code, hash(activationSecret), product.format === "mixed" ? kitFormats[i % 40] : product.format, product.id],
        );
        codes.push({
          format: product.format === "mixed" ? kitFormats[i % 40] : product.format,
          code,
          activationSecret,
          qrUrl:
            (process.env.APP_ORIGIN || "http://localhost:5173") + "/t/" + code,
        });
      }
      await mkdir("private-exports", { recursive: true });
      const file = "private-exports/" + Date.now() + "-" + productId + ".json";
      await writeFile(file, JSON.stringify(codes, null, 2), {
        mode: 0o600,
        flag: "wx",
      });
      console.log("Private print export: " + file);
    });
  } else if (command === "fulfill") {
    console.log(await fulfill(pool, args[0]));
  } else if (command === "orders") {
    console.log(
      JSON.stringify(
        (
          await pool.query(
            "SELECT id,status,amount_minor,lines,school_id FROM orders WHERE status IN ('paid','fulfilled') ORDER BY created_at DESC LIMIT 100",
          )
        ).rows,
        null,
        2,
      ),
    );
  } else if (command === "packing-list") {
    console.log(
      JSON.stringify(
        (
          await pool.query(
            "SELECT t.code,t.format,p.name FROM tags t JOIN products p ON p.id=t.product_id WHERE t.order_id=$1",
            [args[0]],
          )
        ).rows,
        null,
        2,
      ),
    );
  } else
    throw new Error(
      "Commands: migrate, school, staff, box, batch, orders, fulfill, packing-list",
    );
} finally {
  await pool.end();
}
