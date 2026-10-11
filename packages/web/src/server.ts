import "dotenv/config";
import express from "express";
import multer from "multer";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildFromEnv } from "@agent-payroll/payout-orchestrator/src/config.js";
import type { Job, Ledger, Obligation, Task } from "@agent-payroll/payout-orchestrator/src/model.js";
import { checkPhoto } from "./checks.js";
import { esc, page, short, tag } from "./html.js";

const env = (k: string, d?: string) => process.env[k] ?? d ?? "";
const { orch, store } = buildFromEnv();
const dataDir = env("PAYROLL_DATA_DIR", "./data");
const uploads = join(dataDir, "uploads");
mkdirSync(uploads, { recursive: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const OP = env("OPERATOR_TOKEN", "change-me");
const solLink = (sig?: string | null) => (sig ? env("SOLANA_EXPLORER", "https://explorer.solana.com/tx/{sig}?cluster=devnet").replace("{sig}", sig) : "");
const evmLink = (h?: string | null) => (h ? env("EVM_EXPLORER", "https://sepolia.etherscan.io/tx/{hash}").replace("{hash}", h) : "");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ---------- public: verifiable settlement record ----------
// Shows tx hashes, anonymised task ids and states. Never emails, never claim URLs.
app.get("/", (_req, res) => {
  const l = store.get();
  const jobs = Object.values(l.jobs).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const rows = jobs
    .map((job) => {
      const tasks = Object.values(l.tasks).filter((t) => t.jobId === job.id);
      const obs = Object.values(l.obligations).filter((o) => tasks.some((t) => t.id === o.taskId));
      const paid = obs.filter((o) => o.payment.state === "funded").reduce((a, o) => a + Number(o.amount), 0);
      return `<div class="card">
${moneyTrail(job, tasks, obs)}
<div><b>Job ${esc(job.id)}</b> · revenue ${esc(job.revenueAmount)} USDC on Solana · <a href="${solLink(job.clientRef)}" target="_blank" rel="noopener"><code>${esc(short(job.clientRef))}</code></a> · ${esc(job.createdAt.slice(0, 16))}Z</div>
<div class="sub">${tasks.length} task(s) · ${obs.length} obligation(s) · ${paid} ${obs[0] ? coin(obs[0]) : "USDT"} paid into claim links</div>
<table><tr><th>task</th><th>state</th><th>obligation</th><th>payment</th><th>funding tx</th><th>claim</th></tr>
${tasks.map((t) => obRows(t, obs.filter((o) => o.taskId === t.id))).join("")}
</table></div>`;
    })
    .join("");
  res.send(
    page(
      "Agent Payroll — settlement record",
      `<h1>Settlement record</h1><p class="sub">Every USDC the agent received on Solana, and every stablecoin claim link it funded on AllScale for a human. Test networks. Emails and claim URLs are private.</p>${rows || "<p>No jobs yet.</p>"}`,
    ),
  );
});

/** One money, start to finish: Solana receipt → CCTP burn → EVM mint → claim links funded → claimed. */
function moneyTrail(job: Job, tasks: Task[], obs: Obligation[]): string {
  const funded = obs.filter((o) => o.payment.state === "funded");
  const claimed = obs.filter((o) => o.claim.state === "claimed");
  const refunded = obs.filter((o) => o.claim.state === "refunded");
  const sw = job.sweep;
  const step = (cls: string, label: string, main: string, sub = "") => `<div class="step ${cls}"><b>${esc(label)}</b>${main}<br><small>${sub}</small></div>`;
  const link = (href: string, text: string) => `<a href="${href}" target="_blank" rel="noopener"><code>${esc(text)}</code></a>`;
  return `<div class="trail">
${step("done", "1 · client paid on Solana", `${esc(job.revenueAmount)} USDC`, link(solLink(job.clientRef), short(job.clientRef)))}
${step(sw ? (sw.state === "minted" ? "done" : "wait") : "wait", "2 · CCTP burn (Solana)", sw ? "burned" : "not started", sw ? link(solLink(sw.solanaBurnTx), short(sw.solanaBurnTx)) : "revenue still on Solana")}
${step(sw?.state === "minted" ? "done" : "wait", "3 · USDC minted to operator (EVM)", sw?.state === "minted" ? `${Number(sw.mintedAtomic ?? 0) / 1e6} USDC` : sw?.state === "attested" ? "attested, minting…" : "waiting for attestation", sw?.evmReceiveTx ? link(evmLink(sw.evmReceiveTx), short(sw.evmReceiveTx)) : "")}
${step(funded.length === tasks.length && tasks.length > 0 ? "done" : funded.length ? "wait" : "wait", "4 · claim links funded (AllScale)", `${funded.length} / ${tasks.length} · ${funded.reduce((a, o) => a + Number(o.amount), 0)} ${funded[0] ? coin(funded[0]) : "USDT"}`, funded.map((o) => link(evmLink(o.payment.fundingTxHash), short(o.payment.fundingTxHash, 6))).join(" "))}
${step(claimed.length === funded.length && funded.length > 0 ? "done" : refunded.length ? "bad" : "wait", "5 · claimed by humans", `${claimed.length} claimed${refunded.length ? ` · ${refunded.length} refunded (re-issued)` : ""}`, claimed.map((o) => (o.claim.claimTxHash ? link(evmLink(o.claim.claimTxHash), short(o.claim.claimTxHash, 6)) : "")).join(" "))}
</div>`;
}

function obRows(t: Task, obs: Obligation[]): string {
  if (!obs.length) return `<tr><td>${esc(t.id)}<br><span class="sub">${esc(t.title)}</span></td><td>${tag(t.state)}</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>`;
  return obs
    .map(
      (o) => `<tr><td>${esc(t.id)}<br><span class="sub">${esc(t.title)}</span></td><td>${tag(t.state)}</td>
<td><code>${esc(o.id)}</code>${o.supersedes ? `<br><span class="sub">re-issue of ${esc(o.supersedes)}</span>` : ""}<br>${esc(o.amount)} ${coin(o)}</td>
<td>${tag(o.payment.state, o.payment.state === "funded" ? "ok" : o.payment.state === "failed_needs_operator" ? "bad" : "warn")}${o.payment.lastError ? `<br><span class="sub">${esc(o.payment.lastError.code ?? "")} ${esc(o.payment.lastError.reasonCode ?? "")}</span>` : ""}</td>
<td>${o.payment.fundingTxHash ? `<a href="${evmLink(o.payment.fundingTxHash)}" target="_blank" rel="noopener"><code>${esc(short(o.payment.fundingTxHash))}</code></a>` : "—"}</td>
<td>${tag(o.claim.state, o.claim.state === "claimed" ? "ok" : o.claim.state === "refunded" ? "bad" : "")}${o.claim.claimTxHash ? `<br><a href="${evmLink(o.claim.claimTxHash)}" target="_blank" rel="noopener"><code>${esc(short(o.claim.claimTxHash))}</code></a>` : ""}</td></tr>`,
    )
    .join("");
}

// ---------- workers: task board ----------
app.get("/work", (req, res) => {
  const l = store.get();
  const me = String(req.query.me ?? "").trim().toLowerCase();
  const open = Object.values(l.tasks).filter((t) => t.state === "open");
  const mine = Object.values(l.tasks).filter((t) => t.state === "assigned" && (!me || (t.workerEmail ?? "").toLowerCase() === me));
  // Paid tasks for this worker: show the claim link here, so delivery never depends on email arriving.
  const paid = me
    ? Object.values(l.obligations)
        .filter((o) => o.workerEmail.toLowerCase() === me && o.payment.state === "funded")
        .map((o) => ({ o, t: l.tasks[o.taskId] }))
    : [];
  res.send(
    page(
      "Task board",
      `<h1>Task board</h1><p class="sub">Reward, deadline and acceptance criteria are fixed before you take a task. After acceptance you get a claim link — no wallet, no gas.</p>
<form method="get" action="/work" style="margin:8px 0 16px"><input type="email" name="me" value="${esc(me)}" placeholder="your email — to see your tasks and payments"> <button class="secondary">Show mine</button></form>
${paid.length ? `<h2>Your payments</h2>${paid.map(({ o, t }) => paidCard(o, t)).join("")}` : ""}
<h2>Open</h2>${open.length ? open.map((t) => openCard(t, me)).join("") : "<p>Nothing open right now.</p>"}
<h2>In progress${me ? " (yours)" : ""}</h2>${mine.length ? mine.map(assignedCard).join("") : "<p>—</p>"}`,
    ),
  );
});

const coin = (o: { stableCoin?: number }) => (o.stableCoin === 1 ? "USDT" : "USDC");
const paidCard = (o: Obligation, t?: Task) => `<div class="card" style="border-color:var(--ok)"><b>${esc(t?.title ?? o.taskId)}</b> · <b>${esc(o.amount)} ${coin(o)}</b> · ${tag(o.claim.state === "claimed" ? "claimed" : "ready to claim", o.claim.state === "claimed" ? "ok" : "")}
<p class="sub">Accepted ${esc((o.payment.fundedAt ?? "").slice(0, 16))}Z · funding tx <a href="${evmLink(o.payment.fundingTxHash)}" target="_blank" rel="noopener"><code>${esc(short(o.payment.fundingTxHash))}</code></a></p>
${o.claim.state !== "claimed" && o.payment.claimUrl ? `<a href="${esc(o.payment.claimUrl)}" target="_blank" rel="noopener"><button>Claim your payment</button></a> <span class="sub">opens AllScale — enter a wallet address, or your email to create one</span>` : ""}</div>`;

const openCard = (t: Task, me = "") => `<div class="card"><b>${esc(t.title)}</b> · <b>${esc(t.reward)}</b> · due ${esc(t.deadline.slice(0, 16))}Z
<p class="sub">${esc(t.acceptanceCriteria)}</p>
<form method="post" action="/work/${esc(t.id)}/take"><input type="email" name="email" value="${esc(me)}" placeholder="your email (this is where the money goes)" required> <button>Take this task</button></form></div>`;

const assignedCard = (t: Task) => `<div class="card"><b>${esc(t.title)}</b> · ${esc(t.reward)} · batch <code>${esc(t.batchId)}</code>
<p class="sub">${esc(t.acceptanceCriteria)}</p>
<form method="post" action="/work/${esc(t.id)}/submit" enctype="multipart/form-data"><input type="hidden" name="batchId" value="${esc(t.batchId)}">
<input type="file" name="photo" accept="image/*" capture="environment" required> <input type="text" name="note" placeholder="what you saw (optional)"> <button>Submit</button></form></div>`;

app.post("/work/:id/take", (req, res) => {
  try {
    orch.assign(req.params.id, String(req.body.email));
    res.redirect("/work?me=" + encodeURIComponent(String(req.body.email)));
  } catch (e) {
    res.status(400).send(page("Error", `<p>${esc(String(e))}</p><a href="/work">back</a>`));
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
    res.send(page("Submitted", `<h1>Submitted</h1><p>Structural checks: ${check.checks.map((c) => tag(`${c.name}: ${c.detail}`, c.ok ? "ok" : "warn")).join(" ")}</p><p class="sub">A person will review and accept. Your claim link will appear on this board under "Your payments" (and by email).</p><a href="/work?me=${encodeURIComponent(t.workerEmail ?? "")}">back to my tasks</a>`));
  } catch (e) {
    res.status(400).send(page("Error", `<p>${esc(String(e))}</p><a href="/work">back</a>`));
  }
});

// ---------- operator: review & pay ----------
const guard = (req: express.Request, res: express.Response, next: express.NextFunction) => (req.query.token === OP || req.body?.token === OP ? next() : res.status(401).send("operator token required"));

app.get("/review", guard, (req, res) => {
  const l = store.get();
  const submitted = Object.values(l.tasks).filter((t) => t.state === "submitted" || t.state === "needs_review");
  const pending = Object.values(l.obligations).filter((o) => o.payment.state !== "funded");
  res.send(
    page(
      "Review",
      `<h1>Review</h1><p class="sub">Accepting creates a pay obligation and triggers the AllScale Auto-Payout immediately. Structural checks are advisory; you decide.</p>
${submitted.map((t) => reviewCard(t, String(req.query.token))).join("") || "<p>Nothing to review.</p>"}
<h2>Obligations not yet funded</h2>${pending.length ? `<table><tr><th>obligation</th><th>state</th><th>attempts</th><th>last error</th><th></th></tr>${pending.map((o) => `<tr><td><code>${esc(o.id)}</code></td><td>${tag(o.payment.state)}</td><td>${o.payment.attempts}</td><td>${esc(o.payment.lastError?.message ?? "")}</td><td><form method="post" action="/review/pay/${esc(o.id)}"><input type="hidden" name="token" value="${esc(String(req.query.token))}"><button class="secondary">${o.payment.state === "failed_needs_operator" ? "reset & retry" : "retry"}</button></form></td></tr>`).join("")}</table>` : "<p>—</p>"}`,
    ),
  );
});

const reviewCard = (t: Task, token: string) => {
  const check = (t.submission?.evidence as any)?.check as { checks: { name: string; ok: boolean; detail: string }[] } | undefined;
  const file = (t.submission?.evidence as any)?.file as string | undefined;
  return `<div class="card"><b>${esc(t.title)}</b> · ${esc(t.reward)} ${process.env.ALLSCALE_STABLE_COIN === "2" ? "USDC" : "USDT"} · batch <code>${esc(t.batchId)}</code> · ${tag(t.state)}
<p class="sub">${esc(t.acceptanceCriteria)}</p>
${file ? `<img src="/uploads/${esc(file)}?token=${esc(token)}" style="max-width:100%;max-height:360px;border-radius:8px">` : ""}
<p>${(check?.checks ?? []).map((c) => tag(`${c.name}: ${c.detail}`, c.ok ? "ok" : "warn")).join(" ")}</p>
<p class="sub">note: ${esc((t.submission?.evidence as any)?.note ?? "")}</p>
<form method="post" action="/review/${esc(t.id)}/accept" style="display:inline"><input type="hidden" name="token" value="${esc(token)}"><input type="hidden" name="batchId" value="${esc(t.batchId)}"><button>Accept & pay</button></form>
<form method="post" action="/review/${esc(t.id)}/flag" style="display:inline"><input type="hidden" name="token" value="${esc(token)}"><button class="secondary">Needs review</button></form></div>`;
};

app.get("/uploads/:f", guard, (req, res) => res.sendFile(join(process.cwd(), uploads, req.params.f.replace(/[^\w.\-]/g, ""))));

app.post("/review/:id/accept", guard, async (req, res) => {
  try {
    const ob = orch.accept(req.params.id, String(req.body.batchId));
    const paid = await orch.pay(ob.id);
    res.redirect(`/review?token=${encodeURIComponent(String(req.body.token))}&last=${paid.payment.state}`);
  } catch (e) {
    res.status(400).send(page("Error", `<p>${esc(String(e))}</p>`));
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

// ---------- json for the agent / demo narration ----------
app.get("/api/ledger", (_req, res) => {
  const l: Ledger = store.get();
  const redacted = structuredClone(l);
  for (const o of Object.values(redacted.obligations)) {
    (o as any).workerEmail = "[redacted]";
    o.payment.claimUrl = o.payment.claimUrl ? "[private]" : null;
  }
  res.json(redacted);
});

app.listen(Number(env("PORT", "4030")), () => console.log(`web on :${env("PORT", "4030")}  /  /work  /review?token=${OP}`));
