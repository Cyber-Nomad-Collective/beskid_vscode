import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "mermaid", "dist", "mermaid.min.js");
const targetDir = join(root, "media", "graph");
const target = join(targetDir, "mermaid.min.js");

if (!existsSync(source)) {
  console.error("[bundle-mermaid] mermaid not installed — run bun install in beskid_vscode");
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);
console.log("[bundle-mermaid] copied mermaid.min.js to media/graph/");
