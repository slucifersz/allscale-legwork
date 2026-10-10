# Colosseum submission — field by field

Deadline: 12 Oct 2026 23:59 PT (13 Oct 14:59 Beijing). Team leader uploads. Every member registered at colosseum.com first.
Narrative fields are yours to write (draft, then get it torn apart). Factual fields are filled below.

| Form field | Status | Content / what to write |
| --- | --- | --- |
| Product name | **decide** (§8 Q9 — AllScale prefix or standalone) | working name: Agent Payroll |
| Brief description | you write, ≤ 2 sentences, English | must contain: who pays (client, USDC on Solana), who gets paid (a human with only an email), what AllScale does (funds the claim link within an operator-set budget). No "revolutionize", no "trillion". |
| Blockchains and tools integrated | filled | Solana (x402 `exact` scheme, devnet), Ethereum Sepolia (AllScale Auto-Payout settlement, chain id 11), Circle CCTP V2 (Solana → EVM USDC), AllScale Claim Link Auto-Payout API + AllScale CLI, Anthropic API (task planning + result compilation, optional) |
| Teammates & backgrounds | you fill | one line each; AllScale roles stated plainly |
| Team location | you fill | Guangzhou / Hong Kong per actual |
| Logo | **todo** | 512×512 PNG |
| GitHub repo | filled after `git init` | private is fine — grant hackathon@colosseum.com. README already separates pre-existing vs new. |
| Presentation video (2–3 min) | you record | order: (1) one real payout you ran: email → claim → tx hash, 20 s; (2) the gap: agent payments stop at the agent's wallet — RentAHuman pays via Stripe Connect, which self-serve reaches only US/UK/EEA/CA/CH; (3) what we built: one money trail, Solana → CCTP → claim links; (4) controls: reward fixed before work, obligation reserved, revoke → agent cannot pay; (5) first customers: AllScale Payout clients already automating (name from §8 Q6), disclosure. |
| Product demo video (≤ 3 min) | you record | plan §5 steps 1–9, screen only, testnet labels visible, no narration of features that are not on screen |
| Go-to-market / demand validation / distribution | you write | demand: the one customer call (§8 Q10) — quote, not adjectives; distribution: AllScale sales channel + CLI developer docs; pricing hypothesis: per payout (0.6% + network) is AllScale's existing model, say so |
| Pre-existing code disclosure | filled | "AllScale Claim Link Auto-Payout API and AllScale CLI are the company's existing products and were not written during the hackathon. Circle CCTP, x402 SDKs and Solana are third-party. Everything in this repository (orchestrator, x402 endpoint, task board, settlement record, CCTP sweep, tests) was written between 10 and 12 Oct 2026." |

## Judging criteria → where our evidence is

| Criterion (FAQ + rules §8) | Evidence to point at |
| --- | --- |
| Founder-market fit | AllScale already runs payouts for creator/contractor platforms; the team works there |
| Insight | agent payments end at the agent's wallet; the human last mile needs email-only payout + budget control, not a new chain |
| Product & execution | 24+ tests incl. HTTP e2e with HMAC/idempotency; three state chains; real 402 middleware flow; revoke demo |
| Functionality / UX | task board → review → pay in three clicks; worker never sees a wallet |
| Open source | repo public after the hackathon (decide) |
| Viability / business plan | AllScale's existing fee model; first customers from its payout book |
| Traction | 3 real workers completed tasks and claimed test USDC (say "test tokens", not "earnings"); 1 customer conversation |
| Communication | the money-trail view is the one slide |

## Honesty checklist before upload

- [ ] Every tx in the videos is labelled devnet / Sepolia / gamma.
- [ ] "Humans claimed test tokens", never "humans got paid real money".
- [ ] If CCTP did not land before payout in the recording: say "funded from pre-deposited test USDC; sweep in flight".
- [ ] If CLI could not do unattended payout: say "REST Auto-Payout; CLI used for keys/status"; do not say the CLI pays.
- [ ] Remotasks citation is Rest of World 28 Mar 2024, Kenya/Nigeria/Pakistan — nothing else.
- [ ] Stripe claim is "self-serve Connect cross-border payouts: US/UK/EEA/CA/CH only" — nothing broader.
