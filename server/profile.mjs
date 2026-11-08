import { z } from "zod";
import { requireThat } from "./security.mjs";

// Profiles are small and personal: a square photo (already resized in the browser), a short tagline,
// an accent colour and an emoji. Photos are stored inline, capped at 160 KB, and only PNG, JPEG or WebP
// are accepted, checked by their file signature as well as their declared type.
export const ACCENTS = ["sage", "forest", "cream", "sky", "sunset", "lilac"];
const MAX_PHOTO = 160 * 1024;

function validPhoto(dataUrl) {
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return false;
  const bytes = Buffer.from(m[2], "base64");
  if (!bytes.length || bytes.length > MAX_PHOTO) return false;
  const sig = bytes.subarray(0, 12);
  if (m[1] === "png") return sig[0] === 0x89 && sig.toString("latin1", 1, 4) === "PNG";
  if (m[1] === "jpeg") return sig[0] === 0xff && sig[1] === 0xd8 && sig[2] === 0xff;
  return sig.toString("latin1", 0, 4) === "RIFF" && sig.toString("latin1", 8, 12) === "WEBP";
}

export async function profileRoutes(app, { pool, user }) {
  const read = async (uid) => {
    const r = (await pool.query("SELECT u.name,p.avatar,p.tagline,p.accent,p.emoji FROM users u LEFT JOIN user_profiles p ON p.user_id=u.id WHERE u.id=$1", [uid])).rows[0];
    return { name: r.name, avatar: r.avatar || null, tagline: r.tagline || "", accent: r.accent || "sage", emoji: r.emoji || "" };
  };
  app.get("/api/account/profile", async (req) => read((await user(req)).id));
  const schema = z.object({
    name: z.string().trim().min(2).max(100).optional(),
    tagline: z.string().trim().max(80).optional(),
    accent: z.enum(ACCENTS).optional(),
    emoji: z.string().max(16).regex(/^[^<>&"']*$/).optional(),
    avatar: z.string().max(Math.ceil(MAX_PHOTO * 1.4) + 40).nullable().optional(),
  }).strict();
  app.post("/api/account/profile", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req) => {
    const u = await user(req);
    const d = schema.parse(req.body || {});
    if (d.avatar) requireThat(validPhoto(d.avatar), 400, "Please choose a PNG, JPEG or WebP photo under 160 KB.");
    if (d.name) await pool.query("UPDATE users SET name=$1 WHERE id=$2", [d.name, u.id]);
    await pool.query(
      `INSERT INTO user_profiles(user_id,avatar,tagline,accent,emoji) VALUES($1,$2::text,COALESCE($3::text,''),COALESCE($4::text,'sage'),COALESCE($5::text,''))
       ON CONFLICT(user_id) DO UPDATE SET
         avatar=CASE WHEN $6::boolean THEN EXCLUDED.avatar ELSE user_profiles.avatar END,
         tagline=COALESCE($3::text,user_profiles.tagline), accent=COALESCE($4::text,user_profiles.accent), emoji=COALESCE($5::text,user_profiles.emoji), updated_at=now()`,
      [u.id, d.avatar ?? null, d.tagline ?? null, d.accent ?? null, d.emoji ?? null, d.avatar !== undefined],
    );
    return read(u.id);
  });
}
