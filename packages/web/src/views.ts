/**
 * Page renderers shared by the live server (server.ts) and the static demo export (export.ts).
 * Pure: ledger + config in, HTML out. No I/O, no AllScale calls.
 *
 * Operator console (sidebar): Overview · Jobs · Review · Payouts.   Worker app (phone): Tasks · My work · Wallet.
 * Public pages never show full emails or claim URLs.
 */
import type { Job, Ledger, Obligation, Task } from "@agent-payroll/payout-orchestrator/src/model.js";
import { CHECK, CROSS, ICONS, LOGO, SHIELD_I, SHIELD_OK, SHIELD_X, ago, appPage, consolePage, esc, fmtAmt, maskEmail, short, tag } from "./html.js";

export interface ViewCfg {
  solLink: (sig?: string | null) => string;
  evmLink: (hash?: string | null) => string;
  /** Coin shown for tasks that have no obligation yet. */
  payCoin: string;
  /** Static demo build: no polling, demo notes, every action simulated client-side. */
  demo?: boolean;
  /** Review link (live: carries the operator token; demo: plain /review). Omit to hide Review from the sidebar. */
  reviewHref?: string;
  uploadSrc: (file: string) => string;
}

export function cfgFromEnv(): ViewCfg {
  const env = (k: string, d: string) => process.env[k] ?? d;
  return {
    solLink: (sig) => (sig ? env("SOLANA_EXPLORER", "https://explorer.solana.com/tx/{sig}?cluster=devnet").replace("{sig}", sig) : ""),
    evmLink: (h) => (h ? env("EVM_EXPLORER", "https://sepolia.etherscan.io/tx/{hash}").replace("{hash}", h) : ""),
    payCoin: process.env.ALLSCALE_STABLE_COIN === "2" ? "USDC" : "USDT",
    uploadSrc: (f) => `/uploads/${encodeURIComponent(f)}`,
  };
}

const coin = (o: { stableCoin?: number }) => (o.stableCoin === 1 ? "USDT" : "USDC");
const link = (href: string, text: string) => (href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(text)} ↗</a>` : `<span class="dash">—</span>`);
const when = (cfg: ViewCfg, iso: string) =>
  cfg.demo ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }) + " UTC" : ago(iso);
const sumAmt = (os: Obligation[]) => os.reduce((a, o) => a + Number(o.amount), 0);
const awaiting = (l: Ledger) => Object.values(l.tasks).filter((t) => t.state === "submitted" || t.state === "needs_review");
const consoleOpts = (cfg: ViewCfg, l: Ledger) => ({ review: cfg.reviewHref, reviewCount: awaiting(l).length, demo: cfg.demo });

// ---------- money flow per job (shared by Overview rows and Jobs cards) ----------

interface Flow {
  tasks: Task[];
  obs: Obligation[];
  funded: Obligation[];
  claimed: Obligation[];
  blocked: Obligation[];
  /** class per step 1..5 */
  steps: string[];
  here: number;
  now: string;
  revoked: boolean;
}

function flow(job: Job, l: Ledger): Flow {
  const tasks = Object.values(l.tasks).filter((t) => t.jobId === job.id);
  const obs = Object.values(l.obligations).filter((o) => tasks.some((t) => t.id === o.taskId));
  const funded = obs.filter((o) => o.payment.state === "funded");
  const claimed = obs.filter((o) => o.claim.state === "claimed");
  const refunded = obs.filter((o) => o.claim.state === "refunded");
  const blocked = obs.filter((o) => o.payment.state === "failed_needs_operator");
  const sw = job.sweep;
  const minted = sw?.state === "minted";
  let here: number, now: string, revoked = false;
  if (blocked.length) { here = 4; now = "Held by operator"; revoked = true; }
  else if (claimed.length && claimed.length === funded.length && funded.length === tasks.length) { here = 5; now = "With the people who did the work"; }
  else if (funded.length) { here = 4; now = "In claim links, waiting to be claimed"; }
  else if (minted) { here = 3; now = "Minted to operator"; }
  else if (sw) { here = 2; now = "Burned on Solana, waiting for attestation"; }
  else { here = 1; now = "Received on Solana"; }
  const s4 = blocked.length ? "bad" : funded.length && funded.length === tasks.length ? "done" : funded.length || obs.length ? "wait" : "idle";
  const s5 = refunded.length ? "bad" : claimed.length && claimed.length === funded.length ? "done" : funded.length ? "wait" : "idle";
  const steps = ["done", sw ? "done" : "wait", minted ? "done" : sw ? "wait" : "idle", s4, s5];
  return { tasks, obs, funded, claimed, blocked, steps, here, now, revoked };
}

const jobsSorted = (l: Ledger) => Object.values(l.jobs).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

// ---------- Overview ----------

export function overviewPage(l: Ledger, cfg: ViewCfg): string {
  const jobs = jobsSorted(l);
  const obs = Object.values(l.obligations);
  const funded = obs.filter((o) => o.payment.state === "funded");
  const revenue = jobs.reduce((a, j) => a + Number(j.revenueAmount), 0);
  const paid = sumAmt(funded);
  const payCoin = funded[0] ? coin(funded[0]) : cfg.payCoin;
  const reserved = Object.values(l.tasks).reduce((a, t) => a + Number(t.reward), 0);
  const review = awaiting(l);
  const blocked = obs.some((o) => o.payment.state === "failed_needs_operator");
  const pct = reserved ? Math.min(100, Math.round((paid / reserved) * 100)) : 0;
  const events = feed(l);

  const kpi = (k: string, v: string, unit: string, s: string) => `<div class="kpi"><div class="k">${k}</div><div class="v">${v}${unit ? `<small>${unit}</small>` : ""}</div><div class="s">${s}</div></div>`;
  const kpis = `<div class="panel kpis">${kpi("Agent revenue", fmtAmt(revenue), "USDC", `${jobs.length} job${jobs.length === 1 ? "" : "s"} paid via x402 on Solana`)}${kpi("Paid to humans", fmtAmt(paid), payCoin, `${funded.length} claim link${funded.length === 1 ? "" : "s"} funded by AllScale`)}${kpi("Awaiting review", String(review.length), "", review.length && cfg.reviewHref ? `<a href="${esc(cfg.reviewHref)}">Open review →</a>` : review.length ? "submissions" : "Nothing to review")}</div>`;

  const authAction = cfg.demo
    ? `<button class="switch" type="button" role="switch" aria-checked="${blocked ? "false" : "true"}" aria-label="Agent spending authority" data-revoke><span></span></button>`
    : `<span class="tag">Managed in AllScale</span>`;
  const auth = `<div class="panel"><div class="pb"><div class="auth${blocked ? " off" : ""}" id="auth"><span class="ic">${blocked ? SHIELD_X : SHIELD_OK}</span>
<div><div class="t">Agent spending authority · <span data-auth-state>${blocked ? "Revoked" : "Active"}</span></div><div class="d">Pays workers from your AllScale wallet, only within budget. Switch off any time.</div></div>
<div class="meter"><div class="lbl"><span><b>${fmtAmt(paid)}</b> paid</span><span>${fmtAmt(reserved)} ${payCoin} budget</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>${authAction}</div></div></div>`;

  const rows = jobs
    .map((j) => {
      const f = flow(j, l);
      return `<tr class="click" onclick="location.href='/jobs#${esc(j.id)}'"><td><div class="tt">Job ${esc(j.id.slice(4, 12))}</div><div class="id">${when(cfg, j.createdAt)}</div></td><td class="amt">${fmtAmt(j.revenueAmount)} USDC</td><td>${f.funded.length}/${f.tasks.length} paid</td><td><div class="dots">${f.steps.map((s) => `<i class="${s}"></i>`).join("")}<span>${esc(f.now)}</span></div></td></tr>`;
    })
    .join("");
  const jobsPanel = `<div class="panel"><div class="ph"><h2>Jobs</h2><div class="r"><a class="btn line sm" href="/jobs">View all</a></div></div>${
    rows ? `<div class="tw"><table class="t"><thead><tr><th>Job</th><th>Revenue</th><th>Workers</th><th>Money flow</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="pb empty">No jobs yet. The first x402 payment will appear here.</div>`
  }</div>`;

  const updates = `<div class="panel"><div class="ph"><h2>Updates</h2><div class="r"><span class="tag">${events.length}</span></div></div><ul class="feed">${
    events
      .slice(0, 8)
      .map(
        (e) => `<li><span class="dot ${e.cls}"></span><div style="min-width:0"><div class="w">${esc(e.who)}</div><div class="m">${e.what}</div>${
          e.review && cfg.reviewHref ? `<div class="acts"><a class="btn go sm" href="${esc(cfg.reviewHref)}">Review</a></div>` : ""
        }</div><span class="time">${when(cfg, e.at)}</span></li>`,
      )
      .join("") || `<li class="empty">Nothing yet.</li>`
  }</ul></div>`;

  return consolePage(
    "AllScale Legwork — Overview",
    "Overview",
    `<div class="hello"><div><div class="eyebrow">${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}</div><h1>Welcome back, Operator</h1><div class="sub">Your agent has earned ${fmtAmt(revenue)} USDC and paid ${funded.length} worker${funded.length === 1 ? "" : "s"} so far.</div></div><div class="act"><a class="btn line" href="/work">Open worker app</a>${review.length && cfg.reviewHref ? `<a class="btn dark" href="${esc(cfg.reviewHref)}">Review ${review.length} submission${review.length === 1 ? "" : "s"}</a>` : ""}</div></div>
<div class="grid"><div class="col">${kpis}${auth}${jobsPanel}</div><div class="col">${updates}</div></div>`,
    { nav: "overview", ...consoleOpts(cfg, l), script: cfg.demo ? DEMO_JS : "" },
  );
}

interface FeedItem { at: string; who: string; what: string; cls: string; review?: boolean }

/** Activity derived from the ledger. `what` is pre-escaped HTML. */
function feed(l: Ledger): FeedItem[] {
  const out: FeedItem[] = [];
  for (const j of Object.values(l.jobs)) {
    out.push({ at: j.createdAt, who: "Client paid the agent", what: `${fmtAmt(j.revenueAmount)} USDC on Solana · job ${esc(j.id.slice(4, 12))}`, cls: "" });
    if (j.sweep?.state === "minted") out.push({ at: j.sweep.updatedAt, who: "CCTP sweep complete", what: `${fmtAmt(Number(j.sweep.mintedAtomic ?? 0) / 1e6)} USDC minted to operator on Sepolia`, cls: "" });
  }
  for (const t of Object.values(l.tasks)) {
    if (t.submission && (t.state === "submitted" || t.state === "needs_review")) out.push({ at: t.submission.at, who: maskEmail(t.workerEmail), what: `submitted ${esc(t.title)}`, cls: "warn", review: true });
  }
  for (const o of Object.values(l.obligations)) {
    const t = l.tasks[o.taskId];
    if (o.payment.state === "funded" && o.payment.fundedAt) out.push({ at: o.payment.fundedAt, who: "Claim link funded", what: `${fmtAmt(o.amount)} ${coin(o)} → ${esc(maskEmail(o.workerEmail))}${t ? ` · ${esc(t.title)}` : ""}`, cls: "" });
    if (o.payment.state === "failed_needs_operator") out.push({ at: o.payment.lastError?.at ?? o.createdAt, who: "Payout refused", what: `${fmtAmt(o.amount)} ${coin(o)} · ${esc(explain(o.payment.lastError).msg)}`, cls: "bad" });
    if (o.claim.state === "claimed" && o.claim.updatedAt) out.push({ at: o.claim.updatedAt, who: `${maskEmail(o.workerEmail)} claimed`, what: `${fmtAmt(o.amount)} ${coin(o)}`, cls: "" });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

// ---------- Jobs: the money trail per job ----------

export function jobsPage(l: Ledger, cfg: ViewCfg): string {
  return consolePage(
    "AllScale Legwork — Jobs",
    "Jobs",
    `<div class="pagehead"><div><h1>Jobs</h1><p>Every job's money, from the client's x402 payment on Solana to the people who did the work. Each step links to its transaction.</p></div>${
      cfg.demo ? `<div class="act"><button class="btn go" type="button" data-replay>▶ Replay money flow</button></div>` : ""
    }</div>
<div id="jobs">${jobCards(l, cfg)}</div>`,
    { nav: "jobs", ...consoleOpts(cfg, l), script: cfg.demo ? DEMO_JS : POLL_JS },
  );
}

export function jobCards(l: Ledger, cfg: ViewCfg): string {
  return jobsSorted(l).map((job) => jobCard(job, l, cfg)).join("") || `<div class="panel"><div class="pb empty">No jobs yet. The first x402 payment will appear here.</div></div>`;
}

/** Live refresh: re-fetch the job cards every 3 s; flash any money-trail step whose state changed. */
const POLL_JS = String.raw`
(function(){
  var box=document.getElementById("jobs");if(!box)return;
  function sig(root){var m={};root.querySelectorAll("[data-job]").forEach(function(j){j.querySelectorAll("[data-step]").forEach(function(s){m[j.dataset.job+"/"+s.dataset.step]=s.className.replace(" flash","")})});return m}
  function flash(el){el.classList.remove("flash");void el.offsetWidth;el.classList.add("flash")}
  var prev=sig(box);
  setInterval(function(){
    fetch(location.pathname+"?partial=1",{cache:"no-store"}).then(function(r){return r.text()}).then(function(html){
      var tmp=document.createElement("div");tmp.innerHTML=html;var next=sig(tmp);
      var changed=[];for(var k in next){if(prev[k]!==undefined&&prev[k]!==next[k])changed.push(k)}
      var newJobs=Object.keys(next).some(function(k){return prev[k]===undefined});
      if(changed.length||newJobs||box.innerHTML.length!==html.length){box.innerHTML=html;
        changed.forEach(function(k){var p=k.split("/");var el=box.querySelector('[data-job="'+p[0]+'"] [data-step="'+p[1]+'"]');if(el)flash(el)});
        if(newJobs){var first=box.querySelector("[data-job]");if(first)flash(first.querySelector("[data-step]"))}}
      prev=next;
    }).catch(function(){})
  },3000);
})();`;

function jobCard(job: Job, l: Ledger, cfg: ViewCfg): string {
  const { solLink, evmLink } = cfg;
  const f = flow(job, l);
  const sw = job.sweep;
  const payCoin = f.funded[0] ? coin(f.funded[0]) : cfg.payCoin;
  const node = (cls: string, n: number) => (cls === "done" ? CHECK : cls === "bad" ? CROSS : cls === "wait" ? `<span class="spin"></span>` : String(n));
  const step = (n: number, title: string, sub: string, extra = "") => {
    const cls = f.steps[n - 1];
    const here = f.here === n ? " has-here" : "";
    return `<div class="step ${cls}${here}" data-step="${n}"><span class="node">${node(cls, n)}</span>${here ? `<span class="here">Money is here</span>` : ""}<div class="n">Step ${n}</div><div class="t">${title}</div>${extra}<div class="sub">${sub}</div></div>`;
  };
  const s1 = step(1, "Client paid", `Solana · ${fmtAmt(job.revenueAmount)} USDC · ${link(solLink(job.clientRef), short(job.clientRef, 6))}`);
  const s2 = step(2, "CCTP burn", sw ? `Solana · ${link(solLink(sw.solanaBurnTx), short(sw.solanaBurnTx, 6))}` : "Solana · not started");
  const s3 = step(3, "USDC minted to operator", sw?.state === "minted" ? `Sepolia · ${fmtAmt(Number(sw.mintedAtomic ?? 0) / 1e6)} USDC · ${link(evmLink(sw.evmReceiveTx), short(sw.evmReceiveTx, 6))}` : sw ? "Sepolia · waiting for attestation" : "Sepolia");
  const s4 = step(
    4,
    "Claim links funded",
    f.blocked.length ? `refused · agent revoked (${f.blocked.length})` : `AllScale · ${f.funded.length}/${f.tasks.length} · ${fmtAmt(sumAmt(f.funded))} ${payCoin}`,
    f.steps[3] === "wait" && f.tasks.length ? `<div class="prog"><i style="width:${Math.round((f.funded.length / f.tasks.length) * 100)}%"></i></div>` : "",
  );
  const s5 = step(5, "Claimed by workers", `by email · ${f.claimed.length}/${f.funded.length}`);
  const rows = f.tasks.map((t) => taskRow(t, f.obs.filter((o) => o.taskId === t.id), cfg)).join("");
  return `<div class="panel job" id="${esc(job.id)}" data-job="${esc(job.id)}"><div class="ph"><h2>Job ${esc(job.id.slice(4, 12))}</h2>${f.revoked ? tag("agent revoked", "bad", true) : tag(`${f.funded.length}/${f.tasks.length} paid`, f.funded.length ? "ok" : "")}<div class="r jobhead"><b>${fmtAmt(job.revenueAmount)} USDC</b>${link(solLink(job.clientRef), short(job.clientRef))}<span>${when(cfg, job.createdAt)}</span></div></div>
<div class="pb"><div class="where"><span class="muted">Money is now</span><span${f.revoked ? ' style="color:var(--bad)"' : ""}>${f.now}</span></div><div class="trail">${s1}${s2}${s3}${s4}${s5}</div></div>
<div class="tw" style="border-top:1px solid var(--line)"><table class="t"><thead><tr><th>Task</th><th>State</th><th>Amount</th><th>Payment</th><th>Funding tx</th><th>Claim</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

const stateTag = (s: string) => tag(s, s === "accepted" ? "ok" : s === "submitted" || s === "needs_review" ? "warn" : s === "void" ? "bad" : "");
const payTag = (o: Obligation) =>
  o.payment.state === "funded" ? tag("funded", "ok", true)
  : o.payment.state === "failed_needs_operator" ? tag("agent revoked", "bad", true)
  : o.payment.state === "in_flight" ? `<span class="tag warn"><span class="spin"></span>in flight</span>`
  : tag(o.payment.state, "dim");
const claimTag = (o: Obligation) => tag(o.claim.state, o.claim.state === "claimed" ? "ok" : o.claim.state === "refunded" || o.claim.state === "cancelled" ? "bad" : o.claim.state === "pending" ? "warn" : "");

function taskRow(t: Task, obs: Obligation[], cfg: ViewCfg): string {
  const cell = `<td><div class="tt">${esc(t.title)}</div><div class="id">${esc(t.id.slice(0, 13))}</div></td>`;
  if (!obs.length) return `<tr>${cell}<td>${stateTag(t.state)}</td><td class="amt">${fmtAmt(t.reward)} ${cfg.payCoin}</td><td>${tag("not requested", "dim")}</td><td class="dash">—</td><td class="dash">—</td></tr>`;
  return obs
    .map(
      (o) => `<tr>${cell}<td>${stateTag(t.state)}</td><td class="amt">${fmtAmt(o.amount)} ${coin(o)}${o.supersedes ? `<div class="id">re-issue</div>` : ""}</td><td>${payTag(o)}</td><td class="tx">${o.payment.fundingTxHash ? link(cfg.evmLink(o.payment.fundingTxHash), short(o.payment.fundingTxHash, 6)) : `<span class="dash">—</span>`}</td><td>${claimTag(o)}${o.claim.claimTxHash ? `<div class="id">${link(cfg.evmLink(o.claim.claimTxHash), short(o.claim.claimTxHash, 6))}</div>` : ""}</td></tr>`,
    )
    .join("");
}

// ---------- Payouts ----------

export function payoutsPage(l: Ledger, cfg: ViewCfg): string {
  const obs = Object.values(l.obligations).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const rows = obs
    .map((o) => {
      const t = l.tasks[o.taskId];
      return `<tr><td><div class="tt">${esc(t?.title ?? o.taskId)}</div><div class="id">${esc(o.id.slice(0, 16))}</div></td><td>${esc(maskEmail(o.workerEmail))}</td><td class="amt">${fmtAmt(o.amount)} ${coin(o)}</td><td>${payTag(o)}</td><td class="tx">${
        o.payment.fundingTxHash ? link(cfg.evmLink(o.payment.fundingTxHash), short(o.payment.fundingTxHash, 6)) : `<span class="dash">—</span>`
      }</td><td>${claimTag(o)}</td><td class="muted" style="white-space:nowrap">${when(cfg, o.createdAt)}</td></tr>`;
    })
    .join("");
  const funded = obs.filter((o) => o.payment.state === "funded");
  return consolePage(
    "AllScale Legwork — Payouts",
    "Payouts",
    `<div class="pagehead"><div><h1>Payouts</h1><p>One obligation per accepted task. Each is paid once through an AllScale claim link, idempotent by its reference id — a retry never pays twice.</p></div><div class="act"><span class="tag ok">${funded.length} funded · ${fmtAmt(sumAmt(funded))} ${funded[0] ? coin(funded[0]) : cfg.payCoin}</span></div></div>
<div class="panel">${
      rows ? `<div class="tw"><table class="t"><thead><tr><th>Task / obligation</th><th>Worker</th><th>Amount</th><th>Payment</th><th>Funding tx</th><th>Claim</th><th>Created</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="pb empty">No payouts yet. Accepting work on the Review page creates one.</div>`
    }</div>`,
    { nav: "payouts", ...consoleOpts(cfg, l), script: cfg.demo ? DEMO_JS : "" },
  );
}

// ---------- Review ----------

/** Map AllScale failure codes to one plain sentence. The agent's credential is operator-granted; these are the ways it gets refused. */
export function explain(err?: { code: number | null; message: string; reasonCode?: string }): { msg: string; code: string; retry: boolean } {
  const rc = err?.reasonCode ?? "";
  const c = err?.code ?? 0;
  if (rc === "policy_denied" || c === 30002 || c === 50104) return { msg: "The operator has revoked this agent's spending authority.", code: rc || String(c), retry: true };
  if (rc === "session_expired") return { msg: "Operator authorization expired. Re-authorize in the AllScale dashboard.", code: rc, retry: true };
  if (rc === "signer_error") return { msg: "Signing failed on AllScale's side. Retry.", code: rc, retry: true };
  if (c === 20001 || c === 20002) return { msg: "The agent's credential is no longer valid.", code: String(c), retry: false };
  if (c === 40001) return { msg: "Rate limited by AllScale. Retry in a moment.", code: String(c), retry: true };
  return { msg: err?.message || "Payout refused.", code: err?.code != null ? String(err.code) : "unknown", retry: true };
}

export const guardBlock = (err: ReturnType<typeof explain>, retryForm = "", eyebrow = "Payout blocked · No funds moved") =>
  `<div class="guard"><span class="shield">${err.retry ? SHIELD_I : SHIELD_X}</span><div><div class="ey">${esc(eyebrow)}</div><div class="msg">${esc(err.msg)}</div><div class="code"><b>${esc(err.code)}</b> · enforced by AllScale policy engine</div></div>${retryForm}</div>`;

export function reviewPage(l: Ledger, token: string, cfg: ViewCfg): string {
  const submitted = awaiting(l);
  const pending = Object.values(l.obligations).filter((o) => o.payment.state !== "funded");
  const needs = pending.map((o) => needsCard(o, l.tasks[o.taskId], token)).join("");
  const realTx = Object.values(l.obligations).find((o) => o.payment.fundingTxHash)?.payment.fundingTxHash;
  const demoBits = cfg.demo
    ? `${realTx ? `<span id="demo-tx" hidden data-tx="${esc(short(realTx, 10))}" data-url="${esc(cfg.evmLink(realTx))}"></span>` : ""}<template id="demo-guard">${guardBlock(explain({ code: 30002, message: "", reasonCode: "policy_denied" }))}</template>`
    : "";
  return consolePage(
    "AllScale Legwork — Review",
    "Review",
    `<div class="pagehead"><div><h1>Review</h1><p>Check the evidence, then accept. The agent funds an AllScale claim link for the worker from the operator's wallet — within the budget the operator set.</p></div><div class="act">${tag(`${submitted.length} waiting`, submitted.length ? "warn" : "")}</div></div>
${submitted.map((t) => reviewCard(t, token, cfg)).join("") || `<div class="panel"><div class="pb empty">Nothing to review.</div></div>`}
<div class="panel" style="margin-top:20px"><div class="ph"><h2>Needs operator</h2></div><div class="pb">${needs || `<span class="empty">All payouts are healthy.</span>`}</div></div>${demoBits}`,
    { nav: "review", ...consoleOpts(cfg, l), script: cfg.demo ? DEMO_JS : REVIEW_JS },
  );
}

/** Accept & pay without leaving the page: show a timer while AllScale funds the link, then render the result in place. */
const REVIEW_JS = String.raw`
(function(){
  document.querySelectorAll("form.accept").forEach(function(f){
    f.addEventListener("submit",function(e){
      e.preventDefault();
      var card=f.closest("[data-review]"),btns=card.querySelector(".actions"),prog=card.querySelector(".progress"),t=0,timer;
      btns.querySelectorAll("button").forEach(function(b){b.disabled=true});
      prog.classList.add("on");timer=setInterval(function(){t++;prog.querySelector(".mono").textContent=t+" s"},1000);
      fetch(f.action,{method:"POST",headers:{"Accept":"application/json","Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams(new FormData(f))})
        .then(function(r){return r.json()}).then(function(j){
          clearInterval(timer);prog.classList.remove("on");
          var slot=card.querySelector(".result");
          if(j.ok){slot.innerHTML='<div class="success"><span class="ck">'+${JSON.stringify(CHECK)}+'</span>Funded · <a href="'+j.txUrl+'" target="_blank" rel="noopener">'+j.tx+' ↗</a></div>';}
          else{slot.innerHTML=j.guardHtml;}
          setTimeout(function(){location.reload()},j.ok?2500:60000);
        }).catch(function(err){clearInterval(timer);prog.classList.remove("on");alert(String(err))});
    });
  });
})();`;

const reviewCard = (t: Task, token: string, cfg: ViewCfg) => {
  const ev = (t.submission?.evidence ?? {}) as { check?: { checks: { name: string; ok: boolean; detail: string }[] }; file?: string; note?: string };
  const checks = (ev.check?.checks ?? []).map((c) => tag(`${c.name}: ${c.detail}`, c.ok ? "ok" : "warn", true)).join("") || tag("no checks", "dim");
  const src = ev.file ? cfg.uploadSrc(ev.file) + (token ? `?token=${encodeURIComponent(token)}` : "") : "";
  return `<div class="panel" data-review style="margin-bottom:20px"><div class="pb"><div class="rv">
<div class="photo-box">${src ? `<img src="${esc(src)}" alt="Submitted photo">` : "no photo"}</div>
<div><div class="tt">${esc(t.title)}</div><div class="idl">${esc(t.id.slice(0, 13))} · job ${esc(t.jobId.slice(4, 12))} <span data-state>${stateTag(t.state)}</span></div>
<dl class="kv"><dt>Worker</dt><dd>${esc(maskEmail(t.workerEmail))}</dd>${t.submission ? `<dt>Submitted</dt><dd>${when(cfg, t.submission.at)}</dd>` : ""}${ev.note ? `<dt>Note</dt><dd>${esc(ev.note)}</dd>` : ""}<dt>Checks</dt><dd class="checks">${checks}</dd><dt>Criteria</dt><dd>${esc(t.acceptanceCriteria)}</dd></dl>
<div class="actions"><form class="accept" method="post" action="/review/${esc(t.id)}/accept"><input type="hidden" name="token" value="${esc(token)}"><input type="hidden" name="batchId" value="${esc(t.batchId)}"><button class="btn go" type="submit">Accept &amp; pay ${fmtAmt(t.reward)} ${cfg.payCoin}</button></form>
<form method="post" action="/review/${esc(t.id)}/flag"><input type="hidden" name="token" value="${esc(token)}"><button class="btn line" type="submit">Flag</button></form></div>
<div class="progress"><span class="spin"></span>Funding claim link via AllScale…<span class="mono">0 s</span></div>
<div class="result"></div>
</div></div></div></div>`;
};

const needsCard = (o: Obligation, t: Task | undefined, token: string) => {
  const retry = `<form method="post" action="/review/pay/${esc(o.id)}"><input type="hidden" name="token" value="${esc(token)}"><button class="btn line" type="submit">${o.payment.state === "failed_needs_operator" ? "Retry payment" : "Retry"}</button></form>`;
  const body =
    o.payment.state === "failed_needs_operator"
      ? guardBlock(explain(o.payment.lastError))
      : `<div class="progress on"><span class="spin"></span>${esc(o.payment.state)} · ${o.payment.attempts} attempt${o.payment.attempts === 1 ? "" : "s"}${o.payment.lastError ? ` · ${esc(o.payment.lastError.message)}` : ""}</div>`;
  return `<div class="needs" style="padding:8px 0"><div><div style="font-weight:500">${esc(t?.title ?? o.taskId)}</div><div class="mono muted" style="font-size:12px">${esc(o.id.slice(0, 14))} · ${fmtAmt(o.amount)} ${coin(o)} · ${esc(maskEmail(o.workerEmail))}</div></div>${body}${retry}</div>`;
};

// ---------- Worker app (phone) ----------

export function workPage(l: Ledger, me: string, cfg: ViewCfg): string {
  if (!me) {
    return appPage(
      "AllScale Legwork — Worker",
      `<div class="apphead">${LOGO}</div><div class="scroll"><form class="signin" method="get" action="/work"><h2>Get paid for legwork.</h2><p>Take a nearby task, snap a photo, get paid by email. No wallet needed.</p><input class="field" type="email" name="me" placeholder="Your email — this is where the money goes" required><button class="btn go" type="submit" style="width:100%;margin-top:12px;min-height:48px">Continue</button></form></div>`,
      { demo: cfg.demo, script: TABS_JS },
    );
  }
  const open = Object.values(l.tasks).filter((t) => t.state === "open");
  const mine = Object.values(l.tasks).filter((t) => (t.state === "assigned" || t.state === "submitted") && (t.workerEmail ?? "").toLowerCase() === me);
  // Paid tasks for this worker: the claim link is shown here, so delivery never depends on email arriving.
  const paid = Object.values(l.obligations).filter((o) => o.workerEmail.toLowerCase() === me && o.payment.state === "funded");
  const ready = paid.filter((o) => o.claim.state !== "claimed");
  const wcoin = paid[0] ? coin(paid[0]) : cfg.payCoin;

  const screen = `<div class="apphead">${LOGO}<div class="who" title="${esc(me)}"><span class="avatar">${esc(me.slice(0, 1).toUpperCase())}</span></div></div>
<div class="scroll">
<section class="tab" data-tab="tasks"><h2>Nearby</h2><p class="lede">On-site tasks posted by the Legwork agent</p><div id="sec-open">${open.length ? open.map((t) => openCard(t, me, cfg)).join("") : `<p class="empty">Nothing open right now.</p>`}</div></section>
<section class="tab" data-tab="mine"><h2>My work</h2><p class="lede">Finish before the timer runs out</p><div id="sec-mine">${mine.length ? mine.map((t) => assignedCard(t, cfg)).join("") : `<p class="empty">Take a task to start.</p>`}</div></section>
<section class="tab" data-tab="wallet"><h2>Wallet</h2><p class="lede">Paid by email through AllScale</p><div class="wallet">${LOGO}<div class="k">Earned with Legwork</div><div class="v">${fmtAmt(sumAmt(paid))}<small>${wcoin}</small></div><div class="s">Paid by AllScale claim links · gas covered · no wallet needed</div></div>
<h3>Payments</h3>${paid.length ? paid.map((o) => paidCard(o, l.tasks[o.taskId], cfg)).join("") : `<p class="empty">Accepted work shows up here with a claim button.</p>`}
<div class="foot">Powered by AllScale</div></section>
</div>
<nav class="tabs"><button type="button" data-go="tasks">${ICONS.tasks}Nearby<span class="bd" id="bd-tasks" data-n="${open.length}">${open.length}</span></button><button type="button" data-go="mine">${ICONS.mine}My work<span class="bd" id="bd-mine" data-n="${mine.length}">${mine.length}</span></button><button type="button" data-go="wallet">${ICONS.wallet}Wallet<span class="bd" id="bd-wallet" data-n="${ready.length}">${ready.length}</span></button></nav>`;
  return appPage("AllScale Legwork — Worker", screen, { demo: cfg.demo, script: TABS_JS + (cfg.demo ? DEMO_JS : WORK_LIVE_JS) });
}

/** Tab bar, deadline countdowns, photo picker. The open tab lives in location.hash so reloads keep it. */
const TABS_JS = String.raw`
(function(){
  window.legworkTab=function(name){document.querySelectorAll(".tab").forEach(function(s){s.classList.toggle("on",s.dataset.tab===name)});document.querySelectorAll("[data-go]").forEach(function(b){b.classList.toggle("on",b.dataset.go===name)});if(history.replaceState)history.replaceState(null,"","#"+name);var sc=document.querySelector(".scroll");if(sc)sc.scrollTop=0};
  document.querySelectorAll("[data-go]").forEach(function(b){b.addEventListener("click",function(){legworkTab(b.dataset.go)})});
  if(document.querySelector(".tab"))legworkTab((location.hash||"#tasks").slice(1));
  var els=[].slice.call(document.querySelectorAll("[data-deadline]"));
  function tick(){var now=Date.now();els.forEach(function(e){var s=Math.max(0,Math.floor((+e.dataset.deadline-now)/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;e.textContent=h?h+"h "+String(m).padStart(2,"0")+"m":m+"m "+String(sec).padStart(2,"0")+"s"})}
  tick();setInterval(tick,1000);
  document.querySelectorAll(".photo input").forEach(function(i){i.addEventListener("change",function(){var l=i.closest(".photo");l.classList.add("picked");l.querySelector("small").textContent=i.files[0]?i.files[0].name:""})});
})();`;
const WORK_LIVE_JS = String.raw`
(function(){
  setInterval(function(){if(!document.querySelector("form.busy")&&!document.activeElement.matches("input,textarea"))location.reload()},10000);
  document.querySelectorAll("form").forEach(function(f){f.addEventListener("submit",function(){f.classList.add("busy")})});
})();`;

const amt = (a: string | number, c: string, sm = false) => `<div class="amount${sm ? " sm" : ""}">${fmtAmt(a)}<small>${esc(c)}</small></div>`;
const crit = (t: Task) => `<div class="crit"><b>Accepted if</b>${esc(t.acceptanceCriteria)}</div>`;
const PHOTO_ICON = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0c9a4a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>`;

const paidCard = (o: Obligation, t: Task | undefined, cfg: ViewCfg) =>
  o.claim.state === "claimed"
    ? `<div class="card"><div class="row"><div class="title">${esc(t?.title ?? o.taskId)}</div>${tag("claimed", "ok")}</div>${amt(o.amount, coin(o), true)}<div class="claimed">✓ Claimed${o.claim.claimTxHash ? ` · <span class="mono">${short(o.claim.claimTxHash, 6)}</span>` : ""}</div></div>`
    : `<div class="card ready"><div class="row"><div class="title">${esc(t?.title ?? o.taskId)}</div>${tag("ready to claim", "ok", true)}</div>${amt(o.amount, coin(o))}<div class="meta"><span>Gas covered · no wallet needed</span>${o.payment.fundingTxHash ? link(cfg.evmLink(o.payment.fundingTxHash), "funding tx") : ""}</div>${
        o.payment.claimUrl ? `<a class="btn go" href="${esc(o.payment.claimUrl)}" target="_blank" rel="noopener"${cfg.demo ? " data-claim" : ""}>Claim ${fmtAmt(o.amount)} ${coin(o)}</a>` : `<div class="waiting"><span class="spin"></span>Claim link on its way…</div>`
      }</div>`;

const submitForm = (t: Task) =>
  `<form method="post" action="/work/${esc(t.id)}/submit" enctype="multipart/form-data"><input type="hidden" name="batchId" value="${esc(t.batchId)}">
<label class="photo">${PHOTO_ICON}Take photo<small>Opens your camera</small><input type="file" name="photo" accept="image/*" capture="environment" required></label>
<textarea class="field" name="note" placeholder="Note (optional)"></textarea><button class="btn go" type="submit">Submit</button></form>`;

const assignedCard = (t: Task, cfg: ViewCfg) =>
  t.state === "submitted"
    ? `<div class="card"><div class="row"><div class="title">${esc(t.title)}</div>${tag("submitted", "warn")}</div>${amt(t.reward, cfg.payCoin, true)}<div class="waiting"><span class="spin"></span>Submitted — waiting for review</div></div>`
    : `<div class="card"><div class="row"><div class="title">${esc(t.title)}</div>${tag("in progress")}</div>${amt(t.reward, cfg.payCoin)}<div class="meta"><span class="warnc" data-deadline="${new Date(t.deadline).getTime()}"></span><span>left</span></div>${crit(t)}${submitForm(t)}</div>`;

const openCard = (t: Task, me: string, cfg: ViewCfg) => `<div class="card"><div class="title">${esc(t.title)}</div>${amt(t.reward, cfg.payCoin)}<div class="meta"><span class="warnc" data-deadline="${new Date(t.deadline).getTime()}"></span><span>to finish once taken</span></div>${crit(t)}
<form method="post" action="/work/${esc(t.id)}/take"><input type="hidden" name="email" value="${esc(me)}"><button class="btn dark" type="submit">Take this task</button></form></div>`;

// ---------- static demo: every action is simulated in the browser ----------

/**
 * Demo build only. Nothing leaves the page. Clicks change the page the way the live app would:
 * take → submit → (operator) accept & pay → claim, revoke the agent's authority, replay a job's money flow.
 * The revoke switch persists in sessionStorage so Review refuses payouts after a revoke on Overview.
 */
const DEMO_JS = String.raw`
(function(){
  var CK=${JSON.stringify(CHECK)},SOK=${JSON.stringify(SHIELD_OK)},SX=${JSON.stringify(SHIELD_X)},PH=${JSON.stringify(PHOTO_ICON)};
  var t=document.createElement("div");t.className="toast";document.body.appendChild(t);var h;
  function toast(m){t.textContent=m;t.classList.add("on");clearTimeout(h);h=setTimeout(function(){t.classList.remove("on")},3600)}
  function pulse(el){el.classList.remove("flash");void el.offsetWidth;el.classList.add("flash")}
  function store(k,v){try{if(v===undefined)return sessionStorage.getItem(k);if(v===null)sessionStorage.removeItem(k);else sessionStorage.setItem(k,v)}catch(e){}}
  function bump(id,d){var n=document.getElementById(id);if(!n)return;var v=Math.max(0,+n.textContent+d);n.textContent=v;n.dataset.n=v}
  function setTag(card,html){var old=card.querySelector(".row .tag");if(old)old.outerHTML=html;else{var ti=card.querySelector(".title");ti.outerHTML='<div class="row">'+ti.outerHTML+html+'</div>'}}
  function wirePhoto(i){i.removeAttribute("required");i.addEventListener("change",function(){var l=i.closest(".photo");l.classList.add("picked");l.querySelector("small").textContent=i.files[0]?i.files[0].name:""})}

  // ---- overview: revoke / restore the agent's spending authority
  var auth=document.getElementById("auth");
  function paintAuth(off){if(!auth)return;auth.classList.toggle("off",off);auth.querySelector(".ic").innerHTML=off?SX:SOK;auth.querySelector("[data-auth-state]").textContent=off?"Revoked":"Active";var b=auth.querySelector("[data-revoke]");if(b)b.setAttribute("aria-checked",off?"false":"true")}
  paintAuth(store("legwork-revoked")==="1");
  document.querySelectorAll("[data-revoke]").forEach(function(b){b.addEventListener("click",function(){var off=store("legwork-revoked")!=="1";store("legwork-revoked",off?"1":null);paintAuth(off);pulse(auth);
    toast(off?"Authority revoked — the agent can't pay anyone. Try Accept & pay on Review.":"Authority restored — the agent can pay again, within budget.")})});

  // ---- jobs: replay the first job's money moving through the five steps
  document.querySelectorAll("[data-replay]").forEach(function(b){b.addEventListener("click",function(){
    var job=document.querySelector("[data-job]");if(!job)return;var steps=[].slice.call(job.querySelectorAll(".step"));
    var orig=steps.map(function(x){return x.className}),here=job.querySelector(".here");if(here)here.style.visibility="hidden";
    steps.forEach(function(x){x.className="step idle"});b.disabled=true;job.scrollIntoView({behavior:"smooth",block:"start"});
    var msgs=["Client pays the agent 9 USDC on Solana (x402)","The agent burns USDC on Solana via Circle CCTP","USDC is minted to the operator's wallet on Sepolia","AllScale funds a claim link for each accepted task","Workers claim by email — the money is with the humans"];
    steps.forEach(function(x,i){setTimeout(function(){x.className="step done has-here";if(i)steps[i-1].className="step done";pulse(x);toast(msgs[i])},600+i*1400)});
    setTimeout(function(){steps.forEach(function(x,i){x.className=orig[i]});if(here)here.style.visibility="";b.disabled=false},600+steps.length*1400+1800);
  })});

  // ---- worker app: claim
  document.querySelectorAll("[data-claim]").forEach(function(a){a.addEventListener("click",function(e){e.preventDefault();var card=a.closest(".card");card.classList.remove("ready");setTag(card,'<span class="tag ok">claimed</span>');
    a.outerHTML='<div class="claimed">✓ Claimed (simulated) — in your AllScale wallet</div>';bump("bd-wallet",-1);pulse(card);
    toast("Claimed. For real, the worker opens the AllScale link from their email — no wallet, no gas.")})});

  function onSubmit(e){
    e.preventDefault();
    var f=e.currentTarget,action=f.getAttribute("action")||"",card=f.closest(".card,[data-review]");
    if(/\/take$/.test(action)){
      var mine=document.getElementById("sec-mine");var em=mine.querySelector(".empty");if(em)em.remove();mine.insertBefore(card,mine.firstChild);
      bump("bd-tasks",-1);bump("bd-mine",1);setTag(card,'<span class="tag">in progress</span>');
      f.outerHTML='<form method="post" action="/work/demo/submit"><label class="photo">'+PH+'Take photo<small>Optional in the demo</small><input type="file" name="photo" accept="image/*"></label><textarea class="field" name="note" placeholder="Note (optional)"></textarea><button class="btn go" type="submit">Submit</button></form>';
      var nf=card.querySelector("form");nf.addEventListener("submit",onSubmit);wirePhoto(nf.querySelector(".photo input"));
      if(window.legworkTab)legworkTab("mine");pulse(card);toast("Task taken. Go on site, take the photo, submit.");return}
    if(/\/submit$/.test(action)){
      setTag(card,'<span class="tag warn">submitted</span>');f.outerHTML='<div class="waiting"><span class="spin"></span>Submitted — waiting for review</div>';pulse(card);
      toast("Submitted. The operator reviews it in the console.");return}
    if(/\/flag$/.test(action)){var st=card.querySelector("[data-state]");if(st)st.innerHTML='<span class="tag warn">needs_review</span>';toast("Flagged for a second look — no payout.");return}
    if(!f.classList.contains("accept")){toast("Demo only — run the app locally to try this.");return}
    var prog=card.querySelector(".progress"),s=0,revoked=store("legwork-revoked")==="1";
    card.querySelector(".result").innerHTML="";
    card.querySelectorAll(".actions button").forEach(function(b){b.disabled=true});
    prog.classList.add("on");var timer=setInterval(function(){s++;prog.querySelector(".mono").textContent=s+" s"},1000);
    setTimeout(function(){clearInterval(timer);prog.classList.remove("on");prog.querySelector(".mono").textContent="0 s";
      if(revoked){var g=document.getElementById("demo-guard");card.querySelector(".result").innerHTML=g?g.innerHTML:"";card.querySelectorAll(".actions button").forEach(function(b){b.disabled=false});
        toast("Refused — the operator revoked the agent's authority. Switch it back on in Overview.");return}
      var st=card.querySelector("[data-state]");if(st)st.innerHTML='<span class="tag ok">accepted</span>';
      var d=(document.getElementById("demo-tx")||{dataset:{}}).dataset;
      card.querySelector(".result").innerHTML='<div class="success"><span class="ck">'+CK+'</span>Claim link funded (simulated)<small>In the live app this calls AllScale Auto-Payout. A real funding tx from our verification run: <a href="'+d.url+'" target="_blank" rel="noopener">'+d.tx+' ↗</a></small></div>';
      toast("Paid. The worker gets an email with a claim link.");
    },revoked?1500:3000);
  }
  document.querySelectorAll("form").forEach(function(f){f.addEventListener("submit",onSubmit)});
  document.querySelectorAll(".photo input").forEach(wirePhoto);
})();`;

// ---------- pitch deck ----------

/** The static design deck, with live links and the newest real hashes from the ledger swapped in. */
export function deckPage(html: string, l: Ledger, cfg: ViewCfg, opts: { reviewHref: string; demoWorker: string }): string {
  const jobs = jobsSorted(l);
  const x402 = jobs.find((j) => j.sweep?.state === "minted")?.clientRef ?? jobs[0]?.clientRef;
  const swept = jobs.find((j) => j.sweep?.state === "minted")?.sweep;
  const funded = Object.values(l.obligations).filter((o) => o.payment.state === "funded" && o.payment.fundingTxHash).sort((a, b) => (b.payment.fundedAt ?? "").localeCompare(a.payment.fundedAt ?? ""))[0];
  const rep = (h: string, placeholder: string, value: string | undefined | null, href: string) =>
    value ? h.replace(placeholder, `<a href="${esc(href)}" target="_blank" rel="noopener" class="mono">${esc(short(value, 12))} ↗</a>`) : h;
  let out = html
    .replace(/http:\/\/localhost:4031/g, "")
    .replace("review?token=TOKEN", opts.reviewHref.replace(/^\//, ""))
    .replace("work?me=demo@example.com", `work?me=${encodeURIComponent(opts.demoWorker)}`);
  // Proof slide: swap the design's placeholder hashes for the live ones.
  out = rep(out, `<a href="#" class="mono" style="font-size:24px">yGeuCDHCyZ86…kUkVzYq6 ↗</a>`, x402, cfg.solLink(x402));
  out = rep(out, `<a href="#">DajXP1mtgbqu…mL3h3mF ↗</a>`, swept?.solanaBurnTx, cfg.solLink(swept?.solanaBurnTx));
  out = rep(out, `<a href="#">0xf511fedfc79e…222b6da1c ↗</a>`, swept?.evmReceiveTx, cfg.evmLink(swept?.evmReceiveTx));
  out = rep(out, `<a href="#" class="mono" style="font-size:24px">0xd7ea677e422a…5303c7eb ↗</a>`, funded?.payment.fundingTxHash, cfg.evmLink(funded?.payment.fundingTxHash));
  return out;
}

/** Public JSON view of the ledger: no emails, no claim URLs. */
export function redactLedger(l: Ledger): Ledger {
  const r = structuredClone(l);
  for (const o of Object.values(r.obligations)) {
    (o as { workerEmail: string }).workerEmail = "[redacted]";
    o.payment.claimUrl = o.payment.claimUrl ? "[private]" : null;
  }
  return r;
}
