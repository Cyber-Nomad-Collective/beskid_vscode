/**
 * Server crash reports. The server catches a panic per request or notification,
 * writes `~/.beskid/crash/lsp-<time>.txt` and sends `beskid/crashReport`
 * with `{ reportPath, summary, method }`.
 * The extension shows one notification per distinct report, and only for a
 * `lsp-*.txt` file directly in the crash directory (real paths, so a symlink
 * or `..` cannot point elsewhere). No `vscode` import.
 */

import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join } from "node:path";

export const CRASH_REPORT_METHOD = "beskid/crashReport";
export const OPEN_REPORT_ACTION = "Open report";

export type CrashReport = { path: string; summary: string };

export function parseCrashReport(params: unknown): CrashReport | undefined {
	if (!params || typeof params !== "object") {
		return undefined;
	}
	const { reportPath, summary } = params as Record<string, unknown>;
	if (typeof reportPath !== "string" || reportPath.length === 0) {
		return undefined;
	}
	return { path: reportPath, summary: typeof summary === "string" ? summary : "" };
}

/** `~/.beskid/crash` */
export function defaultCrashDir(): string {
	return join(homedir(), ".beskid", "crash");
}

const REPORT_NAME = /^lsp-[^/\\]+\.txt$/;

/**
 * The real path of `reportPath` when it is an `lsp-*.txt` file directly in
 * `crashDir` (both resolved to real paths), else undefined.
 */
export function trustedCrashReportPath(
	reportPath: string,
	crashDir: string,
	realpath: (path: string) => string = realpathSync,
): string | undefined {
	if (!isAbsolute(reportPath) || !REPORT_NAME.test(basename(reportPath))) {
		return undefined;
	}
	let real: string;
	let realDir: string;
	try {
		real = realpath(reportPath);
		realDir = realpath(crashDir);
	} catch {
		return undefined;
	}
	if (dirname(real) !== realDir || !REPORT_NAME.test(basename(real))) {
		return undefined;
	}
	return real;
}

export type CrashReportUi = {
	showError: (
		message: string,
		...actions: string[]
	) => PromiseLike<string | undefined>;
	openFile: (path: string) => PromiseLike<unknown>;
};

export class CrashReportNotifier {
	private readonly seen = new Set<string>();

	constructor(
		private readonly ui: CrashReportUi,
		private readonly crashDir: string,
		private readonly realpath: (path: string) => string = realpathSync,
	) {}

	/**
	 * Returns true when a notification was shown (false for a repeated or
	 * malformed report, or one outside the crash directory).
	 */
	async handle(params: unknown): Promise<boolean> {
		const parsed = parseCrashReport(params);
		const path = parsed && trustedCrashReportPath(parsed.path, this.crashDir, this.realpath);
		if (!parsed || !path || this.seen.has(path)) {
			return false;
		}
		this.seen.add(path);
		const report = { ...parsed, path };
		const detail = report.summary ? `: ${report.summary}` : ".";
		const choice = await this.ui.showError(
			`The Beskid language server hit an internal error${detail} It keeps running.`,
			OPEN_REPORT_ACTION,
		);
		if (choice === OPEN_REPORT_ACTION) {
			try {
				await this.ui.openFile(report.path);
			} catch {
				// The report may have been removed since; nothing more to show.
			}
		}
		return true;
	}
}
