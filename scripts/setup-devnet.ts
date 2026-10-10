/**
 * One-shot Solana devnet setup. Creates the AGENT wallet and a CLIENT wallet, airdrops SOL, creates their USDC token
 * accounts, and writes the keys into the three package .env files. Re-runnable: existing keys are kept.
 *   node --import tsx scripts/setup-devnet.ts
 * After this: get devnet USDC for BOTH public keys at https://faucet.circle.com (network: Solana Devnet).
 */
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, getAccount } from "@solana/spl-token";
import bs58 from "bs58";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const USDC = new PublicKey(process.env.USDC_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const root = join(import.meta.dirname, "..");
const keysDir = join(root, ".devnet-keys");
mkdirSync(keysDir, { recursive: true });

function loadOrCreate(name: string): Keypair {
  const f = join(keysDir, `${name}.json`);
  if (existsSync(f)) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(f, "utf8"))));
  const kp = Keypair.generate();
  writeFileSync(f, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}
function setEnv(file: string, kv: Record<string, string>) {
  if (!existsSync(file)) {
    const ex = file.replace(/\.env$/, ".env.example");
    writeFileSync(file, existsSync(ex) ? readFileSync(ex, "utf8") : "");
  }
  let s = readFileSync(file, "utf8");
  for (const [k, v] of Object.entries(kv)) {
    const re = new RegExp(`^${k}=.*$`, "m");
    s = re.test(s) ? s.replace(re, `${k}=${v}`) : s + `\n${k}=${v}`;
  }
  writeFileSync(file, s);
}

async function ensureSol(conn: Connection, pk: PublicKey, label: string) {
  const bal = await conn.getBalance(pk);
  if (bal >= 0.5 * LAMPORTS_PER_SOL) return console.log(`${label}: ${bal / LAMPORTS_PER_SOL} SOL (ok)`);
  try {
    const sig = await conn.requestAirdrop(pk, 1 * LAMPORTS_PER_SOL);
    await conn.confirmTransaction(sig, "confirmed");
    console.log(`${label}: airdropped 1 SOL`);
  } catch (e) {
    console.log(`${label}: airdrop failed (${String(e).slice(0, 80)}) — use https://faucet.solana.com for ${pk.toBase58()}`);
  }
}

async function main() {
  const conn = new Connection(RPC, "confirmed");
  const agent = loadOrCreate("agent");
  const client = loadOrCreate("client");
  console.log("agent  pubkey:", agent.publicKey.toBase58());
  console.log("client pubkey:", client.publicKey.toBase58());
  await ensureSol(conn, agent.publicKey, "agent");
  await ensureSol(conn, client.publicKey, "client");
  for (const [label, kp] of [["agent", agent], ["client", client]] as const) {
    try {
      const ata = await getOrCreateAssociatedTokenAccount(conn, kp, USDC, kp.publicKey);
      const acc = await getAccount(conn, ata.address);
      console.log(`${label}: USDC account ${ata.address.toBase58()} balance ${Number(acc.amount) / 1e6} USDC`);
    } catch (e) {
      console.log(`${label}: could not create USDC account yet (needs SOL): ${String(e).slice(0, 80)}`);
    }
  }
  const agentSecret = bs58.encode(agent.secretKey);
  const clientSecret = bs58.encode(client.secretKey);
  setEnv(join(root, "packages/x402-server/.env"), { SOLANA_PAY_TO: agent.publicKey.toBase58(), CLIENT_SOLANA_SECRET_KEY: clientSecret, SOLANA_RPC_URL: RPC, USDC_MINT: USDC.toBase58() });
  setEnv(join(root, "packages/cctp-sweep/.env"), { AGENT_SOLANA_SECRET_KEY: agentSecret, SOLANA_RPC_URL: RPC, USDC_MINT: USDC.toBase58() });
  console.log("\nwrote keys into packages/x402-server/.env and packages/cctp-sweep/.env (keys also in .devnet-keys/, gitignored)");
  console.log("\nNEXT: get devnet USDC for both pubkeys at https://faucet.circle.com (Solana Devnet), then run this script again to see balances.");
}
main().catch((e) => { console.error(e); process.exit(1); });
