/**
 * Server-rendered HTML helpers. AllScale product visual system: quiet neutrals, hairline borders with soft
 * elevation, AllScale green reserved for primary actions and money-arrived states. No framework, no build step.
 * Two shells: consolePage (operator, sidebar layout) and appPage (worker, phone app).
 */
export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const BASE = String.raw`
:root{
--bg:#f6f7f6;--surface:#fff;--sunken:#f9faf9;--line:#ebeeec;--line2:#dfe3e1;
--ink:#0b1310;--ink2:#2f3a35;--muted:#69736e;--dim:#9ba4a0;
--g:#19d46b;--g2:#12b85b;--g-ink:#08884a;--g-soft:#edf9f2;--g-line:#c6eed6;
--warn:#b86e00;--warn-soft:#fff7e8;--warn-line:#f2dcae;--bad:#d4372f;--bad-soft:#fdf0ef;--bad-line:#f3c9c6;
--r:16px;--r-sm:10px;
--sh-1:0 1px 2px rgba(11,19,16,.04),0 0 0 1px rgba(11,19,16,.055);
--sh-2:0 1px 2px rgba(11,19,16,.04),0 4px 16px -4px rgba(11,19,16,.08),0 0 0 1px rgba(11,19,16,.055);
--ease:cubic-bezier(.23,1,.32,1);
--sans:"Inter","Noto Sans SC",system-ui,-apple-system,"PingFang SC",sans-serif;--mono:"JetBrains Mono","SF Mono",ui-monospace,Menlo,monospace}
*{box-sizing:border-box}
html{background:var(--bg)}
body{margin:0;min-height:100vh;font-family:var(--sans);font-feature-settings:"cv11","ss01","ss03";color:var(--ink);-webkit-font-smoothing:antialiased;font-size:14px;line-height:1.5;letter-spacing:-.006em;background:var(--bg)}
a{color:var(--g-ink);text-decoration:none;transition:color .15s}a:hover{color:var(--ink)}
.mono,code{font-family:var(--mono);letter-spacing:0}
.num{font-variant-numeric:tabular-nums}
button{font:inherit;letter-spacing:inherit}
.muted{color:var(--muted)}
:focus-visible{outline:2px solid var(--g);outline-offset:2px}
/* logo mark: the AllScale corner brackets */
.logo{display:inline-flex;align-items:center;gap:.38em;white-space:nowrap;color:var(--ink);letter-spacing:-.025em}
.logo:hover{color:var(--ink)}
.logo .br{position:relative;font-weight:700;padding:.12em .28em}
.logo .br::before,.logo .br::after{content:"";position:absolute;width:.34em;height:.34em;border:0 solid var(--g)}
.logo .br::before{top:0;left:0;border-top-width:.12em;border-left-width:.12em}
.logo .br::after{bottom:0;right:0;border-bottom-width:.12em;border-right-width:.12em}
.logo .lw{font-weight:400;color:var(--muted)}
/* tags */
.tag{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 9px;border-radius:999px;font-size:12px;font-weight:500;white-space:nowrap;color:var(--ink2);background:#f2f4f3;letter-spacing:0}
.tag.ok{color:var(--g-ink);background:var(--g-soft)}
.tag.warn{color:var(--warn);background:var(--warn-soft)}
.tag.bad{color:var(--bad);background:var(--bad-soft)}
.tag.dim{color:var(--dim);background:transparent;box-shadow:inset 0 0 0 1px var(--line)}
.tag .d{width:6px;height:6px;border-radius:50%;background:currentColor}
.spin{width:10px;height:10px;border-radius:50%;border:1.6px solid rgba(184,110,0,.22);border-top-color:var(--warn);animation:spin .9s linear infinite;display:inline-block;flex:none}
@keyframes spin{to{transform:rotate(360deg)}}
/* buttons & fields */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:38px;padding:0 16px;border-radius:var(--r-sm);border:0;font-size:13.5px;font-weight:500;cursor:pointer;text-decoration:none;white-space:nowrap;transition:background .15s,box-shadow .15s,transform .1s var(--ease)}
.btn:active{transform:scale(.98)}
.btn.go{background:var(--g);color:#032313;box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 1px 2px rgba(8,136,74,.25)}
.btn.go:hover{background:#2bdb79;color:#032313}
.btn.line{background:var(--surface);color:var(--ink);box-shadow:var(--sh-1)}
.btn.line:hover{background:var(--sunken);color:var(--ink)}
.btn.dark{background:var(--ink);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.12)}
.btn.dark:hover{background:#1d2925;color:#fff}
.btn[disabled]{opacity:.45;cursor:not-allowed;transform:none}
.btn.sm{height:30px;padding:0 12px;font-size:12.5px;border-radius:8px}
.field{width:100%;height:42px;padding:0 13px;border-radius:var(--r-sm);background:var(--surface);border:0;box-shadow:var(--sh-1);color:var(--ink);font:400 14px var(--sans);outline:none;transition:box-shadow .15s}
textarea.field{height:auto;min-height:72px;padding:11px 13px;resize:vertical}
.field:focus{box-shadow:0 0 0 1px var(--g),0 0 0 4px rgba(25,212,107,.15)}
.field::placeholder{color:var(--dim)}
.empty{color:var(--dim);font-size:13px;padding:16px 4px}
.flash{animation:flash 1.4s var(--ease)}
@keyframes flash{0%{box-shadow:0 0 0 4px rgba(25,212,107,.28),var(--sh-1)}100%{}}
/* switch */
.switch{position:relative;width:40px;height:24px;border-radius:999px;border:0;background:var(--g);cursor:pointer;flex:none;transition:background .2s;box-shadow:inset 0 0 0 1px rgba(0,0,0,.04)}
.switch span{position:absolute;top:3px;left:19px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:left .25s var(--ease)}
.switch[aria-checked="false"]{background:#d6dbd8}
.switch[aria-checked="false"] span{left:3px}
/* toast */
.toast{position:fixed;left:50%;bottom:28px;transform:translate(-50%,12px) scale(.98);opacity:0;max-width:calc(100% - 32px);padding:11px 18px 11px 16px;border-radius:12px;background:rgba(11,19,16,.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:#fff;font-size:13.5px;font-weight:500;box-shadow:0 16px 40px -8px rgba(11,19,16,.35);transition:opacity .25s var(--ease),transform .35s var(--ease);pointer-events:none;z-index:50;display:flex;align-items:center;gap:10px}
.toast::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--g);box-shadow:0 0 0 3px rgba(25,212,107,.25);flex:none}
.toast.on{opacity:1;transform:translate(-50%,0) scale(1)}
`;

const CONSOLE = String.raw`
.app{display:grid;grid-template-columns:248px minmax(0,1fr);min-height:100vh}
.side{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;gap:2px;padding:20px 12px 14px;background:var(--bg)}
.side>.logo{font-size:19px;padding:2px 12px 18px}
.ws{display:flex;align-items:center;gap:10px;padding:9px 10px;margin-bottom:10px;border-radius:12px;background:var(--surface);box-shadow:var(--sh-1)}
.ws .mark{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:linear-gradient(135deg,#1fe07a,#0aa452);color:#fff;font-weight:700;font-size:13px;box-shadow:inset 0 1px 0 rgba(255,255,255,.3)}
.ws b{display:block;font-weight:600;font-size:13px;line-height:1.2}
.ws small{display:block;color:var(--muted);font-size:11.5px}
.ws svg{margin-left:auto;color:var(--dim)}
.side .sec{font-size:11px;font-weight:500;color:var(--dim);padding:14px 12px 6px}
.side a.item{display:flex;align-items:center;gap:11px;height:36px;padding:0 10px;border-radius:9px;color:var(--ink2);font-size:13.5px;font-weight:500;transition:background .15s,color .15s}
.side a.item:hover{background:rgba(11,19,16,.04);color:var(--ink)}
.side a.item.cur{background:var(--surface);color:var(--ink);box-shadow:var(--sh-1)}
.side a.item svg{flex:none;color:var(--dim);transition:color .15s}
.side a.item.cur svg{color:var(--g-ink)}
.side .badge{margin-left:auto;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:var(--ink);color:#fff;font-size:11px;font-weight:600;display:grid;place-items:center}
.side .me{margin-top:auto;display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px}
.side .me b{display:block;font-size:13px;font-weight:600;line-height:1.2}
.side .me small{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:11.5px}
.side .me small::before{content:"";width:6px;height:6px;border-radius:50%;background:#e6a23c}
.avatar{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:var(--ink);color:#fff;font-weight:600;font-size:12px;flex:none}
.main{min-width:0;padding:10px 12px 12px 0}
.canvas{min-height:calc(100vh - 22px);background:var(--surface);border-radius:20px;box-shadow:var(--sh-1);padding:0 36px 56px}
.top{display:flex;align-items:center;gap:12px;height:60px;border-bottom:1px solid var(--line);margin:0 -36px;padding:0 24px 0 36px}
.top .crumb{color:var(--muted);font-size:13px;display:flex;gap:8px;align-items:center}
.top .crumb b{color:var(--ink);font-weight:500}
.top .right{margin-left:auto;display:flex;align-items:center;gap:8px}
.chip{display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 11px;border-radius:8px;font-size:12.5px;color:var(--ink2);box-shadow:var(--sh-1);background:var(--surface);white-space:nowrap}
.chip .d{width:6px;height:6px;border-radius:50%;background:#e6a23c}
.chip.demo{color:var(--warn);background:var(--warn-soft);box-shadow:none;cursor:help}
.iconbtn{width:32px;height:32px;border-radius:8px;display:grid;place-items:center;color:var(--muted);box-shadow:var(--sh-1)}
.hello{display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;margin:34px 0 26px}
.eyebrow{font-size:12.5px;color:var(--muted);margin-bottom:6px}
.hello h1,.pagehead h1{margin:0;font-size:26px;font-weight:600;letter-spacing:-.03em;line-height:1.2}
.hello .sub{color:var(--muted);font-size:14px;margin-top:6px}
.hello .act,.pagehead .act{margin-left:auto;display:flex;gap:8px;align-items:center}
.pagehead{display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;margin:34px 0 26px}
.pagehead p{margin:6px 0 0;color:var(--muted);font-size:14px;max-width:640px}
.grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:24px;align-items:start}
.col{display:flex;flex-direction:column;gap:24px;min-width:0}
.panel{background:var(--surface);border-radius:var(--r);box-shadow:var(--sh-1);min-width:0;overflow:hidden}
.panel>.ph{display:flex;align-items:center;gap:10px;min-height:56px;padding:0 20px;border-bottom:1px solid var(--line)}
.panel>.ph h2{margin:0;font-size:14.5px;font-weight:600;letter-spacing:-.01em}
.panel>.ph .r{margin-left:auto;display:flex;gap:8px;align-items:center}
.panel>.pb{padding:20px}
.kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
.kpi{padding:20px 22px 22px}
.kpi+.kpi{border-left:1px solid var(--line)}
.kpi .k{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12.5px;font-weight:500}
.kpi .v{font-size:32px;font-weight:600;letter-spacing:-.035em;line-height:1.1;margin-top:12px;font-variant-numeric:tabular-nums}
.kpi .v small{font-size:13px;color:var(--muted);font-weight:500;margin-left:6px;letter-spacing:0}
.kpi .s{color:var(--muted);font-size:12.5px;margin-top:8px}
.kpi .s a{font-weight:500}
.auth{display:grid;grid-template-columns:auto minmax(0,1fr) minmax(180px,260px) auto;align-items:center;gap:18px}
.auth .ic{width:40px;height:40px;border-radius:11px;display:grid;place-items:center;background:var(--g-soft);color:var(--g-ink);transition:background .2s,color .2s}
.auth.off .ic{background:var(--bad-soft);color:var(--bad)}
.auth .t{font-size:14px;font-weight:600}
.auth .t [data-auth-state]{font-weight:500;color:var(--g-ink)}
.auth.off .t [data-auth-state]{color:var(--bad)}
.auth .d{color:var(--muted);font-size:12.5px;margin-top:2px}
.meter .lbl{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.meter .lbl b{color:var(--ink);font-weight:500}
.meter .bar{height:6px;border-radius:6px;background:#eef0ef;overflow:hidden;margin-top:8px}
.meter .bar i{display:block;height:100%;background:var(--ink);border-radius:6px;transition:background .2s}
.auth.off .meter .bar i{background:var(--bad)}
/* tables */
.tw{overflow-x:auto}
table.t{width:100%;border-collapse:collapse;font-size:13.5px}
.t th{text-align:left;font-weight:500;font-size:12px;color:var(--muted);padding:10px 20px;background:var(--sunken);border-bottom:1px solid var(--line);white-space:nowrap}
.t td{padding:14px 20px;border-bottom:1px solid var(--line);vertical-align:middle}
.t tr:last-child td{border-bottom:0}
.t tr.click{cursor:pointer;transition:background .15s}
.t tr.click:hover td{background:var(--sunken)}
.t .tt{font-weight:500;color:var(--ink)}
.t .id{font:400 11.5px var(--mono);color:var(--dim);margin-top:3px}
.t .amt{font-weight:500;white-space:nowrap;font-variant-numeric:tabular-nums}
.t .tx{font:400 12.5px var(--mono);white-space:nowrap}
.dash{color:var(--dim)}
.dots{display:flex;align-items:center;gap:3px}
.dots i{width:18px;height:4px;border-radius:4px;background:#e7eae8}
.dots i.done{background:var(--g)}
.dots i.wait{background:#f0c36d}
.dots i.bad{background:var(--bad)}
.dots span{margin-left:10px;font-size:12.5px;color:var(--muted);white-space:nowrap}
/* updates: timeline */
.feed{list-style:none;margin:0;padding:8px 0}
.feed li{position:relative;display:flex;gap:12px;padding:10px 20px 10px 20px}
.feed li:not(:last-child)::before{content:"";position:absolute;left:30px;top:34px;bottom:-10px;width:1px;background:var(--line)}
.feed .dot{position:relative;width:21px;height:21px;border-radius:50%;background:var(--g-soft);flex:none;margin-top:1px}
.feed .dot::after{content:"";position:absolute;inset:7px;border-radius:50%;background:var(--g)}
.feed .dot.warn{background:var(--warn-soft)}.feed .dot.warn::after{background:#e6a23c}
.feed .dot.bad{background:var(--bad-soft)}.feed .dot.bad::after{background:var(--bad)}
.feed .w{font-weight:500;font-size:13.5px}
.feed .m{color:var(--muted);font-size:12.5px;margin-top:1px}
.feed .time{margin-left:auto;color:var(--dim);font-size:11.5px;white-space:nowrap;padding-left:8px;font-variant-numeric:tabular-nums}
.feed .acts{display:flex;gap:8px;margin-top:10px}
/* job: money-flow stepper */
.job+.job{margin-top:24px}
.jobhead{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;color:var(--muted);font-size:12.5px}
.jobhead b{color:var(--ink);font-weight:500;font-variant-numeric:tabular-nums}
.where{display:flex;align-items:baseline;flex-wrap:wrap;gap:10px;margin:2px 0 24px;font-size:17px;font-weight:600;letter-spacing:-.02em}
.where .muted{font-weight:400;font-size:13px;letter-spacing:0}
.trail{display:grid;grid-template-columns:repeat(5,minmax(0,1fr))}
.step{position:relative;padding:0 18px 4px 0;display:flex;flex-direction:column;gap:3px;transition:opacity .3s}
.step::before{content:"";position:absolute;top:13px;left:34px;right:6px;height:2px;border-radius:2px;background:var(--line);transition:background .4s}
.step:last-child::before{display:none}
.step.done::before{background:var(--g)}
.step .node{position:relative;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;margin-bottom:12px;background:var(--surface);box-shadow:inset 0 0 0 1.5px var(--line2);color:var(--dim);font-size:12px;font-weight:600;transition:background .3s,box-shadow .3s}
.step.done .node{background:var(--g);box-shadow:none}
.step.wait .node{box-shadow:inset 0 0 0 1.5px var(--warn-line);background:var(--warn-soft)}
.step.bad .node{background:var(--bad);box-shadow:none}
.step.has-here .node::after{content:"";position:absolute;inset:-5px;border-radius:50%;border:2px solid var(--g);opacity:.5;animation:pulse 1.8s var(--ease) infinite}
.step.bad.has-here .node::after{border-color:var(--bad)}
@keyframes pulse{0%{transform:scale(.85);opacity:.7}100%{transform:scale(1.35);opacity:0}}
.step .n{font-size:11.5px;color:var(--dim);font-weight:500}
.step .t{font-size:13.5px;font-weight:600;line-height:1.35;letter-spacing:-.01em}
.step .sub{font-size:12px;color:var(--muted);word-break:break-all;line-height:1.5}
.step .sub a{font-family:var(--mono);font-size:11.5px}
.step.idle{opacity:.5}
.step.bad .sub{color:var(--bad)}
.here{position:absolute;top:4px;left:40px;z-index:1;font-size:10.5px;font-weight:600;letter-spacing:.02em;padding:2px 8px;border-radius:999px;color:var(--g-ink);background:var(--g-soft);box-shadow:0 0 0 3px var(--surface)}
.step.bad .here{color:var(--bad);background:var(--bad-soft)}
.prog{height:3px;border-radius:3px;background:#f3e3c2;overflow:hidden;margin:4px 0 2px;max-width:140px}
.prog i{display:block;height:100%;background:#e6a23c}
/* review */
.rv{display:grid;grid-template-columns:minmax(0,380px) minmax(0,1fr);gap:28px}
.photo-box{aspect-ratio:4/3;width:100%;border-radius:12px;overflow:hidden;position:relative;background:var(--sunken);box-shadow:var(--sh-1);display:grid;place-items:center;color:var(--dim);font-size:13px}
.photo-box img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.rv .tt{font-size:18px;font-weight:600;letter-spacing:-.02em}
.rv .idl{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font:400 11.5px var(--mono);color:var(--dim);margin-top:6px}
.kv{display:grid;grid-template-columns:88px 1fr;gap:11px 16px;margin:20px 0;font-size:13.5px}
.kv dt{color:var(--muted)}
.kv dd{margin:0;color:var(--ink2)}
.checks{display:flex;flex-wrap:wrap;gap:6px}
.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px;padding-top:20px;border-top:1px solid var(--line)}
.progress{display:none;align-items:center;gap:10px;margin-top:14px;padding:11px 14px;border-radius:var(--r-sm);background:var(--warn-soft);color:var(--warn);font-weight:500;font-size:13.5px}
.progress.on{display:flex}
.progress .spin{width:14px;height:14px}
.progress .mono{margin-left:auto;font-size:12px}
.success{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:14px;padding:12px 14px;border-radius:var(--r-sm);background:var(--g-soft);font-weight:600;font-size:13.5px;animation:rise .4s var(--ease)}
.success .ck{width:20px;height:20px;border-radius:50%;background:var(--g);display:grid;place-items:center;flex:none}
.success small{flex-basis:100%;color:var(--muted);font-weight:400;font-size:12.5px}
.success a{font-family:var(--mono);font-size:12px}
@keyframes rise{from{opacity:0;transform:translateY(4px)}}
.guard{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;margin-top:14px;padding:14px;border-radius:12px;background:var(--bad-soft);animation:rise .4s var(--ease)}
.guard .shield{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;background:var(--surface);box-shadow:0 0 0 1px var(--bad-line)}
.guard .ey{font-size:11.5px;font-weight:600;color:var(--bad);letter-spacing:.01em}
.guard .msg{font-size:14px;font-weight:600;margin-top:2px}
.guard .code{font:400 11.5px var(--mono);color:#a3605b;margin-top:4px}
.guard .code b{color:var(--bad);font-weight:500}
.needs{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.6fr) auto;gap:16px;align-items:center}
.needs .guard{margin-top:0;grid-template-columns:auto 1fr}
.foot-note{margin-top:28px;color:var(--dim);font-size:12px;display:flex;gap:6px;align-items:center}
@media (max-width:1240px){.grid{grid-template-columns:1fr}.auth{grid-template-columns:auto minmax(0,1fr) auto}.auth .meter{grid-column:1/-1;grid-row:2}}
@media (max-width:1100px){.trail{grid-template-columns:1fr;gap:18px}.step{display:grid;grid-template-columns:28px 1fr;column-gap:14px;padding:0}.step>*:not(.node){grid-column:2}.step .node{grid-row:1/span 5;margin:0}.step::before{top:34px;bottom:-14px;left:13px;right:auto;width:2px;height:auto}.here{position:static;grid-column:2;justify-self:start;margin-bottom:2px}}
@media (max-width:900px){
.app{grid-template-columns:1fr}
.side{position:static;height:auto;flex-direction:row;align-items:center;gap:4px;padding:10px 12px;overflow-x:auto}
.side>.logo{padding:0 8px 0 4px;font-size:17px}.side .sec,.side .me,.ws{display:none}
.side a.item{white-space:nowrap}.side a.item svg{display:none}
.main{padding:0}.canvas{border-radius:0;padding:0 16px 48px;min-height:0}.top{margin:0 -16px;padding:0 16px}.top .crumb{display:none}
.kpis{grid-template-columns:1fr}.kpi+.kpi{border-left:0;border-top:1px solid var(--line)}
.rv,.needs{grid-template-columns:1fr}.guard{grid-template-columns:auto 1fr}.guard .btn{grid-column:1/-1}
.hello .act,.pagehead .act{margin-left:0}}
`;

const PHONE = String.raw`
body.phone{background:radial-gradient(ellipse 60% 50% at 70% 50%,rgba(25,212,107,.10),transparent 70%),var(--bg)}
.stage{min-height:100vh;display:flex;align-items:center;justify-content:center;gap:72px;padding:32px}
.aside{max-width:320px;color:var(--muted);font-size:14px}
.aside .logo{font-size:20px;margin-bottom:28px}
.aside h1{font-size:30px;font-weight:600;letter-spacing:-.035em;color:var(--ink);margin:0 0 12px;line-height:1.15}
.aside p{margin:0 0 16px;line-height:1.6}
.aside ol{margin:0 0 20px;padding:0;list-style:none;counter-reset:s}
.aside ol li{counter-increment:s;display:flex;gap:10px;align-items:baseline;padding:6px 0;color:var(--ink2)}
.aside ol li::before{content:counter(s);width:20px;height:20px;border-radius:50%;display:grid;place-items:center;flex:none;font-size:11px;font-weight:600;background:var(--surface);box-shadow:var(--sh-1);color:var(--ink)}
.aside .note{font-size:12.5px;color:var(--warn)}
.device{position:relative;width:390px;height:812px;border-radius:56px;padding:11px;background:linear-gradient(145deg,#1d2622,#0b1310);box-shadow:0 50px 100px -20px rgba(11,19,16,.35),0 30px 60px -30px rgba(11,19,16,.4),inset 0 0 0 1.5px #39443f}
.screen{position:relative;width:100%;height:100%;border-radius:46px;overflow:hidden;background:var(--bg);display:flex;flex-direction:column}
.notch{position:absolute;top:11px;left:50%;width:118px;height:34px;margin-left:-59px;border-radius:20px;background:#000;z-index:5}
.status{display:flex;justify-content:space-between;align-items:center;padding:18px 32px 6px;font-size:14px;font-weight:600}
.status i{display:inline-block;width:24px;height:11px;border-radius:3px;box-shadow:inset 0 0 0 1px var(--ink);position:relative}
.status i::after{content:"";position:absolute;inset:2px 5px 2px 2px;background:var(--ink);border-radius:1px}
.apphead{display:flex;align-items:center;gap:10px;padding:14px 20px 8px}
.apphead .logo{font-size:16px}
.apphead .who{margin-left:auto}
.apphead .avatar{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:var(--ink);color:#fff;font-weight:600;font-size:12px}
.scroll{flex:1;overflow-y:auto;padding:4px 16px 24px;scrollbar-width:none}
.scroll::-webkit-scrollbar{display:none}
.tab{display:none;animation:rise .35s var(--ease)}
.tab.on{display:block}
@keyframes rise{from{opacity:0;transform:translateY(6px)}}
.tab h2{font-size:28px;font-weight:600;letter-spacing:-.035em;margin:10px 4px 4px}
.tab .lede{color:var(--muted);font-size:13px;margin:0 4px 16px}
.tab h3{font-size:12px;font-weight:500;color:var(--muted);margin:22px 4px 10px}
.tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin:0 12px 24px;padding:6px;border-radius:22px;background:rgba(255,255,255,.82);backdrop-filter:blur(16px) saturate(160%);-webkit-backdrop-filter:blur(16px) saturate(160%);box-shadow:var(--sh-2)}
.tabs button{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;padding:7px 0 6px;border:0;border-radius:16px;background:none;color:var(--dim);font-size:11px;font-weight:500;cursor:pointer;transition:background .2s,color .2s}
.tabs button.on{color:var(--ink);background:var(--bg)}
.tabs button.on svg{color:var(--g-ink)}
.tabs .bd{position:absolute;top:3px;left:50%;margin-left:7px;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:var(--ink);color:#fff;font-size:10px;font-weight:600;display:grid;place-items:center}
.tabs .bd[data-n="0"]{display:none}
.card{background:var(--surface);border-radius:20px;padding:18px;margin-bottom:12px;box-shadow:var(--sh-1)}
.card.ready{box-shadow:0 0 0 1.5px var(--g-line),0 8px 24px -10px rgba(25,212,107,.35)}
.row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.title{font-size:15px;font-weight:600;line-height:1.35;letter-spacing:-.015em}
.amount{display:flex;align-items:baseline;font-size:34px;line-height:1;font-weight:600;letter-spacing:-.04em;margin:16px 0 6px;font-variant-numeric:tabular-nums}
.amount small{font-size:13px;color:var(--muted);font-weight:500;margin-left:6px;letter-spacing:0}
.amount.sm{font-size:26px}
.meta{display:flex;flex-wrap:wrap;gap:6px 10px;font-size:12px;color:var(--muted)}
.meta .warnc{color:var(--warn);font-family:var(--mono);font-weight:500}
.crit{margin-top:14px;padding:12px 14px;border-radius:12px;background:var(--sunken);font-size:12.5px;line-height:1.55;color:var(--ink2)}
.crit b{display:block;font-weight:600;color:var(--muted);font-size:11px;letter-spacing:.02em;margin-bottom:3px}
.card .btn{display:flex;width:100%;height:46px;margin-top:14px;font-size:14.5px;border-radius:13px}
.card .field{margin-top:10px}
.photo{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:108px;border-radius:14px;border:1.5px dashed var(--g-line);background:var(--g-soft);font-weight:600;font-size:14px;cursor:pointer;margin-top:14px;position:relative;color:var(--ink);transition:border-color .2s}
.photo:hover{border-color:var(--g)}
.photo small{font-size:11.5px;color:var(--muted);font-weight:400}
.photo input{position:absolute;width:1px;height:1px;opacity:0}
.photo.picked{border-style:solid;border-color:var(--g)}
.waiting{display:flex;align-items:center;gap:10px;margin-top:14px;padding:12px 14px;border-radius:12px;background:var(--warn-soft);color:var(--warn);font-weight:500;font-size:13px}
.waiting .spin{width:13px;height:13px}
.claimed{display:flex;align-items:center;gap:8px;margin-top:14px;height:44px;padding:0 14px;border-radius:12px;background:var(--g-soft);font-size:13px;color:var(--g-ink);font-weight:500}
.wallet{position:relative;overflow:hidden;border-radius:24px;padding:22px;background:linear-gradient(160deg,#16201c,#0b1310 60%);color:#fff;margin-bottom:8px;box-shadow:0 18px 40px -18px rgba(11,19,16,.6)}
.wallet::before{content:"";position:absolute;right:-60px;top:-80px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(25,212,107,.45),transparent 65%)}
.wallet .logo{position:relative;font-size:13px;color:#fff}.wallet .logo .lw{color:#8d9a94}
.wallet .k{position:relative;font-size:12px;color:#8d9a94;margin-top:26px}
.wallet .v{position:relative;font-size:40px;font-weight:600;letter-spacing:-.04em;margin-top:2px;font-variant-numeric:tabular-nums}
.wallet .v small{font-size:14px;color:#8d9a94;margin-left:6px;font-weight:500;letter-spacing:0}
.wallet .s{position:relative;font-size:11.5px;color:#8d9a94;margin-top:10px}
.signin{padding:24px 6px}
.signin h2{font-size:28px;font-weight:600;letter-spacing:-.035em;margin:24px 0 8px}
.signin p{color:var(--muted);margin:0 0 20px}
.foot{text-align:center;font-size:11.5px;color:var(--dim);margin:20px 0 4px}
@media (max-width:860px){body.phone{background:var(--bg)}.stage{padding:0;display:block}.aside{display:none}.device{width:100%;height:100vh;height:100dvh;border-radius:0;padding:0;box-shadow:none;background:none}.screen{border-radius:0}.notch,.status{display:none}.apphead{padding-top:16px}}
`;

const HEAD = (title: string, css: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${BASE}${css}</style></head>`;

export const LOGO = `<a href="/" class="logo"><span class="br">AllScale</span><span class="lw">Legwork</span></a>`;
export const CHECK = `<svg width="12" height="12" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#032313" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const CROSS = `<svg width="10" height="10" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/></svg>`;
export const SHIELD_X = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d4372f" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5.5c0 4.4-3 8.1-7 9.5-4-1.4-7-5.1-7-9.5V6z"/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"/></svg>`;
export const SHIELD_I = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d4372f" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5.5c0 4.4-3 8.1-7 9.5-4-1.4-7-5.1-7-9.5V6z"/><path d="M12 8v5M12 16h.01"/></svg>`;
export const SHIELD_OK = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5.5c0 4.4-3 8.1-7 9.5-4-1.4-7-5.1-7-9.5V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>`;

const ic = (d: string, s = 17) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const ICONS = {
  overview: ic(`<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>`),
  jobs: ic(`<path d="M3 12h4l3-7 4 14 3-7h4"/>`),
  review: ic(`<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-5 4z"/><path d="M8.5 10l2 2 4-4"/>`),
  payouts: ic(`<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 14.5h3"/>`),
  phone: ic(`<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>`),
  deck: ic(`<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8"/>`),
  bell: ic(`<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>`, 16),
  chev: ic(`<path d="M8 10l4-4 4 4M8 14l4 4 4-4"/>`, 15),
  info: ic(`<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>`, 14),
  tasks: ic(`<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>`, 20),
  mine: ic(`<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M9 8h6M9 12h6M9 16h3"/>`, 20),
  wallet: ic(`<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M16 13.5h1"/>`, 20),
};

export type NavKey = "overview" | "jobs" | "review" | "payouts";
export interface ConsoleOpts {
  nav: NavKey;
  /** Review link (live: carries the operator token; demo: plain /review). Omit to hide Review. */
  review?: string;
  reviewCount?: number;
  demo?: boolean;
  script?: string;
}

const DEMO_TEXT = "Demo workspace: on-chain links are real Solana devnet / Sepolia transactions from our verification run; workers and photos are illustrative. Clicks are simulated — nothing moves money.";

export function consolePage(title: string, crumb: string, body: string, opts: ConsoleOpts): string {
  const item = (k: NavKey | "", href: string, label: string, icon: string, extra = "") =>
    `<a class="item${k && opts.nav === k ? " cur" : ""}" href="${esc(href)}">${icon}${label}${extra}</a>`;
  const side = `<aside class="side">${LOGO}
<div class="ws"><span class="mark">L</span><div><b>Legwork</b><small>AllScale workspace</small></div>${ICONS.chev}</div>
${item("overview", "/", "Overview", ICONS.overview)}
${item("jobs", "/jobs", "Jobs", ICONS.jobs)}
${opts.review ? item("review", opts.review, "Review", ICONS.review, opts.reviewCount ? `<span class="badge">${opts.reviewCount}</span>` : "") : ""}
${item("payouts", "/payouts", "Payouts", ICONS.payouts)}
<div class="sec">Apps</div>
${item("", "/work", "Worker app", ICONS.phone)}
${item("", "/deck", "Pitch deck", ICONS.deck)}
<div class="me"><span class="avatar">OP</span><div><b>Operator</b><small>Testnet</small></div></div></aside>`;
  const top = `<div class="top"><span class="crumb">Legwork <span class="muted">/</span> <b>${esc(crumb)}</b></span><div class="right">${
    opts.demo ? `<span class="chip demo" title="${esc(DEMO_TEXT)}">${ICONS.info}Demo workspace</span>` : ""
  }<span class="chip"><span class="d"></span>Solana devnet · Sepolia</span><span class="iconbtn">${ICONS.bell}</span></div></div>`;
  const note = opts.demo ? `<div class="foot-note">${ICONS.info}${esc(DEMO_TEXT)}</div>` : "";
  return `${HEAD(title, CONSOLE)}<body><div class="app">${side}<main class="main"><div class="canvas">${top}${body}${note}</div></main></div>${opts.script ? `<script>${opts.script}</script>` : ""}</body></html>`;
}

export function appPage(title: string, screen: string, opts: { demo?: boolean; script?: string } = {}): string {
  const aside = `<div class="aside">${LOGO}<h1>Get paid for the legwork an AI agent can't do.</h1><p>Take a task nearby, snap a photo on site, get paid by email through an AllScale claim link — no wallet, no gas, no KYC.</p>${
    opts.demo ? `<ol><li>Take a task, then submit it</li><li>Accept it in the operator console</li><li>Claim the payment in Wallet</li></ol><p class="note">Demo — nothing is sent.</p>` : ""
  }<p><a href="/">← Operator console</a></p></div>`;
  return `${HEAD(title, PHONE)}<body class="phone"><div class="stage">${aside}<div class="device"><div class="screen"><div class="notch"></div><div class="status"><span>9:41</span><i></i></div>${screen}</div></div></div>${opts.script ? `<script>${opts.script}</script>` : ""}</body></html>`;
}

/** Minimal page for server errors. */
export function errorPage(msg: string, back = "/"): string {
  return `${HEAD("Error", CONSOLE)}<body><main class="main" style="padding:24px"><div class="panel"><div class="pb"><p>${esc(msg)}</p><a href="${esc(back)}">← back</a></div></div></main></body></html>`;
}

export const tag = (text: string, cls = "", dot = false) => `<span class="tag ${cls}">${dot ? '<span class="d"></span>' : ""}${esc(text)}</span>`;
export const short = (s?: string | null, n = 8) => (s ? `${s.slice(0, n)}…${s.slice(-6)}` : "—");
export const maskEmail = (e?: string | null) => {
  if (!e) return "—";
  const [u, d] = e.split("@");
  return `${u.slice(0, 1)}•••@${d ?? ""}`;
};
export const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};
export const fmtAmt = (a: string | number) => Number(a).toFixed(2);
