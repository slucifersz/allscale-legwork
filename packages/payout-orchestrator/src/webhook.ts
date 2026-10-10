/**
 * Webhook receiver for claim link events (claimed / expired / cancelled).
 *   node --import tsx src/webhook.ts   → listens on $PORT (default 8787) at POST /webhooks/allscale
 */
import { createServer } from "node:http";
import { verifyWebhook } from "./allscale/hmac.js";
import { buildFromEnv } from "./config.js";

const { orch } = buildFromEnv();
const secret = process.env.ALLSCALE_WEBHOOK_SECRET;
const path = "/webhooks/allscale";

createServer((req, res) => {
  if (req.method !== "POST" || !req.url?.startsWith(path)) {
    res.writeHead(404).end();
    return;
  }
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
    if (secret) {
      const v = verifyWebhook({ method: "POST", path, rawBody: raw, headers, secret });
      if (!v.ok) {
        res.writeHead(401).end(v.reason);
        return;
      }
    }
    try {
      const ev = JSON.parse(raw);
      const out = orch.applyClaimEvent(ev);
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(out));
    } catch (e) {
      res.writeHead(400).end(String(e));
    }
  });
}).listen(Number(process.env.PORT ?? 8787), () => console.log(`webhook listening on :${process.env.PORT ?? 8787}${path}`));
