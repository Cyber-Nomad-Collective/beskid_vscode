import { execSync } from "node:child_process";

if (process.env.BESKID_VSCODE_SKIP_PREBUILD === "1") {
  process.exit(0);
}

execSync("bun run build", { stdio: "inherit" });
