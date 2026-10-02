import { execSync } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  bundleExactHostLsp,
  bundleVerifiedReleaseLsp,
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

const { platformKey, version } = process.env.BESKID_EDITOR_LSP_ARTIFACT
  ? bundleVerifiedReleaseLsp({
      extensionRoot: root, repoRoot,
      platformKey: process.env.BESKID_EDITOR_PLATFORM,
      artifactPath: process.env.BESKID_EDITOR_LSP_ARTIFACT,
      sha256: process.env.BESKID_EDITOR_LSP_SHA256,
      version: process.env.BESKID_EDITOR_RELEASE_VERSION,
    })
  : bundleExactHostLsp({ extensionRoot: root, repoRoot });
const vsixName = versionedVsixName(version, platformKey);
const vsixPath = join("dist", vsixName);
for (const entry of readdirSync(join(root, "server"))) {
  if (entry !== platformKey) throw new Error(`Unexpected server payload ${entry}; stage only ${platformKey} before packaging`);
}
run("bun run build");
run("npm prune --omit=dev");

try {
  run(`bunx @vscode/vsce package --target ${platformKey} --out ${vsixPath}`, {
    BESKID_VSCODE_SKIP_PREBUILD: "1",
  });
} finally {
  run("bun install");
}

console.log(`Created ${vsixPath}`);
