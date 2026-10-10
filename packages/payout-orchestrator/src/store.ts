import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { emptyLedger, type Ledger } from "./model.js";

/** Minimal crash-safe JSON persistence: write temp, fsync-free rename. Good enough for a hackathon, replace with SQLite later. */
export class FileStore {
  private readonly file: string;
  private ledger: Ledger;
  constructor(dir: string) {
    mkdirSync(dir, { recursive: true });
    this.file = join(dir, "ledger.json");
    this.ledger = existsSync(this.file) ? (JSON.parse(readFileSync(this.file, "utf8")) as Ledger) : emptyLedger();
  }
  get(): Ledger {
    return this.ledger;
  }
  /** Mutate under a callback and persist atomically. */
  update<T>(fn: (l: Ledger) => T): T {
    const out = fn(this.ledger);
    const tmp = this.file + ".tmp";
    writeFileSync(tmp, JSON.stringify(this.ledger, null, 2));
    renameSync(tmp, this.file);
    return out;
  }
}

export class MemoryStore extends FileStore {
  private mem: Ledger = emptyLedger();
  constructor() {
    super(join(process.cwd(), ".tmp-memstore-" + process.pid));
  }
  override get(): Ledger {
    return this.mem;
  }
  override update<T>(fn: (l: Ledger) => T): T {
    return fn(this.mem);
  }
}
