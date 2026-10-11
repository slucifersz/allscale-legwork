/**
 * The AI part: turn a client request into a constrained task plan.
 * Rewards and acceptance criteria are fixed HERE, before any worker sees them.
 * The planner may be an LLM; the budget rule is enforced by code, never by the model.
 */
export interface PlanInput {
  request: string; // natural language from the client
  budgetUsdc: string; // total revenue for this job
  maxTasks?: number;
}
export interface PlannedTask {
  title: string;
  reward: string;
  acceptanceCriteria: string;
  deadlineMinutes: number;
}
export interface Plan {
  summary: string;
  tasks: PlannedTask[];
}

export interface Planner {
  plan(i: PlanInput): Promise<Plan>;
}

/** Deterministic planner used by default and in tests: one field-check task per location mentioned, equal split, 90% of budget to humans. */
export class RuleBasedPlanner implements Planner {
  async plan(i: PlanInput): Promise<Plan> {
    const locations = splitLocations(i.request).slice(0, i.maxTasks ?? 5);
    const n = Math.max(locations.length, 1);
    const human = (toMicro(i.budgetUsdc) * 90n) / 100n; // keep 10% as agent margin
    const each = human / BigInt(n);
    return {
      summary: `Field check of ${n} location(s): is it open, what notice is posted at the door.`,
      tasks: (locations.length ? locations : [i.request]).map((loc) => ({
        title: `On-site photo: ${loc}`,
        reward: fromMicro(each),
        acceptanceCriteria: "One photo of the storefront taken on site within the window; EXIF timestamp inside the window; location within 200 m; the door and any posted notice visible.",
        deadlineMinutes: 180,
      })),
    };
  }
}

/** Optional LLM planner. Set ANTHROPIC_API_KEY to use. Output is validated and re-budgeted by code. */
export class AnthropicPlanner implements Planner {
  constructor(private readonly apiKey: string, private readonly fallback: Planner = new RuleBasedPlanner()) {}
  async plan(i: PlanInput): Promise<Plan> {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 800,
          system: "You split a client's request into micro-tasks that only a human on site can do. Reply with JSON only: {\"summary\":string,\"tasks\":[{\"title\":string,\"acceptanceCriteria\":string}]}. At most " + (i.maxTasks ?? 5) + " tasks. No prices.",
          messages: [{ role: "user", content: i.request }],
        }),
      });
      const j = (await res.json()) as { content?: { text?: string }[] };
      const text = j.content?.[0]?.text ?? "";
      const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { summary: string; tasks: { title: string; acceptanceCriteria: string }[] };
      const n = Math.max(1, Math.min(parsed.tasks.length, i.maxTasks ?? 5));
      const each = (toMicro(i.budgetUsdc) * 90n) / 100n / BigInt(n);
      return {
        summary: parsed.summary,
        tasks: parsed.tasks.slice(0, n).map((t) => ({ title: t.title, acceptanceCriteria: t.acceptanceCriteria, reward: fromMicro(each), deadlineMinutes: 180 })),
      };
    } catch {
      return this.fallback.plan(i);
    }
  }
}

export function splitLocations(req: string): string[] {
  // "A, B and C" / "A、B、C" / numbered lines → list
  return req
    .split(/\n|,|，|、|;|；| and | & /i)
    .map((s) => s.replace(/^\s*\d+[.)]\s*/, "").replace(/\s*[—–-]\s.*$/, "").replace(/[?？].*$/, "").trim())
    .filter((s) => s.length > 1 && s.length < 80);
}

function toMicro(s: string): bigint {
  const [i, f = ""] = s.split(".");
  return BigInt(i) * 1_000_000n + BigInt((f + "000000").slice(0, 6));
}
function fromMicro(n: bigint): string {
  const i = n / 1_000_000n;
  const f = (n % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return f ? `${i}.${f}` : `${i}`;
}
