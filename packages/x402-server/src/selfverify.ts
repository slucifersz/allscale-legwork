/**
 * Fallback payment verification when no x402 facilitator is available:
 * the client pays USDC on Solana itself and sends the transaction signature in `X-Solana-Tx`.
 * We confirm on-chain that ≥ expected USDC landed in payTo's token account, and never accept the same signature twice.
 *
 * This is NOT x402. It is the documented escape hatch in the plan (section 9). Label it as such in the submission.
 */
import { Connection, PublicKey, type ParsedTransactionWithMeta } from "@solana/web3.js";

export interface SelfVerifyOptions {
  rpcUrl: string;
  usdcMint: string;
  payTo: string; // owner pubkey
  minAmount: string; // decimal USDC
  /** injectable for tests */
  fetchTx?: (sig: string) => Promise<ParsedTransactionWithMeta | null>;
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
  amount?: string;
  signature?: string;
  payer?: string;
}

const SIG_RE = /^[1-9A-HJ-NP-Za-km-z]{64,100}$/;

export function amountReceived(tx: ParsedTransactionWithMeta, mint: string, owner: string): { amount: bigint; payer?: string } {
  const pre = tx.meta?.preTokenBalances ?? [];
  const post = tx.meta?.postTokenBalances ?? [];
  const bal = (list: typeof pre) => list.filter((b) => b.mint === mint && b.owner === owner).reduce((a, b) => a + BigInt(b.uiTokenAmount.amount), 0n);
  const delta = bal(post) - bal(pre);
  const payer = tx.transaction.message.accountKeys[0]?.pubkey?.toString();
  return { amount: delta, payer };
}

export class SelfVerifier {
  private readonly used = new Set<string>();
  private readonly conn?: Connection;
  constructor(private readonly o: SelfVerifyOptions) {
    if (!o.fetchTx) this.conn = new Connection(o.rpcUrl, "confirmed");
  }

  async verify(signature: string | undefined): Promise<VerifyResult> {
    if (!signature || !SIG_RE.test(signature)) return { ok: false, reason: "missing_or_malformed_signature" };
    if (this.used.has(signature)) return { ok: false, reason: "replay" };
    const tx = this.o.fetchTx ? await this.o.fetchTx(signature) : await this.conn!.getParsedTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (!tx) return { ok: false, reason: "tx_not_found" };
    if (tx.meta?.err) return { ok: false, reason: "tx_failed" };
    const { amount, payer } = amountReceived(tx, this.o.usdcMint, this.o.payTo);
    const min = toMicro(this.o.minAmount);
    if (amount < min) return { ok: false, reason: `insufficient: got ${fromMicro(amount)} need ${this.o.minAmount}` };
    this.used.add(signature);
    return { ok: true, amount: fromMicro(amount), signature, payer };
  }
}

function toMicro(s: string): bigint {
  const [i, f = ""] = s.split(".");
  return BigInt(i) * 1_000_000n + BigInt((f + "000000").slice(0, 6));
}
function fromMicro(n: bigint): string {
  const i = n / 1_000_000n;
  const f = (n % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return f ? `${i}.${f}` : `${i}`;
}
