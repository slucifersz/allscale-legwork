// Load repo-root .env first (shared AllScale creds + PAYROLL_DATA_DIR), then the package-local .env (overrides).
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
for (const f of [resolve(import.meta.dirname, "../../../.env"), resolve(process.cwd(), ".env")]) {
  if (existsSync(f)) loadEnv({ path: f, override: f.endsWith("/.env") && f === resolve(process.cwd(), ".env") });
}
import { AllScaleClient } from "./allscale/client.js";
import type { ChainId, StableCoinId } from "./allscale/types.js";
import { FileStore } from "./store.js";
import { Orchestrator } from "./orchestrator.js";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name} (see .env.example)`);
  return v;
}

export function buildFromEnv() {
  const client = new AllScaleClient({
    baseUrl: process.env.ALLSCALE_BASE_URL ?? "https://openapi.allscale.io",
    apiKey: req("ALLSCALE_API_KEY"),
    apiSecret: req("ALLSCALE_API_SECRET"),
  });
  const store = new FileStore(process.env.PAYROLL_DATA_DIR ?? "./data");
  const orch = new Orchestrator({
    client,
    store,
    chain: Number(process.env.ALLSCALE_CHAIN ?? 11) as ChainId,
    stableCoin: Number(process.env.ALLSCALE_STABLE_COIN ?? 2) as StableCoinId,
    senderDisplayName: process.env.ALLSCALE_SENDER_DISPLAY_NAME ?? "Agent Payroll",
  });
  return { client, store, orch };
}
