/** Shared handler: a verified payment → job + reserved tasks in the orchestrator. Used by both x402 modes. */
import type { Orchestrator } from "@agent-payroll/payout-orchestrator/src/orchestrator.js";
import type { Planner } from "./planner.js";

export interface PaidJobInput {
  request: string;
  paymentRef: string; // Solana tx signature (or x402 settlement id)
  amountUsdc: string;
}

export async function createPaidJob(orch: Orchestrator, planner: Planner, input: PaidJobInput) {
  const plan = await planner.plan({ request: input.request, budgetUsdc: input.amountUsdc });
  const job = orch.createJob(input.paymentRef, input.amountUsdc);
  const tasks = plan.tasks.map((t) =>
    orch.createTask({
      jobId: job.id,
      title: t.title,
      reward: t.reward,
      acceptanceCriteria: t.acceptanceCriteria,
      deadline: new Date(Date.now() + t.deadlineMinutes * 60_000).toISOString(),
    }),
  );
  const budget = orch.reservedFor(job.id);
  if (!budget.ok) throw new Error(`planner over budget: reserved ${budget.reserved} > revenue ${budget.revenue}`);
  return { job, plan, tasks, budget };
}
