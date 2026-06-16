import type { LspCommandResult } from "./lspExecuteCommand.js";

/** Typed success/error result for extension ↔ LSP execute-command boundaries. */
export type LspOutcome<T> = { ok: true; value: T } | { ok: false; error: string };

export function fromLspCommandResult<T>(result: LspCommandResult<T>): LspOutcome<T> {
  if (result.ok) {
    return { ok: true, value: result.value };
  }
  return { ok: false, error: result.error.message };
}

/** Convenience for callers that treat a failed command as absent data. */
export function unwrapLspOutcome<T>(outcome: LspOutcome<T>): T | undefined {
  return outcome.ok ? outcome.value : undefined;
}
