# Agent Payroll

An AI agent that earns USDC on Solana (x402) and pays the humans who do the parts it cannot — through AllScale claim links. Recipients need only an email.

Built during the Colosseum Crypto World's Fair Hackathon (Solana track), Oct 2026.

## Packages

| package | what it is | status |
| --- | --- | --- |
| `packages/payout-orchestrator` | obligations → AllScale Auto-Payout (HMAC, idempotent by `reference_id`, 50103/50105/50106 handling, 90 s timeout recovery), three independent state chains (task / payment / claim), webhook verification, operator CLI | 15 tests, typecheck clean |
| `packages/x402-server` | the agent's paid endpoint on Solana: x402 via `@x402/express` + facilitator, or self-verify fallback (`X-Solana-Tx`); AI planner → tasks reserved within budget | 4 tests, typecheck clean |
| `packages/web` | task board (`/work`), operator review that accepts & pays (`/review`), public settlement record (`/`) | 2 tests, smoke-tested |
| `packages/cctp-sweep` | Solana devnet → Sepolia USDC via Circle CCTP V2 into the operator EOA; attestation poller, EVM receive | 2 tests; Solana burn accounts written from docs — verify before first run |

## How the money moves

1. A client calls the agent's x402 endpoint (`POST /jobs`) and pays USDC on Solana.
2. The agent (AI planner) splits the request into on-site micro-tasks; rewards and acceptance criteria are fixed before any human sees them; the total is reserved against the job's revenue.
3. Humans take tasks on the task board, go on site, submit a photo. Structural checks (EXIF time, GPS) are advisory.
4. A person accepts → an **obligation** is created (one `reference_id`, amount never changes) → the orchestrator calls AllScale Auto-Payout → a claim link is funded from the operator's wallet → the worker gets an email and claims the stablecoin (USDT or USDC, whichever the operator wallet holds) with no wallet, no gas, no KYC.
5. Meanwhile the job's Solana revenue is swept to the operator's EVM wallet via Circle CCTP, so the settlement record shows one money from client to human.
6. The operator can revoke the agent's paying credential at any time; the agent then cannot pay.

Three independent state chains (task / payment / claim) and reference-id idempotency make the payout crash-safe: a timeout is retried with the same id and returns the original link; an expired, refunded link does not erase the debt — it is re-issued under a new id.

Docs: `docs/RUNBOOK.md` (run it, three verifications), `docs/RESEARCH.md` (verified facts + sources), `docs/SUBMISSION.md` (Colosseum form).

## Pre-existing vs new work (disclosure)

- **Pre-existing AllScale products used, not written here:** AllScale Claim Link Auto-Payout API (`POST /v1/claim_link_auto_payouts`), AllScale CLI.
- **Everything in this repository** was written during the hackathon period.
