import { rmSync } from "node:fs";
import { listStaleExtensionFolders } from "./staleExtensions.js";
import type { ServerSelection } from "./toolchainSelection.js";

export type RemovalPlan = { files: string[]; folders: string[] };

export function planStaleRemoval(
	selection: ServerSelection,
	extensionsDir: string,
	currentVersion: string,
): RemovalPlan {
	return {
		files: selection.stale?.files ?? [],
		folders: listStaleExtensionFolders(extensionsDir, currentVersion),
	};
}

export function describeRemovalPlan(plan: RemovalPlan): string {
	const lines: string[] = [];
	if (plan.files.length > 0) {
		lines.push("Stale toolchain files:", ...plan.files.map((f) => `  ${f}`));
	}
	if (plan.folders.length > 0) {
		lines.push("Old Beskid extension folders:", ...plan.folders.map((f) => `  ${f}`));
	}
	return lines.join("\n");
}

/** Deletes exactly the planned paths; `beskid-up` and other files in `~/.beskid/bin` stay. */
export function applyRemovalPlan(
	plan: RemovalPlan,
	remove: (path: string) => void = (path) =>
		rmSync(path, { recursive: true, force: true }),
): void {
	for (const path of [...plan.files, ...plan.folders]) {
		remove(path);
	}
}
