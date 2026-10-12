/** Server-rendered HTML helpers. AllScale sales-deck visual system: pure black, flat graphite cards, AllScale green. No framework, no build step. */
export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const CSS = String.raw`
:root{--bg:#000;--card:#161616;--card2:#1f1f1f;--line:#2b2b2b;--line2:#3a3a3a;--ink:#f3f7f4;--head:#e3ece6;--muted:#9a9e9b;--dim:#6b6f6c;
--ok:#17d46a;--okbg:#0d2a1a;--okline:#1f7a45;--warn:#f5b546;--bad:#ff5b52;--chip:#e6eee9;
--sans:"Noto Sans","Noto Sans SC",system-ui,-apple-system,"PingFang SC",sans-serif;--mono:"JetBrains Mono","SF Mono",ui-monospace,Menlo,monospace}
*{box-sizing:border-box}
html{background:var(--bg)}
body{margin:0;min-height:100vh;font-family:var(--sans);color:var(--ink);-webkit-font-smoothing:antialiased;font-size:15px;line-height:1.5;
background:radial-gradient(ellipse 70% 45% at 50% 115%,rgba(255,255,255,.10),transparent 70%) fixed,var(--bg)}
a{color:var(--ok);text-decoration:none}a:hover{text-decoration:underline;text-underline-offset:3px}
.mono,code{font-family:var(--mono)}
.shell{max-width:1280px;margin:0 auto;padding:20px 32px 96px}
body.work .shell{max-width:460px;padding:20px 16px 56px}
/* ---- chrome ---- */
header{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:16px}
header .right{justify-self:end}
.logo{display:inline-flex;align-items:center;gap:.45em;font-size:22px;letter-spacing:-.02em;white-space:nowrap;color:#fff}
.logo:hover{text-decoration:none}
.logo .br{position:relative;font-weight:700;padding:.14em .3em}
.logo .br::before,.logo .br::after{content:"";position:absolute;width:.36em;height:.36em;border:0 solid var(--ok)}
.logo .br::before{top:0;left:0;border-top-width:.12em;border-left-width:.12em}
.logo .br::after{bottom:0;right:0;border-bottom-width:.12em;border-right-width:.12em}
.logo .lw{font-weight:400;color:var(--muted)}
.navpills{display:flex;gap:2px;padding:6px 10px;border-radius:999px;background:#0b0b0b;border:1px solid var(--line2)}
.navpills a{position:relative;padding:8px 16px 10px;color:#8b8f8c;font-size:15px;white-space:nowrap}
.navpills a:hover{color:#fff;text-decoration:none}
.navpills a.cur{color:#fff}
.navpills a.cur::after{content:"";position:absolute;left:50%;bottom:1px;width:6px;height:6px;margin-left:-3px;border-radius:50%;background:var(--ok)}
.demo-bar{margin:18px 0 0;padding:10px 16px;border-radius:14px;background:var(--card);border:1px solid var(--line);color:var(--muted);font-size:13px;text-align:center}
.demo-bar b{color:var(--ok);font-weight:600}
/* ---- type ---- */
.hero{text-align:center;margin:72px auto 48px;max-width:980px}
h1{font-size:64px;line-height:1.1;font-weight:500;letter-spacing:-.02em;color:var(--head);margin:0 0 22px;text-wrap:balance}
h1 u,.u{text-decoration:underline;text-decoration-thickness:3px;text-underline-offset:12px}
.lead{color:var(--muted);font-size:19px;line-height:1.6;margin:0 auto;max-width:760px;text-wrap:pretty}
h2{font-size:26px;font-weight:500;letter-spacing:-.01em;color:var(--head);margin:64px 0 20px}
.chip-g{display:inline-block;padding:6px 14px;background:var(--ok);color:#03130a;font-size:16px;font-weight:500;margin-bottom:22px}
.num{display:inline-flex;align-items:center;justify-content:center;min-width:52px;height:34px;padding:0 14px;border-radius:999px;background:var(--chip);color:#111;font-size:15px;font-weight:500}
.sub{color:var(--muted)}
.empty{color:var(--dim);font-size:14px;padding:6px 2px}
/* ---- tags ---- */
.tag{display:inline-flex;align-items:center;gap:7px;padding:3px 11px;border-radius:999px;font-size:12.5px;font-weight:500;line-height:1.5;white-space:nowrap;color:#cfd3d0;background:#232323;border:1px solid var(--line2)}
.tag.ok{color:var(--ok);border-color:var(--okline);background:var(--okbg)}
.tag.warn{color:var(--warn);border-color:rgba(245,181,70,.4);background:rgba(245,181,70,.08)}
.tag.bad{color:var(--bad);border-color:rgba(255,91,82,.45);background:rgba(255,91,82,.08)}
.tag.dim{color:var(--dim);background:transparent}
.tag .d{width:6px;height:6px;border-radius:50%;background:currentColor}
.spin{width:10px;height:10px;border-radius:50%;border:2px solid rgba(245,181,70,.25);border-top-color:var(--warn);animation:spin 1s linear infinite;display:inline-block}
@keyframes spin{to{transform:rotate(360deg)}}
/* ---- cards ---- */
.card{position:relative;border-radius:22px;padding:32px;background:var(--card);border:1px solid var(--line);margin-bottom:20px}
body.work .card{border-radius:20px;padding:22px;margin-bottom:12px}
.card.ready{border-color:var(--okline);background:linear-gradient(180deg,var(--okbg),var(--card) 70%)}
.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:28px}
.stat{border-radius:22px;padding:24px 26px;background:var(--card);border:1px solid var(--line)}
.stat .k{color:var(--muted);font-size:15px}
.stat .v{font-size:46px;line-height:1.1;font-weight:500;letter-spacing:-.02em;color:var(--ok);margin-top:10px}
.stat .v small{font-size:18px;color:var(--muted);margin-left:6px;letter-spacing:0}
/* ---- buttons & fields ---- */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:48px;padding:0 26px;border-radius:999px;border:0;font:500 15px var(--sans);cursor:pointer;text-decoration:none}
.btn:hover{text-decoration:none}
.btn.go{background:var(--ok);color:#03130a}
.btn.go:hover{background:#3be283;color:#03130a}
.btn.go:active{background:#12b85b}
.btn.glass{background:transparent;color:#fff;border:1px solid var(--line2)}
.btn.glass:hover{background:#222;color:#fff}
.btn[disabled]{opacity:.35;cursor:not-allowed}
body.work .btn{display:flex;width:100%;min-height:52px;font-size:16px;margin-top:16px}
.field{width:100%;min-height:48px;margin-top:10px;padding:12px 16px;border-radius:14px;background:#0e0e0e;border:1px solid var(--line2);color:#fff;font:400 15px var(--sans);outline:none}
.field:focus{border-color:var(--ok)}
.field::placeholder{color:var(--dim)}
textarea.field{resize:vertical;min-height:72px}
/* ---- settlement ---- */
.jobs{display:flex;flex-direction:column;gap:20px}
.jobhead{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;color:var(--muted);font-size:14px}
.jobhead b{color:#fff;font-weight:500}
.jobhead .sep,.status .sep{color:#4a4a4a}
.status{display:flex;align-items:center;flex-wrap:wrap;gap:12px 16px;margin:16px 0 30px;font-size:24px;font-weight:500;letter-spacing:-.01em;color:var(--head)}
.status .now{font-size:15px;font-weight:500;padding:4px 12px;color:#03130a;background:var(--ok)}
.status.revoked .now{background:var(--bad);color:#1a0505}
.status .muted{color:var(--muted)}
.trail{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:40px}
.step{position:relative;min-height:150px;border-radius:18px;padding:18px 18px 16px;background:#0f0f0f;border:1px solid var(--line2);display:flex;flex-direction:column;gap:8px;transition:border-color .3s,background .3s}
.step .n{display:flex;align-items:center;justify-content:space-between}
.step .n span:first-child{display:inline-flex;align-items:center;justify-content:center;height:26px;padding:0 11px;border-radius:999px;background:#2a2a2a;color:#bbb;font-size:13px;font-weight:500}
.step .t{font-size:17px;font-weight:500;line-height:1.3;color:var(--head);text-wrap:balance}
.step .sub{font-size:12.5px;color:var(--muted);margin-top:auto;word-break:break-all;line-height:1.5}
.step .sub a{font-family:var(--mono);font-size:12px}
.step .ico{width:24px;height:24px;border-radius:50%;display:grid;place-items:center}
.step.done{border-color:var(--okline);background:var(--okbg)}
.step.done .n span:first-child{background:var(--chip);color:#111}
.step.done .ico{background:var(--ok)}
.step.wait{border-color:rgba(245,181,70,.55)}
.step.wait .n span:first-child{background:rgba(245,181,70,.15);color:var(--warn)}
.step.wait .ico{border:2px solid rgba(245,181,70,.25);border-top-color:var(--warn);animation:spin 1s linear infinite}
.step.idle{opacity:.55}
.step.bad{border-color:rgba(255,91,82,.6);background:rgba(255,91,82,.06)}
.step.bad .n span:first-child{background:rgba(255,91,82,.15);color:var(--bad)}
.step.bad .sub{color:var(--bad)}
.step.bad .ico{background:var(--bad)}
.step:not(:last-child)::after{content:"→";position:absolute;top:50%;right:-31px;transform:translateY(-50%);font-size:24px;line-height:1;color:var(--ok)}
.step.wait::after,.step.idle::after,.step.bad::after{color:#4a4a4a}
.step.has-here{border-color:var(--ok);box-shadow:0 0 0 1px var(--ok)}
.step.bad.has-here{border-color:var(--bad);box-shadow:0 0 0 1px var(--bad)}
.here{position:absolute;left:18px;top:-12px;white-space:nowrap;font-size:12px;font-weight:600;letter-spacing:.04em;padding:2px 10px;color:#03130a;background:var(--ok)}
.step.bad .here{background:var(--bad);color:#1a0505}
.prog{height:4px;border-radius:4px;background:rgba(245,181,70,.15);overflow:hidden}
.prog i{display:block;height:100%;background:var(--warn);border-radius:4px}
.step.flash{animation:flash 1s cubic-bezier(.23,1,.32,1)}
@keyframes flash{0%{background:rgba(23,212,106,.35)}100%{}}
.tablewrap{overflow-x:auto;margin-top:30px;border:1px solid var(--line);border-radius:16px}
.tasks{width:100%;border-collapse:collapse;font-size:14px}
.tasks th{text-align:left;font-weight:500;font-size:14px;color:var(--head);padding:14px 16px;background:#1c1c1c;border-bottom:1px solid var(--line)}
.tasks td{padding:14px 16px;border-bottom:1px solid var(--line);vertical-align:middle;background:#121212}
.tasks tr:last-child td{border-bottom:0}
.tasks .tt{font-weight:500;font-size:15px}
.tasks .id{font:400 12px var(--mono);color:var(--dim);margin-top:3px}
.tasks .amt{font-weight:500;white-space:nowrap}
.tasks .tx{font:400 13px var(--mono)}
.tasks .dash,.dash{color:#4a4a4a}
@media (max-width:1000px){.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.trail{grid-template-columns:1fr;gap:28px}.step{min-height:0}.step:not(:last-child)::after{content:"↓";top:auto;bottom:-27px;right:auto;left:26px;transform:none;font-size:20px}h1{font-size:44px}.hero{margin:48px auto 36px}}
@media (max-width:700px){header{grid-template-columns:1fr auto}header nav{grid-column:1/-1;grid-row:2;justify-self:center}.shell{padding:16px 16px 72px}.card{padding:22px}.status{font-size:19px}h1{font-size:36px}.stat .v{font-size:34px}.navpills a{padding:8px 11px 10px;font-size:14px}}
/* ---- work (mobile) ---- */
body.work header{grid-template-columns:1fr auto}
body.work .hero{margin:40px 0 8px;text-align:left}
body.work h1{font-size:36px;margin:0 0 8px}
body.work h2{display:flex;justify-content:space-between;align-items:center;font-size:20px;margin:36px 2px 14px}
.me{display:inline-flex;align-items:center;gap:8px;color:var(--muted);font-size:14px}
.me::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--ok)}
.row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.title{font-size:17px;font-weight:500;line-height:1.35;color:var(--head);text-wrap:balance}
.amount{font-size:48px;line-height:1;font-weight:500;letter-spacing:-.03em;margin:18px 0 6px;color:var(--ok)}
.amount small{font-size:18px;color:var(--muted);font-weight:400;letter-spacing:0;margin-left:8px}
.amount.sm{font-size:38px}
.meta{display:flex;gap:10px;font-size:13px;color:var(--muted);margin-top:8px}
.meta .warnc{color:var(--warn);font-family:var(--mono)}
.crit{margin:16px 0 0;padding:14px 16px;border-radius:14px;background:#0f0f0f;border:1px solid var(--line);font-size:14px;line-height:1.55;color:var(--muted)}
.crit b{display:block;color:var(--head);font-weight:500;margin-bottom:4px}
.photo{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:120px;border-radius:16px;border:1.5px dashed var(--okline);background:#0f0f0f;color:#fff;font-weight:500;font-size:17px;cursor:pointer;margin-top:16px;position:relative}
.photo:hover{border-color:var(--ok)}
.photo small{font-size:12.5px;color:var(--muted);font-weight:400}
.photo input{position:absolute;width:1px;height:1px;opacity:0}
.photo.picked{border-style:solid;border-color:var(--ok)}
.waiting{display:flex;align-items:center;gap:12px;margin-top:16px;padding:14px 16px;border-radius:14px;border:1px dashed rgba(245,181,70,.5);color:var(--warn);font-weight:500}
.waiting .spin{width:16px;height:16px;flex:none}
.claimed{display:flex;align-items:center;gap:10px;margin-top:16px;min-height:48px;padding:0 18px;border-radius:999px;border:1px solid var(--okline);font-size:14px;color:var(--ok)}
.foot{margin-top:36px;text-align:center;font-size:13px;color:var(--dim)}
/* ---- review ---- */
.sub-grid{display:grid;grid-template-columns:minmax(0,480px) minmax(0,1fr);gap:32px}
.ph{aspect-ratio:4/3;max-width:480px;width:100%;border-radius:16px;border:1px solid var(--line);overflow:hidden;position:relative;background:#0f0f0f;display:grid;place-items:center;color:var(--dim);font-size:13px}
.ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.tt{font-size:24px;font-weight:500;letter-spacing:-.01em;line-height:1.25;color:var(--head)}
.idl{font:400 12.5px var(--mono);color:var(--dim);margin-top:8px;display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}
.kv{display:grid;grid-template-columns:92px 1fr;gap:12px 16px;margin:22px 0;font-size:14px}
.kv dt{color:var(--dim);padding-top:2px}
.kv dd{margin:0;color:#e6ebe8;line-height:1.5}
.checks{display:flex;flex-wrap:wrap;gap:8px}
.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}
.progress{display:none;align-items:center;gap:12px;margin-top:22px;padding:14px 18px;border-radius:14px;border:1px dashed rgba(245,181,70,.55);color:var(--warn);font-weight:500}
.progress.on{display:flex}
.progress .spin{width:18px;height:18px;flex:none}
.progress .mono{margin-left:auto;font-size:13px}
.success{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:22px;padding:14px 18px;border-radius:14px;border:1px solid var(--ok);background:var(--okbg);font-weight:500;color:#fff}
.success .ck{width:26px;height:26px;border-radius:50%;background:var(--ok);display:grid;place-items:center;flex:none}
.success a{font:400 14px var(--mono)}
.success small{flex-basis:100%;color:var(--muted);font-weight:400;font-size:13px}
.guard{display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center;margin-top:22px;padding:18px 20px;border-radius:16px;border:1px solid rgba(255,91,82,.6);background:rgba(255,91,82,.06)}
.guard .shield{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:rgba(255,91,82,.12)}
.guard .ey{font-size:12.5px;font-weight:600;color:var(--bad)}
.guard .msg{font-size:16px;font-weight:600;margin-top:4px;line-height:1.35;color:#fff;text-wrap:pretty}
.guard .code{font:400 12px var(--mono);color:#c8a0a0;margin-top:6px}
.guard .code b{color:var(--bad);font-weight:500}
.guard .btn{min-height:44px;padding:0 20px;font-size:14px}
.needs{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.7fr) auto;gap:20px;align-items:center}
.needs .guard{margin-top:0;grid-template-columns:auto 1fr}
@media (max-width:860px){.sub-grid,.needs{grid-template-columns:1fr}.guard{grid-template-columns:auto 1fr}.guard .btn{grid-column:1/-1}}
/* ---- demo toast ---- */
.toast{position:fixed;left:50%;bottom:28px;transform:translate(-50%,20px);opacity:0;max-width:calc(100% - 32px);padding:12px 20px;border-radius:999px;background:var(--chip);color:#111;font-size:14px;font-weight:500;transition:opacity .25s,transform .25s;pointer-events:none;z-index:50;text-align:center}
.toast.on{opacity:1;transform:translate(-50%,0)}
`;

export const LOGO = `<a href="/" class="logo"><span class="br">AllScale</span><span class="lw">Legwork</span></a>`;
export const TESTNET = `<span class="tag warn"><span class="d"></span>Testnet</span>`;
export const CHECK = `<svg width="13" height="13" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#03130a" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const CROSS = `<svg width="11" height="11" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="#1a0505" stroke-width="3.6" stroke-linecap="round"/></svg>`;
export const SHIELD_X = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff5b52" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5.5c0 4.4-3 8.1-7 9.5-4-1.4-7-5.1-7-9.5V6z"/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"/></svg>`;
export const SHIELD_I = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff5b52" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5.5c0 4.4-3 8.1-7 9.5-4-1.4-7-5.1-7-9.5V6z"/><path d="M12 8v5M12 16h.01"/></svg>`;

export type NavKey = "settlement" | "work" | "review" | "deck";
export interface PageOpts {
  bodyClass?: string;
  nav?: NavKey | "none";
  /** Extra nav entries beyond Settlement / Tasks / Deck (e.g. Review, which needs the operator token on a live server). */
  review?: string;
  script?: string;
  /** Static demo build: shows the demo banner. */
  demo?: boolean;
}

export function page(title: string, body: string, opts: PageOpts = {}): string {
  const items: [NavKey, string, string][] = [["settlement", "Settlement", "/"], ["work", "Tasks", "/work"]];
  if (opts.review) items.push(["review", "Review", opts.review]);
  items.push(["deck", "Deck", "/deck"]);
  const nav = opts.nav === "none" ? "<span></span>" : `<nav class="navpills">${items.map(([k, label, href]) => `<a href="${esc(href)}" class="${opts.nav === k ? "cur" : ""}">${label}</a>`).join("")}</nav>`;
  const demo = opts.demo
    ? `<div class="demo-bar"><b>Demo snapshot.</b> On-chain links are real Solana devnet / Sepolia transactions from our verification run; workers and photos are illustrative. Nothing you click here moves money.</div>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body class="${esc(opts.bodyClass ?? "")}"><div class="shell"><header>${LOGO}${nav}<span class="right">${TESTNET}</span></header>${demo}${body}</div>${opts.script ? `<script>${opts.script}</script>` : ""}</body></html>`;
}

export const tag = (text: string, cls = "", dot = false) => `<span class="tag ${cls}">${dot ? '<span class="d"></span>' : ""}${esc(text)}</span>`;
export const short = (s?: string | null, n = 8) => (s ? `${s.slice(0, n)}…${s.slice(-6)}` : "—");
export const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};
export const fmtAmt = (a: string | number) => {
  const n = Number(a);
  return Number.isInteger(n) ? n.toFixed(2) : String(n);
};
