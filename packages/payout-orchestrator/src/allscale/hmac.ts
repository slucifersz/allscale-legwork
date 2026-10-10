import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/**
 * AllScale Store API request signing (public integration guide, "Authentication").
 *
 * canonical = METHOD \n PATH \n QUERY_STRING \n TIMESTAMP \n NONCE \n BODY_SHA256
 * signature = Base64(HMAC-SHA256(secret, canonical))
 * headers   = X-API-Key, X-Timestamp (unix seconds), X-Nonce, X-Signature: v1=<sig>
 */

export interface SignInput {
  method: string;
  path: string; // e.g. /v1/claim_link_auto_payouts
  query?: string; // without leading "?", empty if none
  body?: string; // raw body string; "" for GET
  apiKey: string;
  apiSecret: string;
  timestamp?: number; // unix seconds; injectable for tests
  nonce?: string; // injectable for tests
}

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export function canonicalString(i: {
  method: string;
  path: string;
  query: string;
  timestamp: number;
  nonce: string;
  bodySha256: string;
}): string {
  return [i.method.toUpperCase(), i.path, i.query, String(i.timestamp), i.nonce, i.bodySha256].join("\n");
}

export function signRequest(input: SignInput): Record<string, string> {
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000);
  const nonce = input.nonce ?? randomUUID();
  const bodySha256 = sha256Hex(input.body ?? "");
  const canonical = canonicalString({
    method: input.method,
    path: input.path,
    query: input.query ?? "",
    timestamp,
    nonce,
    bodySha256,
  });
  const sig = createHmac("sha256", input.apiSecret).update(canonical, "utf8").digest("base64");
  return {
    "X-API-Key": input.apiKey,
    "X-Timestamp": String(timestamp),
    "X-Nonce": nonce,
    "X-Signature": `v1=${sig}`,
    "Content-Type": "application/json",
  };
}

/**
 * Webhook verification (claim link events share the checkout webhook scheme).
 *
 * canonical = "allscale:webhook:v1" \n METHOD \n PATH \n QUERY_STRING \n WEBHOOK_ID \n TIMESTAMP \n NONCE \n BODY_SHA256
 */
export interface WebhookVerifyInput {
  method: string;
  path: string;
  query?: string;
  rawBody: string;
  headers: Record<string, string | undefined>;
  secret: string;
  now?: number; // unix seconds
  windowSeconds?: number; // default 300
}

export function verifyWebhook(i: WebhookVerifyInput): { ok: true; webhookId: string } | { ok: false; reason: string } {
  const h = (k: string) => i.headers[k] ?? i.headers[k.toLowerCase()];
  const webhookId = h("X-Webhook-Id");
  const ts = h("X-Webhook-Timestamp");
  const nonce = h("X-Webhook-Nonce");
  const sigHeader = h("X-Webhook-Signature");
  if (!webhookId || !ts || !nonce || !sigHeader) return { ok: false, reason: "missing_headers" };

  const now = i.now ?? Math.floor(Date.now() / 1000);
  const window = i.windowSeconds ?? 300;
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(now - tsNum) > window) return { ok: false, reason: "timestamp_out_of_window" };

  const canonical = [
    "allscale:webhook:v1",
    i.method.toUpperCase(),
    i.path,
    i.query ?? "",
    webhookId,
    ts,
    nonce,
    sha256Hex(i.rawBody),
  ].join("\n");
  const expected = createHmac("sha256", i.secret).update(canonical, "utf8").digest("base64");
  const got = sigHeader.startsWith("v1=") ? sigHeader.slice(3) : sigHeader;
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "bad_signature" };
  return { ok: true, webhookId };
}
