/** Directories the extension never reacts to: the server's cache and materialized sources, build output, tool state. */
const EXCLUDED_DIRECTORIES = ["obj", "target", ".beskid"] as const;

/** Globs equivalent to the exclusion, for APIs that take glob patterns. */
export const WATCH_EXCLUDE_GLOBS: readonly string[] = EXCLUDED_DIRECTORIES.map(
	(dir) => `**/${dir}/**`,
);

/** True when `fsPath` lies under an `obj`, `target` or `.beskid` directory at any depth. */
export function isExcludedWatchPath(fsPath: string): boolean {
	const segments = fsPath.split(/[\\/]+/);
	// The last segment is the file itself; only directory segments count.
	return segments
		.slice(0, -1)
		.some((segment) =>
			(EXCLUDED_DIRECTORIES as readonly string[]).includes(segment),
		);
}
