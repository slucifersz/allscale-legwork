/**
 * Claim-state polling, for environments where webhooks need special triggering (gamma).
 * Two sources, pick with CLAIM_STATUS_SOURCE:
 *   cli  — shells out to the AllScale CLI: `allscale claim-link get <claim_link_id> --json` (command per internal 0.1.0 list;
 *          adjust CLAIM_STATUS_CLI if the real command differs). Parses tolerantly.
 *   rest — GET /v1/claim_link_auto_payouts/{claim_link_id} with HMAC. NOT in the public guide; only works if the API has it.
 * Both map the remote status onto the claim chain exactly like a webhook would, via applyClaimEvent with a synthetic webhook_id,
 * so dedupe and state rules are shared.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { signRequest } from "./allscale/hmac.js";
import type { Orchestrator } from "./orchestrator.js";
import type { FileStore } from "./store.js";

const exec = promisify(execFile);

export interface RemoteClaim {
  status: string; // claimed | expired | cancelled | funded | pending_deposit | claiming | ...
  claim_tx_hash?: string | null;
  refund_tx_hash?: string | null;
}

export function normalize(raw: unknown): RemoteClaim | null {
  // Accept {payload:{...}} envelopes, {data:{...}}, or flat objects; accept snake or camel case.
  const o: any = (raw as any)?.payload ?? (raw as any)?.data ?? raw;
  if (!o || typeof o !== "object") return null;
  const status = o.status ?? o.state ?? o.claim_status;
  if (typeof status !== "string") return null;
  return { status: status.toLowerCase(), claim_tx_hash: o.claim_tx_hash ?? o.claimTxHash ?? null, refund_tx_hash: o.refund_tx_hash ?? o.refundTxHash ?? null };
}

export async function fetchViaCli(claimLinkId: string, cmd = process.env.CLAIM_STATUS_CLI ?? "allscale claim-link get {id} --json"): Promise<RemoteClaim | null> {
  const parts = cmd.replace("{id}", claimLinkId).split(/\s+/);
  const { stdout } = await exec(parts[0], parts.slice(1), { timeout: 30_000 });
  const start = stdout.indexOf("{");
  return normalize(JSON.parse(stdout.slice(start)));
}

export async function fetchViaRest(claimLinkId: string, o: { baseUrl: string; apiKey: string; apiSecret: string; fetchImpl?: typeof fetch }): Promise<RemoteClaim | null> {
  const path = `/v1/claim_link_auto_payouts/${encodeURIComponent(claimLinkId)}`;
  const headers = signRequest({ method: "GET", path, body: "", apiKey: o.apiKey, apiSecret: o.apiSecret });
  const res = await (o.fetchImpl ?? fetch)(o.baseUrl.replace(/\/$/, "") + path, { headers });
  if (!res.ok) return null;
  return normalize(await res.json());
}

/** One pass over funded-but-unclaimed obligations. Returns what changed. */
export async function pollOnce(orch: Orchestrator, store: FileStore, fetchOne: (claimLinkId: string) => Promise<RemoteClaim | null>): Promise<{ id: string; event: string }[]> {
  const changed: { id: string; event: string }[] = [];
  const targets = Object.values(store.get().obligations).filter((ob) => ob.payment.state === "funded" && ob.payment.claimLinkId && (ob.claim.state === "pending" || ob.claim.state === "refund_pending"));
  for (const ob of targets) {
    const r = await fetchOne(ob.payment.claimLinkId!).catch(() => null);
    if (!r) continue;
    const event = r.status === "claimed" ? "claimed" : r.status === "expired" ? "expired" : r.status === "cancelled" ? "cancelled" : null;
    if (!event) continue;
    const res = orch.applyClaimEvent({ webhook_id: `poll:${ob.payment.claimLinkId}:${event}`, reference_id: ob.id, event, claim_tx_hash: r.claim_tx_hash, refund_tx_hash: r.refund_tx_hash });
    if (res.applied) changed.push({ id: ob.id, event });
  }
  return changed;
}
