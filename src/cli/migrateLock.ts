import { fileURLToPath } from "node:url";

/**
 * Argument the "Migrate lock file" quick fix passes to `beskid.migrateLock`:
 * a uri string, `{ uri }`, or `{ fsPath }`. Returns the file path of a project
 * manifest or `Project.lock`, or undefined so the caller uses the focused project.
 */
export function migrateLockTargetPath(target: unknown): string | undefined {
	let raw: string | undefined;
	if (typeof target === "string") {
		raw = target;
	} else if (target && typeof target === "object") {
		const record = target as { uri?: unknown; fsPath?: unknown };
		if (typeof record.uri === "string") {
			raw = record.uri;
		} else if (typeof record.fsPath === "string") {
			raw = record.fsPath;
		}
	}
	if (!raw) {
		return undefined;
	}
	let path = raw;
	if (raw.startsWith("file:")) {
		try {
			path = fileURLToPath(raw);
		} catch {
			return undefined;
		}
	}
	return /(\.bproj|[\\/]Project\.lock)$/i.test(path) ? path : undefined;
}
