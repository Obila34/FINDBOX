import {operationalAlerts} from './operational-alerts.mjs';
import { isIP } from "node:net";
import { connect } from "./db.mjs";
import { createApp } from "./app.mjs";
import { tick } from "./worker.mjs";
const production = process.env.NODE_ENV === "production";
const trustedProxy = process.env.TRUSTED_PROXY;
if (trustedProxy && !isIP(trustedProxy))
  throw new Error(
    "TRUSTED_PROXY must be one exact IP address, never a subnet or wildcard",
  );
const config = {
  production,
  supportAdminIds: (process.env.SUPPORT_ADMIN_IDS || "").split(",").map(s=>s.trim()).filter(Boolean),
  trustedProxy,
  origin: process.env.APP_ORIGIN || "http://localhost:5173",
  // Optional dedicated portals, e.g. https://ops.findbox.africa and https://school.findbox.africa.
  opsOrigin: process.env.OPS_ORIGIN || "",
  schoolOrigin: process.env.SCHOOL_ORIGIN || "",
  paystackKey: process.env.PAYSTACK_SECRET_KEY,
  resendKey: process.env.RESEND_API_KEY,
  mailFrom: process.env.MAIL_FROM,
  ollamaUrl: process.env.OLLAMA_URL || "",
  assistantModel: process.env.ASSISTANT_MODEL || "gemma4:e2b-it-qat",
  companyEmailEnabled: process.env.COMPANY_EMAIL_CODES === 'true',
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT || 465),
  smtpUser: process.env.SMTP_USER,
  smtpPassword: process.env.SMTP_PASSWORD_B64 ? Buffer.from(process.env.SMTP_PASSWORD_B64,'base64').toString('utf8') : process.env.SMTP_PASSWORD,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  encryptionKey: process.env.ENCRYPTION_KEY,
  darajaKey: process.env.DARAJA_SANDBOX_CONSUMER_KEY,
  darajaSecret: process.env.DARAJA_SANDBOX_CONSUMER_SECRET,
  darajaShortcode: process.env.DARAJA_SANDBOX_SHORTCODE,
  darajaPasskey: process.env.DARAJA_SANDBOX_PASSKEY,
};
if (production && !config.origin.startsWith("https://"))
  throw new Error("Production APP_ORIGIN must use HTTPS");
if(production && Buffer.from(config.encryptionKey||"","base64").length!==32) throw new Error("Production requires a 32-byte base64 ENCRYPTION_KEY");
if(config.companyEmailEnabled && !(config.smtpHost && config.smtpUser && config.smtpPassword && config.mailFrom)) throw new Error('Company email codes require configured SMTP delivery');
const pool = connect();
const app = await createApp({ pool, config });
let running = false;
let lastOperationalCheck=0;
const timer = setInterval(async () => {
  if (running) return;
  running = true;
  try {
    await tick(pool, config);
    if(Date.now()-lastOperationalCheck>300000){lastOperationalCheck=Date.now();await operationalAlerts(pool,config);}
    await pool.query("INSERT INTO runtime_heartbeat(name,last_ok) VALUES('worker',now()) ON CONFLICT(name) DO UPDATE SET last_ok=now()");
  } catch (error) {
    app.log.error({ error }, "Worker failed");
  } finally {
    running = false;
  }
}, 30000);
const shutdown = async () => {
  clearInterval(timer);
  await app.close();
  await pool.end();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
await app.listen({
  port: Number(process.env.PORT || 3001),
  host: process.env.HOST || "127.0.0.1",
});
