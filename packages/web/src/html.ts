/** Tiny server-rendered HTML helpers. No framework, no build step. */
export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>
:root{--ink:#111;--muted:#666;--line:#e5e5e5;--ok:#0a7d3b;--warn:#b35c00;--bad:#b00020;--accent:#2b5bd7;--bg:#fff}
@media(prefers-color-scheme:dark){:root{--ink:#eee;--muted:#999;--line:#333;--bg:#0f0f10}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:860px;margin:0 auto;padding:24px 16px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 8px}
.sub{color:var(--muted);margin:0 0 20px}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:8px 6px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-weight:500}
.tag{display:inline-block;padding:1px 8px;border-radius:999px;border:1px solid var(--line);font-size:12px}
.ok{color:var(--ok);border-color:var(--ok)}.warn{color:var(--warn);border-color:var(--warn)}.bad{color:var(--bad);border-color:var(--bad)}
.card{border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:10px 0}
button,input[type=submit]{background:var(--accent);color:#fff;border:0;border-radius:8px;padding:8px 14px;font:inherit;cursor:pointer}
button.secondary{background:transparent;color:var(--ink);border:1px solid var(--line)}
input[type=email],input[type=text],textarea{width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--line);border-radius:8px;background:transparent;color:var(--ink);font:inherit}
code{font-size:13px;word-break:break-all}
a{color:var(--accent)}
nav a{margin-right:14px}
.trail{display:flex;flex-wrap:wrap;align-items:stretch;gap:0;margin:10px 0 4px}
.step{flex:1 1 150px;min-width:150px;border:1px solid var(--line);border-radius:8px;padding:8px 10px;position:relative;margin-right:18px;margin-bottom:8px}
.step:after{content:"→";position:absolute;right:-16px;top:50%;transform:translateY(-50%);color:var(--muted)}
.step:last-child:after{content:""}
.step.done{border-color:var(--ok)}.step.wait{border-color:var(--warn);border-style:dashed}.step.bad{border-color:var(--bad)}
.step b{display:block;font-size:12px;color:var(--muted);font-weight:500;margin-bottom:2px}
.step small{color:var(--muted)}
</style></head><body><main><nav><a href="/">Settlement record</a><a href="/work">Task board</a></nav>${body}</main></body></html>`;
}

export const tag = (text: string, cls = "") => `<span class="tag ${cls}">${esc(text)}</span>`;
export const short = (s?: string | null, n = 10) => (s ? `${s.slice(0, n)}…${s.slice(-6)}` : "—");
