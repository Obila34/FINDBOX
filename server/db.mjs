import pg from "pg";
import { readFile } from "node:fs/promises";
export function connect() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  return new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: Math.max(1, Math.min(50, Number(process.env.DB_POOL_SIZE)||10)),
    statement_timeout: 10000,
    idle_in_transaction_session_timeout: 15000,
    connectionTimeoutMillis: 5000,
  });
}
export async function transaction(pool, fn) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const value = await fn(c);
    await c.query("COMMIT");
    return value;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function migrate(pool) {
  await pool.query(
    await readFile(new URL("./schema.sql", import.meta.url), "utf8"),
  );
}
const catalog = JSON.parse(await readFile(new URL('../src/commerce/catalog.json', import.meta.url), 'utf8'));
export const products = catalog.map(p => ({id:p.serverId,name:p.name,description:p.description,price:p.price*100,count:p.count,format:p.stockFormat,image:p.image,available:p.available!==false}));
export async function seedCatalog(pool) {
  for (const p of products)
    await pool.query(
      "INSERT INTO products(id,name,description,price_minor,tag_count,format,image,available) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, price_minor=EXCLUDED.price_minor, tag_count=EXCLUDED.tag_count, format=EXCLUDED.format, image=EXCLUDED.image, available=EXCLUDED.available",
      [p.id, p.name, p.description, p.price, p.count, p.format, p.image, p.available],
    );
}
