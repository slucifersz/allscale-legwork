/**
 * One sweep: burn on Solana → wait attestation → mint on EVM into DEST_RECIPIENT.
 *   npm run sweep -- <amount_usdc>          e.g. 9
 *   npm run sweep -- --resume <solana_sig>  skip the burn, finish an earlier one
 *   add --job <job_id> to record the sweep on that job in the shared ledger (PAYROLL_DATA_DIR)
 *   npm run sweep -- --check                 no transfer: verify config, balances, and that EVM_USDC matches the contract the
 *                                            operator wallet already holds (the AllScale payout token)
 */
import "dotenv/config";
import bs58 from "bs58";
import { Keypair, PublicKey } from "@solana/web3.js";
import { evmAddressToBytes32, waitForAttestation } from "./attestation.js";
import { depositForBurn } from "./solana.js";
import { receiveOnEvm, usdcBalance } from "./evm.js";
import { FileStore } from "@agent-payroll/payout-orchestrator/src/store.js";

const env = (k: string, d?: string) => process.env[k] ?? d ?? (() => { throw new Error(`missing env ${k}`); })();
const log = (s: string) => console.log(new Date().toISOString(), s);

function recordSweep(jobId: string | undefined, patch: Partial<NonNullable<import("@agent-payroll/payout-orchestrator/src/model.js").Job["sweep"]>>) {
  if (!jobId) return;
  const store = new FileStore(process.env.PAYROLL_DATA_DIR ?? "../payout-orchestrator/data");
  store.update((l) => {
    const j = l.jobs[jobId];
    if (!j) throw new Error(`unknown job ${jobId}`);
    j.sweep = { solanaBurnTx: "", state: "burned", ...(j.sweep ?? {}), ...patch, updatedAt: new Date().toISOString() } as NonNullable<typeof j.sweep>;
  });
}

async function check() {
  const { Connection, Keypair, PublicKey } = await import("@solana/web3.js");
  const { getAssociatedTokenAddressSync, getAccount } = await import("@solana/spl-token");
  const conn = new Connection(env("SOLANA_RPC_URL"), "confirmed");
  const payer = Keypair.fromSecretKey(bs58.decode(env("AGENT_SOLANA_SECRET_KEY")));
  const mint = new PublicKey(env("USDC_MINT"));
  console.log("agent solana wallet :", payer.publicKey.toBase58());
  const sol = await conn.getBalance(payer.publicKey);
  console.log("agent SOL           :", sol / 1e9, sol < 5_000_000 ? "← too low for a burn tx, airdrop" : "");
  try {
    const acc = await getAccount(conn, getAssociatedTokenAddressSync(mint, payer.publicKey));
    console.log("agent devnet USDC   :", Number(acc.amount) / 1e6);
  } catch {
    console.log("agent devnet USDC   : no token account yet (run setup-devnet / faucet.circle.com)");
  }
  const dest = env("DEST_RECIPIENT") as `0x${string}`;
  console.log("dest EVM (operator) :", dest, "domain", env("DEST_DOMAIN"));
  const bal = await usdcBalance({ rpcUrl: env("EVM_RPC_URL"), usdc: env("EVM_USDC") as `0x${string}`, owner: dest });
  console.log("operator EVM_USDC   :", Number(bal) / 1e6, "at", env("EVM_USDC"));
  console.log("relayer key set     :", Boolean(process.env.EVM_RELAYER_PRIVATE_KEY));
  console.log("iris api            :", env("IRIS_API"));
  console.log("\nIf AllScale's gamma payout moves a DIFFERENT token contract than EVM_USDC, minted funds will not be spendable by AllScale.");
  console.log("Compare EVM_USDC with the token in your verification-one funding tx on sepolia.etherscan.io.");
}

async function main() {
  const argvAll = process.argv.slice(2);
  if (argvAll.includes("--check")) return check();
  const jobIdx = argvAll.indexOf("--job");
  const jobId = jobIdx >= 0 ? argvAll[jobIdx + 1] : undefined;
  const argv = argvAll.filter((_, i) => i !== jobIdx && i !== jobIdx + 1);
  let sig: string;
  if (argv[0] === "--resume") {
    sig = argv[1];
  } else {
    const amount = argv[0] ?? "1";
    const [i, f = ""] = amount.split(".");
    const atomic = BigInt(i) * 1_000_000n + BigInt((f + "000000").slice(0, 6));
    const payer = Keypair.fromSecretKey(bs58.decode(env("AGENT_SOLANA_SECRET_KEY")));
    log(`burning ${amount} USDC from ${payer.publicKey.toBase58()} → domain ${env("DEST_DOMAIN")} recipient ${env("DEST_RECIPIENT")}`);
    const r = await depositForBurn({
      rpcUrl: env("SOLANA_RPC_URL"),
      payer,
      usdcMint: new PublicKey(env("USDC_MINT")),
      messageTransmitter: new PublicKey(env("CCTP_MESSAGE_TRANSMITTER_V2")),
      tokenMessengerMinter: new PublicKey(env("CCTP_TOKEN_MESSENGER_MINTER_V2")),
      destinationDomain: Number(env("DEST_DOMAIN")),
      mintRecipient32: evmAddressToBytes32(env("DEST_RECIPIENT")),
      amountAtomic: atomic,
      idlPath: process.env.CCTP_IDL_PATH,
    });
    sig = r.signature;
    log(`burn tx ${sig}`);
    recordSweep(jobId, { solanaBurnTx: sig, state: "burned" });
  }
  const att = await waitForAttestation({ irisApi: env("IRIS_API"), sourceDomain: Number(env("SOLANA_DOMAIN")), txHash: sig, log });
  log(`attestation complete nonce=${att.eventNonce ?? "?"}`);
  recordSweep(jobId, { solanaBurnTx: sig, state: "attested" });
  const before = await usdcBalance({ rpcUrl: env("EVM_RPC_URL"), usdc: env("EVM_USDC") as `0x${string}`, owner: env("DEST_RECIPIENT") as `0x${string}` });
  const rx = await receiveOnEvm({ rpcUrl: env("EVM_RPC_URL"), relayerKey: env("EVM_RELAYER_PRIVATE_KEY") as `0x${string}`, messageTransmitter: env("EVM_MESSAGE_TRANSMITTER_V2") as `0x${string}`, message: att.message, attestation: att.attestation });
  const after = await usdcBalance({ rpcUrl: env("EVM_RPC_URL"), usdc: env("EVM_USDC") as `0x${string}`, owner: env("DEST_RECIPIENT") as `0x${string}` });
  log(`receiveMessage ${rx.hash} ${rx.status}; recipient USDC ${before} → ${after}`);
  recordSweep(jobId, { solanaBurnTx: sig, evmReceiveTx: rx.hash, mintedAtomic: (after - before).toString(), state: "minted" });
  console.log(JSON.stringify({ solana_burn_tx: sig, evm_receive_tx: rx.hash, minted_atomic: (after - before).toString() }, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
