import { test } from "node:test";
import assert from "node:assert/strict";
import { AllScaleClient, AllScaleError } from "../src/allscale/client.js";
import { Orchestrator, toMicro, fromMicro } from "../src/orchestrator.js";
import { MemoryStore } from "../src/store.js";

/** Fake AllScale: records every request; behaviour scripted per test. */
function fakeAllScale(script: (req: any, n: number) => { status: number; body: any } | Error) {
  const calls: any[] = [];
  const fetchImpl: typeof fetch = async (_url, init) => {
    const req = JSON.parse(String(init?.body ?? "{}"));
    calls.push(req);
    const r = script(req, calls.length);
    if (r instanceof Error) throw r;
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { "content-type": "application/json" } });
  };
  const client = new AllScaleClient({ baseUrl: "https://x.test", apiKey: "k", apiSecret: "s", fetchImpl, timeoutMs: 5000 });
  return { client, calls };
}

const ok = (ref: string, hit = false) => ({
  status: 200,
  body: { code: 0, payload: { claim_link_id: "clk_" + ref, reference_id: ref, amount: "3", token_symbol: "USDC", status: "funded", token: hit ? null : "tok", claim_url: hit ? null : "https://app.allscale.io/claim/tok", funding_tx_hash: hit ? null : "0xfund", funded_amount: "3", idempotent_hit: hit }, error: null },
});
const apiErr = (code: number, status: number, details?: any) => ({ status, body: { code, payload: null, error: { message: "err " + code, details } } });

function setup(script: Parameters<typeof fakeAllScale>[0]) {
  const { client, calls } = fakeAllScale(script);
  let n = 0;
  const orch = new Orchestrator({ client, store: new MemoryStore(), chain: 11, stableCoin: 2, idGen: () => "id" + ++n, now: () => new Date("2026-10-10T00:00:00Z") });
  const job = orch.createJob("sol_tx_1", "9");
  const task = orch.createTask({ jobId: job.id, title: "photo", reward: "3", acceptanceCriteria: "exif ok", deadline: "2026-10-11T00:00:00Z" });
  return { orch, calls, job, task };
}

test("happy path: accept creates one obligation, pay funds it with the obligation id as reference_id", async () => {
  const { orch, calls, task } = setup((req) => ok(req.reference_id));
  const t = orch.assign(task.id, "w@x.io");
  orch.submit(task.id, t.batchId!, { photo: "a.jpg" });
  const ob = orch.accept(task.id, t.batchId!);
  const paid = await orch.pay(ob.id);
  assert.equal(paid.payment.state, "funded");
  assert.equal(calls[0].reference_id, ob.id);
  assert.equal(calls[0].amount, "3");
  assert.equal(calls[0].chain, 11);
  assert.equal(calls[0].stable_coin, 2);
  assert.equal(calls[0].receiver_email, "w@x.io");
  assert.equal(paid.payment.claimUrl, "https://app.allscale.io/claim/tok");
});

test("accept is idempotent: the same batch never creates a second obligation", () => {
  const { orch, task } = setup((req) => ok(req.reference_id));
  const t = orch.assign(task.id, "w@x.io");
  orch.submit(task.id, t.batchId!, {});
  const a = orch.accept(task.id, t.batchId!);
  const b = orch.accept(task.id, t.batchId!);
  assert.equal(a.id, b.id);
});

test("pay twice sends the same reference_id; idempotent_hit keeps the original claim_url", async () => {
  const { orch, calls, task } = setup((req, n) => ok(req.reference_id, n > 1));
  const t = orch.assign(task.id, "w@x.io");
  orch.submit(task.id, t.batchId!, {});
  const ob = orch.accept(task.id, t.batchId!);
  await orch.pay(ob.id);
  const again = await orch.pay(ob.id); // already funded → no call
  assert.equal(calls.length, 1);
  assert.equal(again.payment.claimUrl, "https://app.allscale.io/claim/tok");
});

test("timeout → state unknown; retry reuses the SAME reference_id and recovers via idempotent_hit", async () => {
  const { orch, calls, task } = setup((req, n) => (n === 1 ? Object.assign(new Error("aborted"), { name: "AbortError" }) : ok(req.reference_id, true)));
  const t = orch.assign(task.id, "w@x.io");
  orch.submit(task.id, t.batchId!, {});
  const ob = orch.accept(task.id, t.batchId!);
  const r1 = await orch.pay(ob.id);
  assert.equal(r1.payment.state, "unknown");
  const r2 = await orch.pay(ob.id);
  assert.equal(r2.payment.state, "funded");
  assert.equal(calls[0].reference_id, calls[1].reference_id);
  assert.equal(r2.payment.attempts, 2);
});

test("50103 signer_error is retryable; 50103 policy_denied needs operator and blocks until reset", async () => {
  const { orch, task } = setup((req, n) => (n === 1 ? apiErr(50103, 400, { reason_code: "signer_error" }) : n === 2 ? apiErr(50103, 400, { reason_code: "policy_denied" }) : ok(req.reference_id)));
  const t = orch.assign(task.id, "w@x.io");
  orch.submit(task.id, t.batchId!, {});
  const ob = orch.accept(task.id, t.batchId!);
  assert.equal((await orch.pay(ob.id)).payment.state, "unknown");
  assert.equal((await orch.pay(ob.id)).payment.state, "failed_needs_operator");
  await assert.rejects(() => orch.pay(ob.id));
  orch.resetForRetry(ob.id);
  assert.equal((await orch.pay(ob.id)).payment.state, "funded");
});

test("50104 (auto-payout disabled / sandbox key) and 30002 need operator", async () => {
  const { orch, task } = setup(() => apiErr(50104, 403));
  const t = orch.assign(task.id, "w@x.io");
  orch.submit(task.id, t.batchId!, {});
  const ob = orch.accept(task.id, t.batchId!);
  const r = await orch.pay(ob.id);
  assert.equal(r.payment.state, "failed_needs_operator");
  assert.equal(r.payment.lastError?.code, 50104);
});

test("50105 concurrent duplicate → unknown, drain retries it", async () => {
  const { orch, task } = setup((req, n) => (n === 1 ? apiErr(50105, 409) : ok(req.reference_id)));
  const t = orch.assign(task.id, "w@x.io");
  orch.submit(task.id, t.batchId!, {});
  const ob = orch.accept(task.id, t.batchId!);
  assert.equal((await orch.pay(ob.id)).payment.state, "unknown");
  const out = await orch.drain();
  assert.equal(out[0].payment.state, "funded");
});

test("old batch can never pay: expired assignment + new worker; stale submission rejected", () => {
  const { orch, task } = setup((req) => ok(req.reference_id));
  const t1 = orch.assign(task.id, "slow@x.io");
  orch.expireAssignment(task.id);
  const t2 = orch.assign(task.id, "fast@x.io");
  assert.notEqual(t1.batchId, t2.batchId);
  assert.throws(() => orch.submit(task.id, t1.batchId!, {}));
  orch.submit(task.id, t2.batchId!, {});
  const ob = orch.accept(task.id, t2.batchId!);
  assert.equal(ob.workerEmail, "fast@x.io");
});

test("budget: rewards cannot exceed job revenue", () => {
  const { orch, job } = setup((req) => ok(req.reference_id));
  orch.createTask({ jobId: job.id, title: "b", reward: "3", acceptanceCriteria: "", deadline: "2026-10-11T00:00:00Z" });
  orch.createTask({ jobId: job.id, title: "c", reward: "3", acceptanceCriteria: "", deadline: "2026-10-11T00:00:00Z" });
  assert.equal(orch.reservedFor(job.id).ok, true); // 3+3+3 = 9
  orch.createTask({ jobId: job.id, title: "d", reward: "0.5", acceptanceCriteria: "", deadline: "2026-10-11T00:00:00Z" });
  assert.equal(orch.reservedFor(job.id).ok, false);
});

test("claim chain: webhook dedupe, expired → refunded, re-issue mints a NEW reference_id and keeps the debt", async () => {
  const { orch, calls, task } = setup((req) => ok(req.reference_id));
  const t = orch.assign(task.id, "w@x.io");
  orch.submit(task.id, t.batchId!, {});
  const ob = orch.accept(task.id, t.batchId!);
  await orch.pay(ob.id);
  assert.deepEqual(orch.applyClaimEvent({ webhook_id: "wh1", reference_id: ob.id, event: "expired", refund_tx_hash: "0xr" }), { applied: true });
  assert.deepEqual(orch.applyClaimEvent({ webhook_id: "wh1", reference_id: ob.id, event: "expired" }), { applied: false, reason: "duplicate_webhook" });
  const re = orch.reissueAfterRefund(ob.id);
  assert.notEqual(re.id, ob.id);
  assert.equal(re.supersedes, ob.id);
  assert.equal(re.amount, "3");
  await orch.pay(re.id);
  assert.equal(calls[1].reference_id, re.id);
  assert.equal(orch.reissueAfterRefund(ob.id).id, re.id); // idempotent
});

test("micro-unit arithmetic", () => {
  assert.equal(toMicro("3"), 3_000_000n);
  assert.equal(toMicro("0.5"), 500_000n);
  assert.equal(fromMicro(9_250_000n), "9.25");
  assert.throws(() => toMicro("1e3"));
});
