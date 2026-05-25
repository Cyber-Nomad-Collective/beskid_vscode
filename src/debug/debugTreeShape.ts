import type { LspRuntimeSnapshot } from "../runtime/lspRuntimeTypes.js";

export type DebugTreeRow = { label: string; value: string };

export function formatDebugTreeValue(value: string | undefined): string {
  return value?.trim() ? value : "—";
}

export function runtimeDebugRows(snapshot: LspRuntimeSnapshot): DebugTreeRow[] {
  return [
    { label: "Phase", value: formatDebugTreeValue(snapshot.phase) },
    { label: "Detail", value: formatDebugTreeValue(snapshot.detail) },
    { label: "Error", value: formatDebugTreeValue(snapshot.error) },
    { label: "CLI version", value: formatDebugTreeValue(snapshot.cliVersion) },
    { label: "LSP version", value: formatDebugTreeValue(snapshot.lspVersion) },
    {
      label: "Scan",
      value: snapshot.scan.active
        ? formatDebugTreeValue(
            `${snapshot.scan.current ?? "?"}/${snapshot.scan.total ?? "?"} ${snapshot.scan.message ?? ""}`.trim(),
          )
        : "inactive",
    },
    {
      label: "Package activity",
      value: snapshot.pckgActivity?.active
        ? formatDebugTreeValue(
            `${snapshot.pckgActivity.phase}${snapshot.pckgActivity.message ? ` — ${snapshot.pckgActivity.message}` : ""}`,
          )
        : "none",
    },
  ];
}

export function launchDebugRows(snapshot: LspRuntimeSnapshot): DebugTreeRow[] {
  const launch = snapshot.launch;
  if (!launch) {
    return [{ label: "Launch", value: "not resolved yet" }];
  }
  return [
    { label: "Source", value: formatDebugTreeValue(launch.source) },
    { label: "Command", value: formatDebugTreeValue(launch.command) },
    { label: "Args", value: formatDebugTreeValue(launch.args.join(" ")) },
    { label: "CWD", value: formatDebugTreeValue(launch.cwd) },
    { label: "Binary", value: formatDebugTreeValue(launch.binaryPath) },
  ];
}
