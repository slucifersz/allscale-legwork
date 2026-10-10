/** Enums from the public AllScale integration guide (Auto-Payout section). */
export const Chain = {
  Ethereum: 1,
  Base: 5,
  BNB: 6,
  Arbitrum: 7,
  Polygon: 8,
  Optimism: 9,
  Sepolia: 11, // test environments only
} as const;
export type ChainId = (typeof Chain)[keyof typeof Chain];

export const StableCoin = { USDT: 1, USDC: 2 } as const;
export type StableCoinId = (typeof StableCoin)[keyof typeof StableCoin];

export interface CreateAutoPayoutRequest {
  amount: string; // decimal string, never a float
  stable_coin: StableCoinId;
  chain: ChainId;
  reference_id: string; // 1–128 printable ASCII, no spaces, case-sensitive
  receiver_email?: string;
  sender_display_name?: string;
  sender_message?: string;
}

export interface AutoPayoutPayload {
  claim_link_id: string;
  reference_id: string;
  amount: string;
  token_symbol: string;
  status: string; // e.g. pending_deposit, funded, claiming, claimed, cancelled, expired
  token: string | null; // only on first create
  claim_url: string | null; // only on first create
  funding_tx_hash: string | null; // only on first create
  funded_amount?: string;
  idempotent_hit: boolean;
}

export interface Envelope<T> {
  code: number; // 0 = success
  payload: T | null;
  error: { message?: string; details?: Record<string, unknown> } | null;
  request_id?: string;
}

/** Error codes documented for auto-payout. */
export const ErrorCode = {
  PAYOUT_NOT_ENABLED: 30002, // 403
  AUTO_PAYOUT_DISABLED: 50104, // 403 — key/env disabled (incl. sandbox keys)
  CREATE_FAILED: 50103, // 400 — pre-broadcast, no funds moved; see details.reason_code
  VALIDATION: 10001,
  DUPLICATE_REFERENCE: 50105, // 409 — concurrent create in flight
  REFERENCE_PARAM_CONFLICT: 50106, // 409 — same reference_id, different params
  NOT_FOUND: 50107,
  NOT_CANCELLABLE: 50108,
  AUTH_MISSING: 20001,
  AUTH_INVALID: 20002,
  RATE_LIMITED: 40001,
} as const;

export type CreateFailedReason = "session_expired" | "policy_denied" | "signer_error" | string;
