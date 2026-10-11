import { randomUUID } from "node:crypto";
import { AllScaleClient, AllScaleError } from "./allscale/client.js";
import type { ChainId, StableCoinId } from "./allscale/types.js";
import type { Obligation, Task } from "./model.js";
import type { FileStore } from "./store.js";

export interface OrchestratorOptions {
  client: AllScaleClient;
  store: FileStore;
  chain: ChainId;
  stableCoin: StableCoinId;
  senderDisplayName?: string;
  now?: () => Date;
  idGen?: () => string;
}

const REF_ID_RE = /^[\x21-\x7e]{1,128}$/; // printable ASCII, no spaces, 1–128

export class Orchestrator {
  private readonly now: () => Date;
  private readonly idGen: () => string;
  constructor(private readonly o: OrchestratorOptions) {
    this.now = o.now ?? (() => new Date());
    this.idGen = o.idGen ?? (() => randomUUID().replace(/-/g, "").slice(0, 20));
  }

  // ---------- jobs & tasks ----------

  /** Replace the job's payment reference once the on-chain settlement signature is known (x402 settles after the handler). */
  setJobClientRef(jobId: string, clientRef: string) {
    return this.o.store.update((l) => {
      const j = l.jobs[jobId];
      if (!j) throw new Error("unknown job");
      j.clientRef = clientRef;
      return clone(j);
    });
  }

  createJob(clientRef: string, revenueAmount: string) {
    return this.o.store.update((l) => {
      const id = "job_" + this.idGen();
      l.jobs[id] = { id, clientRef, revenueAmount, createdAt: this.now().toISOString() };
      return clone(l.jobs[id]);
    });
  }

  /** Reward and acceptance criteria are fixed here, before any worker sees the task. */
  createTask(input: { jobId: string; title: string; reward: string; acceptanceCriteria: string; deadline: string }): Task {
    assertDecimal(input.reward);
    return this.o.store.update((l) => {
      if (!l.jobs[input.jobId]) throw new Error("unknown job");
      const id = "task_" + this.idGen();
      l.tasks[id] = { id, ...input, state: "open", batchId: null, workerEmail: null };
      return clone(l.tasks[id]);
    });
  }

  /** Budget check: sum of rewards for a job must not exceed its revenue. Call before publishing tasks. */
  reservedFor(jobId: string): { revenue: string; reserved: string; ok: boolean } {
    const l = this.o.store.get();
    const job = l.jobs[jobId];
    if (!job) throw new Error("unknown job");
    const reserved = Object.values(l.tasks)
      .filter((t) => t.jobId === jobId && t.state !== "void")
      .reduce((a, t) => a + toMicro(t.reward), 0n);
    const revenue = toMicro(job.revenueAmount);
    return { revenue: fromMicro(revenue), reserved: fromMicro(reserved), ok: reserved <= revenue };
  }

  /** Worker takes the task. Every take mints a new batch id; old batches can never pay. */
  assign(taskId: string, workerEmail: string): Task {
    return this.o.store.update((l) => {
      const t = must(l.tasks[taskId], "unknown task");
      if (t.state !== "open") throw new Error(`task not open (${t.state})`);
      t.state = "assigned";
      t.batchId = "batch_" + this.idGen();
      t.workerEmail = workerEmail;
      return clone(t);
    });
  }

  /** Deadline passed without submission → void the batch, reopen. */
  expireAssignment(taskId: string): Task {
    return this.o.store.update((l) => {
      const t = must(l.tasks[taskId], "unknown task");
      if (t.state !== "assigned") throw new Error(`task not assigned (${t.state})`);
      t.state = "open";
      t.batchId = null;
      t.workerEmail = null;
      return clone(t);
    });
  }

  submit(taskId: string, batchId: string, evidence: Record<string, unknown>): Task {
    return this.o.store.update((l) => {
      const t = must(l.tasks[taskId], "unknown task");
      if (t.state !== "assigned" || t.batchId !== batchId) throw new Error("submission does not match the current batch");
      t.state = "submitted";
      t.submission = { batchId, at: this.now().toISOString(), evidence };
      return clone(t);
    });
  }

  /** Structural checks are advisory; a human decision (accept / needs_review) is what creates an obligation. */
  accept(taskId: string, batchId: string): Obligation {
    return this.o.store.update((l) => {
      const t = must(l.tasks[taskId], "unknown task");
      const existing = Object.values(l.obligations).find((ob) => ob.taskId === taskId && ob.batchId === batchId);
      if (existing) return clone(existing); // accept is idempotent
      if (t.state !== "submitted" || t.batchId !== batchId || !t.workerEmail) throw new Error("cannot accept: not submitted or batch mismatch");
      t.state = "accepted";
      const id = ("ob_" + this.idGen()).replace(/[^\x21-\x7e]/g, "");
      if (!REF_ID_RE.test(id)) throw new Error("bad reference id");
      const ob: Obligation = {
        id,
        taskId,
        batchId,
        workerEmail: t.workerEmail,
        amount: t.reward,
        stableCoin: this.o.stableCoin,
        chain: this.o.chain,
        createdAt: this.now().toISOString(),
        payment: { state: "not_requested", attempts: 0 },
        claim: { state: "pending" },
      };
      l.obligations[id] = ob;
      return clone(ob);
    });
  }

  markNeedsReview(taskId: string): Task {
    return this.o.store.update((l) => {
      const t = must(l.tasks[taskId], "unknown task");
      if (t.state !== "submitted") throw new Error("not submitted");
      t.state = "needs_review";
      return clone(t);
    });
  }

  // ---------- payment chain ----------

  /**
   * Execute (or resume) the payout for an obligation. Safe to call any number of times:
   * the same reference_id is always sent, so the API returns the original link on repeats.
   */
  async pay(obligationId: string): Promise<Obligation> {
    const ob0 = must(this.o.store.get().obligations[obligationId], "unknown obligation");
    if (ob0.payment.state === "funded") return clone(ob0);
    if (ob0.payment.state === "failed_needs_operator") throw new Error("obligation needs operator action; call resetForRetry after fixing");

    this.o.store.update((l) => {
      const ob = l.obligations[obligationId];
      ob.payment.state = "in_flight";
      ob.payment.attempts += 1;
    });

    try {
      const res = await this.o.client.createAutoPayout({
        amount: ob0.amount,
        stable_coin: ob0.stableCoin as StableCoinId,
        chain: ob0.chain as ChainId,
        reference_id: ob0.id,
        receiver_email: ob0.workerEmail,
        sender_display_name: this.o.senderDisplayName,
        sender_message: `Payment for task ${ob0.taskId}`,
      });
      return this.o.store.update((l) => {
        const ob = l.obligations[obligationId];
        ob.payment.state = "funded";
        ob.payment.claimLinkId = res.claim_link_id;
        // on idempotent_hit these are null — keep whatever we stored from the first success
        if (res.claim_url) ob.payment.claimUrl = res.claim_url;
        if (res.funding_tx_hash) ob.payment.fundingTxHash = res.funding_tx_hash;
        ob.payment.fundedAt = ob.payment.fundedAt ?? this.now().toISOString();
        ob.payment.lastError = undefined;
        return clone(ob);
      });
    } catch (e) {
      const err = e instanceof AllScaleError ? e : new AllScaleError("transport", null, String(e));
      return this.o.store.update((l) => {
        const ob = l.obligations[obligationId];
        ob.payment.lastError = { code: err.code, message: err.message, reasonCode: err.reasonCode, at: this.now().toISOString() };
        if (err.needsOperator) ob.payment.state = "failed_needs_operator";
        else if (err.retryableSameReference) ob.payment.state = "unknown"; // result unknown: retry with SAME reference_id later
        else if (err.code === 50106) ob.payment.state = "failed_needs_operator"; // params drifted: a bug, never silently re-issue
        else ob.payment.state = "unknown";
        return clone(ob);
      });
    }
  }

  /** After the operator fixed the cause (re-authorized, raised limits), allow pay() again. Same reference_id. */
  resetForRetry(obligationId: string): Obligation {
    return this.o.store.update((l) => {
      const ob = must(l.obligations[obligationId], "unknown obligation");
      if (ob.payment.state !== "failed_needs_operator") throw new Error("not in failed_needs_operator");
      ob.payment.state = "unknown";
      return clone(ob);
    });
  }

  /** Drive every obligation that is not terminal. Call from a cron/loop. */
  async drain(): Promise<Obligation[]> {
    const ids = Object.values(this.o.store.get().obligations)
      .filter((ob) => ob.payment.state === "not_requested" || ob.payment.state === "unknown")
      .map((ob) => ob.id);
    const out: Obligation[] = [];
    for (const id of ids) out.push(await this.pay(id));
    return out;
  }

  // ---------- claim chain (fed by webhooks or polling) ----------

  applyClaimEvent(ev: { webhook_id: string; reference_id: string; event: string; claim_tx_hash?: string | null; refund_tx_hash?: string | null; occurred_at?: string }): { applied: boolean; reason?: string } {
    return this.o.store.update((l) => {
      if (l.webhooks[ev.webhook_id]) return { applied: false, reason: "duplicate_webhook" };
      const ob = l.obligations[ev.reference_id];
      if (!ob) return { applied: false, reason: "unknown_reference" };
      l.webhooks[ev.webhook_id] = this.now().toISOString();
      ob.claim.lastWebhookId = ev.webhook_id;
      ob.claim.updatedAt = ev.occurred_at ?? this.now().toISOString();
      switch (ev.event) {
        case "claimed":
          ob.claim.state = "claimed";
          ob.claim.claimTxHash = ev.claim_tx_hash ?? undefined;
          break;
        case "expired":
          ob.claim.state = "refunded";
          ob.claim.refundTxHash = ev.refund_tx_hash ?? undefined;
          break;
        case "cancelled":
          ob.claim.state = "cancelled";
          ob.claim.refundTxHash = ev.refund_tx_hash ?? undefined;
          break;
        default:
          return { applied: false, reason: "unknown_event" };
      }
      return { applied: true };
    });
  }

  /**
   * The money came back but the person is still owed. Mint a NEW obligation (new reference_id)
   * that supersedes the refunded one. Never reuse the old reference_id — the API would return the dead link.
   */
  reissueAfterRefund(obligationId: string): Obligation {
    return this.o.store.update((l) => {
      const old = must(l.obligations[obligationId], "unknown obligation");
      if (old.claim.state !== "refunded") throw new Error("only refunded obligations can be re-issued");
      const already = Object.values(l.obligations).find((o) => o.supersedes === old.id);
      if (already) return clone(already);
      const id = "ob_" + this.idGen();
      const ob: Obligation = {
        ...old,
        id,
        createdAt: this.now().toISOString(),
        supersedes: old.id,
        payment: { state: "not_requested", attempts: 0 },
        claim: { state: "pending" },
      };
      l.obligations[id] = ob;
      return clone(ob);
    });
  }
}

// ---------- helpers ----------

function clone<T>(v: T): T {
  return structuredClone(v);
}
function must<T>(v: T | undefined, msg: string): T {
  if (v === undefined) throw new Error(msg);
  return v;
}
function assertDecimal(s: string) {
  if (!/^\d+(\.\d{1,6})?$/.test(s)) throw new Error(`amount must be a decimal string with ≤6 dp, got ${s}`);
}
export function toMicro(s: string): bigint {
  assertDecimal(s);
  const [i, f = ""] = s.split(".");
  return BigInt(i) * 1_000_000n + BigInt((f + "000000").slice(0, 6));
}
export function fromMicro(n: bigint): string {
  const i = n / 1_000_000n;
  const f = (n % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return f ? `${i}.${f}` : `${i}`;
}
