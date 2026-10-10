/**
 * Populate the ledger with a realistic demo job so the pages have something to show before real runs.
 *   npm run seed            → writes into PAYROLL_DATA_DIR (default ../payout-orchestrator/data)
 * Clearly fake: tx hashes are labelled "seed". Delete data/ledger.json before the real demo.
 */
import "dotenv/config";
import { FileStore } from "@agent-payroll/payout-orchestrator/src/store.js";
import type { Ledger } from "@agent-payroll/payout-orchestrator/src/model.js";

const store = new FileStore(process.env.PAYROLL_DATA_DIR ?? "./data");
const now = Date.now();
const iso = (ms: number) => new Date(now + ms).toISOString();
store.update((l: Ledger) => {
  const jobId = "job_seed0001";
  l.jobs[jobId] = { id: jobId, clientRef: "seedSolanaSignature1111111111111111111111111111111111111111111111111111111111111", revenueAmount: "9", createdAt: iso(-3600e3), sweep: { solanaBurnTx: "seedBurnSignature22222222222222222222222222222222222222222222222222222222222222222", evmReceiveTx: "0xseedmint000000000000000000000000000000000000000000000000000000003", mintedAtomic: "9000000", state: "minted", updatedAt: iso(-2400e3) } };
  const mk = (n: number, title: string, state: any, extra: Partial<any> = {}) => {
    const id = `task_seed000${n}`;
    l.tasks[id] = { id, jobId, title, reward: "2.7", acceptanceCriteria: "One storefront photo on site; EXIF time in window; GPS within 200 m; door and notice visible.", deadline: iso(2 * 3600e3), state, batchId: `batch_seed000${n}`, workerEmail: `worker${n}@example.com`, ...extra };
    return id;
  };
  const t1 = mk(1, "On-site photo: 天河区 A店", "accepted", { submission: { batchId: "batch_seed0001", at: iso(-1200e3), evidence: { note: "open, sale notice on door", check: { ok: true, checks: [{ name: "file", ok: true, detail: "2.1 MB" }, { name: "exif_time_in_window", ok: true, detail: iso(-1300e3) }, { name: "gps_present", ok: true, detail: "23.13,113.32" }] } } } });
  const t2 = mk(2, "On-site photo: 天河区 B店", "submitted", { submission: { batchId: "batch_seed0002", at: iso(-600e3), evidence: { note: "closed, renovation notice", check: { ok: false, checks: [{ name: "file", ok: true, detail: "1.8 MB" }, { name: "exif_time_in_window", ok: true, detail: iso(-700e3) }, { name: "gps_present", ok: false, detail: "no GPS" }] } } } });
  mk(3, "On-site photo: 天河区 C店", "open", { batchId: null, workerEmail: null });
  l.obligations["ob_seed0001"] = { id: "ob_seed0001", taskId: t1, batchId: "batch_seed0001", workerEmail: "worker1@example.com", amount: "2.7", stableCoin: 2, chain: 11, createdAt: iso(-1100e3), payment: { state: "funded", attempts: 1, claimLinkId: "clk_seed", claimUrl: "https://app.allscale.io/claim/seed", fundingTxHash: "0xseedfunding000000000000000000000000000000000000000000000000000001", fundedAt: iso(-1000e3) }, claim: { state: "claimed", claimTxHash: "0xseedclaim00000000000000000000000000000000000000000000000000000002", updatedAt: iso(-300e3) } };
  void t2;
});
console.log("seeded", (process.env.PAYROLL_DATA_DIR ?? "./data") + "/ledger.json");
