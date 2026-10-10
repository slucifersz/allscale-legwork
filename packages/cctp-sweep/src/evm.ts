/** Destination side: call MessageTransmitterV2.receiveMessage(message, attestation) on the EVM chain. */
import { createPublicClient, createWalletClient, http, parseAbi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const abi = parseAbi([
  "function receiveMessage(bytes message, bytes attestation) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
]);

export async function receiveOnEvm(opts: { rpcUrl: string; relayerKey: Hex; messageTransmitter: Hex; message: Hex; attestation: Hex }) {
  const account = privateKeyToAccount(opts.relayerKey);
  const wallet = createWalletClient({ account, chain: sepolia, transport: http(opts.rpcUrl) });
  const pub = createPublicClient({ chain: sepolia, transport: http(opts.rpcUrl) });
  const hash = await wallet.writeContract({ address: opts.messageTransmitter, abi, functionName: "receiveMessage", args: [opts.message, opts.attestation] });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  return { hash, status: receipt.status };
}

export async function usdcBalance(opts: { rpcUrl: string; usdc: Hex; owner: Hex }): Promise<bigint> {
  const pub = createPublicClient({ chain: sepolia, transport: http(opts.rpcUrl) });
  return pub.readContract({ address: opts.usdc, abi, functionName: "balanceOf", args: [opts.owner] });
}
