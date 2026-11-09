import { z } from "zod";
import { id, secret, hash, requireThat } from "./security.mjs";
import { transaction } from "./db.mjs";
import { notify } from "./worker.mjs";

// One QR per child, houses and "I found it".
//  - Every child has one code. It is printed, with their name, on every sticker and fabric label, and each of
//    the child's belongings hangs off that code.
//  - Students belong to a house: green, red, blue or yellow. Houses earn Ubuntu stars when members return
//    other people's things, and a star for every member-week with nothing lost; lost items take points off.
//  - Anyone in the school can scan a code: their own item comes straight back to "with you", anything else is
//    linked to its owner, whose family is told at once.

export const HOUSES = ["green", "red", "blue", "yellow"];
export const HOUSE_NAMES = { green: "Green", red: "Red", blue: "Blue", yellow: "Yellow" };
const house = z.enum(HOUSES);
const categories = z.enum(["bottle", "book", "clothing", "lunchbox", "keys", "sports", "electronics", "other"]);
const WINDOW_DAYS = 90;
const WEEK = 7 * 864e5;
const firstName = (name = "") => name.trim().split(/\s+/)[0] || "";

/** The child's code, created on first use. Codes carry no personal data. */
export async function childCode(db, child, ownerId) {
  const existing = (await db.query("SELECT * FROM tags WHERE student_id=$1 AND status='active'", [child.id])).rows[0];
  if (existing) return existing;
  const code = "FB-" + secret().slice(0, 18);
  return (await db.query(
    "INSERT INTO tags(id,code,activation_hash,format,product_id,owner_id,status,student_id) VALUES($1,$2,$3,'child',NULL,$4,'active',$5) RETURNING *",
    [id(), code, hash(secret()), ownerId, child.id],
  )).rows[0];
}

/** Children the signed-in person looks after: a parent's linked children, or a student themself. */
async function myChildren(db, u) {
  if (u.role === "student") return (await db.query("SELECT * FROM students WHERE user_id=$1 AND status='active'", [u.id])).rows;
  return (await db.query("SELECT * FROM students WHERE guardian_id=$1 AND status='active' ORDER BY name", [u.id])).rows;
}

async function myChild(db, u, studentId) {
  const child = (await myChildren(db, u)).find((c) => c.id === studentId);
  requireThat(child, 404, "This child is not linked to your account");
  return child;
}

/** True when the item belongs to the scanner's own family. */
async function isMine(db, u, item) {
  if (item.owner_id === u.id) return true;
  if (u.guardian_id && item.owner_id === u.guardian_id) return true;
  const r = await db.query(
    "SELECT 1 FROM users WHERE id=$1 AND guardian_id=$2 UNION ALL SELECT 1 FROM students WHERE id=$3 AND (guardian_id=$2 OR user_id=$2)",
    [item.owner_id, u.id, item.student_id],
  );
  return r.rowCount > 0;
}

/** A student's house: their school record first, then the house they picked on their own account. */
async function houseOf(db, userId) {
  const r = (await db.query(
    "SELECT COALESCE((SELECT house FROM students WHERE user_id=u.id AND status='active' LIMIT 1),u.house) AS house,u.role FROM users u WHERE u.id=$1",
    [userId],
  )).rows[0];
  return r?.role === "student" ? r.house : null;
}

/** Gives the finder's house an Ubuntu star once the item is safely back. One star per case. */
export async function awardStar(db, caseId) {
  const found = (await db.query(
    "SELECT e.actor_id,c.school_id,c.title FROM events e JOIN cases c ON c.id=e.case_id WHERE e.case_id=$1 AND e.action IN ('deposit_reported','found_direct') ORDER BY e.created_at LIMIT 1",
    [caseId],
  )).rows[0];
  if (!found?.actor_id) return null;
  const h = await houseOf(db, found.actor_id);
  if (!h) return null;
  await db.query(
    "INSERT INTO house_stars(id,school_id,house,user_id,case_id,reason) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (case_id) DO NOTHING",
    [id(), found.school_id, h, found.actor_id, caseId, "Returned " + found.title],
  );
  return h;
}

/** House standings for one school over the last 90 days, scored per member so size alone does not win. */
export async function standings(db, schoolId, now = Date.now()) {
  const since = new Date(now - WINDOW_DAYS * 864e5);
  const members = (await db.query(
    `SELECT s.id AS member,s.user_id,s.house,s.created_at FROM students s WHERE s.school_id=$1 AND s.status='active' AND s.house IS NOT NULL
     UNION ALL
     SELECT 'u:'||u.id,u.id,u.house,u.created_at FROM users u JOIN memberships m ON m.user_id=u.id AND m.school_id=$1
      WHERE u.role='student' AND u.house IS NOT NULL AND u.disabled_at IS NULL AND NOT EXISTS(SELECT 1 FROM students s WHERE s.user_id=u.id AND s.status='active')`,
    [schoolId],
  )).rows;
  const lost = (await db.query(
    `SELECT c.created_at,i.student_id,i.owner_id FROM cases c JOIN items i ON i.id=c.item_id WHERE c.school_id=$1 AND c.created_at>=$2`,
    [schoolId, since],
  )).rows;
  const stars = (await db.query("SELECT house,count(*)::int AS n FROM house_stars WHERE school_id=$1 AND created_at>=$2 GROUP BY house", [schoolId, since])).rows;
  const byStudent = new Map(), byUser = new Map();
  for (const m of members) { if (!m.member.startsWith("u:")) byStudent.set(m.member, m); if (m.user_id) byUser.set(m.user_id, m); }
  const rows = Object.fromEntries(HOUSES.map((h) => [h, { house: h, name: HOUSE_NAMES[h], members: 0, returns: 0, cleanWeeks: 0, lost: 0 }]));
  const lostWeeks = new Map();
  for (const c of lost) {
    const m = (c.student_id && byStudent.get(c.student_id)) || byUser.get(c.owner_id);
    if (!m) continue;
    rows[m.house].lost++;
    const week = Math.floor((now - new Date(c.created_at).getTime()) / WEEK);
    if (!lostWeeks.has(m.member)) lostWeeks.set(m.member, new Set());
    lostWeeks.get(m.member).add(week);
  }
  for (const m of members) {
    const r = rows[m.house];
    r.members++;
    const from = Math.max(since.getTime(), new Date(m.created_at).getTime());
    const weeks = Math.floor((now - from) / WEEK);
    r.cleanWeeks += Math.max(0, weeks - (lostWeeks.get(m.member)?.size || 0));
  }
  for (const s of stars) if (rows[s.house]) rows[s.house].returns = s.n;
  const list = Object.values(rows).map((r) => {
    const stars = r.returns * 3 + r.cleanWeeks;
    const score = r.members ? Math.round(((stars - r.lost * 2) / r.members) * 10) / 10 : 0;
    return { ...r, stars, score };
  });
  list.sort((a, b) => b.score - a.score || a.lost - b.lost || b.stars - a.stars);
  return list.map((r, i) => ({ ...r, rank: i + 1 }));
}

export async function houseRoutes(app, { pool, user }) {
  const verified = async (req) => { const u = await user(req); requireThat(u.verified, 403, "Verify your email before continuing"); return u; };

  // ---- Child codes and belongings ----
  app.get("/api/family/qr", async (req) => {
    const u = await user(req);
    const children = await myChildren(pool, u);
    const out = [];
    for (const c of children) {
      const tag = (await pool.query("SELECT code FROM tags WHERE student_id=$1 AND status='active'", [c.id])).rows[0];
      const items = (await pool.query(
        "SELECT i.id,i.name,i.category,i.color,i.status,t.code FROM items i JOIN tags t ON t.id=i.tag_id WHERE i.student_id=$1 ORDER BY i.created_at",
        [c.id],
      )).rows;
      const school = (await pool.query("SELECT name FROM schools WHERE id=$1", [c.school_id])).rows[0]?.name || "";
      out.push({ id: c.id, name: c.name, className: c.class_name, school, house: c.house, code: tag?.code || null, items });
    }
    return { children: out };
  });

  app.post("/api/family/children/:id/qr", async (req) => {
    const u = await verified(req);
    return transaction(pool, async (db) => {
      const child = await myChild(db, u, req.params.id);
      const tag = await childCode(db, child, child.guardian_id || u.id);
      return { code: tag.code };
    });
  });

  app.post("/api/family/children/:id/items", async (req) => {
    const u = await verified(req);
    const d = z.object({ name: z.string().trim().min(1).max(100), category: categories.default("other"), color: z.string().trim().max(60).default("") }).strict().parse(req.body);
    return transaction(pool, async (db) => {
      const child = await myChild(db, u, req.params.id);
      const owner = child.guardian_id || u.id;
      const tag = await childCode(db, child, owner);
      const count = (await db.query("SELECT count(*)::int AS n FROM items WHERE student_id=$1", [child.id])).rows[0].n;
      requireThat(count < 200, 409, "This child already has 200 belongings listed");
      const itemId = id();
      await db.query(
        "INSERT INTO items(id,tag_id,owner_id,school_id,name,category,child_name,color,student_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [itemId, tag.id, owner, child.school_id, d.name, d.category, child.name, d.color, child.id],
      );
      return { id: itemId, code: tag.code };
    });
  });

  // ---- Houses ----
  app.post("/api/family/children/:id/house", async (req) => {
    const u = await verified(req);
    requireThat(u.role !== "student", 403, "Ask your parent or school to change your house");
    const d = z.object({ house }).strict().parse(req.body);
    return transaction(pool, async (db) => {
      const child = await myChild(db, u, req.params.id);
      await db.query("UPDATE students SET house=$1,revision=revision+1 WHERE id=$2", [d.house, child.id]);
      return { house: d.house };
    });
  });

  // A student picks their house once; after that only a parent or the school changes it.
  app.post("/api/account/house", async (req) => {
    const u = await user(req);
    requireThat(u.role === "student", 403, "Only students choose a house for themselves");
    const d = z.object({ house }).strict().parse(req.body);
    return transaction(pool, async (db) => {
      const current = await houseOf(db, u.id);
      requireThat(!current, 409, "You are already in a house. Ask your parent or school to change it.");
      const row = (await db.query("SELECT id FROM students WHERE user_id=$1 AND status='active' FOR UPDATE", [u.id])).rows[0];
      if (row) await db.query("UPDATE students SET house=$1,revision=revision+1 WHERE id=$2", [d.house, row.id]);
      else await db.query("UPDATE users SET house=$1 WHERE id=$2", [d.house, u.id]);
      return { house: d.house };
    });
  });

  app.get("/api/houses", async (req) => {
    const u = await user(req);
    requireThat(u.school_id, 409, "Join your school to see houses");
    const table = await standings(pool, u.school_id);
    const staffView = ["staff", "manager"].includes(u.role);
    let members = [];
    if (staffView) {
      members = (await pool.query(
        "SELECT id,name,class_name,house FROM students WHERE school_id=$1 AND status='active' ORDER BY house NULLS LAST,name LIMIT 2000",
        [u.school_id],
      )).rows;
    } else {
      members = (await myChildren(pool, u)).map((c) => ({ id: c.id, name: c.name, class_name: c.class_name, house: c.house }));
      if (u.role === "student" && !members.length) members = [{ id: "me", name: u.name, class_name: "", house: await houseOf(pool, u.id) }];
    }
    const myStars = (await pool.query("SELECT count(*)::int AS n FROM house_stars WHERE user_id=$1", [u.id])).rows[0].n;
    return { standings: table, members, staff: staffView, canChoose: u.role === "student" && !(await houseOf(pool, u.id)), myStars, windowDays: WINDOW_DAYS };
  });

  app.post("/api/school/houses/:studentId", async (req) => {
    const u = await verified(req);
    requireThat(["staff", "manager"].includes(u.role) && u.school_id, 403, "School staff access required");
    const d = z.object({ house: house.nullable() }).strict().parse(req.body);
    const r = await pool.query("UPDATE students SET house=$1,revision=revision+1 WHERE id=$2 AND school_id=$3", [d.house, req.params.studentId, u.school_id]);
    requireThat(r.rowCount, 404, "Student not found");
    return { house: d.house };
  });

  // ---- Scan: "I found it" ----
  app.get("/api/scan/:code", async (req) => {
    const u = await user(req);
    const tag = (await pool.query("SELECT t.*,s.name AS child FROM tags t LEFT JOIN students s ON s.id=t.student_id WHERE t.code=$1 AND t.status='active'", [req.params.code])).rows[0];
    requireThat(tag, 404, "We could not find that FindBox code. Check it and try again.");
    const items = (await pool.query(
      "SELECT i.*,(SELECT status FROM cases c WHERE c.item_id=i.id AND c.status NOT IN ('returned','closed') LIMIT 1) AS open_case FROM items i WHERE i.tag_id=$1 ORDER BY i.created_at",
      [tag.id],
    )).rows;
    requireThat(items.length, 404, "This code has no belongings yet.");
    const mine = await isMine(pool, u, items[0]);
    requireThat(mine || items[0].school_id === u.school_id, 404, "This code belongs to a different school. Hand the item to that school or its collection box.");
    const childName = tag.child || items[0].child_name || "";
    const boxes = (await pool.query("SELECT id,name,directions,opening_hours FROM boxes WHERE school_id=$1 AND active=true", [items[0].school_id])).rows;
    return {
      code: tag.code,
      mine,
      child: mine ? childName : firstName(childName),
      items: items.map((i) => ({ id: i.id, name: i.name, category: i.category, status: i.status, open: i.open_case })),
      boxes,
    };
  });

  app.post("/api/found", async (req) => {
    const u = await verified(req);
    const d = z.object({
      code: z.string().trim().min(1).max(100),
      itemId: z.string().max(100).default(""),
      boxId: z.string().max(100).default(""),
    }).parse(req.body);
    return transaction(pool, async (db) => {
      const tag = (await db.query("SELECT * FROM tags WHERE code=$1 AND status='active'", [d.code])).rows[0];
      requireThat(tag, 404, "Tag not found in your school");
      const items = (await db.query("SELECT * FROM items WHERE tag_id=$1 ORDER BY created_at FOR UPDATE", [tag.id])).rows;
      requireThat(items.length, 404, "Tag not found in your school");
      let item;
      if (d.itemId === "other") {
        // Something of the child's that was never listed: add it under their code so it can come home.
        const first = items[0];
        const itemId = id();
        await db.query(
          "INSERT INTO items(id,tag_id,owner_id,school_id,name,category,child_name,student_id) VALUES($1,$2,$3,$4,$5,'other',$6,$7)",
          [itemId, tag.id, first.owner_id, first.school_id, "Unlisted item", first.child_name, first.student_id],
        );
        item = (await db.query("SELECT * FROM items WHERE id=$1", [itemId])).rows[0];
      } else if (d.itemId) {
        item = items.find((i) => i.id === d.itemId);
        requireThat(item, 404, "Choose one of the listed belongings");
      } else {
        requireThat(items.length === 1, 400, "Choose which belonging you found");
        item = items[0];
      }
      const open = (await db.query("SELECT * FROM cases WHERE item_id=$1 AND status NOT IN ('returned','closed') FOR UPDATE", [item.id])).rows[0];

      // Their own: it was never lost, or it has just come home. Close anything open.
      if (await isMine(db, u, item)) {
        if (open) {
          await db.query("UPDATE cases SET status='returned',collected_at=now() WHERE id=$1", [open.id]);
          await db.query("INSERT INTO events(id,case_id,actor_id,action,note) VALUES($1,$2,$3,'owner_scanned','Back with the family')", [id(), open.id, u.id]);
          await awardStar(db, open.id);
        }
        await db.query("UPDATE items SET status='with_owner',revision=revision+1 WHERE id=$1", [item.id]);
        return { mine: true, message: `${item.name} is marked as back with you.` };
      }

      requireThat(item.school_id === u.school_id, 404, "Tag not found in your school");
      requireThat(!open || open.status === "reported_lost", 409, `${item.name} is already on its way back. Thank you!`);
      let box = null;
      if (d.boxId) {
        box = (await db.query("SELECT * FROM boxes WHERE id=$1 AND school_id=$2 AND active=true", [d.boxId, u.school_id])).rows[0];
        requireThat(box, 400, "Box is not available");
      }
      let c = open;
      if (c) await db.query("UPDATE cases SET status='awaiting_deposit',box_id=$1 WHERE id=$2", [box?.id || null, c.id]);
      else c = (await db.query(
        "INSERT INTO cases(id,school_id,item_id,box_id,title,category,status) VALUES($1,$2,$3,$4,$5,$6,'awaiting_deposit') RETURNING *",
        [id(), u.school_id, item.id, box?.id || null, item.name, item.category],
      )).rows[0];
      await db.query("UPDATE items SET status='found',revision=revision+1 WHERE id=$1", [item.id]);
      await db.query("INSERT INTO events(id,case_id,actor_id,action,note) VALUES($1,$2,$3,$4,$5)", [
        id(), c.id, u.id, box ? "deposit_reported" : "found_direct", box ? "Staff confirmation required" : "Finder will hand it back",
      ]);
      const finder = `${firstName(u.name)} (${u.role === "student" ? "a student" : u.role === "parent" ? "a parent" : "school staff"})`;
      await notify(db, item.owner_id, box
        ? `Good news: ${item.name} was found by ${finder} and is going to ${box.name}. We'll tell you when it is ready to collect.`
        : `Good news: ${item.name} was found by ${finder}, who will hand it back. When you have it, scan its QR to mark it home.`);
      return {
        id: c.id,
        mine: false,
        message: box
          ? `Thank you! Drop ${item.name} at ${box.name}. The family has been told.`
          : `Thank you! ${firstName(item.child_name) || "The owner"}'s family has been told. Hand it back, or drop it at a collection box.`,
      };
    });
  });
}
