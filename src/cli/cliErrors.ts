export type ToolchainErrorContext = Record<string, string | undefined>;

export function formatToolchainError(
  phase: string,
  error: unknown,
  context?: ToolchainErrorContext,
): string {
  const lines = [`[Beskid toolchain] ${phase} failed`];
  if (context) {
    for (const [key, value] of Object.entries(context)) {
      if (value) {
        lines.push(`  ${key}: ${value}`);
      }
    }
  }
  if (error instanceof Error) {
    lines.push(`  error: ${error.message}`);
    if (error.cause instanceof Error) {
      lines.push(`  cause: ${error.cause.message}`);
    }
    if (error.stack) {
      lines.push(error.stack);
    }
  } else {
    lines.push(`  error: ${String(error)}`);
  }
  return lines.join("\n");
}

export function appendToolchainFailure(
  outputChannel: { appendLine: (line: string) => void; show: (preserveFocus?: boolean) => void },
  phase: string,
  error: unknown,
  context?: ToolchainErrorContext,
): string {
  const detail = formatToolchainError(phase, error, context);
  outputChannel.appendLine(detail);
  outputChannel.show(true);
  return detail;
}
