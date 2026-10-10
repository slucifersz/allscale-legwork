/**
 * Real @x402/express middleware against a mock facilitator: proves the 402 challenge shape, the PAYMENT-SIGNATURE
 * round trip, that /verify and /settle are called, and that a paid request creates a job within budget.
 * The mock facilitator approves everything — it does not validate a Solana transaction.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { AllScaleClient } from "@agent-payroll/payout-orchestrator/src/allscale/client.js";
import { Orchestrator } from "@agent-payroll/payout-orchestrator/src/orchestrator.js";
import { MemoryStore } from "@agent-payroll/payout-orchestrator/src/store.js";
import { buildApp } from "../src/app.js";
import { RuleBasedPlanner } from "../src/planner.js";

const NETWORK = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" as const;
const MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const PAYTO = "AgentPayTo1111111111111111111111111111111111";
const FEEPAYER = "FeePayer11111111111111111111111111111111111";

function mockFacilitator() {
  const calls: { path: string; body: any }[] = [];
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const path = req.url!.split("?")[0];
      const body = raw ? JSON.parse(raw) : null;
      calls.push({ path, body });
      const json = (o: unknown) => res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(o));
      if (path.endsWith("/supported")) return json({ kinds: [{ x402Version: 2, scheme: "exact", network: NETWORK, extra: { feePayer: FEEPAYER } }], extensions: [], signers: { [NETWORK]: [FEEPAYER] } });
      if (path.endsWith("/verify")) return json({ isValid: true, payer: "Client111" });
      if (path.endsWith("/settle")) return json({ success: true, transaction: "SettledSig" + calls.length, network: NETWORK, payer: "Client111" });
      res.writeHead(404).end();
    });
  });
  return { server, calls };
}

test("x402 facilitator mode: 402 challenge → signed payload → verify/settle → job created", async () => {
  const fac = mockFacilitator();
  await new Promise<void>((r) => fac.server.listen(0, r));
  const facUrl = `http://127.0.0.1:${(fac.server.address() as any).port}`;

  const orch = new Orchestrator({ client: new AllScaleClient({ baseUrl: "http://127.0.0.1:9", apiKey: "k", apiSecret: "s" }), store: new MemoryStore(), chain: 11, stableCoin: 2 });
  const app = await buildApp({ orch, planner: new RuleBasedPlanner(), mode: "facilitator", priceUsdc: "9", network: NETWORK, usdcMint: MINT, payTo: PAYTO, facilitatorUrl: facUrl });
  const srv = app.listen(0);
  await new Promise<void>((r) => srv.once("listening", r));
  const base = `http://127.0.0.1:${(srv.address() as any).port}`;

  // 1. unpaid → 402 with PAYMENT-REQUIRED
  const r1 = await fetch(`${base}/jobs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ request: "A店, B店, C店" }) });
  assert.equal(r1.status, 402);
  const prHeader = r1.headers.get("PAYMENT-REQUIRED");
  assert.ok(prHeader, "PAYMENT-REQUIRED header present");
  const pr = JSON.parse(Buffer.from(prHeader!, "base64").toString("utf8"));
  assert.equal(pr.x402Version, 2);
  const acc = pr.accepts[0];
  assert.equal(acc.scheme, "exact");
  assert.equal(acc.network, NETWORK);
  assert.equal(acc.asset, MINT);
  assert.equal(acc.amount, "9000000");
  assert.equal(acc.payTo, PAYTO);
  assert.equal(acc.extra?.feePayer, FEEPAYER);

  // 2. paid: a client would sign a Solana tx here; the mock facilitator accepts any payload
  const payload = { x402Version: 2, resource: pr.resource, accepted: acc, payload: { transaction: "base64-signed-solana-tx" } };
  const sig = Buffer.from(JSON.stringify(payload)).toString("base64");
  const r2 = await fetch(`${base}/jobs`, { method: "POST", headers: { "content-type": "application/json", "PAYMENT-SIGNATURE": sig }, body: JSON.stringify({ request: "A店, B店, C店" }) });
  const text = await r2.text();
  assert.equal(r2.status, 200, text);
  const out = JSON.parse(text);
  assert.equal(out.tasks.length, 3);
  assert.equal(out.budget.ok, true);
  assert.equal(out.tasks[0].reward, "2.7");
  const prResp = r2.headers.get("PAYMENT-RESPONSE");
  assert.ok(prResp, "PAYMENT-RESPONSE header present");
  const settled = JSON.parse(Buffer.from(prResp!, "base64").toString("utf8"));
  assert.equal(settled.success, true);
  assert.match(settled.transaction, /^SettledSig/);

  const paths = fac.calls.map((c) => c.path);
  assert.ok(paths.some((p) => p.endsWith("/supported")));
  assert.ok(paths.some((p) => p.endsWith("/verify")));
  assert.ok(paths.some((p) => p.endsWith("/settle")));

  srv.close();
  fac.server.close();
});
