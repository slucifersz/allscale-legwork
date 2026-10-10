import { test } from "node:test";
import assert from "node:assert/strict";
import { AllScaleClient } from "../src/allscale/client.js";
import { Orchestrator } from "../src/orchestrator.js";
import { MemoryStore } from "../src/store.js";
import { normalize, pollOnce, fetchViaRest } from "../src/poll.js";

test("normalize accepts envelope / flat / camelCase", () => {
  assert.deepEqual(normalize({ payload: { status: "CLAIMED", claim_tx_hash: "0x1" } }), { status: "claimed", claim_tx_hash: "0x1", refund_tx_hash: null });
  assert.deepEqual(normalize({ state: "expired", refundTxHash: "0x2" }), { status: "expired", claim_tx_hash: null, refund_tx_hash: "0x2" });
  assert.equal(normalize({ nope: 1 }), null);
});

test("pollOnce maps remote status to claim chain once (dedupe) and ignores non-terminal", async () => {
  const store = new MemoryStore();
  const orch = new Orchestrator({ client: new AllScaleClient({ baseUrl: "http://127.0.0.1:9", apiKey: "k", apiSecret: "s" }), store, chain: 11, stableCoin: 2 });
  const job = orch.createJob("sig", "9");
  const t = orch.createTask({ jobId: job.id, title: "x", reward: "3", acceptanceCriteria: "", deadline: new Date(Date.now() + 1e6).toISOString() });
  const a = orch.assign(t.id, "w@x");
  orch.submit(t.id, a.batchId!, {});
  const ob = orch.accept(t.id, a.batchId!);
  store.update((l) => { l.obligations[ob.id].payment.state = "funded"; l.obligations[ob.id].payment.claimLinkId = "clk_1"; });
  let status = "funded";
  const fetchOne = async () => ({ status, claim_tx_hash: status === "claimed" ? "0xc" : null });
  assert.deepEqual(await pollOnce(orch, store, fetchOne), []);
  status = "claimed";
  assert.deepEqual(await pollOnce(orch, store, fetchOne), [{ id: ob.id, event: "claimed" }]);
  assert.equal(store.get().obligations[ob.id].claim.state, "claimed");
  assert.deepEqual(await pollOnce(orch, store, fetchOne), []); // terminal now, not polled again
});

test("fetchViaRest signs a GET with empty-body hash and returns null on non-200", async () => {
  let seen: any;
  const fetchImpl: typeof fetch = async (url, init) => { seen = { url: String(url), headers: init?.headers }; return new Response(JSON.stringify({ code: 0, payload: { status: "expired", refund_tx_hash: "0xr" } }), { status: 200 }); };
  const r = await fetchViaRest("clk_9", { baseUrl: "https://api.test", apiKey: "k", apiSecret: "s", fetchImpl });
  assert.equal(r?.status, "expired");
  assert.equal(seen.url, "https://api.test/v1/claim_link_auto_payouts/clk_9");
  assert.ok((seen.headers as any)["X-Signature"].startsWith("v1="));
  const r404 = await fetchViaRest("clk_9", { baseUrl: "https://api.test", apiKey: "k", apiSecret: "s", fetchImpl: async () => new Response("", { status: 404 }) });
  assert.equal(r404, null);
});
