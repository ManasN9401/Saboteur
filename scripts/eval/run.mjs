// Runs a TypeScript eval script with the app's module aliases: node scripts/eval/run.mjs <script.ts> [args]
import { createJiti } from "jiti";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Keys come from the same files Next.js reads; anything already in the environment wins.
for (const file of [".env.local", ".env"]) {
  let text = "";
  try {
    text = readFileSync(path.join(root, file), "utf8");
  } catch {
    continue;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
const jiti = createJiti(import.meta.url, {
  alias: { "@": root, "server-only": path.join(root, "test/server-only-stub.ts") },
});
await jiti.import(path.resolve(process.argv[2]));
