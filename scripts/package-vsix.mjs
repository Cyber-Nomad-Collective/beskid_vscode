import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(command, env = {}) {
  execSync(command, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
}

mkdirSync(join(root, "dist"), { recursive: true });

run("node scripts/bundle-lsp-host.mjs");
run("bun run build");
run("npm prune --omit=dev");

try {
  run("bunx @vscode/vsce package --out dist/beskid.vsix", {
    BESKID_VSCODE_SKIP_PREBUILD: "1",
  });
} finally {
  run("bun install");
}
