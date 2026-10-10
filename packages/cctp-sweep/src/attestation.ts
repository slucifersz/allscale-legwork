/** Poll Circle's V2 attestation API until the message for a source tx is complete. */
export interface Attested {
  message: `0x${string}`;
  attestation: `0x${string}`;
  status: string;
  eventNonce?: string;
}

export async function waitForAttestation(opts: {
  irisApi: string;
  sourceDomain: number;
  txHash: string; // Solana signature or EVM tx hash
  fetchImpl?: typeof fetch;
  intervalMs?: number;
  timeoutMs?: number;
  log?: (s: string) => void;
}): Promise<Attested> {
  const f = opts.fetchImpl ?? fetch;
  const url = `${opts.irisApi.replace(/\/$/, "")}/v2/messages/${opts.sourceDomain}?transactionHash=${opts.txHash}`;
  const deadline = Date.now() + (opts.timeoutMs ?? 30 * 60_000);
  while (Date.now() < deadline) {
    const res = await f(url);
    if (res.status === 404) {
      opts.log?.("attestation: not indexed yet");
    } else if (res.ok) {
      const j = (await res.json()) as { messages?: { message: string; attestation: string; status: string; eventNonce?: string }[] };
      const m = j.messages?.[0];
      if (m && m.status === "complete" && m.attestation && m.attestation !== "PENDING") {
        return { message: m.message as `0x${string}`, attestation: m.attestation as `0x${string}`, status: m.status, eventNonce: m.eventNonce };
      }
      opts.log?.(`attestation: status=${m?.status ?? "none"}`);
    } else {
      opts.log?.(`attestation: http ${res.status}`);
    }
    await new Promise((r) => setTimeout(r, opts.intervalMs ?? 5000));
  }
  throw new Error("attestation timeout");
}

/** 20-byte EVM address → 32-byte left-padded, as CCTP mintRecipient expects. */
export function evmAddressToBytes32(addr: string): Uint8Array {
  const hex = addr.replace(/^0x/, "").toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(hex)) throw new Error("bad evm address");
  const out = new Uint8Array(32);
  Buffer.from(hex, "hex").copy(out, 12);
  return out;
}
