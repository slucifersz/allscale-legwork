import express from "express";
import type { Orchestrator } from "@agent-payroll/payout-orchestrator/src/orchestrator.js";
import type { Planner } from "./planner.js";
import { SelfVerifier } from "./selfverify.js";
import { createPaidJob } from "./jobs.js";
import { TemplateSummarizer, type Summarizer } from "./summarizer.js";
import type { FileStore } from "@agent-payroll/payout-orchestrator/src/store.js";

export interface AppOptions {
  orch: Orchestrator;
  planner: Planner;
  mode: "facilitator" | "selfverify";
  priceUsdc: string; // decimal
  network: `${string}:${string}`;
  usdcMint: string;
  payTo: string;
  facilitatorUrl?: string;
  solanaRpcUrl?: string;
  /** for GET /jobs/:id — reads the shared ledger; optional */
  store?: FileStore;
  summarizer?: Summarizer;
  uploadsDir?: string;
}

export const toAtomic = (usdc: string) => {
  const [i, f = ""] = usdc.split(".");
  return (BigInt(i) * 1_000_000n + BigInt((f + "000000").slice(0, 6))).toString();
};

/** Stable key for a signed x402 payload before settlement: the signed transaction/signature string, truncated. */
const payloadRef = (p: { payload?: Record<string, unknown> } | undefined) =>
  String(p?.payload?.transaction ?? p?.payload?.signature ?? "").slice(0, 120) || "x402:" + Date.now();

export async function buildApp(o: AppOptions): Promise<express.Express> {
  const app = express();
  app.use(express.json());

  if (o.mode === "facilitator") {
    const { HTTPFacilitatorClient } = await import("@x402/core/server");
    const { x402ResourceServer, paymentMiddleware } = await import("@x402/express");
    const { ExactSvmScheme } = await import("@x402/svm/exact/server");
    if (!o.facilitatorUrl) throw new Error("facilitatorUrl required");
    const facilitator = new HTTPFacilitatorClient({ url: o.facilitatorUrl });
    const resourceServer = new x402ResourceServer(facilitator).register(o.network, new ExactSvmScheme());
    // The middleware settles AFTER our handler, so the job is first recorded with the signed-payload reference and then
    // updated with the real on-chain signature from the facilitator's settle response.
    const pendingJobs = new Map<string, string>(); // payload reference → jobId
    resourceServer.onAfterSettle(async (ctx) => {
      const key = payloadRef(ctx.paymentPayload as { payload?: Record<string, unknown> });
      const jobId = pendingJobs.get(key);
      const tx = (ctx.result as { transaction?: string }).transaction;
      if (jobId && tx) {
        o.orch.setJobClientRef(jobId, tx);
        pendingJobs.delete(key);
      }
    });
    app.use(
      paymentMiddleware(
        {
          "POST /jobs": {
            accepts: [{ scheme: "exact", price: { asset: o.usdcMint, amount: toAtomic(o.priceUsdc) }, network: o.network, payTo: o.payTo }],
            description: "Hire the agent for one field-check job (humans on site, paid via AllScale)",
            mimeType: "application/json",
          },
        },
        resourceServer,
      ),
    );
    app.post("/jobs", async (req, res) => {
      try {
        // Settlement is finalised by the middleware after the handler; the payment reference we can record now is the
        // signed payload (transaction) the client sent. The middleware adds PAYMENT-RESPONSE with the on-chain tx.
        const sigHeader = req.header("PAYMENT-SIGNATURE") ?? req.header("X-PAYMENT") ?? "";
        let ref = "x402:" + Date.now();
        try {
          ref = payloadRef(JSON.parse(Buffer.from(sigHeader, "base64").toString("utf8")));
        } catch {
          /* keep fallback */
        }
        const out = await createPaidJob(o.orch, o.planner, { request: String(req.body?.request ?? ""), paymentRef: ref, amountUsdc: o.priceUsdc });
        pendingJobs.set(ref, out.job.id);
        res.json(out);
      } catch (e) {
        res.status(500).json({ error: String(e) });
      }
    });
  } else {
    const verifier = new SelfVerifier({ rpcUrl: o.solanaRpcUrl ?? "https://api.devnet.solana.com", usdcMint: o.usdcMint, payTo: o.payTo, minAmount: o.priceUsdc });
    app.post("/jobs", async (req, res) => {
      const sig = req.header("X-Solana-Tx");
      if (!sig) {
        res.status(402).json({ error: "payment required", pay: { network: o.network, asset: o.usdcMint, payTo: o.payTo, amount: o.priceUsdc, then: "retry with header X-Solana-Tx: <signature>" } });
        return;
      }
      const v = await verifier.verify(sig);
      if (!v.ok) {
        res.status(402).json({ error: v.reason });
        return;
      }
      try {
        const out = await createPaidJob(o.orch, o.planner, { request: String(req.body?.request ?? ""), paymentRef: v.signature!, amountUsdc: v.amount! });
        res.json(out);
      } catch (e) {
        res.status(500).json({ error: String(e) });
      }
    });
  }

  // Client polls this (free, no payment) for the status and, once humans delivered, the AI-compiled answer.
  app.get("/jobs/:id", async (req, res) => {
    if (!o.store) {
      res.status(501).json({ error: "no store" });
      return;
    }
    const l = o.store.get();
    if (!l.jobs[req.params.id]) {
      res.status(404).json({ error: "unknown job" });
      return;
    }
    const sum = o.summarizer ?? new TemplateSummarizer();
    const out = await sum.summarize(l, req.params.id, o.uploadsDir ?? "./data/uploads");
    res.json(out);
  });

  app.get("/health", (_r, res) => res.json({ ok: true, mode: o.mode }));
  return app;
}
