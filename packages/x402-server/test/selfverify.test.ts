import { test } from "node:test";
import assert from "node:assert/strict";
import { SelfVerifier, amountReceived } from "../src/selfverify.js";
import { RuleBasedPlanner, splitLocations } from "../src/planner.js";

const MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const PAYTO = "AgentPayTo1111111111111111111111111111111111";
const SIG = "5".repeat(88);

function tx(preAmt: string, postAmt: string, err: unknown = null): any {
  return {
    meta: {
      err,
      preTokenBalances: [{ accountIndex: 1, mint: MINT, owner: PAYTO, uiTokenAmount: { amount: preAmt, decimals: 6 } }],
      postTokenBalances: [{ accountIndex: 1, mint: MINT, owner: PAYTO, uiTokenAmount: { amount: postAmt, decimals: 6 } }],
    },
    transaction: { message: { accountKeys: [{ pubkey: { toString: () => "Payer111" } }] } },
  };
}

test("accepts a transfer ≥ price, rejects replay", async () => {
  const v = new SelfVerifier({ rpcUrl: "", usdcMint: MINT, payTo: PAYTO, minAmount: "9", fetchTx: async () => tx("1000000", "10000000") });
  const r = await v.verify(SIG);
  assert.equal(r.ok, true);
  assert.equal(r.amount, "9");
  assert.equal((await v.verify(SIG)).reason, "replay");
});

test("rejects insufficient, failed and missing tx", async () => {
  const low = new SelfVerifier({ rpcUrl: "", usdcMint: MINT, payTo: PAYTO, minAmount: "9", fetchTx: async () => tx("0", "8999999") });
  assert.match((await low.verify(SIG)).reason!, /insufficient/);
  const failed = new SelfVerifier({ rpcUrl: "", usdcMint: MINT, payTo: PAYTO, minAmount: "9", fetchTx: async () => tx("0", "9000000", { InstructionError: [] }) });
  assert.equal((await failed.verify(SIG)).reason, "tx_failed");
  const none = new SelfVerifier({ rpcUrl: "", usdcMint: MINT, payTo: PAYTO, minAmount: "9", fetchTx: async () => null });
  assert.equal((await none.verify(SIG)).reason, "tx_not_found");
  assert.equal((await none.verify("not-a-sig")).reason, "missing_or_malformed_signature");
});

test("amountReceived ignores other mints/owners", () => {
  const t = tx("0", "5000000");
  t.meta.postTokenBalances.push({ accountIndex: 2, mint: "OtherMint", owner: PAYTO, uiTokenAmount: { amount: "999999999", decimals: 6 } });
  assert.equal(amountReceived(t, MINT, PAYTO).amount, 5_000_000n);
});

test("rule planner: splits locations, keeps 10% margin, never exceeds budget", async () => {
  assert.deepEqual(splitLocations("天河区 A店, B店 and C店"), ["天河区 A店", "B店", "C店"]);
  const p = await new RuleBasedPlanner().plan({ request: "A店, B店, C店", budgetUsdc: "9" });
  assert.equal(p.tasks.length, 3);
  assert.equal(p.tasks[0].reward, "2.7");
});

test("template summarizer: partial vs complete", async () => {
  const { TemplateSummarizer } = await import("../src/summarizer.js");
  const l: any = { jobs: { j: { id: "j", clientRef: "x", revenueAmount: "9", createdAt: "" } }, tasks: {
    a: { id: "a", jobId: "j", title: "On-site photo: A店", state: "accepted", reward: "3", acceptanceCriteria: "", deadline: "", batchId: "b", workerEmail: "w", submission: { batchId: "b", at: "", evidence: { note: "open, sale sign", check: { exif: { takenAt: "2026-10-11T03:00:00.000Z" } } } } },
    b: { id: "b", jobId: "j", title: "On-site photo: B店", state: "submitted", reward: "3", acceptanceCriteria: "", deadline: "", batchId: "c", workerEmail: "w" },
  }, obligations: {}, webhooks: {} };
  const r = await new TemplateSummarizer().summarize(l, "j", "/tmp");
  assert.equal(r.complete, false);
  assert.match(r.answer, /A店.*open, sale sign/);
  assert.match(r.answer, /B店.*pending/);
  l.tasks.b.state = "accepted";
  assert.equal((await new TemplateSummarizer().summarize(l, "j", "/tmp")).complete, true);
});
