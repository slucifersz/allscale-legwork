/**
 * Real-protocol x402 client (facilitator mode). Talks to the agent's POST /jobs the way any x402 buyer would:
 *   1. POST /jobs → 402 + PAYMENT-REQUIRED (price, network, payTo, feePayer)
 *   2. build + sign a Solana USDC transfer where the facilitator pays the fee
 *   3. POST /jobs again with PAYMENT-SIGNATURE → facilitator verifies + settles → 200 + PAYMENT-RESPONSE (tx)
 *
 *   CLIENT_SOLANA_SECRET_KEY=<base58> npm run client:x402 -- "天河区 A店, B店, C店 — open today? what's on the door?"
 */
import "dotenv/config";
import bs58 from "bs58";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";

const env = (k: string, d?: string) => process.env[k] ?? d ?? (() => { throw new Error(`missing env ${k}`); })();

async function main() {
  const [request = "A店, B店, C店"] = process.argv.slice(2);
  const url = env("AGENT_URL", "http://localhost:4020") + "/jobs";
  const signer = await createKeyPairSignerFromBytes(bs58.decode(env("CLIENT_SOLANA_SECRET_KEY")));
  // Client-side budget: the SDK refuses any single payment above this (default is $1). Set to the job price.
  const maxPerPayment = env("CLIENT_MAX_PER_PAYMENT_USD", "$10");
  const client = registerExactSvmScheme(new x402Client().setSpendControls({ maxAmountPerPayment: maxPerPayment }), { signer });
  const http = new x402HTTPClient(client);
  const body = JSON.stringify({ request });
  const json = { "content-type": "application/json" };

  console.log(`client ${signer.address} → ${url} (max per payment ${maxPerPayment})`);
  const first = await fetch(url, { method: "POST", headers: json, body });
  if (first.status !== 402) {
    console.log(`expected 402, got ${first.status}:`, await first.text());
    process.exit(1);
  }
  const firstBody = await first.json().catch(() => undefined);
  const required = http.getPaymentRequiredResponse((n) => first.headers.get(n), firstBody);
  const acc = required.accepts[0] as Record<string, unknown>;
  console.log(`402 PAYMENT-REQUIRED: ${acc.amount} atomic on ${acc.network} → ${acc.payTo} (feePayer ${(acc.extra as Record<string, unknown> | undefined)?.feePayer ?? "n/a"})`);

  const payload = await http.createPaymentPayload(required);
  console.log(`signed payment (x402Version ${payload.x402Version})`);

  const second = await fetch(url, { method: "POST", headers: { ...json, ...http.encodePaymentSignatureHeader(payload) }, body });
  const out = await second.json().catch(() => undefined);
  let settle: unknown = undefined;
  try {
    settle = http.getPaymentSettleResponse((n) => second.headers.get(n));
  } catch {
    /* no PAYMENT-RESPONSE header */
  }
  console.log(second.status, JSON.stringify(out, null, 2));
  if (settle) console.log("PAYMENT-RESPONSE:", JSON.stringify(settle));
  if (second.status !== 200) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
