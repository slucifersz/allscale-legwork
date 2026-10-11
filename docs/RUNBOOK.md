# Runbook — from zero to the three verifications

All commands from the repo root unless noted. Node ≥ 20. `npm install` once.

## 0. Credentials you need (never commit them)

| what | where it goes | how to get |
| --- | --- | --- |
| AllScale **Store API key + secret** with scope `claim_link:auto_payout` | `packages/payout-orchestrator/.env` and `packages/web/.env` | gamma Dashboard → non-test store → Store Settings → Payout → Enable API-Auto-Payout → signing session + limits → copy credentials |
| AllScale gamma base URL | `ALLSCALE_BASE_URL` | **`https://openapi-sandbox.allscale.io`** (verified 10 Oct). Not `openapi-beta` (separate DB → invalid_key), not `gamma.allscale.io/api` (Main API → 2012). |
| Operator Turnkey EOA address (payout source) | `packages/cctp-sweep/.env` `DEST_RECIPIENT` | Dashboard wallet page; the token it pays is whatever it holds (gamma: USDT) |
| Agent Solana devnet wallet (base58 secret) | `packages/cctp-sweep/.env`, `SOLANA_PAY_TO` (its pubkey) in `packages/x402-server/.env` | `solana-keygen new`; airdrop SOL; get devnet USDC from faucet.circle.com; create its USDC ATA |
| Sepolia relayer key (gas only) | `EVM_RELAYER_PRIVATE_KEY` | any throwaway key with Sepolia ETH |
| x402 facilitator URL supporting `solana:EtWT…` | `FACILITATOR_URL` | solana.com/docs/tools/x402-facilitator → pick one; or set `X402_MODE=selfverify` |

## 1. Verification one — unattended Auto-Payout (plan §10)

**Passed 2026-10-10 13:16 UTC** on gamma: `POST https://openapi-sandbox.allscale.io/v1/claim_link_auto_payouts`, 1 USDT, Sepolia, 14.9 s,
`funding_tx_hash 0xd7ea677e…c7eb`, `claim_url` on `gamma.allscale.io/s/…`, `idempotent_hit:false`. Claim links on gamma live under
`gamma.allscale.io/s/<token>`, not `app.allscale.io/claim/…`. The token in the URL is a bearer credential — never commit or publish it.

```
cd packages/payout-orchestrator
cp .env.example .env   # fill ALLSCALE_*; ALLSCALE_CHAIN=11 (Sepolia), ALLSCALE_STABLE_COIN=1 (USDT — what the gamma wallet holds)
npm run cli -- ping    # note: /v1/test/ping may not exist on gamma; a 404 here is not an auth failure
npm run cli -- send-test you@yourmail.com 1
```

Pass = all four: no browser prompt during the call · output shows `payment.state: "funded"`, `fundingTxHash`, `claimUrl` · the email arrives and you can claim · then:

```
npm run cli -- resend <obligation_id>    # expect idempotent_hit (claimUrl kept from first run), no second link
```

Record: environment, store type, the USDC contract the funding tx moved (compare with `EVM_USDC` in cctp-sweep), limit settings.

If it fails: `npm run cli -- status <obligation_id>` shows `lastError.code` / `reasonCode`. 30002 / 50104 → payout not enabled on this key. 50103 session_expired / policy_denied → redo the Dashboard authorization. 20001/20002 → key/secret/signing.

## 2. Verification two — revoke the paying credential

In Dashboard revoke the Store API credential (or the payout authorization) used in step 1. Then with the SAME old credential:

```
npm run cli -- send-test you@yourmail.com 1    # NEW obligation → new reference_id
```

Pass = rejected (expect 20002 / 50104 / 50103) and no funding tx on chain. Replaying an old reference_id proves nothing.

## 3. CCTP sweep (Solana devnet → Sepolia, into the operator EOA)

```
cd packages/cctp-sweep && cp .env.example .env   # fill
npm run sweep -- 1
```

Before the first real run, open `src/solana.ts` and compare the account list with `tests/utils.ts` in github.com/circlefin/solana-cctp-contracts — it was written from the docs, not executed. If `fetchIdl` returns null, download the program IDL JSON and set `CCTP_IDL_PATH`. Attestation on testnet can take minutes; `--resume <solana_sig>` finishes an interrupted run.

Then check the minted token's contract on Sepolia equals the USDC AllScale paid from in step 1 (plan §8 Q3). If not, the sweep lands money AllScale cannot spend — stop and ask.

## 4. Run the demo stack

```
# terminal 1 — agent's paid endpoint
cd packages/x402-server && cp .env.example .env && npm run dev
# terminal 2 — task board / review / settlement record
cd packages/web && cp .env.example .env && npm run dev
# terminal 3 (optional) — webhook receiver for claimed/expired/cancelled
cd packages/payout-orchestrator && node --import tsx src/webhook.ts
```

Client call (facilitator mode, the real protocol — use this for the demo):

```
cd packages/x402-server
npm run client:x402 -- "天河区 A店, B店, C店 — open today?"
```
Prints the 402, the signed payment, then 200 + PAYMENT-RESPONSE with the settled Solana tx.

Client call (selfverify mode, fallback if the facilitator is down): pay USDC on devnet to `SOLANA_PAY_TO`, then

```
curl -X POST localhost:4020/jobs -H 'content-type: application/json' -H "X-Solana-Tx: <signature>" \
  -d '{"request":"天河区 A店, B店, C店 — open today? what notice is on the door?"}'
```

→ job + 3 tasks reserved (90% of revenue to humans). Workers open `/work`, take, submit a photo. Operator opens `/review?token=…`, clicks **Accept & pay** → Auto-Payout fires → `/` shows Solana tx → funding tx → claim state.

## 5. What is pre-existing (disclose in the Colosseum form)

AllScale Claim Link Auto-Payout API and AllScale CLI are company products. Circle CCTP, x402 SDKs, Solana are third-party. Everything in this repo is new.

## 6. One-command devnet setup (added 10 Oct)

```
npm run setup-devnet            # makes agent + client devnet wallets, airdrops SOL, creates USDC accounts, writes keys into .env files
# then: https://faucet.circle.com → Solana Devnet → paste BOTH pubkeys printed above
npm run setup-devnet            # again, to see USDC balances
cd packages/cctp-sweep && npm run sweep -- --check   # verifies config + balances, moves nothing
```
