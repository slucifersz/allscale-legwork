/**
 * One-time prep for the sweep, no secrets printed:
 *   - DEST_RECIPIENT: the operator EOA, read from the Transfer log of the verification-one funding tx (the token sender).
 *   - EVM_RELAYER_PRIVATE_KEY: generated here if empty and written straight into .env; only its ADDRESS is printed
 *     so you can send it a little Sepolia ETH (it only pays gas for receiveMessage).
 *   npm run prep -- <fundingTxHash>
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { createPublicClient, http, getAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function setEnv(kv: Record<string, string>) {
  let s = readFileSync(".env", "utf8");
  for (const [k, v] of Object.entries(kv)) {
    const re = new RegExp(`^${k}=.*$`, "m");
    s = re.test(s) ? s.replace(re, `${k}=${v}`) : s + `\n${k}=${v}`;
  }
  writeFileSync(".env", s);
}

async function main() {
  const [txHash] = process.argv.slice(2);
  const out: Record<string, string> = {};
  const client = createPublicClient({ transport: http(process.env.EVM_RPC_URL ?? "https://rpc.sepolia.org") });

  if (txHash) {
    const rc = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
    const xfer = rc.logs.find((l) => l.topics[0] === TRANSFER);
    if (!xfer) throw new Error("no ERC-20 Transfer in that tx");
    const token = getAddress(xfer.address);
    const from = getAddress(("0x" + xfer.topics[1]!.slice(26)) as `0x${string}`);
    console.log("funding tx token    :", token, token.toLowerCase() === (process.env.EVM_USDC ?? "").toLowerCase() ? "(= EVM_USDC)" : "(≠ EVM_USDC — AllScale paid a different token; expected on gamma: USDT)");
    console.log("operator EOA (from) :", from);
    out.DEST_RECIPIENT = from;
  }

  let pk = process.env.EVM_RELAYER_PRIVATE_KEY ?? "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    pk = generatePrivateKey();
    out.EVM_RELAYER_PRIVATE_KEY = pk;
    console.log("relayer key         : generated and written to .env");
  }
  const relayer = privateKeyToAccount(pk as `0x${string}`);
  const eth = await client.getBalance({ address: relayer.address });
  console.log("relayer address     :", relayer.address, `(${Number(eth) / 1e18} ETH on Sepolia)`);
  if (eth === 0n) console.log("→ send it ~0.05 Sepolia ETH: https://cloud.google.com/application/web3/faucet/ethereum/sepolia or https://www.alchemy.com/faucets/ethereum-sepolia");

  if (Object.keys(out).length) setEnv(out);
  console.log("\n.env updated:", Object.keys(out).join(", ") || "nothing");
}
main().catch((e) => { console.error(e); process.exit(1); });
