import { createHmac, timingSafeEqual } from "node:crypto";
import { requireThat, HttpError } from "./security.mjs";
export function validSignature(body, signature, key) {
  if (!key || !signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const digest = createHmac("sha512", key).update(body).digest();
  return timingSafeEqual(digest, Buffer.from(signature, "hex"));
}
export function paymentProvider(config) {
  async function call(path, body) {
    requireThat(
      config.paystackKey,
      503,
      "Checkout is not open yet. Please try again later.",
    );
    const r = await fetch("https://api.paystack.co" + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${config.paystackKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(12000),
    });
    const data = await r.json();
    if (!r.ok || !data.status)
      throw new HttpError(502, "Payment provider is temporarily unavailable.");
    return data.data;
  }
  return {
    initialize: (order, email) =>
      call("/transaction/initialize", {
        email,
        amount: order.amount_minor,
        currency: "KES",
        reference: order.payment_reference,
        callback_url: config.origin + "/shop/orders/" + order.id + "?payment=return",
        channels: [order.payment_method === "mpesa" ? "mobile_money" : "card"],
      }),
    verify: (ref) => call("/transaction/verify/" + encodeURIComponent(ref)),
  };
}
