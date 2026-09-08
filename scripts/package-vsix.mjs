import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  bundleExactHostLsp,
  clearVsixArtifacts,
  versionedVsixName,
} from "./exact-release-bundle.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(root, "..");

function run(command, env = {}) {
  execSync(command, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
}

const distRoot = join(root, "dist");
mkdirSync(distRoot, { recursive: true });
clearVsixArtifacts(distRoot);

const { platformKey, version } = bundleExactHostLsp({ extensionRoot: root, repoRoot });
const vsixName = versionedVsixName(version, platformKey);
const vsixPath = join("dist", vsixName);
run("bun run build");
run("npm prune --omit=dev");

try {
  run(`bunx @vscode/vsce package --out ${vsixPath}`, {
    BESKID_VSCODE_SKIP_PREBUILD: "1",
  });
} finally {
  run("bun install");
}

console.log(`Created ${vsixPath}`);
