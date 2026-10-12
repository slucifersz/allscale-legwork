/**
 * Static demo build for Vercel: renders every page from the demo ledger into dist/.
 * No server, no AllScale credentials, nothing writes — forms are simulated in the browser.
 *   npm run export   →   packages/web/dist
 */
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEMO_WORKER, demoLedger } from "./demo-data.js";
import { cfgFromEnv, deckPage, redactLedger, reviewPage, settlementPage, workPage, type ViewCfg } from "./views.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist");
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "api"), { recursive: true });
mkdirSync(join(out, "uploads"), { recursive: true });

const ledger = demoLedger();
const cfg: ViewCfg = { ...cfgFromEnv(), payCoin: "USDT", demo: true, reviewHref: "/review", uploadSrc: (f) => `/uploads/${f}` };
const write = (path: string, html: string) => writeFileSync(join(out, path), html);

write("index.html", settlementPage(ledger, cfg));
write("work.html", workPage(ledger, DEMO_WORKER, cfg));
write("review.html", reviewPage(ledger, "", cfg));
write("deck.html", deckPage(readFileSync(join(root, "design", "deck.html"), "utf8"), ledger, cfg, { reviewHref: "/review", demoWorker: DEMO_WORKER }));
write("api/ledger.json", JSON.stringify(redactLedger(ledger), null, 2));
copyFileSync(join(root, "demo", "storefront.svg"), join(out, "uploads", "demo-storefront.svg"));

console.log(`static demo → ${out}`);
