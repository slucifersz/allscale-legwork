/**
 * Ledger for the public static demo (export.ts). Every on-chain reference here is a real testnet
 * transaction from the 2026-10-10 verification run (x402 payments on Solana devnet, the CCTP burn/mint,
 * the AllScale claim-link funding tx on Sepolia). Task titles, workers and the photo are illustrative.
 * No emails of real people, no claim URLs.
 */
import type { Ledger } from "@agent-payroll/payout-orchestrator/src/model.js";

export const DEMO_WORKER = "worker@legwork.demo";

export function demoLedger(now = Date.now()): Ledger {
  const at = (ms: number) => new Date(now + ms).toISOString();
  const H = 3600_000;
  const CRIT = "One photo of the storefront taken on site within the window; EXIF timestamp inside the window; location within 200 m; the door and any posted notice visible.";
  const J1 = "job_93143d6c4268429198b2";
  const J2 = "job_01fbb89aedad447b8cad";
  return {
    jobs: {
      [J1]: {
        id: J1,
        clientRef: "yGeuCDHCyZ86dLDRdfv1baLRGdx7mpqGDMMdGDsURwg7G3BhnFdYEX6Aa3LQziJt4ji5AjNZPcjVqoMkUkVzYq6",
        revenueAmount: "9",
        createdAt: "2026-10-10T14:53:56.576Z",
        sweep: {
          solanaBurnTx: "DajXP1mtgbquuU3UbW7GCvmWvDdHKmD4f4jJso7tgE2EaGau6eM6tw7j3QdjFwZV1ELeQQzPW9KW1ciYmL3h3mF",
          evmReceiveTx: "0xf511fedfc79e536b12c57b03458dee5326ec28dad32cc2975bbe161222b6da1c",
          mintedAtomic: "1000000",
          state: "minted",
          updatedAt: "2026-10-10T17:00:51.289Z",
        },
      },
      [J2]: {
        id: J2,
        clientRef: "RzMp5ufWUvVpPoGbVqkvfuQ4pTPenCxonJQXyq8ZL9bgQWCQttkJwknDtJCnUDDN17fuVzJaHebYnBavpoMxEFw",
        revenueAmount: "9",
        createdAt: "2026-10-10T14:49:03.487Z",
      },
    },
    tasks: {
      task_demo_a: {
        id: "task_demo_a", jobId: J1, title: "On-site photo: 天河区 A店", reward: "1", acceptanceCriteria: CRIT,
        deadline: "2026-10-10T16:53:56.576Z", state: "accepted", batchId: "batch_demo_a", workerEmail: DEMO_WORKER,
        submission: { batchId: "batch_demo_a", at: "2026-10-10T13:10:00.000Z", evidence: { note: "Open, sale notice on the door" } },
      },
      task_demo_b: {
        id: "task_demo_b", jobId: J1, title: "On-site photo: 天河区 B店", reward: "2.7", acceptanceCriteria: CRIT,
        deadline: at(1.5 * H), state: "submitted", batchId: "batch_demo_b", workerEmail: DEMO_WORKER,
        submission: {
          batchId: "batch_demo_b", at: at(-0.2 * H),
          evidence: {
            file: "demo-storefront.svg",
            note: "Closed — renovation notice on the door",
            check: { ok: true, checks: [{ name: "file", ok: true, detail: "1.8 MB" }, { name: "exif_time", ok: true, detail: "in window" }, { name: "gps", ok: true, detail: "31 m away" }, { name: "hash", ok: true, detail: "unique" }] },
          },
        },
      },
      task_demo_c: {
        id: "task_demo_c", jobId: J1, title: "On-site photo: 天河区 C店", reward: "2.7", acceptanceCriteria: CRIT,
        deadline: at(2 * H), state: "open", batchId: null, workerEmail: null,
      },
      task_demo_d: {
        id: "task_demo_d", jobId: J2, title: "On-site photo: 珠江新城 D店", reward: "2.7", acceptanceCriteria: CRIT,
        deadline: at(1.25 * H), state: "assigned", batchId: "batch_demo_d", workerEmail: DEMO_WORKER,
      },
      task_demo_e: {
        id: "task_demo_e", jobId: J2, title: "On-site photo: 珠江新城 E店", reward: "2.7", acceptanceCriteria: CRIT,
        deadline: at(2 * H), state: "open", batchId: null, workerEmail: null,
      },
      task_demo_f: {
        id: "task_demo_f", jobId: J2, title: "On-site photo: 珠江新城 F店", reward: "2.7", acceptanceCriteria: CRIT,
        deadline: at(2 * H), state: "open", batchId: null, workerEmail: null,
      },
    },
    obligations: {
      ob_765875312d6c4d959370: {
        id: "ob_765875312d6c4d959370", taskId: "task_demo_a", batchId: "batch_demo_a", workerEmail: DEMO_WORKER,
        amount: "1", stableCoin: 1, chain: 11, createdAt: "2026-10-10T13:16:35.097Z",
        payment: {
          state: "funded", attempts: 2, claimLinkId: "6aca3ab55c68188c10dc3f75", claimUrl: "#",
          fundingTxHash: "0xd7ea677e422adb1a3b87cd8539888e47ba89460069dd93efada7f0b05303c7eb", fundedAt: "2026-10-10T13:16:50.047Z",
        },
        claim: { state: "pending" },
      },
    },
    webhooks: {},
  };
}
