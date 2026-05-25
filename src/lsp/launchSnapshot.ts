import type { Executable } from "vscode-languageclient/node";
import type { LspLaunchSnapshot, LspLaunchSource } from "../runtime/lspRuntimeTypes.js";

function inferSource(command: string, args: string[]): LspLaunchSource {
  if (args.includes("lsp")) {
    return "cli";
  }
  if (command === "cargo" || args.includes("beskid_lsp")) {
    return "dev-cargo";
  }
  if (args.length === 0) {
    return "explicit";
  }
  return "bundled";
}

export function launchSnapshotFromExecutable(run: Executable): LspLaunchSnapshot {
  const command = run.command;
  const args = run.args ?? [];
  const cwd = run.options?.cwd;
  return {
    command,
    args,
    cwd,
    source: inferSource(command, args),
    binaryPath: args.includes("lsp") ? command : command,
  };
}
