import { signRequest } from "./hmac.js";
import type { AutoPayoutPayload, CreateAutoPayoutRequest, Envelope } from "./types.js";
import { ErrorCode } from "./types.js";

export interface ClientOptions {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  /** Server blocks up to ~90s while funding settles; give it room. */
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** Thrown for any non-zero envelope code or transport failure. */
export class AllScaleError extends Error {
  constructor(
    public readonly kind: "http" | "api" | "transport" | "timeout",
    public readonly code: number | null,
    message: string,
    public readonly details?: Record<string, unknown>,
    public readonly httpStatus?: number,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "AllScaleError";
  }
  get reasonCode(): string | undefined {
    const r = this.details?.["reason_code"];
    return typeof r === "string" ? r : undefined;
  }
  /** True when the documented remedy is "retry with the SAME reference_id". */
  get retryableSameReference(): boolean {
    if (this.kind === "timeout" || this.kind === "transport") return true;
    if (this.code === ErrorCode.DUPLICATE_REFERENCE) return true;
    if (this.code === ErrorCode.CREATE_FAILED && this.reasonCode === "signer_error") return true;
    if (this.code === ErrorCode.RATE_LIMITED) return true;
    return false;
  }
  /** True when a human must act (re-authorize, fix policy, enable payout) before any retry makes sense. */
  get needsOperator(): boolean {
    if (this.code === ErrorCode.PAYOUT_NOT_ENABLED || this.code === ErrorCode.AUTO_PAYOUT_DISABLED) return true;
    if (this.code === ErrorCode.CREATE_FAILED && (this.reasonCode === "session_expired" || this.reasonCode === "policy_denied")) return true;
    if (this.code === ErrorCode.AUTH_MISSING || this.code === ErrorCode.AUTH_INVALID) return true;
    return false;
  }
}

export class AllScaleClient {
  private readonly fetchImpl: typeof fetch;
  constructor(private readonly opts: ClientOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const raw = body === undefined ? "" : JSON.stringify(body);
    // Sign the path the server actually sees: base URL may carry a prefix (e.g. https://gamma.allscale.io/api).
    const url = new URL(this.opts.baseUrl.replace(/\/$/, "") + path);
    const signedPath = process.env.ALLSCALE_SIGN_PATH === "short" ? path : url.pathname;
    const headers = signRequest({ method, path: signedPath, query: url.search.replace(/^\?/, ""), body: raw, apiKey: this.opts.apiKey, apiSecret: this.opts.apiSecret });
    if (process.env.ALLSCALE_DEBUG) console.error(`[allscale] signing path=${signedPath} ts=${headers["X-Timestamp"]} nonce=${headers["X-Nonce"]}`);
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), this.opts.timeoutMs ?? 120_000);
    let res: Response;
    try {
      res = await this.fetchImpl(url.toString(), {
        method,
        headers,
        body: method === "GET" ? undefined : raw,
        signal: ctl.signal,
      });
    } catch (e) {
      clearTimeout(t);
      const isAbort = (e as { name?: string })?.name === "AbortError";
      throw new AllScaleError(isAbort ? "timeout" : "transport", null, isAbort ? "request timed out" : String(e));
    }
    clearTimeout(t);
    const text = await res.text();
    if (process.env.ALLSCALE_DEBUG) console.error(`[allscale] ${method} ${path} → ${res.status}\n${text.slice(0, 2000)}`);
    let env: Envelope<T> & { message?: string; msg?: string; data?: T };
    try {
      env = JSON.parse(text);
    } catch {
      throw new AllScaleError("http", null, `non-JSON response (${res.status}): ${text.slice(0, 300)}`, undefined, res.status);
    }
    const payload = env.payload ?? env.data ?? null;
    if (env.code !== 0 || payload == null) {
      // tolerate the different envelopes seen in the wild: error.message | message | msg
      const msg = env.error?.message ?? env.message ?? env.msg ?? (typeof (env as any).errors === "string" ? (env as any).errors : undefined) ?? `api error ${env.code}`;
      const details = { ...(env.error?.details ?? {}), raw: text.slice(0, 600) };
      throw new AllScaleError("api", env.code, msg, details, res.status, env.request_id);
    }
    return payload;
  }

  /** Auth smoke test: GET /v1/test/ping with a signed request. Any code 0 reply means key + signature are accepted. */
  ping(): Promise<unknown> {
    return this.call<unknown>("GET", "/v1/test/ping");
  }

  createAutoPayout(req: CreateAutoPayoutRequest): Promise<AutoPayoutPayload> {
    return this.call<AutoPayoutPayload>("POST", "/v1/claim_link_auto_payouts", req);
  }

  cancelAutoPayout(claimLinkId: string): Promise<{ status: string; refund_status?: string }> {
    return this.call("POST", `/v1/claim_link_auto_payouts/${encodeURIComponent(claimLinkId)}/cancel`);
  }
}
