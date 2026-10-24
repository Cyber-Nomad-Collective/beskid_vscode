/**
 * Server crash reports. The server catches a panic per request or notification,
 * writes `~/.beskid/crash/lsp-<time>.txt` and sends `beskid/crashReport`.
 * The extension shows one notification per distinct report. Pure module.
 */

export const CRASH_REPORT_METHOD = "beskid/crashReport";
export const OPEN_REPORT_ACTION = "Open report";

export type CrashReport = { path: string; summary: string };

export function parseCrashReport(params: unknown): CrashReport | undefined {
	if (!params || typeof params !== "object") {
		return undefined;
	}
	const { path, summary } = params as Record<string, unknown>;
	if (typeof path !== "string" || path.length === 0) {
		return undefined;
	}
	return { path, summary: typeof summary === "string" ? summary : "" };
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

	constructor(private readonly ui: CrashReportUi) {}

	/** Returns true when a notification was shown (false for a repeated or malformed report). */
	async handle(params: unknown): Promise<boolean> {
		const report = parseCrashReport(params);
		if (!report || this.seen.has(report.path)) {
			return false;
		}
		this.seen.add(report.path);
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
