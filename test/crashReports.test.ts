import { describe, expect, test } from "bun:test";
import {
	CRASH_REPORT_METHOD,
	CrashReportNotifier,
	OPEN_REPORT_ACTION,
	parseCrashReport,
} from "../src/lsp/crashReports.js";

function harness(answer: string | undefined) {
	const shown: { message: string; actions: string[] }[] = [];
	const opened: string[] = [];
	const notifier = new CrashReportNotifier({
		showError: async (message, ...actions) => {
			shown.push({ message, actions });
			return answer;
		},
		openFile: async (path) => {
			opened.push(path);
		},
	});
	return { notifier, shown, opened };
}

describe("beskid/crashReport", () => {
	test("method name", () => {
		expect(CRASH_REPORT_METHOD).toBe("beskid/crashReport");
	});

	test("parses the payload and rejects malformed ones", () => {
		expect(parseCrashReport({ reportPath: "/c/a.txt", summary: "boom" })).toEqual({
			path: "/c/a.txt",
			summary: "boom",
		});
		expect(parseCrashReport({ summary: "x", path: "/p" })).toBeUndefined();
		expect(parseCrashReport(null)).toBeUndefined();
		expect(parseCrashReport({ reportPath: "" })).toBeUndefined();
	});

	test("one notification per report, with an Open report action", async () => {
		const { notifier, shown, opened } = harness(OPEN_REPORT_ACTION);
		const report = { reportPath: "/c/lsp-1.txt", summary: "panic in hover" };
		expect(await notifier.handle(report)).toBe(true);
		expect(await notifier.handle(report)).toBe(false);
		expect(await notifier.handle({ reportPath: "/c/lsp-2.txt", summary: "again" })).toBe(true);
		expect(shown.length).toBe(2);
		expect(shown[0].actions).toEqual([OPEN_REPORT_ACTION]);
		expect(shown[0].message).toContain("panic in hover");
		expect(opened).toEqual(["/c/lsp-1.txt", "/c/lsp-2.txt"]);
	});

	test("dismissing the notification opens nothing", async () => {
		const { notifier, opened } = harness(undefined);
		await notifier.handle({ reportPath: "/c/lsp-3.txt", summary: "" });
		expect(opened).toEqual([]);
	});

	test("a missing report file does not throw", async () => {
		const notifier = new CrashReportNotifier({
			showError: async () => OPEN_REPORT_ACTION,
			openFile: async () => {
				throw new Error("ENOENT");
			},
		});
		expect(await notifier.handle({ reportPath: "/gone", summary: "" })).toBe(true);
	});
});
