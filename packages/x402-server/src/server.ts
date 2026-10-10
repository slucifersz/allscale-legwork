import "dotenv/config";
import { buildFromEnv } from "@agent-payroll/payout-orchestrator/src/config.js";
import { AnthropicPlanner, RuleBasedPlanner } from "./planner.js";
import { buildApp } from "./app.js";
import { AnthropicSummarizer, TemplateSummarizer } from "./summarizer.js";
import { join } from "node:path";

const env = (k: string, d?: string) => process.env[k] ?? d ?? (() => { throw new Error(`missing env ${k}`); })();
const { orch, store } = buildFromEnv();
const planner = process.env.ANTHROPIC_API_KEY ? new AnthropicPlanner(process.env.ANTHROPIC_API_KEY) : new RuleBasedPlanner();
const mode = env("X402_MODE", "facilitator") as "facilitator" | "selfverify";

const app = await buildApp({
  orch,
  planner,
  mode,
  priceUsdc: env("JOB_PRICE_USDC", "9"),
  network: env("X402_NETWORK") as `${string}:${string}`,
  usdcMint: env("USDC_MINT"),
  payTo: env("SOLANA_PAY_TO"),
  facilitatorUrl: process.env.FACILITATOR_URL,
  solanaRpcUrl: process.env.SOLANA_RPC_URL,
  store,
  summarizer: process.env.ANTHROPIC_API_KEY ? new AnthropicSummarizer(process.env.ANTHROPIC_API_KEY) : new TemplateSummarizer(),
  uploadsDir: join(process.env.PAYROLL_DATA_DIR ?? "./data", "uploads"),
});
app.listen(Number(env("PORT", "4020")), () => console.log(`x402-server (${mode}) on :${env("PORT", "4020")}`));
