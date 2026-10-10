/**
 * Demo client for selfverify mode: pay USDC on Solana devnet to the agent, then POST /jobs with the signature.
 *   CLIENT_SOLANA_SECRET_KEY=<base58> npm run client -- "天河区 A店, B店, C店 — open today? what's on the door?" [amount]
 * (facilitator mode: use any x402 client SDK against the same endpoint; this script is only for the fallback.)
 */
import "dotenv/config";
import bs58 from "bs58";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, transfer } from "@solana/spl-token";

const env = (k: string, d?: string) => process.env[k] ?? d ?? (() => { throw new Error(`missing env ${k}`); })();

async function main() {
  const [request = "A店, B店, C店", amount = env("JOB_PRICE_USDC", "9")] = process.argv.slice(2);
  const conn = new Connection(env("SOLANA_RPC_URL", "https://api.devnet.solana.com"), "confirmed");
  const payer = Keypair.fromSecretKey(bs58.decode(env("CLIENT_SOLANA_SECRET_KEY")));
  const mint = new PublicKey(env("USDC_MINT"));
  const payTo = new PublicKey(env("SOLANA_PAY_TO"));
  const [i, f = ""] = amount.split(".");
  const atomic = BigInt(i) * 1_000_000n + BigInt((f + "000000").slice(0, 6));

  const from = await getOrCreateAssociatedTokenAccount(conn, payer, mint, payer.publicKey);
  const to = await getOrCreateAssociatedTokenAccount(conn, payer, mint, payTo);
  console.log(`paying ${amount} USDC ${payer.publicKey.toBase58()} → ${payTo.toBase58()}`);
  const sig = await transfer(conn, payer, from.address, to.address, payer, atomic);
  console.log(`tx ${sig}`);

  const url = env("AGENT_URL", "http://localhost:4020") + "/jobs";
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "X-Solana-Tx": sig }, body: JSON.stringify({ request }) });
  console.log(res.status, JSON.stringify(await res.json(), null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
