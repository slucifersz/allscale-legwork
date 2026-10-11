import "dotenv/config";
import express from "express";
import multer from "multer";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildFromEnv } from "@agent-payroll/payout-orchestrator/src/config.js";
import type { Job, Ledger, Obligation, Task } from "@agent-payroll/payout-orchestrator/src/model.js";
import { checkPhoto } from "./checks.js";
import { CHECK, CROSS, SHIELD_I, SHIELD_X, ago, esc, fmtAmt, page, short, tag } from "./html.js";

const env = (k: string, d?: string) => process.env[k] ?? d ?? "";
const { orch, store } = buildFromEnv();
const dataDir = env("PAYROLL_DATA_DIR", "./data");
const uploads = join(dataDir, "uploads");
mkdirSync(uploads, { recursive: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const OP = env("OPERATOR_TOKEN", "change-me");
const solLink = (sig?: string | null) => (sig ? env("SOLANA_EXPLORER", "https://explorer.solana.com/tx/{sig}?cluster=devnet").replace("{sig}", sig) : "");
const evmLink = (h?: string | null) => (h ? env("EVM_EXPLORER", "https://sepolia.etherscan.io/tx/{hash}").replace("{hash}", h) : "");
const coin = (o: { stableCoin?: number }) => (o.stableCoin === 1 ? "USDT" : "USDC");
const PAY_COIN = process.env.ALLSCALE_STABLE_COIN === "2" ? "USDC" : "USDT";
const link = (href: string, text: string) => (href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(text)} ↗</a>` : `<span class="dash">—</span>`);

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ---------- public: verifiable settlement record ----------
// Shows tx hashes, anonymised task ids and states. Never emails, never claim URLs.
app.get("/", (req, res) => {
  const l = store.get();
  const jobs = Object.values(l.jobs).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const cards = jobs.map((job) => jobCard(job, l)).join("") || `<p class="empty">No jobs yet. The first x402 payment will appear here.</p>`;
  if (req.query.partial) return res.send(cards);
  res.send(
    page(
      "AllScale Legwork — Settlement record",
      `<h1>An AI agent earns USDC on Solana, hands the on-site work to real people, and pays them by email — no wallet, no gas, no KYC.</h1>
<p class="lead">The agent spends only within a budget its operator set, and the operator can revoke that authority at any time.</p>
<div class="jobs" id="jobs">${cards}</div>`,
      { nav: "settlement", script: POLL_JS },
    ),
  );
});

/** Live refresh: re-fetch the job cards every 3 s; flash any money-trail step whose state changed. */
const POLL_JS = String.raw`
(function(){
  var box=document.getElementById("jobs");if(!box)return;
  function sig(root){var m={};root.querySelectorAll("[data-job]").forEach(function(j){j.querySelectorAll("[data-step]").forEach(function(s){m[j.dataset.job+"/"+s.dataset.step]=s.className.replace(" flash","")})});return m}
  function flash(el){el.classList.remove("flash");void el.offsetWidth;el.classList.add("flash");setTimeout(function(){el.classList.remove("flash")},1000)}
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

function jobCard(job: Job, l: Ledger): string {
  const tasks = Object.values(l.tasks).filter((t) => t.jobId === job.id);
  const obs = Object.values(l.obligations).filter((o) => tasks.some((t) => t.id === o.taskId));
  const funded = obs.filter((o) => o.payment.state === "funded");
  const claimed = obs.filter((o) => o.claim.state === "claimed");
  const refunded = obs.filter((o) => o.claim.state === "refunded");
  const blocked = obs.filter((o) => o.payment.state === "failed_needs_operator");
  const sw = job.sweep;
  const minted = sw?.state === "minted";
  const payCoin = funded[0] ? coin(funded[0]) : PAY_COIN;

  // where is the money right now?
  let hereIdx: number, now: string, revoked = false;
  if (blocked.length) { hereIdx = 4; now = "Held by operator"; revoked = true; }
  else if (claimed.length && claimed.length === funded.length && funded.length === tasks.length) { hereIdx = 5; now = "With the people who did the work"; }
  else if (funded.length) { hereIdx = 4; now = "In claim links, waiting to be claimed"; }
  else if (minted) { hereIdx = 3; now = "Minted to operator"; }
  else if (sw) { hereIdx = 2; now = "Burned on Solana, waiting for attestation"; }
  else { hereIdx = 1; now = "Received on Solana"; }
  const tail = revoked ? `<span style="color:var(--bad)">Agent revoked — ${blocked.length} payout${blocked.length > 1 ? "s" : ""} refused</span>` : `<span class="muted">${funded.length} of ${tasks.length} workers funded</span>`;

  const ico = (cls: string) => (cls.startsWith("done") ? `<span class="ico">${CHECK}</span>` : cls.startsWith("bad") ? `<span class="ico">${CROSS}</span>` : cls.startsWith("wait") ? `<span class="ico"></span>` : "");
  const step = (n: number, cls: string, title: string, sub: string, extra = "") => {
    const here = hereIdx === n ? " has-here" : "";
    return `<div class="step ${cls}${here}" data-step="${n}">${here ? `<span class="here">MONEY IS HERE</span>` : ""}${ico(cls)}<div class="n">0${n}</div><div class="t">${title}</div>${extra}<div class="sub">${sub}</div></div>`;
  };
  const s1 = step(1, "done", "Client paid", `Solana · ${fmtAmt(job.revenueAmount)} USDC · ${link(solLink(job.clientRef), short(job.clientRef, 6))}`);
  const s2 = step(2, sw ? "done" : "wait", "CCTP burn", sw ? `Solana · ${link(solLink(sw.solanaBurnTx), short(sw.solanaBurnTx, 6))}` : "Solana · not started");
  const s3 = step(3, minted ? "done" : sw ? "wait" : "idle", "USDC minted to operator", minted ? `EVM · Sepolia · ${fmtAmt(Number(sw!.mintedAtomic ?? 0) / 1e6)} USDC · ${link(evmLink(sw!.evmReceiveTx), short(sw!.evmReceiveTx, 6))}` : sw ? "EVM · Sepolia · waiting for attestation" : "EVM · Sepolia");
  const s4cls = blocked.length ? "bad" : funded.length && funded.length === tasks.length ? "done" : funded.length || obs.length ? "wait" : "idle";
  const s4 = step(
    4,
    s4cls,
    "Claim links funded",
    blocked.length ? `refused · agent revoked (${blocked.length})` : `AllScale · Sepolia · ${funded.length}/${tasks.length} · ${fmtAmt(funded.reduce((a, o) => a + Number(o.amount), 0))} ${payCoin}`,
    s4cls === "wait" && tasks.length ? `<div class="prog"><i style="width:${Math.round((funded.length / tasks.length) * 100)}%"></i></div>` : "",
  );
  const s5cls = refunded.length ? "bad" : claimed.length && claimed.length === funded.length ? "done" : funded.length ? "wait" : "idle";
  const s5 = step(5, s5cls, "Claimed by humans", `email · AllScale · ${claimed.length}/${funded.length}${refunded.length ? ` · ${refunded.length} refunded` : ""}`);

  const rows = tasks.map((t) => taskRow(t, obs.filter((o) => o.taskId === t.id))).join("");
  return `<article class="card" data-job="${esc(job.id)}">
<div class="jobhead"><b>Job ${esc(job.id.slice(0, 12))}</b><span class="sep">·</span><b>${fmtAmt(job.revenueAmount)} USDC</b> on Solana<span class="sep">·</span>${link(solLink(job.clientRef), short(job.clientRef))}<span class="sep">·</span>${ago(job.createdAt)}</div>
<div class="status${revoked ? " revoked" : ""}"><span class="now">MONEY IS NOW</span><span>${now}</span><span class="sep">·</span>${tail}</div>
<div class="trail">${RIBBON}${s1}${s2}${s3}${s4}${s5}</div>
<div class="tablewrap"><table class="tasks"><thead><tr><th>Task</th><th>State</th><th>Obligation</th><th>Payment</th><th>Funding tx</th><th>Claim</th></tr></thead><tbody>${rows}</tbody></table></div>
</article>`;
}

const RIBBON = `<svg class="rib" viewBox="0 0 1000 160" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="rg1" x1="0" x2="1"><stop offset="0" stop-color="#3ddc84" stop-opacity=".5"/><stop offset=".62" stop-color="#3ddc84" stop-opacity=".55"/><stop offset=".72" stop-color="#f0a842" stop-opacity=".35"/><stop offset="1" stop-color="#2a2f2c" stop-opacity=".2"/></linearGradient><filter id="b1"><feGaussianBlur stdDeviation="10"/></filter></defs><path d="M0 95 C 120 40, 220 140, 350 85 S 600 30, 700 90 S 900 130, 1000 70" fill="none" stroke="#1f6b3d" stroke-width="60" opacity=".55" filter="url(#b1)"/><path d="M0 95 C 120 40, 220 140, 350 85 S 600 30, 700 90 S 900 130, 1000 70" fill="none" stroke="url(#rg1)" stroke-width="3" vector-effect="non-scaling-stroke"/><path class="flow" d="M0 95 C 120 40, 220 140, 350 85 S 600 30, 700 90" fill="none" stroke="#3ddc84" stroke-width="2.5" stroke-dasharray="1 13" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;

const stateTag = (s: string) => tag(s, s === "accepted" ? "ok" : s === "submitted" || s === "needs_review" ? "warn" : s === "void" ? "bad" : "");
const payTag = (o: Obligation) =>
  o.payment.state === "funded" ? tag("funded", "ok", true)
  : o.payment.state === "failed_needs_operator" ? tag("agent revoked", "bad", true)
  : o.payment.state === "in_flight" ? `<span class="tag warn"><span class="spin"></span>in_flight</span>`
  : tag(o.payment.state, "dim");
const claimTag = (o: Obligation) => tag(o.claim.state, o.claim.state === "claimed" ? "ok" : o.claim.state === "refunded" || o.claim.state === "cancelled" ? "bad" : o.claim.state === "pending" ? "warn" : "");

function taskRow(t: Task, obs: Obligation[]): string {
  const cell = (title: string) => `<td><div class="tt">${esc(title)}</div><div class="id">${esc(t.id.slice(0, 13))}</div></td>`;
  if (!obs.length) return `<tr>${cell(t.title)}<td>${stateTag(t.state)}</td><td class="amt">${fmtAmt(t.reward)} ${PAY_COIN}</td><td>${tag("not_requested", "dim")}</td><td class="tx dash">—</td><td class="dash">—</td></tr>`;
  return obs
    .map(
      (o) => `<tr>${cell(t.title)}<td>${stateTag(t.state)}</td><td class="amt">${fmtAmt(o.amount)} ${coin(o)}${o.supersedes ? `<div class="id">re-issue</div>` : ""}</td><td>${payTag(o)}</td><td class="tx">${o.payment.fundingTxHash ? link(evmLink(o.payment.fundingTxHash), short(o.payment.fundingTxHash, 6)) : `<span class="dash">—</span>`}</td><td>${claimTag(o)}${o.claim.claimTxHash ? `<div class="id">${link(evmLink(o.claim.claimTxHash), short(o.claim.claimTxHash, 6))}</div>` : ""}</td></tr>`,
    )
    .join("");
}

// ---------- workers: task board (mobile) ----------
app.get("/work", (req, res) => {
  const l = store.get();
  const me = String(req.query.me ?? "").trim().toLowerCase();
  const open = Object.values(l.tasks).filter((t) => t.state === "open");
  const mine = Object.values(l.tasks).filter((t) => (t.state === "assigned" || t.state === "submitted") && me && (t.workerEmail ?? "").toLowerCase() === me);
  // Paid tasks for this worker: the claim link is shown here, so delivery never depends on email arriving.
  const paid = me ? Object.values(l.obligations).filter((o) => o.workerEmail.toLowerCase() === me && o.payment.state === "funded").map((o) => ({ o, t: l.tasks[o.taskId] })) : [];
  const who = me
    ? `<div class="me">${esc(me)}</div>`
    : `<form method="get" action="/work" class="card" style="margin-top:18px"><div class="title">Who are you?</div><input class="field" type="email" name="me" placeholder="Your email — this is where the money goes" required><button class="btn go" type="submit">Show my tasks</button></form>`;
  const body = `${who}
<h2>Your payments<span>${paid.length}</span></h2>${paid.length ? paid.map(({ o, t }) => paidCard(o, t)).join("") : `<p class="empty">Nothing yet — accepted work shows up here with a claim button.</p>`}
<h2>Your tasks<span>${mine.length}</span></h2>${mine.length ? mine.map(assignedCard).join("") : `<p class="empty">—</p>`}
<h2>Open tasks<span>${open.length}</span></h2>${open.length ? open.map((t) => openCard(t, me)).join("") : `<p class="empty">Nothing open right now.</p>`}
<div class="foot">Paid via AllScale claim link · Powered by AllScale</div>`;
  res.send(page("AllScale Legwork — Task board", body, { bodyClass: "work", nav: "none", script: WORK_JS }));
});

const WORK_JS = String.raw`
(function(){
  var els=[].slice.call(document.querySelectorAll("[data-deadline]"));
  function tick(){var now=Date.now();els.forEach(function(e){var s=Math.max(0,Math.floor((+e.dataset.deadline-now)/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;e.textContent=h?h+"h "+String(m).padStart(2,"0")+"m":m+"m "+String(sec).padStart(2,"0")+"s"})}
  tick();setInterval(tick,1000);
  document.querySelectorAll(".photo input").forEach(function(i){i.addEventListener("change",function(){var l=i.closest(".photo");l.classList.add("picked");l.querySelector("small").textContent=i.files[0]?i.files[0].name:""})});
  setInterval(function(){if(!document.querySelector("form.busy"))location.reload()},5000);
  document.querySelectorAll("form").forEach(function(f){f.addEventListener("submit",function(){f.classList.add("busy")})});
})();`;

const amt = (a: string | number, c: string, sm = false, dim = false) => `<div class="amt${sm ? " sm" : ""}"${dim ? ' style="color:var(--muted)"' : ""}>${fmtAmt(a)}<small>${esc(c)}</small></div>`;
const crit = (t: Task) => `<div class="crit"><b>ACCEPTED IF</b>${esc(t.acceptanceCriteria)}</div>`;
const deadline = (t: Task) => `<div class="meta"><span class="warnc" data-deadline="${new Date(t.deadline).getTime()}"></span><span>left</span></div>`;

const paidCard = (o: Obligation, t?: Task) =>
  o.claim.state === "claimed"
    ? `<div class="card"><div class="row"><div class="title">${esc(t?.title ?? o.taskId)}</div>${tag("claimed")}</div>${amt(o.amount, coin(o), true, true)}<div class="claimed"><svg width="16" height="16" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#3ddc84" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Claimed${o.claim.claimTxHash ? ` · ${short(o.claim.claimTxHash, 6)}` : ""}</div></div>`
    : `<div class="card ready"><div class="row"><div class="title">${esc(t?.title ?? o.taskId)}</div>${tag("ready to claim", "ok", true)}</div>${amt(o.amount, coin(o))}<div class="meta"><span>Gas covered · no wallet needed</span></div>${o.payment.claimUrl ? `<a class="btn go" href="${esc(o.payment.claimUrl)}" target="_blank" rel="noopener">Claim ${fmtAmt(o.amount)} ${coin(o)}</a>` : `<div class="waiting"><span class="spin"></span>Claim link on its way…</div>`}</div>`;

const assignedCard = (t: Task) =>
  t.state === "submitted"
    ? `<div class="card"><div class="row"><div class="title">${esc(t.title)}</div>${tag("submitted", "warn")}</div>${amt(t.reward, PAY_COIN, true)}<div class="waiting"><span class="spin"></span>Submitted — waiting for review</div></div>`
    : `<div class="card"><div class="row"><div class="title">${esc(t.title)}</div>${tag("assigned")}</div>${amt(t.reward, PAY_COIN)}${deadline(t)}${crit(t)}
<form method="post" action="/work/${esc(t.id)}/submit" enctype="multipart/form-data"><input type="hidden" name="batchId" value="${esc(t.batchId)}">
<label class="photo"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3ddc84" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>Take photo<small>Opens your camera</small><input type="file" name="photo" accept="image/*" capture="environment" required></label>
<textarea class="field" name="note" placeholder="Note (optional)"></textarea><button class="btn go" type="submit">Submit</button></form></div>`;

const openCard = (t: Task, me = "") => `<div class="card"><div class="title">${esc(t.title)}</div>${amt(t.reward, PAY_COIN)}<div class="meta"><span data-deadline="${new Date(t.deadline).getTime()}"></span><span>to finish once taken</span></div>${crit(t)}
<form method="post" action="/work/${esc(t.id)}/take"><input class="field" type="email" name="email" value="${esc(me)}" placeholder="Your email" required><button class="btn glass" type="submit" style="border-color:rgba(61,220,132,.45)">Take this task</button></form></div>`;

app.post("/work/:id/take", (req, res) => {
  try {
    orch.assign(req.params.id, String(req.body.email));
    res.redirect("/work?me=" + encodeURIComponent(String(req.body.email)));
  } catch (e) {
    res.status(400).send(page("Error", `<p class="empty">${esc(String(e))}</p><a href="/work">back</a>`, { bodyClass: "work", nav: "none" }));
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
    res.redirect("/work?me=" + encodeURIComponent(t.workerEmail ?? ""));
  } catch (e) {
    res.status(400).send(page("Error", `<p class="empty">${esc(String(e))}</p><a href="/work">back</a>`, { bodyClass: "work", nav: "none" }));
  }
});

// ---------- operator: review & pay ----------
const guard = (req: express.Request, res: express.Response, next: express.NextFunction) => (req.query.token === OP || req.body?.token === OP ? next() : res.status(401).send("operator token required"));

/** Map AllScale failure codes to one plain sentence. The agent's credential is operator-granted; these are the ways it gets refused. */
function explain(err?: { code: number | null; message: string; reasonCode?: string }): { msg: string; code: string; retry: boolean } {
  const rc = err?.reasonCode ?? "";
  const c = err?.code ?? 0;
  if (rc === "policy_denied" || c === 30002 || c === 50104) return { msg: "The operator has revoked this agent's spending authority.", code: rc || String(c), retry: true };
  if (rc === "session_expired") return { msg: "Operator authorization expired. Re-authorize in the AllScale dashboard.", code: rc, retry: true };
  if (rc === "signer_error") return { msg: "Signing failed on AllScale's side. Retry.", code: rc, retry: true };
  if (c === 20001 || c === 20002) return { msg: "The agent's credential is no longer valid.", code: String(c), retry: false };
  if (c === 40001) return { msg: "Rate limited by AllScale. Retry in a moment.", code: String(c), retry: true };
  return { msg: err?.message || "Payout refused.", code: err?.code != null ? String(err.code) : "unknown", retry: true };
}

const guardBlock = (err: ReturnType<typeof explain>, retryForm = "", eyebrow = "Payout blocked · No funds moved") =>
  `<div class="guard"><span class="shield">${err.retry ? SHIELD_I : SHIELD_X}</span><div><div class="ey">${esc(eyebrow)}</div><div class="msg">${esc(err.msg)}</div><div class="code"><b>${esc(err.code)}</b> · enforced by AllScale policy engine</div></div>${retryForm}</div>`;

app.get("/review", guard, (req, res) => {
  const l = store.get();
  const token = String(req.query.token);
  const submitted = Object.values(l.tasks).filter((t) => t.state === "submitted" || t.state === "needs_review");
  const pending = Object.values(l.obligations).filter((o) => o.payment.state !== "funded");
  const needs = pending.map((o) => needsCard(o, l.tasks[o.taskId], token)).join("");
  res.send(
    page(
      "AllScale Legwork — Review",
      `<div class="titlebar"><h1>Review</h1>${tag("Operator", "ok", true)}</div>
${submitted.map((t) => reviewCard(t, token)).join("") || `<p class="empty">Nothing to review.</p>`}
<h2>Needs operator</h2>${needs || `<p class="empty">—</p>`}`,
      { nav: "none", script: REVIEW_JS },
    ),
  );
});

/** Accept & pay without leaving the page: show a timer while AllScale funds the link, then render the result in place. */
const REVIEW_JS = String.raw`
(function(){
  document.querySelectorAll("form.accept").forEach(function(f){
    f.addEventListener("submit",function(e){
      e.preventDefault();
      var card=f.closest("article"),btns=card.querySelector(".actions"),prog=card.querySelector(".progress"),t=0,timer;
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

const reviewCard = (t: Task, token: string) => {
  const ev = (t.submission?.evidence ?? {}) as { check?: { checks: { name: string; ok: boolean; detail: string }[] }; file?: string; note?: string };
  const checks = (ev.check?.checks ?? []).map((c) => tag(`${c.name}: ${c.detail}`, c.ok ? "ok" : "warn", true)).join("") || tag("no checks", "dim");
  return `<article class="card"><div class="sub-grid">
<div class="ph">${ev.file ? `<img src="/uploads/${esc(ev.file)}?token=${esc(token)}" alt="">` : "no photo"}</div>
<div><div class="tt">${esc(t.title)}</div><div class="idl">${esc(t.id.slice(0, 13))} · ${esc(t.jobId.slice(0, 12))} · ${stateTag(t.state)}</div>
<dl class="kv"><dt>Worker</dt><dd class="mono">${esc(t.workerEmail ?? "")}</dd>${ev.note ? `<dt>Note</dt><dd>${esc(ev.note)}</dd>` : ""}<dt>Checks</dt><dd class="checks">${checks}</dd><dt>Criteria</dt><dd>${esc(t.acceptanceCriteria)}</dd></dl>
<div class="actions"><form class="accept" method="post" action="/review/${esc(t.id)}/accept"><input type="hidden" name="token" value="${esc(token)}"><input type="hidden" name="batchId" value="${esc(t.batchId)}"><button class="btn go" type="submit">Accept &amp; pay ${fmtAmt(t.reward)} ${PAY_COIN}</button></form>
<form method="post" action="/review/${esc(t.id)}/flag"><input type="hidden" name="token" value="${esc(token)}"><button class="btn glass" type="submit">Flag</button></form></div>
<div class="progress"><span class="spin"></span>Funding claim link via AllScale…<span class="mono">0 s</span></div>
<div class="result"></div>
</div></div></article>`;
};

const needsCard = (o: Obligation, t: Task | undefined, token: string) => {
  const retry = `<form method="post" action="/review/pay/${esc(o.id)}"><input type="hidden" name="token" value="${esc(token)}"><button class="btn glass" type="submit" style="border-color:rgba(255,90,90,.45)">${o.payment.state === "failed_needs_operator" ? "Retry payment" : "Retry"}</button></form>`;
  const body =
    o.payment.state === "failed_needs_operator"
      ? guardBlock(explain(o.payment.lastError), "", "Payout blocked · No funds moved")
      : `<div class="progress on"><span class="spin"></span>${esc(o.payment.state)} · ${o.payment.attempts} attempt${o.payment.attempts === 1 ? "" : "s"}${o.payment.lastError ? ` · ${esc(o.payment.lastError.message)}` : ""}</div>`;
  return `<article class="card needs"><div><div class="tt" style="font-size:17px">${esc(t?.title ?? o.taskId)}</div><div class="idl">${esc(o.id.slice(0, 14))} · ${fmtAmt(o.amount)} ${coin(o)} · ${esc(o.workerEmail)}</div></div>${body}${retry}</article>`;
};

app.get("/uploads/:f", guard, (req, res) => res.sendFile(join(process.cwd(), uploads, req.params.f.replace(/[^\w.\-]/g, ""))));

app.post("/review/:id/accept", guard, async (req, res) => {
  const wantsJson = (req.headers.accept ?? "").includes("application/json");
  const token = encodeURIComponent(String(req.body.token));
  try {
    const ob = orch.accept(req.params.id, String(req.body.batchId));
    const paid = await orch.pay(ob.id);
    if (!wantsJson) return res.redirect(`/review?token=${token}&last=${paid.payment.state}`);
    if (paid.payment.state === "funded") return res.json({ ok: true, tx: short(paid.payment.fundingTxHash, 6), txUrl: evmLink(paid.payment.fundingTxHash) });
    const err = explain(paid.payment.lastError);
    const retry = `<form method="post" action="/review/pay/${esc(paid.id)}"><input type="hidden" name="token" value="${esc(String(req.body.token))}"><button class="btn glass" type="submit">Retry</button></form>`;
    return res.json({ ok: false, guardHtml: guardBlock(err, err.retry ? retry : "") });
  } catch (e) {
    if (wantsJson) return res.status(400).json({ ok: false, guardHtml: guardBlock({ msg: String(e), code: "error", retry: false }) });
    res.status(400).send(page("Error", `<p class="empty">${esc(String(e))}</p>`, { nav: "none" }));
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
  const l = store.get();
  const jobs = Object.values(l.jobs).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const x402 = jobs.find((j) => !j.clientRef.startsWith("x402:"))?.clientRef;
  const swept = jobs.find((j) => j.sweep?.state === "minted")?.sweep;
  const funded = Object.values(l.obligations).filter((o) => o.payment.state === "funded" && o.payment.fundingTxHash).sort((a, b) => (b.payment.fundedAt ?? "").localeCompare(a.payment.fundedAt ?? ""))[0];
  const rep = (html: string, placeholder: string, value: string | undefined | null, href: string) =>
    value ? html.replace(placeholder, `<a href="${esc(href)}" target="_blank" rel="noopener" class="mono">${esc(short(value, 12))} ↗</a>`) : html;
  let html = readFileSync(file, "utf8")
    .replace(/http:\/\/localhost:4031/g, "")
    .replace("review?token=TOKEN", `review?token=${encodeURIComponent(OP)}`)
    .replace("work?me=demo@example.com", `work?me=${encodeURIComponent(env("DEMO_WORKER_EMAIL", "demo@example.com"))}`);
  // Proof slide: swap the design's placeholder hashes for the live ones.
  html = rep(html, `<a href="#" class="mono" style="font-size:24px">yGeuCDHCyZ86…kUkVzYq6 ↗</a>`, x402, solLink(x402));
  html = rep(html, `<a href="#">DajXP1mtgbqu…mL3h3mF ↗</a>`, swept?.solanaBurnTx, solLink(swept?.solanaBurnTx));
  html = rep(html, `<a href="#">0xf511fedfc79e…222b6da1c ↗</a>`, swept?.evmReceiveTx, evmLink(swept?.evmReceiveTx));
  html = rep(html, `<a href="#" class="mono" style="font-size:24px">0xd7ea677e422a…5303c7eb ↗</a>`, funded?.payment.fundingTxHash, evmLink(funded?.payment.fundingTxHash));
  res.send(html);
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

app.listen(Number(env("PORT", "4030")), () => console.log(`web on :${env("PORT", "4030")}  /  /work  /deck  /review?token=${OP}`));
