/**
 * End-to-end without credentials: a local mock of the AllScale Auto-Payout API that
 *  - verifies the HMAC signature exactly as the public guide specifies,
 *  - enforces reference_id idempotency (200 idempotent_hit / 409 50106 on param drift),
 *  - emits a signed `claimed` webhook.
 * Proves the whole chain task → accept → pay → webhook → claim state with real HTTP in between.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import { AllScaleClient } from "../src/allscale/client.js";
import { sha256Hex, verifyWebhook } from "../src/allscale/hmac.js";
import { Orchestrator } from "../src/orchestrator.js";
import { MemoryStore } from "../src/store.js";

const API_KEY = "sk_test_key", API_SECRET = "sk_test_secret", WH_SECRET = "whsec_test";

function mockAllScale() {
  const links = new Map<string, any>();
  const nonces = new Set<string>();
  let seq = 0;
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const h = (k: string) => String(req.headers[k.toLowerCase()] ?? "");
      const canonical = [req.method, req.url!.split("?")[0], req.url!.split("?")[1] ?? "", h("x-timestamp"), h("x-nonce"), sha256Hex(raw)].join("\n");
      const expected = "v1=" + createHmac("sha256", API_SECRET).update(canonical).digest("base64");
      const send = (status: number, body: unknown) => res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
      if (h("x-api-key") !== API_KEY || h("x-signature") !== expected) return send(401, { code: 20002, payload: null, error: { message: "invalid signature" } });
      if (nonces.has(h("x-nonce"))) return send(401, { code: 20002, payload: null, error: { message: "nonce reused" } });
      nonces.add(h("x-nonce"));
      if (req.method !== "POST" || !req.url!.startsWith("/v1/claim_link_auto_payouts")) return send(404, { code: 50107, payload: null, error: {} });
      const b = JSON.parse(raw);
      if (typeof b.amount !== "string" || !b.reference_id) return send(422, { code: 10001, payload: null, error: { message: "validation" } });
      const prev = links.get(b.reference_id);
      if (prev) {
        if (prev.amount !== b.amount || prev.chain !== b.chain || prev.stable_coin !== b.stable_coin) return send(409, { code: 50106, payload: null, error: { message: "param conflict" } });
        return send(200, { code: 0, payload: { ...prev.payload, token: null, claim_url: null, funding_tx_hash: null, idempotent_hit: true }, error: null });
      }
      const payload = { claim_link_id: "clk_" + ++seq, reference_id: b.reference_id, amount: b.amount, token_symbol: b.stable_coin === 2 ? "USDC" : "USDT", status: "funded", token: "tok" + seq, claim_url: "https://app.allscale.io/claim/tok" + seq, funding_tx_hash: "0xfund" + seq, funded_amount: b.amount, idempotent_hit: false };
      links.set(b.reference_id, { ...b, payload });
      send(200, { code: 0, payload, error: null });
    });
  });
  return { server, links };
}

test("e2e over HTTP: signed request accepted, idempotent on resend, 50106 on drift, webhook verified and applied", async () => {
  const { server, links } = mockAllScale();
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as any).port;
  const client = new AllScaleClient({ baseUrl: `http://127.0.0.1:${port}`, apiKey: API_KEY, apiSecret: API_SECRET });
  const orch = new Orchestrator({ client, store: new MemoryStore(), chain: 11, stableCoin: 2 });

  const job = orch.createJob("5SolanaSig", "9");
  const task = orch.createTask({ jobId: job.id, title: "photo A", reward: "2.7", acceptanceCriteria: "exif", deadline: new Date(Date.now() + 3600e3).toISOString() });
  const a = orch.assign(task.id, "worker@example.com");
  orch.submit(task.id, a.batchId!, { file: "a.jpg" });
  const ob = orch.accept(task.id, a.batchId!);

  const paid = await orch.pay(ob.id);
  assert.equal(paid.payment.state, "funded");
  assert.equal(paid.payment.fundingTxHash, "0xfund1");
  assert.equal(links.get(ob.id).receiver_email, "worker@example.com");

  // crash-recovery path: force state unknown and pay again → same reference_id → idempotent_hit, no second link
  (orch as any).o.store.get().obligations[ob.id].payment.state = "unknown";
  const again = await orch.pay(ob.id);
  assert.equal(again.payment.state, "funded");
  assert.equal(again.payment.claimUrl, "https://app.allscale.io/claim/tok1");
  assert.equal(links.size, 1);

  // param drift must surface as needs-operator, never a silent second payout
  (orch as any).o.store.get().obligations[ob.id].payment.state = "unknown";
  (orch as any).o.store.get().obligations[ob.id].amount = "9.99";
  const drift = await orch.pay(ob.id);
  assert.equal(drift.payment.state, "failed_needs_operator");
  assert.equal(drift.payment.lastError?.code, 50106);
  assert.equal(links.size, 1);

  // wrong secret → 20002 → needs operator
  const bad = new AllScaleClient({ baseUrl: `http://127.0.0.1:${port}`, apiKey: API_KEY, apiSecret: "wrong" });
  await assert.rejects(() => bad.createAutoPayout({ amount: "1", stable_coin: 2, chain: 11, reference_id: "x" }), (e: any) => e.code === 20002 && e.needsOperator);

  // signed webhook → claim state
  const body = JSON.stringify({ event: "claimed", webhook_id: "wh_1", claim_link_id: "clk_1", reference_id: ob.id, amount: "2.7", token_symbol: "USDC", claim_tx_hash: "0xclaim", occurred_at: new Date().toISOString() });
  const ts = String(Math.floor(Date.now() / 1000));
  const canonical = ["allscale:webhook:v1", "POST", "/webhooks/allscale", "", "wh_1", ts, "n1", sha256Hex(body)].join("\n");
  const sig = "v1=" + createHmac("sha256", WH_SECRET).update(canonical).digest("base64");
  const v = verifyWebhook({ method: "POST", path: "/webhooks/allscale", rawBody: body, headers: { "X-Webhook-Id": "wh_1", "X-Webhook-Timestamp": ts, "X-Webhook-Nonce": "n1", "X-Webhook-Signature": sig }, secret: WH_SECRET });
  assert.equal(v.ok, true);
  assert.deepEqual(orch.applyClaimEvent(JSON.parse(body)), { applied: true });
  assert.equal(orch["o"].store.get().obligations[ob.id].claim.state, "claimed");

  server.close();
});
