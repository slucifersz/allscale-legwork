# Verified facts for the pitch (with sources)

Checked 2026-10-10. Only what was actually opened is listed; quotes are from the pages.

## Workers who did AI work and lost access to pay

- Rest of World, Russell Brandom, 28 Mar 2024 — *Scale AI's Remotasks platform is dropping whole countries without explanation*: "Remotasks has shut down entirely in Kenya, Nigeria, and Pakistan over the last month." A Nigerian translator "had less than a dollar to show for five projects totaling more than 20 hours of work." https://restofworld.org/2024/scale-ai-remotasks-banned-workers/
- Countries named in that piece: Kenya, Nigeria, Pakistan (+ sign-ups halted in Thailand, Vietnam, Poland). **Not** Philippines or Venezuela — do not cite those from this source.
- CBS News / 60 Minutes on Kenyan AI workers (background only): https://www.cbsnews.com/news/ai-work-kenya-exploitation-60-minutes/

Use: one line of background. A new payment rail does not fix a platform deciding not to pay; what we show is reward fixed before work + obligation reserved + payout by email.

## Why "Stripe Connect" is not the answer for these workers

- Stripe docs, Connect cross-border payouts: "Platforms based in the US, UK, EEA, Canada, or Switzerland can transfer funds to connected accounts in any of those regions … Stripe doesn't support self-serve cross-border payouts to countries outside the listed regions. Contact sales to discuss alternatives, or use Global Payouts." https://docs.stripe.com/connect/cross-border-payouts
- So a marketplace paying workers through Connect reaches recipients in US/UK/EEA/CA/CH self-serve. Kenya, Nigeria, Pakistan, Philippines, Venezuela are not in that list. Global Payouts (US/UK platforms) has its own recipient-country list — not checked; say "self-serve Connect payouts" precisely, not "Stripe can't".
- RentAHuman (agent-hires-humans marketplace) pays workers via Stripe Connect; funding via USDC on Base / x402. https://www.rentahuman.ai/docs

## Prior Colosseum winners in AI payments (official announcements)

- Latinum — Breakout 2025, AI track 1st: "a payment middleware that enables MCP builders to get paid". https://blog.colosseum.com/announcing-the-winners-of-the-solana-breakout-hackathon/
- MCPay — Cypherpunk 2025, Stablecoin 1st: "open payment infrastructure connecting MCP and x402"; Corbits — Infra 2nd: "open-source x402 endpoint dashboard for merchants"; Mercantill — Stablecoin 4th: "enterprise banking infrastructure for AI agents". https://blog.colosseum.com/announcing-the-winners-of-the-solana-cypherpunk-hackathon/
- All money flows: human→agent or agent→API. None pays a human without a wallet.

## Rails used here

- AllScale Claim Link: "currently supports USDT and USDC only", "no wallet address required", recipients without a wallet register by email; 14-day unclaimed refund; 0.6% + network fee. https://www.allscale.io/solutions/creator-rewards-platforms
- AllScale Auto-Payout API: enable API-Auto-Payout in Dashboard → key gets `claim_link:auto_payout` (wildcard `*` does not); sandbox/test-store keys hard-blocked; Sepolia chain id 11 on test envs; call blocks up to ~90 s; same `reference_id` → original link. https://raw.githubusercontent.com/allscale-io/allscale-checkout-skill/main/.claude/commands/integrate-allscale.md
- x402 on Solana: devnet `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`, devnet USDC `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`; headers `PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE` / `PAYMENT-RESPONSE`. https://solana.com/docs/payments/agentic-payments/x402 — x402.org facilitator listed as supporting Solana devnet (testnet only). https://docs.x402.org/core-concepts/network-and-token-support
- Circle CCTP V2: Solana devnet programs MessageTransmitterV2 `CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC`, TokenMessengerMinterV2 `CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe`, Solana domain 5, Ethereum domain 0; attestation `GET https://iris-api-sandbox.circle.com/v2/messages/{domain}?transactionHash=…`; EVM `receiveMessage(bytes,bytes)`; Sepolia USDC `0x1c7d4b196cb0c7b01d743fbc6116a902379c7238`, TokenMessengerV2 testnet `0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa`. https://developers.circle.com/cctp/references/solana-programs · https://developers.circle.com/cctp/transfer-usdc-on-testnet-from-ethereum-to-avalanche · https://developers.circle.com/cctp/migration-from-v1-to-v2
- CCTP V2 MessageTransmitterV2 on Ethereum Sepolia: `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` is the address Circle uses on other EVM testnets; **confirm on the contract-addresses page before relying on it** (page fetch failed today).

## Still unverified

- **Verified 2026-10-10** `curl https://x402.org/facilitator/supported`: lists `{x402Version:2, scheme:"exact", network:"solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", extra:{feePayer:"CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5", features:{smartWalletSupported:true}}}` and v1 `solana-devnet`. Our server config matches. Facilitator pays the Solana fee; the client must sign with that feePayer (handled by `@x402/svm/exact/client`, see `packages/x402-server/src/x402-client.ts`).
- Whether AllScale gamma's Sepolia USDC is Circle's `0x1c7d…7238` (plan §8 Q3).

- **Verification-one funding tx decoded (Sepolia `0xd7ea677e…c7eb`)**: tx `from` = AllScale relayer `0xc298…` (EIP-7702 gasless confirmed); token = `0x7169d38820dfd117c3fa1f22a697dba58d90ba06` (test USDT, not Circle USDC); operator EOA = `0x8f7bFB68A6E7c57094Ee2b34BC05eEBE0BEbEc9e`; transfers: 1.000000 USDT → claim-link contract `0x17b60025…`, 1.432000 USDT → `0x694db4a9…` (fee? ask tech what this is and the production fee schedule).
