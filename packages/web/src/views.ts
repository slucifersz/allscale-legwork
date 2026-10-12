/**
 * Page renderers shared by the live server (server.ts) and the static demo export (export.ts).
 * Pure: ledger + config in, HTML out. No I/O, no AllScale calls.
 */
import type { Job, Ledger, Obligation, Task } from "@agent-payroll/payout-orchestrator/src/model.js";
import { CHECK, CROSS, SHIELD_I, SHIELD_X, ago, esc, fmtAmt, page, short, tag } from "./html.js";

export interface ViewCfg {
  solLink: (sig?: string | null) => string;
  evmLink: (hash?: string | null) => string;
  /** Coin shown for tasks that have no obligation yet. */
  payCoin: string;
  /** Static demo build: no polling, demo banner, forms simulated client-side. */
  demo?: boolean;
  /** Review nav link (live: carries the operator token; demo: plain /review). Omit to hide Review from the nav. */
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
const when = (cfg: ViewCfg, iso: string) => (cfg.demo ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : ago(iso));

// ---------- settlement record ----------

export function settlementPage(l: Ledger, cfg: ViewCfg): string {
  const jobs = Object.values(l.jobs).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const obs = Object.values(l.obligations);
  const funded = obs.filter((o) => o.payment.state === "funded");
  const revenue = jobs.reduce((a, j) => a + Number(j.revenueAmount), 0);
  const paid = funded.reduce((a, o) => a + Number(o.amount), 0);
  const stat = (k: string, v: string, unit = "") => `<div class="stat"><div class="k">${k}</div><div class="v">${v}${unit ? `<small>${unit}</small>` : ""}</div></div>`;
  return page(
    "AllScale Legwork — Settlement record",
    `<section class="hero"><h1><u>Settlement record</u></h1>
<p class="lead">An AI agent earns USDC on Solana, hands the on-site work to real people, and pays them by email — no wallet, no gas, no KYC. It spends only within a budget its operator set, and the operator can revoke that authority at any time.</p></section>
<div class="stats">${stat("Agent revenue", fmtAmt(revenue), "USDC")}${stat("Paid to humans", fmtAmt(paid), funded[0] ? coin(funded[0]) : cfg.payCoin)}${stat("Claim links funded", String(funded.length))}${stat("Jobs", String(jobs.length))}</div>
<div class="jobs" id="jobs">${jobCards(l, cfg)}</div>`,
    { nav: "settlement", review: cfg.reviewHref, demo: cfg.demo, script: cfg.demo ? DEMO_JS : POLL_JS },
  );
}

export function jobCards(l: Ledger, cfg: ViewCfg): string {
  const jobs = Object.values(l.jobs).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return jobs.map((job) => jobCard(job, l, cfg)).join("") || `<p class="empty">No jobs yet. The first x402 payment will appear here.</p>`;
}

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

function jobCard(job: Job, l: Ledger, cfg: ViewCfg): string {
  const { solLink, evmLink } = cfg;
  const tasks = Object.values(l.tasks).filter((t) => t.jobId === job.id);
  const obs = Object.values(l.obligations).filter((o) => tasks.some((t) => t.id === o.taskId));
  const funded = obs.filter((o) => o.payment.state === "funded");
  const claimed = obs.filter((o) => o.claim.state === "claimed");
  const refunded = obs.filter((o) => o.claim.state === "refunded");
  const blocked = obs.filter((o) => o.payment.state === "failed_needs_operator");
  const sw = job.sweep;
  const minted = sw?.state === "minted";
  const payCoin = funded[0] ? coin(funded[0]) : cfg.payCoin;

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
    return `<div class="step ${cls}${here}" data-step="${n}">${here ? `<span class="here">MONEY IS HERE</span>` : ""}<div class="n"><span>#${n}</span>${ico(cls)}</div><div class="t">${title}</div>${extra}<div class="sub">${sub}</div></div>`;
  };
  const s1 = step(1, "done", "Client paid", `Solana · ${fmtAmt(job.revenueAmount)} USDC · ${link(solLink(job.clientRef), short(job.clientRef, 6))}`);
  const s2 = step(2, sw ? "done" : "wait", "CCTP burn", sw ? `Solana · ${link(solLink(sw.solanaBurnTx), short(sw.solanaBurnTx, 6))}` : "Solana · not started");
  const s3 = step(3, minted ? "done" : sw ? "wait" : "idle", "USDC minted to operator", minted ? `Sepolia · ${fmtAmt(Number(sw!.mintedAtomic ?? 0) / 1e6)} USDC · ${link(evmLink(sw!.evmReceiveTx), short(sw!.evmReceiveTx, 6))}` : sw ? "Sepolia · waiting for attestation" : "Sepolia");
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

  const rows = tasks.map((t) => taskRow(t, obs.filter((o) => o.taskId === t.id), cfg)).join("");
  return `<article class="card" data-job="${esc(job.id)}">
<div class="jobhead"><b>Job ${esc(job.id.slice(0, 12))}</b><span class="sep">·</span><b>${fmtAmt(job.revenueAmount)} USDC</b> on Solana<span class="sep">·</span>${link(solLink(job.clientRef), short(job.clientRef))}<span class="sep">·</span>${when(cfg, job.createdAt)}</div>
<div class="status${revoked ? " revoked" : ""}"><span class="now">Money is now</span><span>${now}</span><span class="sep">·</span>${tail}</div>
<div class="trail">${s1}${s2}${s3}${s4}${s5}</div>
<div class="tablewrap"><table class="tasks"><thead><tr><th>Task</th><th>State</th><th>Obligation</th><th>Payment</th><th>Funding tx</th><th>Claim</th></tr></thead><tbody>${rows}</tbody></table></div>
</article>`;
}

const stateTag = (s: string) => tag(s, s === "accepted" ? "ok" : s === "submitted" || s === "needs_review" ? "warn" : s === "void" ? "bad" : "");
const payTag = (o: Obligation) =>
  o.payment.state === "funded" ? tag("funded", "ok", true)
  : o.payment.state === "failed_needs_operator" ? tag("agent revoked", "bad", true)
  : o.payment.state === "in_flight" ? `<span class="tag warn"><span class="spin"></span>in_flight</span>`
  : tag(o.payment.state, "dim");
const claimTag = (o: Obligation) => tag(o.claim.state, o.claim.state === "claimed" ? "ok" : o.claim.state === "refunded" || o.claim.state === "cancelled" ? "bad" : o.claim.state === "pending" ? "warn" : "");

function taskRow(t: Task, obs: Obligation[], cfg: ViewCfg): string {
  const cell = (title: string) => `<td><div class="tt">${esc(title)}</div><div class="id">${esc(t.id.slice(0, 13))}</div></td>`;
  if (!obs.length) return `<tr>${cell(t.title)}<td>${stateTag(t.state)}</td><td class="amt">${fmtAmt(t.reward)} ${cfg.payCoin}</td><td>${tag("not_requested", "dim")}</td><td class="tx dash">—</td><td class="dash">—</td></tr>`;
  return obs
    .map(
      (o) => `<tr>${cell(t.title)}<td>${stateTag(t.state)}</td><td class="amt">${fmtAmt(o.amount)} ${coin(o)}${o.supersedes ? `<div class="id">re-issue</div>` : ""}</td><td>${payTag(o)}</td><td class="tx">${o.payment.fundingTxHash ? link(cfg.evmLink(o.payment.fundingTxHash), short(o.payment.fundingTxHash, 6)) : `<span class="dash">—</span>`}</td><td>${claimTag(o)}${o.claim.claimTxHash ? `<div class="id">${link(cfg.evmLink(o.claim.claimTxHash), short(o.claim.claimTxHash, 6))}</div>` : ""}</td></tr>`,
    )
    .join("");
}

// ---------- workers: task board (mobile) ----------

export function workPage(l: Ledger, me: string, cfg: ViewCfg): string {
  const open = Object.values(l.tasks).filter((t) => t.state === "open");
  const mine = Object.values(l.tasks).filter((t) => (t.state === "assigned" || t.state === "submitted") && me && (t.workerEmail ?? "").toLowerCase() === me);
  // Paid tasks for this worker: the claim link is shown here, so delivery never depends on email arriving.
  const paid = me ? Object.values(l.obligations).filter((o) => o.workerEmail.toLowerCase() === me && o.payment.state === "funded").map((o) => ({ o, t: l.tasks[o.taskId] })) : [];
  const who = me
    ? `<div class="me">${esc(me)}</div>`
    : `<form method="get" action="/work" class="card" style="margin-top:18px"><div class="title">Who are you?</div><input class="field" type="email" name="me" placeholder="Your email — this is where the money goes" required><button class="btn go" type="submit">Show my tasks</button></form>`;
  const count = (n: number) => `<span class="num">${n}</span>`;
  const body = `<section class="hero"><h1><u>Task board</u></h1>${who}</section>
<h2>Your payments${count(paid.length)}</h2>${paid.length ? paid.map(({ o, t }) => paidCard(o, t, cfg)).join("") : `<p class="empty">Nothing yet — accepted work shows up here with a claim button.</p>`}
<h2>Your tasks${count(mine.length)}</h2>${mine.length ? mine.map((t) => assignedCard(t, cfg)).join("") : `<p class="empty">—</p>`}
<h2>Open tasks${count(open.length)}</h2>${open.length ? open.map((t) => openCard(t, me, cfg)).join("") : `<p class="empty">Nothing open right now.</p>`}
<div class="foot">Paid via AllScale claim link · Powered by AllScale</div>`;
  return page("AllScale Legwork — Task board", body, { bodyClass: "work", nav: "work", review: cfg.reviewHref, demo: cfg.demo, script: WORK_JS + (cfg.demo ? DEMO_JS : WORK_LIVE_JS) });
}

const WORK_JS = String.raw`
(function(){
  var els=[].slice.call(document.querySelectorAll("[data-deadline]"));
  function tick(){var now=Date.now();els.forEach(function(e){var s=Math.max(0,Math.floor((+e.dataset.deadline-now)/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;e.textContent=h?h+"h "+String(m).padStart(2,"0")+"m":m+"m "+String(sec).padStart(2,"0")+"s"})}
  tick();setInterval(tick,1000);
  document.querySelectorAll(".photo input").forEach(function(i){i.addEventListener("change",function(){var l=i.closest(".photo");l.classList.add("picked");l.querySelector("small").textContent=i.files[0]?i.files[0].name:""})});
})();`;
const WORK_LIVE_JS = String.raw`
(function(){
  setInterval(function(){if(!document.querySelector("form.busy"))location.reload()},5000);
  document.querySelectorAll("form").forEach(function(f){f.addEventListener("submit",function(){f.classList.add("busy")})});
})();`;

const amt = (a: string | number, c: string, sm = false, dim = false) => `<div class="amount${sm ? " sm" : ""}"${dim ? ' style="color:var(--muted)"' : ""}>${fmtAmt(a)}<small>${esc(c)}</small></div>`;
const crit = (t: Task) => `<div class="crit"><b>Accepted if</b>${esc(t.acceptanceCriteria)}</div>`;
const deadline = (t: Task) => `<div class="meta"><span class="warnc" data-deadline="${new Date(t.deadline).getTime()}"></span><span>left</span></div>`;

const paidCard = (o: Obligation, t: Task | undefined, cfg: ViewCfg) =>
  o.claim.state === "claimed"
    ? `<div class="card"><div class="row"><div class="title">${esc(t?.title ?? o.taskId)}</div>${tag("claimed")}</div>${amt(o.amount, coin(o), true, true)}<div class="claimed"><svg width="16" height="16" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#17d46a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Claimed${o.claim.claimTxHash ? ` · <span class="mono">${short(o.claim.claimTxHash, 6)}</span>` : ""}</div></div>`
    : `<div class="card ready"><div class="row"><div class="title">${esc(t?.title ?? o.taskId)}</div>${tag("ready to claim", "ok", true)}</div>${amt(o.amount, coin(o))}<div class="meta"><span>Gas covered · no wallet needed</span>${o.payment.fundingTxHash ? `<span>·</span>${link(cfg.evmLink(o.payment.fundingTxHash), "funding tx")}` : ""}</div>${
        o.payment.claimUrl ? `<a class="btn go" href="${esc(o.payment.claimUrl)}" target="_blank" rel="noopener"${cfg.demo ? ' data-demo="Claim links are private — the real one went to the worker\'s inbox."' : ""}>Claim ${fmtAmt(o.amount)} ${coin(o)}</a>` : `<div class="waiting"><span class="spin"></span>Claim link on its way…</div>`
      }</div>`;

const assignedCard = (t: Task, cfg: ViewCfg) =>
  t.state === "submitted"
    ? `<div class="card"><div class="row"><div class="title">${esc(t.title)}</div>${tag("submitted", "warn")}</div>${amt(t.reward, cfg.payCoin, true)}<div class="waiting"><span class="spin"></span>Submitted — waiting for review</div></div>`
    : `<div class="card"><div class="row"><div class="title">${esc(t.title)}</div>${tag("assigned")}</div>${amt(t.reward, cfg.payCoin)}${deadline(t)}${crit(t)}
<form method="post" action="/work/${esc(t.id)}/submit" enctype="multipart/form-data"><input type="hidden" name="batchId" value="${esc(t.batchId)}">
<label class="photo"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#17d46a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>Take photo<small>Opens your camera</small><input type="file" name="photo" accept="image/*" capture="environment" required></label>
<textarea class="field" name="note" placeholder="Note (optional)"></textarea><button class="btn go" type="submit">Submit</button></form></div>`;

const openCard = (t: Task, me: string, cfg: ViewCfg) => `<div class="card"><div class="title">${esc(t.title)}</div>${amt(t.reward, cfg.payCoin)}<div class="meta"><span class="warnc" data-deadline="${new Date(t.deadline).getTime()}"></span><span>to finish once taken</span></div>${crit(t)}
<form method="post" action="/work/${esc(t.id)}/take"><input class="field" type="email" name="email" value="${esc(me)}" placeholder="Your email" required><button class="btn glass" type="submit">Take this task</button></form></div>`;

// ---------- operator: review & pay ----------

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
  const submitted = Object.values(l.tasks).filter((t) => t.state === "submitted" || t.state === "needs_review");
  const pending = Object.values(l.obligations).filter((o) => o.payment.state !== "funded");
  const needs = pending.map((o) => needsCard(o, l.tasks[o.taskId], token)).join("");
  const realTx = Object.values(l.obligations).find((o) => o.payment.fundingTxHash)?.payment.fundingTxHash;
  return page(
    "AllScale Legwork — Review",
    `<section class="hero"><h1><u>Review</u></h1><p class="lead">Check the evidence, then accept — the agent funds an AllScale claim link for the worker from the operator's wallet, within the budget the operator set.</p></section>
${submitted.map((t) => reviewCard(t, token, cfg)).join("") || `<p class="empty">Nothing to review.</p>`}
<h2>Needs operator</h2>${needs || `<p class="empty">—</p>`}${cfg.demo && realTx ? `<span id="demo-tx" hidden data-tx="${esc(short(realTx, 10))}" data-url="${esc(cfg.evmLink(realTx))}"></span>` : ""}`,
    { nav: "review", review: cfg.reviewHref, demo: cfg.demo, script: cfg.demo ? DEMO_JS : REVIEW_JS },
  );
}

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

const reviewCard = (t: Task, token: string, cfg: ViewCfg) => {
  const ev = (t.submission?.evidence ?? {}) as { check?: { checks: { name: string; ok: boolean; detail: string }[] }; file?: string; note?: string };
  const checks = (ev.check?.checks ?? []).map((c) => tag(`${c.name}: ${c.detail}`, c.ok ? "ok" : "warn", true)).join("") || tag("no checks", "dim");
  const src = ev.file ? cfg.uploadSrc(ev.file) + (token ? `?token=${encodeURIComponent(token)}` : "") : "";
  return `<article class="card"><div class="sub-grid">
<div class="ph">${src ? `<img src="${esc(src)}" alt="Submitted photo">` : "no photo"}</div>
<div><div class="tt">${esc(t.title)}</div><div class="idl">${esc(t.id.slice(0, 13))} · ${esc(t.jobId.slice(0, 12))} ${stateTag(t.state)}</div>
<dl class="kv"><dt>Worker</dt><dd class="mono">${esc(t.workerEmail ?? "")}</dd>${ev.note ? `<dt>Note</dt><dd>${esc(ev.note)}</dd>` : ""}<dt>Checks</dt><dd class="checks">${checks}</dd><dt>Criteria</dt><dd>${esc(t.acceptanceCriteria)}</dd></dl>
<div class="actions"><form class="accept" method="post" action="/review/${esc(t.id)}/accept"><input type="hidden" name="token" value="${esc(token)}"><input type="hidden" name="batchId" value="${esc(t.batchId)}"><button class="btn go" type="submit">Accept &amp; pay ${fmtAmt(t.reward)} ${cfg.payCoin}</button></form>
<form method="post" action="/review/${esc(t.id)}/flag"><input type="hidden" name="token" value="${esc(token)}"><button class="btn glass" type="submit">Flag</button></form></div>
<div class="progress"><span class="spin"></span>Funding claim link via AllScale…<span class="mono">0 s</span></div>
<div class="result"></div>
</div></div></article>`;
};

const needsCard = (o: Obligation, t: Task | undefined, token: string) => {
  const retry = `<form method="post" action="/review/pay/${esc(o.id)}"><input type="hidden" name="token" value="${esc(token)}"><button class="btn glass" type="submit">${o.payment.state === "failed_needs_operator" ? "Retry payment" : "Retry"}</button></form>`;
  const body =
    o.payment.state === "failed_needs_operator"
      ? guardBlock(explain(o.payment.lastError), "", "Payout blocked · No funds moved")
      : `<div class="progress on"><span class="spin"></span>${esc(o.payment.state)} · ${o.payment.attempts} attempt${o.payment.attempts === 1 ? "" : "s"}${o.payment.lastError ? ` · ${esc(o.payment.lastError.message)}` : ""}</div>`;
  return `<article class="card needs"><div><div class="tt" style="font-size:18px">${esc(t?.title ?? o.taskId)}</div><div class="idl">${esc(o.id.slice(0, 14))} · ${fmtAmt(o.amount)} ${coin(o)} · ${esc(o.workerEmail)}</div></div>${body}${retry}</article>`;
};

// ---------- static demo: every action is simulated in the browser ----------

/**
 * Demo build only. Forms never leave the page. "Accept & pay" plays the same progress → result
 * sequence as the live app, then points to a real AllScale funding tx from our verification run.
 */
const DEMO_JS = String.raw`
(function(){
  var t=document.createElement("div");t.className="toast";document.body.appendChild(t);var h;
  function toast(m){t.textContent=m;t.classList.add("on");clearTimeout(h);h=setTimeout(function(){t.classList.remove("on")},3200)}
  document.querySelectorAll("[data-demo]").forEach(function(a){a.addEventListener("click",function(e){e.preventDefault();toast(a.dataset.demo)})});
  document.querySelectorAll("form").forEach(function(f){
    f.addEventListener("submit",function(e){
      e.preventDefault();
      if(!f.classList.contains("accept")){toast("Demo only — nothing is submitted. Run the app locally to try the full flow.");return}
      var card=f.closest("article"),prog=card.querySelector(".progress"),s=0;
      card.querySelectorAll(".actions button").forEach(function(b){b.disabled=true});
      prog.classList.add("on");var timer=setInterval(function(){s++;prog.querySelector(".mono").textContent=s+" s"},1000);
      setTimeout(function(){clearInterval(timer);prog.classList.remove("on");
        var d=(document.getElementById("demo-tx")||{dataset:{}}).dataset;
        card.querySelector(".result").innerHTML='<div class="success"><span class="ck">'+${JSON.stringify(CHECK)}+'</span>Claim link funded (simulated)<small>In the live app this calls AllScale Auto-Payout. A real funding tx from our verification run: <a href="'+d.url+'" target="_blank" rel="noopener">'+d.tx+' ↗</a></small></div>';
      },3000);
    });
  });
})();`;

// ---------- pitch deck ----------

/** The static design deck, with live links and the newest real hashes from the ledger swapped in. */
export function deckPage(html: string, l: Ledger, cfg: ViewCfg, opts: { reviewHref: string; demoWorker: string }): string {
  const jobs = Object.values(l.jobs).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
