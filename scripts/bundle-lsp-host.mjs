import { chmodSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const extRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(extRoot, "..");
const compilerRoot = join(repoRoot, "compiler");

function detectPlatformArch() {
  const platform =
    process.platform === "linux" || process.platform === "darwin" || process.platform === "win32"
      ? process.platform
      : undefined;
  const arch = process.arch === "x64" || process.arch === "arm64" ? process.arch : undefined;
  if (!platform || !arch) {
    throw new Error(`Unsupported host platform: ${process.platform}-${process.arch}`);
  }
  return { platform, arch, key: `${platform}-${arch}` };
}

function main() {
  if (!existsSync(join(compilerRoot, "Cargo.toml"))) {
    throw new Error(
      `Compiler workspace not found at ${compilerRoot}. Clone the superrepo with the compiler submodule.`,
    );
  }

  const { platform, key } = detectPlatformArch();
  const binaryName = platform === "win32" ? "beskid_lsp.exe" : "beskid_lsp";
  const destDir = join(extRoot, "server", key);
  const destPath = join(destDir, binaryName);

  execSync("cargo build -p beskid_lsp --release", { cwd: compilerRoot, stdio: "inherit" });

  const builtPath = join(compilerRoot, "target", "release", binaryName);
  if (!existsSync(builtPath)) {
    throw new Error(`Expected LSP binary at ${builtPath}`);
  }

  mkdirSync(destDir, { recursive: true });
  copyFileSync(builtPath, destPath);
  if (platform !== "win32") {
    chmodSync(destPath, 0o755);
  }

  console.log(`Bundled ${binaryName} to ${destPath}`);
}

main();
