import "dotenv/config";
import express from "express";
import multer from "multer";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildFromEnv } from "@agent-payroll/payout-orchestrator/src/config.js";
import { checkPhoto } from "./checks.js";
import { errorPage, esc, short } from "./html.js";
import { cfgFromEnv, deckPage, explain, guardBlock, jobCards, jobsPage, overviewPage, payoutsPage, redactLedger, reviewPage, workPage } from "./views.js";

const env = (k: string, d?: string) => process.env[k] ?? d ?? "";
const { orch, store } = buildFromEnv();
const dataDir = env("PAYROLL_DATA_DIR", "./data");
const uploads = join(dataDir, "uploads");
mkdirSync(uploads, { recursive: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const OP = env("OPERATOR_TOKEN", "change-me");
const cfg = cfgFromEnv();

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ---------- operator console (public read-only views: tx hashes, masked emails, never claim URLs) ----------
app.get("/", (_req, res) => res.send(overviewPage(store.get(), cfg)));
app.get("/jobs", (req, res) => {
  if (req.query.partial) return res.send(jobCards(store.get(), cfg));
  res.send(jobsPage(store.get(), cfg));
});
app.get("/payouts", (_req, res) => res.send(payoutsPage(store.get(), cfg)));

// ---------- workers: task board (mobile) ----------
app.get("/work", (req, res) => {
  const me = String(req.query.me ?? "").trim().toLowerCase();
  res.send(workPage(store.get(), me, cfg));
});

app.post("/work/:id/take", (req, res) => {
  try {
    orch.assign(req.params.id, String(req.body.email));
    res.redirect("/work?me=" + encodeURIComponent(String(req.body.email)) + "#mine");
  } catch (e) {
    res.status(400).send(errorPage(String(e), "/work"));
  }
});

app.post("/work/:id/submit", upload.single("photo"), async (req, res) => {
  try {
    const t = store.get().tasks[req.params.id];
    if (!t) throw new Error("unknown task");
    const buf = req.file?.buffer;
    if (!buf) throw new Error("photo required");
    const name = `${t.id}_${req.body.batchId}.jpg`;
    writeFileSync(join(uploads, name), buf);
    const windowStart = new Date(new Date(t.deadline).getTime() - 6 * 3600_000);
    const check = await checkPhoto(buf, { windowStart, windowEnd: new Date(t.deadline) });
    orch.submit(t.id, String(req.body.batchId), { file: name, note: String(req.body.note ?? ""), check });
    res.redirect("/work?me=" + encodeURIComponent(t.workerEmail ?? "") + "#mine");
  } catch (e) {
    res.status(400).send(errorPage(String(e), "/work"));
  }
});

// ---------- operator: review & pay ----------
const guard = (req: express.Request, res: express.Response, next: express.NextFunction) => (req.query.token === OP || req.body?.token === OP ? next() : res.status(401).send("operator token required"));

app.get("/review", guard, (req, res) => {
  const token = String(req.query.token);
  res.send(reviewPage(store.get(), token, { ...cfg, reviewHref: `/review?token=${encodeURIComponent(token)}` }));
});

app.get("/uploads/:f", guard, (req, res) => res.sendFile(join(process.cwd(), uploads, req.params.f.replace(/[^\w.\-]/g, ""))));

app.post("/review/:id/accept", guard, async (req, res) => {
  const wantsJson = (req.headers.accept ?? "").includes("application/json");
  const token = encodeURIComponent(String(req.body.token));
  try {
    const ob = orch.accept(req.params.id, String(req.body.batchId));
    const paid = await orch.pay(ob.id);
    if (!wantsJson) return res.redirect(`/review?token=${token}&last=${paid.payment.state}`);
    if (paid.payment.state === "funded") return res.json({ ok: true, tx: short(paid.payment.fundingTxHash, 6), txUrl: cfg.evmLink(paid.payment.fundingTxHash) });
    const err = explain(paid.payment.lastError);
    const retry = `<form method="post" action="/review/pay/${esc(paid.id)}"><input type="hidden" name="token" value="${esc(String(req.body.token))}"><button class="btn glass" type="submit">Retry</button></form>`;
    return res.json({ ok: false, guardHtml: guardBlock(err, err.retry ? retry : "") });
  } catch (e) {
    if (wantsJson) return res.status(400).json({ ok: false, guardHtml: guardBlock({ msg: String(e), code: "error", retry: false }) });
    res.status(400).send(errorPage(String(e)));
  }
});
app.post("/review/:id/flag", guard, (req, res) => {
  orch.markNeedsReview(req.params.id);
  res.redirect(`/review?token=${encodeURIComponent(String(req.body.token))}`);
});
app.post("/review/pay/:id", guard, async (req, res) => {
  const o = store.get().obligations[req.params.id];
  if (o?.payment.state === "failed_needs_operator") orch.resetForRetry(o.id);
  await orch.pay(req.params.id);
  res.redirect(`/review?token=${encodeURIComponent(String(req.body.token))}`);
});

// ---------- pitch deck: static design with live iframes + real hashes from the ledger ----------
app.get("/deck", (_req, res) => {
  const file = join(process.cwd(), "design", "deck.html");
  if (!existsSync(file)) return res.status(404).send("design/deck.html missing");
  res.send(deckPage(readFileSync(file, "utf8"), store.get(), cfg, { reviewHref: `/review?token=${encodeURIComponent(OP)}`, demoWorker: env("DEMO_WORKER_EMAIL", "demo@example.com") }));
});

// ---------- json for the agent / demo narration ----------
app.get("/api/ledger", (_req, res) => res.json(redactLedger(store.get())));

app.listen(Number(env("PORT", "4030")), () => console.log(`web on :${env("PORT", "4030")}  /  /jobs  /payouts  /work  /deck  /review?token=${OP}`));
