/**
 * Source side: TokenMessengerMinterV2.depositForBurn on Solana.
 *
 * Accounts and seeds checked on 2026-10-10 against the program source
 * (programs/v2/token-messenger-minter-v2/src/token_messenger_v2/instructions/deposit_for_burn.rs, initialize.rs,
 * add_remote_token_messenger.rs; message-transmitter-v2/src/instructions/initialize.rs):
 *   sender_authority · denylist_account+owner · message_transmitter · token_messenger · remote_token_messenger+domain-as-string
 *   · token_minter · local_token+mint · message_sent_event_data = fresh signer · #[event_cpi] → event_authority + program.
 * Not yet executed on devnet. The IDL is not in the repo; it is fetched from the on-chain IDL account at runtime
 * (`anchor idl fetch CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe` also works) — set CCTP_IDL_PATH if fetch returns null.
 */
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { readFileSync } from "node:fs";

export interface BurnOptions {
  rpcUrl: string;
  payer: Keypair; // agent wallet (owns the USDC)
  usdcMint: PublicKey;
  messageTransmitter: PublicKey;
  tokenMessengerMinter: PublicKey;
  destinationDomain: number;
  mintRecipient32: Uint8Array; // 32-byte padded EVM address
  amountAtomic: bigint;
  maxFeeAtomic?: bigint; // 0 for standard transfer
  minFinalityThreshold?: number; // 2000 standard, ≤1000 fast
  idlPath?: string;
}

const pda = (seeds: (Buffer | Uint8Array)[], program: PublicKey) => PublicKey.findProgramAddressSync(seeds, program)[0];

export async function depositForBurn(o: BurnOptions): Promise<{ signature: string; messageSentEventData: string }> {
  const connection = new Connection(o.rpcUrl, "confirmed");
  const wallet = new anchor.Wallet(o.payer);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const idl = o.idlPath ? (JSON.parse(readFileSync(o.idlPath, "utf8")) as anchor.Idl) : await anchor.Program.fetchIdl(o.tokenMessengerMinter, provider);
  if (!idl) throw new Error("no IDL for TokenMessengerMinterV2; set CCTP_IDL_PATH");
  const program = new anchor.Program(idl, provider);

  const tm = o.tokenMessengerMinter;
  const mt = o.messageTransmitter;
  const domainStr = Buffer.from(String(o.destinationDomain));
  const accounts = {
    owner: o.payer.publicKey,
    eventRentPayer: o.payer.publicKey,
    senderAuthorityPda: pda([Buffer.from("sender_authority")], tm),
    burnTokenAccount: getAssociatedTokenAddressSync(o.usdcMint, o.payer.publicKey),
    denylistAccount: pda([Buffer.from("denylist_account"), o.payer.publicKey.toBuffer()], tm),
    messageTransmitter: pda([Buffer.from("message_transmitter")], mt),
    tokenMessenger: pda([Buffer.from("token_messenger")], tm),
    remoteTokenMessenger: pda([Buffer.from("remote_token_messenger"), domainStr], tm),
    tokenMinter: pda([Buffer.from("token_minter")], tm),
    localToken: pda([Buffer.from("local_token"), o.usdcMint.toBuffer()], tm),
    burnTokenMint: o.usdcMint,
    messageSentEventData: Keypair.generate(),
    messageTransmitterProgram: mt,
    tokenMessengerMinterProgram: tm,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
    eventAuthority: pda([Buffer.from("__event_authority")], tm),
    program: tm,
  };

  const args = {
    amount: new anchor.BN(o.amountAtomic.toString()),
    destinationDomain: o.destinationDomain,
    mintRecipient: new PublicKey(o.mintRecipient32),
    destinationCaller: PublicKey.default, // anyone may call receiveMessage
    maxFee: new anchor.BN((o.maxFeeAtomic ?? 0n).toString()),
    minFinalityThreshold: o.minFinalityThreshold ?? 2000,
  };

  const sig = await (program.methods as any)
    .depositForBurn(args)
    .accounts({ ...accounts, messageSentEventData: accounts.messageSentEventData.publicKey })
    .signers([accounts.messageSentEventData])
    .rpc();
  return { signature: sig, messageSentEventData: accounts.messageSentEventData.publicKey.toBase58() };
}
