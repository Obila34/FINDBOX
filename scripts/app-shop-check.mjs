import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
await mkdir("shots/app-shop", { recursive: true });
const base = process.env.BASE || "http://localhost:5173";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("request", (r) => {
  if (new URL(r.url()).pathname.startsWith("/api/"))
    errors.push("Preview called backend");
});
await p.goto(base + "/app/sign-in");
await p.getByRole("button", { name: "Parent", exact: true }).click();
await p.getByRole("button", { name: /Amina Wekesa/ }).click();
const dock = p.getByRole("navigation", { name: "Mobile primary", exact: true });
await dock.getByRole("link", { name: "Shop", exact: true }).click();
await p.waitForURL("**/app/shop");
await p.getByRole("heading", { name: "Shop tags", exact: true }).waitFor();
await p.locator('a[href="/app/shop/products/everyday"]').first().click();
await p.getByRole("button", { name: /Add to bag/ }).click();
await p.getByRole("link", { name: /View bag/ }).click();
await p.getByRole("link", { name: /Continue to checkout/ }).click();
await p.getByRole("checkbox").check();
await p.getByRole("button", { name: "Place sample order" }).click();
await p.waitForURL("**/app/shop/orders/*");
await p.getByRole("heading", { name: "You’re all set." }).waitFor();
await p.screenshot({ path: "shots/app-shop/order-mobile.png", fullPage: true });
await p
  .getByRole("navigation", { name: "Mobile primary" })
  .getByRole("link", { name: "Home", exact: true })
  .click();
await p.waitForURL("**/app/home");
await p.screenshot({ path: "shots/app-shop/home-mobile.png", fullPage: true });
const widths = await p
  .getByRole("navigation", { name: "Mobile primary", exact: true })
  .locator("a")
  .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().width));
if (Math.max(...widths) - Math.min(...widths) > 1)
  errors.push("Unequal dock icon widths");
if (
  await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
)
  errors.push("Mobile overflow");
await browser.close();
if (errors.length) throw new Error(errors.join("\n"));
console.log(
  "In-app sample shopping, retained sign-in, checkout, return to app, equal navigation spacing and zero backend requests passed.",
);
