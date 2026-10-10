/**
 * Three independent state chains. Nothing is inferred across chains:
 *  - task      (per assignment batch): open → assigned → submitted → accepted | needs_review | void
 *  - payment   (per obligation):       not_requested → in_flight → unknown | funded | failed_needs_operator
 *  - claim     (per claim link):       pending → claimed | refund_pending → refunded
 *
 * An OBLIGATION is "we owe this person this amount for this accepted work". It is created when
 * work is accepted (or reserved earlier as a budget hold) and it never changes amount/coin/chain.
 * One obligation ↔ one reference_id ↔ at most one AllScale claim link. A refunded (expired) link
 * does NOT extinguish the obligation: it gets re-issued under a NEW obligation that references the old one.
 */

export type TaskState = "open" | "assigned" | "submitted" | "accepted" | "needs_review" | "void";
export type PaymentState = "not_requested" | "in_flight" | "unknown" | "funded" | "failed_needs_operator";
export type ClaimState = "pending" | "claimed" | "refund_pending" | "refunded" | "cancelled";

export interface Job {
  id: string;
  clientRef: string; // e.g. Solana payment tx signature
  revenueAmount: string; // USDC decimal string received
  createdAt: string;
  /** CCTP sweep of this job's revenue into the operator's EVM wallet (set by cctp-sweep --job) */
  sweep?: { solanaBurnTx: string; evmReceiveTx?: string; mintedAtomic?: string; state: "burned" | "attested" | "minted"; updatedAt: string };
}

export interface Task {
  id: string;
  jobId: string;
  title: string;
  reward: string; // decimal string, fixed before anyone takes it
  acceptanceCriteria: string;
  deadline: string; // ISO
  state: TaskState;
  /** Current assignment batch. A new batch is minted every time the task is (re)opened and taken. */
  batchId: string | null;
  workerEmail: string | null;
  submission?: { batchId: string; at: string; evidence: Record<string, unknown> };
}

export interface Obligation {
  id: string; // == reference_id sent to AllScale
  taskId: string;
  batchId: string; // the accepted batch; submissions from other batches never pay
  workerEmail: string;
  amount: string;
  stableCoin: number;
  chain: number;
  createdAt: string;
  supersedes?: string; // previous obligation id if this is a re-issue after refund
  payment: {
    state: PaymentState;
    attempts: number;
    lastError?: { code: number | null; message: string; reasonCode?: string; at: string };
    claimLinkId?: string;
    claimUrl?: string | null;
    fundingTxHash?: string | null;
    fundedAt?: string;
  };
  claim: {
    state: ClaimState;
    claimTxHash?: string;
    refundTxHash?: string;
    updatedAt?: string;
    lastWebhookId?: string;
  };
}

export interface Ledger {
  jobs: Record<string, Job>;
  tasks: Record<string, Task>;
  obligations: Record<string, Obligation>;
  /** webhook_id → processed at (dedupe) */
  webhooks: Record<string, string>;
}

export const emptyLedger = (): Ledger => ({ jobs: {}, tasks: {}, obligations: {}, webhooks: {} });
