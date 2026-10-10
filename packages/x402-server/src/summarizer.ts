/**
 * The second AI step: turn accepted human submissions into the client's answer.
 * Template version always works; Anthropic version reads the photos (vision) when ANTHROPIC_API_KEY is set.
 * The summarizer never touches money: it only reads tasks whose state is "accepted".
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Ledger, Task } from "@agent-payroll/payout-orchestrator/src/model.js";

export interface JobResult {
  jobId: string;
  complete: boolean; // every task accepted
  answer: string; // markdown for the client
  items: { taskId: string; title: string; state: string; note?: string; takenAt?: string; file?: string }[];
}

export interface Summarizer {
  summarize(l: Ledger, jobId: string, uploadsDir: string): Promise<JobResult>;
}

function items(l: Ledger, jobId: string) {
  return Object.values(l.tasks)
    .filter((t) => t.jobId === jobId)
    .map((t) => {
      const ev = (t.submission?.evidence ?? {}) as { note?: string; file?: string; check?: { exif?: { takenAt?: string } } };
      return { taskId: t.id, title: t.title, state: t.state, note: ev.note, takenAt: ev.check?.exif?.takenAt, file: ev.file, task: t };
    });
}

export class TemplateSummarizer implements Summarizer {
  async summarize(l: Ledger, jobId: string, _uploadsDir?: string): Promise<JobResult> {
    const its = items(l, jobId);
    const complete = its.length > 0 && its.every((i) => i.state === "accepted");
    const lines = its.map((i) => `- **${i.title.replace(/^On-site photo: /, "")}** — ${i.state === "accepted" ? (i.note || "photo received") : `pending (${i.state})`}${i.takenAt ? ` · taken ${i.takenAt.slice(0, 16)}Z` : ""}`);
    return { jobId, complete, answer: `${complete ? "All locations checked." : "Partial results."}\n\n${lines.join("\n")}`, items: its.map(({ task: _t, ...rest }) => rest) };
  }
}

export class AnthropicSummarizer implements Summarizer {
  constructor(private readonly apiKey: string, private readonly fallback: Summarizer = new TemplateSummarizer()) {}
  async summarize(l: Ledger, jobId: string, uploadsDir: string): Promise<JobResult> {
    const base = await this.fallback.summarize(l, jobId, uploadsDir);
    const accepted = items(l, jobId).filter((i) => i.state === "accepted");
    if (!accepted.length) return base;
    try {
      const content: any[] = [{ type: "text", text: `Client asked: "${l.jobs[jobId]?.clientRef ? "see request" : ""}". For each location below, say in one line whether it is open and what notice (if any) is posted. Use only what is visible in the photo and the worker's note. If unclear, say so.` }];
      for (const i of accepted) {
        content.push({ type: "text", text: `Location: ${i.title.replace(/^On-site photo: /, "")}. Worker note: ${i.note || "(none)"}.` });
        const p = i.file ? join(uploadsDir, i.file) : "";
        if (p && existsSync(p)) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: readFileSync(p).toString("base64") } });
      }
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 600, messages: [{ role: "user", content }] }),
      });
      const j = (await res.json()) as { content?: { text?: string }[] };
      const text = j.content?.map((c) => c.text ?? "").join("\n").trim();
      return text ? { ...base, answer: text + (base.complete ? "" : "\n\n_(some tasks still pending)_") } : base;
    } catch {
      return base;
    }
  }
}

export function taskSummaryLine(t: Task): string {
  return `${t.title} [${t.state}]`;
}
