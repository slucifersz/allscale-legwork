/** Write ALLSCALE_API_KEY / ALLSCALE_API_SECRET into .env safely (no sed, no editor). Input is read from stdin, not echoed. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline";

function ask(q: string): Promise<string> {
  return new Promise((res) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    process.stdout.write(q);
    (rl as any)._writeToOutput = () => {}; // hide typed characters
    rl.question("", (a) => { rl.close(); process.stdout.write("\n"); res(a.trim()); });
  });
}

const file = ".env";
const key = await ask("paste API key, then Enter: ");
const secret = await ask("paste API secret, then Enter: ");
if (!key || !secret) { console.error("empty input"); process.exit(1); }
let env = existsSync(file) ? readFileSync(file, "utf8") : readFileSync(".env.example", "utf8");
const set = (k: string, v: string) => { env = env.match(new RegExp(`^${k}=.*$`, "m")) ? env.replace(new RegExp(`^${k}=.*$`, "m"), `${k}=${v}`) : env + `\n${k}=${v}`; };
set("ALLSCALE_API_KEY", key);
set("ALLSCALE_API_SECRET", secret);
writeFileSync(file, env);
console.log(`written: key ${key.slice(0, 6)}… (${key.length} chars), secret ${secret.slice(0, 6)}… (${secret.length} chars)`);
