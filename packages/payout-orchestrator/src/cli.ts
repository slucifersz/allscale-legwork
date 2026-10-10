/**
 * Minimal operator CLI.
 *
 *   npm run cli -- ping                           # auth smoke test (key + HMAC) — run this first after changing keys
 *   npm run cli -- send-test <email> <amount>     # 验证一: one unattended payout end to end
 *   npm run cli -- resend <obligation_id> --force # simulate lost response: same reference_id again → expect idempotent_hit:true
 *   npm run cli -- status [obligation_id]         # print ledger
 *   npm run cli -- drain                          # retry everything non-terminal
 *   npm run cli -- poll [--loop 30]               # refresh claim states (CLAIM_STATUS_SOURCE=cli|rest), optionally every N seconds
 */
import { buildFromEnv } from "./config.js";
import { fetchViaCli, fetchViaRest, pollOnce } from "./poll.js";

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const { orch, store, client } = buildFromEnv();

  switch (cmd) {
    case "ping": {
      try {
        const r = await client.ping();
        console.log("auth OK:", JSON.stringify(r));
      } catch (e: any) {
        console.log("auth FAILED:", e.code, e.message, e.details?.reason ?? "");
        process.exitCode = 1;
      }
      break;
    }
    case "send-test": {
      const [email, amount = "1"] = args;
      if (!email) throw new Error("usage: send-test <email> [amount]");
      const job = orch.createJob("manual-test", amount);
      const task = orch.createTask({
        jobId: job.id,
        title: "verification payout",
        reward: amount,
        acceptanceCriteria: "n/a — manual test",
        deadline: new Date(Date.now() + 3600_000).toISOString(),
      });
      const t1 = orch.assign(task.id, email);
      orch.submit(task.id, t1.batchId!, { note: "manual" });
      const ob = orch.accept(task.id, t1.batchId!);
      console.log("obligation", ob.id, "→ calling AllScale (may block up to ~90s)…");
      const t0 = Date.now();
      const res = await orch.pay(ob.id);
      console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      console.log(JSON.stringify(res, null, 2));
      if (res.payment.state !== "funded") process.exitCode = 1;
      break;
    }
    case "resend": {
      // resend <id>          → no-op if already funded (local guard)
      // resend <id> --force  → simulate "we never got the response": state=unknown, then pay again with the SAME reference_id.
      //                        Expect the server to answer idempotent_hit:true and NO second claim link.
      const [id] = args;
      if (args.includes("--force")) {
        store.update((l) => {
          const ob = l.obligations[id];
          if (!ob) throw new Error("unknown obligation");
          ob.payment.state = "unknown";
        });
        console.log("forced payment.state=unknown; re-sending same reference_id", id);
      }
      const res = await orch.pay(id);
      console.log(JSON.stringify(res, null, 2));
      break;
    }
    case "drain": {
      const out = await orch.drain();
      console.log(JSON.stringify(out, null, 2));
      break;
    }
    case "poll": {
      const src = process.env.CLAIM_STATUS_SOURCE ?? "cli";
      const fetchOne = src === "rest"
        ? (id: string) => fetchViaRest(id, { baseUrl: process.env.ALLSCALE_BASE_URL ?? "https://openapi.allscale.io", apiKey: process.env.ALLSCALE_API_KEY!, apiSecret: process.env.ALLSCALE_API_SECRET! })
        : (id: string) => fetchViaCli(id);
      const loopIdx = args.indexOf("--loop");
      const every = loopIdx >= 0 ? Number(args[loopIdx + 1] ?? 30) : 0;
      do {
        const changed = await pollOnce(orch, store, fetchOne);
        console.log(new Date().toISOString(), src, changed.length ? JSON.stringify(changed) : "no change");
        if (every) await new Promise((r) => setTimeout(r, every * 1000));
      } while (every);
      break;
    }
    case "status": {
      const [id] = args;
      const l = store.get();
      console.log(JSON.stringify(id ? l.obligations[id] : l, null, 2));
      break;
    }
    default:
      console.log("commands: ping | send-test <email> [amount] | resend <obligation_id> | drain | poll [--loop N] | status [obligation_id]");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
