import { transaction } from "./db.mjs";
import { requireThat } from "./security.mjs";
import { notify } from "./worker.mjs";
export async function fulfill(pool, orderId, { after } = {}) {
  return transaction(pool, async (db) => {
    const order = (
      await db.query("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [orderId])
    ).rows[0];
    requireThat(order, 404, "Order not found");
    if (order.status === "fulfilled")
      return { id: order.id, status: "fulfilled" };
    requireThat(
      order.status === "paid",
      409,
      "Only paid orders may be fulfilled",
    );
    for (const line of order.lines) {
      const parts=line.productId==='complete-41'?[['sticker',20],['fabric',20]]:[[null,line.tagCount]];
      for(const [format,n] of parts){
        const count=n*line.quantity;
        const held=(await db.query("SELECT id FROM tags WHERE order_id=$1 AND product_id=$2 AND status='reserved' AND ($3::text IS NULL OR format=$3) FOR UPDATE",[order.id,line.productId,format])).rows;
        requireThat(held.length<=count,409,'Reserved stock needs operator reconciliation');
        const extra=count-held.length;
        const available=extra?(await db.query("SELECT id FROM tags WHERE product_id=$1 AND status='stock' AND ($2::text IS NULL OR format=$2) ORDER BY created_at LIMIT $3 FOR UPDATE SKIP LOCKED",[line.productId,format,extra])).rows:[];
        const tags=[...held,...available];requireThat(tags.length===count,409,'Insufficient tag stock. Replenish before fulfillment.');
        for(const tag of tags)await db.query("UPDATE tags SET status='allocated',order_id=$1 WHERE id=$2",[order.id,tag.id]);
      }

    }
    await db.query("UPDATE orders SET status='fulfilled' WHERE id=$1", [
      order.id,
    ]);
    await notify(
      db,
      order.user_id,
      order.delivery === "home"
        ? "Your FindBox labels are on their way to your home address. Each one carries your child's name and QR."
        : "Your FindBox labels are ready for collection at your school. Each one carries your child's name and QR.",
    );
    if(after)await after(db,order);
    return { id: order.id, status: "fulfilled" };
  });
}
