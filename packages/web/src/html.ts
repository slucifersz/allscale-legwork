/** Server-rendered HTML helpers. Dark AllScale visual system (see ../design/*.html). No framework, no build step. */
export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const CSS = String.raw`
:root{--bg:#0a0c0b;--ink:#ffffff;--muted:#b9c1bc;--line:#2a2f2c;--ok:#3ddc84;--warn:#f0a842;--bad:#ff5a5a;--accent:#3ddc84;--deep:#1f6b3d;
--sans:"Archivo","Avenir Next","Helvetica Neue",system-ui,sans-serif;--mono:"JetBrains Mono","SF Mono",ui-monospace,Menlo,monospace}
*{box-sizing:border-box}
html{background:var(--bg)}
body{margin:0;min-height:100vh;font-family:var(--sans);color:var(--ink);-webkit-font-smoothing:antialiased;font-size:15px;
background:radial-gradient(ellipse 55% 40% at 78% 0%,rgba(31,107,61,.45),transparent 70%),radial-gradient(ellipse 50% 40% at 10% 60%,rgba(31,107,61,.22),transparent 70%),
radial-gradient(1.2px 1.2px at 23px 41px,rgba(255,255,255,.5),transparent 2px),radial-gradient(1px 1px at 151px 97px,rgba(255,255,255,.3),transparent 2px),radial-gradient(1px 1px at 88px 173px,rgba(255,255,255,.22),transparent 2px),radial-gradient(1.3px 1.3px at 211px 260px,rgba(255,255,255,.4),transparent 2px),var(--bg);
background-size:auto,auto,233px 233px,317px 317px,191px 191px,419px 419px;background-attachment:fixed}
body::after{content:"";position:fixed;inset:0;pointer-events:none;opacity:.06;mix-blend-mode:overlay;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
a{color:var(--ok);text-decoration:none}a:hover{color:#7cf0ae}
.mono,code{font-family:var(--mono)}
.shell{max-width:1240px;margin:0 auto;padding:24px 28px 80px}
body.work .shell{max-width:390px;padding:54px 16px 48px}
header{display:flex;align-items:center;gap:20px;flex-wrap:wrap}
body.work header{gap:10px}
.logo{display:inline-flex;align-items:center;gap:.42em;font-size:20px;letter-spacing:-.02em;white-space:nowrap;color:#fff}
body.work .logo{font-size:18px}
.logo .br{position:relative;font-weight:700;padding:.16em .3em}
.logo .br::before,.logo .br::after{content:"";position:absolute;width:.38em;height:.38em;border:0 solid var(--ok)}
.logo .br::before{top:0;left:0;border-top-width:.1em;border-left-width:.1em}
.logo .br::after{bottom:0;right:0;border-bottom-width:.1em;border-right-width:.1em}
.logo .lw{font-weight:400;color:#e8ece9}
.navpills{display:flex;gap:4px;padding:5px;border-radius:999px;background:rgba(16,20,18,.72);border:1px solid var(--line);backdrop-filter:blur(12px);box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
.navpills a{display:flex;align-items:center;gap:8px;padding:8px 16px;border-radius:999px;color:#8e9892;font-size:14px;font-weight:500}
.navpills a:hover{color:#fff}
.navpills a.cur{color:#fff;background:rgba(255,255,255,.06)}
.navpills a.cur::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--ok);box-shadow:0 0 8px var(--ok)}
.tag{display:inline-flex;align-items:center;gap:7px;padding:4px 11px;border-radius:999px;font:500 12px/1.4 var(--mono);letter-spacing:.02em;white-space:nowrap;color:#d6ddd9;background:rgba(255,255,255,.04);border:1px solid var(--line)}
.tag.ok{color:var(--ok);border-color:rgba(61,220,132,.35);background:rgba(61,220,132,.07)}
.tag.warn{color:var(--warn);border-color:rgba(240,168,66,.35);background:rgba(240,168,66,.07)}
.tag.bad{color:var(--bad);border-color:rgba(255,90,90,.4);background:rgba(255,90,90,.08)}
.tag.dim{color:#7d8781}
.tag .d{width:6px;height:6px;border-radius:50%;background:currentColor}
.card{position:relative;border-radius:24px;padding:28px;border:1px solid transparent;background:linear-gradient(180deg,rgba(26,32,29,.8),rgba(11,14,12,.84)) padding-box,linear-gradient(170deg,rgba(255,255,255,.15),rgba(255,255,255,.04) 35%,rgba(255,255,255,.02) 65%,rgba(61,220,132,.24)) border-box;box-shadow:inset 0 1px 0 rgba(255,255,255,.06),inset 0 0 50px rgba(61,220,132,.035),0 24px 60px rgba(0,0,0,.3);backdrop-filter:blur(10px);margin-bottom:18px}
body.work .card{border-radius:22px;padding:20px;margin-bottom:12px}
.card.ready{border-color:rgba(61,220,132,.45);box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 0 40px rgba(31,107,61,.35)}
h1{font-size:40px;line-height:1.12;font-weight:500;letter-spacing:-.03em;margin:56px 0 14px;max-width:960px;text-wrap:balance}
.lead{color:var(--muted);font-size:17px;line-height:1.5;margin:0 0 40px;max-width:820px;text-wrap:pretty}
h2{font:600 12px var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:52px 0 14px}
body.work h2{margin:36px 4px 12px;display:flex;justify-content:space-between}
body.work h2 span{color:#5d6661}
.sub{color:var(--muted)}
.empty{color:#6b746f;font-size:14px;padding:8px 4px}
.spin{width:10px;height:10px;border-radius:50%;border:2px solid rgba(240,168,66,.25);border-top-color:var(--warn);animation:spin 1s linear infinite;display:inline-block}
@keyframes spin{to{transform:rotate(360deg)}}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:48px;padding:0 24px;border-radius:999px;border:0;font:600 15px var(--sans);cursor:pointer;letter-spacing:-.01em;text-decoration:none}
.btn.go{background:var(--ok);color:#06130b;box-shadow:0 0 28px rgba(61,220,132,.3)}
.btn.go:hover{background:#5ae79a;color:#06130b}
.btn.go:active{background:#2fc070}
.btn.glass{background:rgba(255,255,255,.05);color:#fff;border:1px solid var(--line)}
.btn.glass:hover{background:rgba(255,255,255,.09);color:#fff}
.btn.go[disabled]{opacity:.35;cursor:not-allowed;box-shadow:none}
body.work .btn{display:flex;width:100%;min-height:52px;font-size:16px;margin-top:16px}
.field{width:100%;min-height:48px;margin-top:10px;padding:13px 16px;border-radius:14px;background:rgba(255,255,255,.04);border:1.5px solid var(--line);color:#fff;font:500 15px var(--sans);outline:none}
.field:hover{background:rgba(255,255,255,.06)}
.field:focus{border-color:var(--ok);background:rgba(61,220,132,.05)}
.field::placeholder{color:#6b746f}
textarea.field{resize:vertical;min-height:72px}
/* ---- settlement ---- */
.jobhead{font:500 13px var(--mono);color:var(--muted);display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center}
.jobhead b{color:#fff;font-weight:500}
.jobhead .sep,.status .sep{color:#4a524e}
.status{display:flex;align-items:center;flex-wrap:wrap;gap:12px 16px;margin:18px 0 30px;font-size:22px;font-weight:500;letter-spacing:-.02em}
.status .now{font:600 12px var(--mono);letter-spacing:.14em;padding:6px 12px;border-radius:999px;color:#06130b;background:var(--ok);box-shadow:0 0 22px rgba(61,220,132,.45)}
.status.revoked .now{background:var(--bad);color:#1a0505;box-shadow:0 0 22px rgba(255,90,90,.35)}
.status .muted{color:var(--muted)}
.trail{position:relative;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:30px;padding:22px 0 8px}
.trail svg.rib{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible}
.step{position:relative;z-index:1;min-height:132px;border-radius:18px;padding:18px 16px 16px;background:rgba(10,13,11,.88);border:1.5px solid var(--line);display:flex;flex-direction:column;gap:6px;transition:border-color .3s,background .3s}
.step .n{font:600 12px var(--mono);letter-spacing:.1em;color:#7d8781}
.step .t{font-size:16px;font-weight:500;line-height:1.25;letter-spacing:-.01em;text-wrap:balance}
.step .sub{font:500 12px var(--mono);color:var(--muted);margin-top:auto;word-break:break-all}
.step .ico{position:absolute;top:14px;right:14px;width:26px;height:26px;border-radius:50%;display:grid;place-items:center}
.step.done{border-color:var(--ok);background:linear-gradient(180deg,rgba(61,220,132,.09),rgba(10,13,11,.9))}
.step.done .n{color:var(--ok)}
.step.done .ico{background:var(--ok);box-shadow:0 0 14px rgba(61,220,132,.5)}
.step.wait{border-style:dashed;border-color:var(--warn)}
.step.wait .n{color:var(--warn)}
.step.wait .ico{border:2px solid rgba(240,168,66,.25);border-top-color:var(--warn);animation:spin 1s linear infinite}
.step.idle{border-style:dashed;border-color:#343a37;opacity:.6}
.step.bad{border-color:var(--bad);background:linear-gradient(180deg,rgba(255,90,90,.1),rgba(10,13,11,.9))}
.step.bad .n,.step.bad .sub{color:var(--bad)}
.step.bad .ico{background:var(--bad)}
.step:not(:last-child)::after{content:"";position:absolute;top:50%;right:-27px;width:24px;height:12px;transform:translateY(-50%);
background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='12'><path d='M1 6H19' stroke='%233ddc84' stroke-width='2' stroke-linecap='round' stroke-dasharray='1 5'/><path d='M16 2l5 4-5 4' fill='none' stroke='%233ddc84' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg>") no-repeat center}
.step.wait::after,.step.idle::after,.step.bad::after{filter:grayscale(1) brightness(.7)}
.here{position:absolute;left:50%;top:-13px;transform:translateX(-50%);white-space:nowrap;font:700 11px var(--mono);letter-spacing:.14em;padding:5px 10px;border-radius:999px;color:#06130b;background:var(--ok);box-shadow:0 0 0 4px rgba(10,12,11,1),0 0 24px rgba(61,220,132,.6)}
.here::after{content:"";position:absolute;left:50%;bottom:-4px;width:8px;height:8px;background:var(--ok);transform:translateX(-50%) rotate(45deg)}
.step.has-here{box-shadow:0 0 0 4px rgba(61,220,132,.08),0 0 40px rgba(61,220,132,.18)}
.step.bad.has-here .here{background:var(--bad);color:#1a0505}
.step.bad.has-here .here::after{background:var(--bad)}
.prog{height:4px;border-radius:4px;background:rgba(240,168,66,.15);overflow:hidden;margin-top:6px}
.prog i{display:block;height:100%;background:var(--warn);border-radius:4px}
.step.flash{animation:flash 1s cubic-bezier(.23,1,.32,1)}
@keyframes flash{0%{transform:scale(1);box-shadow:0 0 0 0 rgba(61,220,132,.7);background:rgba(61,220,132,.35)}30%{transform:scale(1.045);box-shadow:0 0 0 10px rgba(61,220,132,.25),0 0 60px rgba(61,220,132,.5)}100%{transform:scale(1);box-shadow:0 0 0 0 rgba(61,220,132,0)}}
.rib .flow{animation:flow 1.6s linear infinite}
@keyframes flow{to{stroke-dashoffset:-28}}
.tasks{width:100%;border-collapse:collapse;margin-top:30px;font-size:14px}
.tasks th{text-align:left;font:500 11px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:#7d8781;padding:0 14px 12px;border-bottom:1px solid var(--line)}
.tasks td{padding:14px;border-bottom:1px solid rgba(42,47,44,.6);vertical-align:middle}
.tasks tr:last-child td{border-bottom:0}
.tasks .tt{font-weight:500;font-size:15px}
.tasks .id{font:500 12px var(--mono);color:#7d8781;margin-top:3px}
.tasks .amt{font:500 14px var(--mono)}
.tasks .tx{font:500 13px var(--mono)}
.tasks .dash{color:#4a524e}
.tablewrap{overflow-x:auto}
.jobs{display:flex;flex-direction:column;gap:22px}
@media (max-width:900px){.trail{grid-template-columns:1fr;gap:22px}.trail svg.rib{display:none}.step{min-height:0}.step:not(:last-child)::after{top:auto;bottom:-19px;right:auto;left:28px;transform:rotate(90deg)}h1{font-size:30px}}
/* ---- work (mobile) ---- */
.me{font:500 12px var(--mono);color:var(--muted);margin:14px 0 0;display:flex;align-items:center;gap:8px}
.me::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--ok);box-shadow:0 0 8px var(--ok)}
.row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.title{font-size:16px;font-weight:500;line-height:1.3;letter-spacing:-.01em;text-wrap:balance}
.amt{font:600 44px/1 var(--mono);letter-spacing:-.04em;margin:16px 0 4px}
.amt small{font-size:20px;color:var(--muted);font-weight:500;letter-spacing:0;margin-left:6px}
.amt.sm{font-size:36px}
.meta{display:flex;gap:14px;font:500 12px var(--mono);color:var(--muted);margin-top:8px}
.meta .warnc{color:var(--warn)}
.crit{margin:14px 0 0;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid var(--line);font-size:13px;line-height:1.5;color:var(--muted)}
.crit b{display:block;font:600 11px var(--mono);letter-spacing:.12em;color:#7d8781;margin-bottom:4px}
.photo{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:120px;border-radius:18px;border:1.5px dashed rgba(61,220,132,.5);background:rgba(61,220,132,.05);color:#fff;font-weight:600;font-size:17px;cursor:pointer;margin-top:16px;position:relative}
.photo:hover{background:rgba(61,220,132,.09)}
.photo small{font:500 12px var(--mono);color:var(--muted)}
.photo input{position:absolute;width:1px;height:1px;opacity:0}
.photo.picked{border-style:solid;border-color:var(--ok)}
.waiting{display:flex;align-items:center;gap:12px;margin-top:16px;padding:14px 16px;border-radius:14px;border:1.5px dashed rgba(240,168,66,.5);color:var(--warn);font-weight:500}
.waiting .spin{width:16px;height:16px;flex:none}
.claimed{display:flex;align-items:center;gap:10px;margin-top:16px;min-height:48px;padding:0 16px;border-radius:999px;border:1px solid rgba(61,220,132,.35);font:500 13px var(--mono);color:var(--ok)}
.foot{margin-top:28px;text-align:center;font-size:12px;color:#6b746f}
/* ---- review ---- */
.titlebar{display:flex;align-items:center;gap:14px;margin:52px 0 28px}
.titlebar h1{margin:0}
.sub-grid{display:grid;grid-template-columns:minmax(0,480px) minmax(0,1fr);gap:28px}
.ph{aspect-ratio:4/3;max-width:480px;width:100%;border-radius:18px;border:1px solid var(--line);overflow:hidden;position:relative;background:repeating-linear-gradient(135deg,rgba(255,255,255,.025) 0 12px,transparent 12px 24px),#111513;display:grid;place-items:center;color:#5d6661;font:500 12px var(--mono)}
.ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.tt{font-size:22px;font-weight:500;letter-spacing:-.02em;line-height:1.2}
.idl{font:500 12px var(--mono);color:#7d8781;margin-top:6px}
.kv{display:grid;grid-template-columns:90px 1fr;gap:10px 14px;margin:20px 0;font-size:14px}
.kv dt{font:500 11px var(--mono);letter-spacing:.12em;color:#7d8781;text-transform:uppercase;padding-top:2px}
.kv dd{margin:0;color:#e6ebe8;line-height:1.45}
.checks{display:flex;flex-wrap:wrap;gap:8px}
.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
.progress{display:none;align-items:center;gap:12px;margin-top:22px;padding:14px 18px;border-radius:16px;border:1.5px dashed rgba(240,168,66,.55);color:var(--warn);font-weight:500}
.progress.on{display:flex}
.progress .spin{width:18px;height:18px;flex:none}
.progress .mono{margin-left:auto;font-size:13px}
.success{display:flex;align-items:center;gap:12px;margin-top:22px;padding:14px 18px;border-radius:16px;border:1.5px solid var(--ok);background:rgba(61,220,132,.07);font-weight:600;color:#fff;box-shadow:0 0 30px rgba(31,107,61,.35)}
.success .ck{width:26px;height:26px;border-radius:50%;background:var(--ok);display:grid;place-items:center;flex:none}
.success a{font:500 14px var(--mono);margin-left:4px}
.guard{position:relative;display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center;margin-top:22px;padding:18px 20px;border-radius:18px;border:1.5px solid var(--bad);background:linear-gradient(180deg,rgba(255,90,90,.10),rgba(255,90,90,.03));box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 0 40px rgba(255,90,90,.12)}
.guard .shield{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:rgba(255,90,90,.12);border:1px solid rgba(255,90,90,.4)}
.guard .ey{font:600 11px var(--mono);letter-spacing:.14em;color:var(--bad);text-transform:uppercase}
.guard .msg{font-size:16px;font-weight:700;margin-top:5px;line-height:1.3;color:#fff;text-wrap:pretty}
.guard .code{font:500 12px var(--mono);color:#c8a0a0;margin-top:6px}
.guard .code b{color:var(--bad);font-weight:500}
.guard .btn{min-height:44px;padding:0 20px;font-size:14px}
.needs{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.7fr) auto;gap:20px;align-items:center}
.needs .guard{margin-top:0;grid-template-columns:auto 1fr}
@media (max-width:860px){.sub-grid,.needs{grid-template-columns:1fr}.guard{grid-template-columns:auto 1fr}.guard .btn{grid-column:1/-1}}
`;

export const LOGO = `<a href="/" class="logo"><span class="br">AllScale</span><span class="lw">Legwork</span></a>`;
export const TESTNET = `<span class="tag warn" style="margin-left:auto"><span class="d"></span>TESTNET</span>`;
export const CHECK = `<svg width="14" height="14" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#06130b" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const CROSS = `<svg width="12" height="12" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="#1a0505" stroke-width="3.6" stroke-linecap="round"/></svg>`;
export const SHIELD_X = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff5a5a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5.5c0 4.4-3 8.1-7 9.5-4-1.4-7-5.1-7-9.5V6z"/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"/></svg>`;
export const SHIELD_I = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff5a5a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5.5c0 4.4-3 8.1-7 9.5-4-1.4-7-5.1-7-9.5V6z"/><path d="M12 8v5M12 16h.01"/></svg>`;

export function page(title: string, body: string, opts: { bodyClass?: string; nav?: "settlement" | "work" | "none"; script?: string } = {}): string {
  const nav =
    opts.nav === "none"
      ? ""
      : `<nav class="navpills"><a href="/" class="${opts.nav === "settlement" ? "cur" : ""}">Settlement record</a><a href="/work" class="${opts.nav === "work" ? "cur" : ""}">Task board</a></nav>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body class="${esc(opts.bodyClass ?? "")}"><div class="shell"><header>${LOGO}${nav}${TESTNET}</header>${body}</div>${opts.script ? `<script>${opts.script}</script>` : ""}</body></html>`;
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
