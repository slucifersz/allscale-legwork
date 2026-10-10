import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { canonicalString, sha256Hex, signRequest, verifyWebhook } from "../src/allscale/hmac.js";

test("canonical string follows METHOD\\nPATH\\nQUERY\\nTS\\nNONCE\\nBODY_SHA256", () => {
  const c = canonicalString({ method: "post", path: "/v1/x", query: "", timestamp: 1700000000, nonce: "n1", bodySha256: sha256Hex("{}") });
  assert.equal(c, `POST\n/v1/x\n\n1700000000\nn1\n${sha256Hex("{}")}`);
});

test("signRequest produces v1= base64 HMAC-SHA256 over canonical", () => {
  const h = signRequest({ method: "POST", path: "/v1/claim_link_auto_payouts", body: '{"a":1}', apiKey: "k", apiSecret: "s", timestamp: 1700000000, nonce: "n" });
  const expected = createHmac("sha256", "s").update(`POST\n/v1/claim_link_auto_payouts\n\n1700000000\nn\n${sha256Hex('{"a":1}')}`).digest("base64");
  assert.equal(h["X-Signature"], `v1=${expected}`);
  assert.equal(h["X-API-Key"], "k");
  assert.equal(h["X-Timestamp"], "1700000000");
  assert.equal(h["X-Nonce"], "n");
});

test("GET signs empty body hash", () => {
  const h = signRequest({ method: "GET", path: "/v1/y", apiKey: "k", apiSecret: "s", timestamp: 1, nonce: "n" });
  const expected = createHmac("sha256", "s").update(`GET\n/v1/y\n\n1\nn\n${sha256Hex("")}`).digest("base64");
  assert.equal(h["X-Signature"], `v1=${expected}`);
});

test("verifyWebhook accepts a correctly signed payload and rejects tampering / stale timestamps", () => {
  const body = JSON.stringify({ event: "claimed", webhook_id: "wh_1", reference_id: "ob_1" });
  const ts = "1700000000";
  const canonical = ["allscale:webhook:v1", "POST", "/webhooks/allscale", "", "wh_1", ts, "nonce9", sha256Hex(body)].join("\n");
  const sig = createHmac("sha256", "whsec").update(canonical).digest("base64");
  const headers = { "X-Webhook-Id": "wh_1", "X-Webhook-Timestamp": ts, "X-Webhook-Nonce": "nonce9", "X-Webhook-Signature": `v1=${sig}` };
  assert.deepEqual(verifyWebhook({ method: "POST", path: "/webhooks/allscale", rawBody: body, headers, secret: "whsec", now: 1700000010 }), { ok: true, webhookId: "wh_1" });
  assert.equal(verifyWebhook({ method: "POST", path: "/webhooks/allscale", rawBody: body + " ", headers, secret: "whsec", now: 1700000010 }).ok, false);
  assert.equal(verifyWebhook({ method: "POST", path: "/webhooks/allscale", rawBody: body, headers, secret: "whsec", now: 1700009999 }).ok, false);
});
