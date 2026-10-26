import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	CRASH_REPORT_METHOD,
	CrashReportNotifier,
	OPEN_REPORT_ACTION,
	parseCrashReport,
	trustedCrashReportPath,
} from "../src/lsp/crashReports.js";

const root = realpathSync(mkdtempSync(join(tmpdir(), "beskid-crash-")));
const crashDir = join(root, "crash");
mkdirSync(join(crashDir, "nested"), { recursive: true });
for (const name of ["lsp-1.txt", "lsp-2.txt", "lsp-3.txt", "other.txt", "nested/lsp-9.txt"]) {
	writeFileSync(join(crashDir, name), "report");
}
writeFileSync(join(root, "secret.txt"), "secret");
symlinkSync(join(root, "secret.txt"), join(crashDir, "lsp-link.txt"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

function harness(answer: string | undefined) {
	const shown: { message: string; actions: string[] }[] = [];
	const opened: string[] = [];
	const notifier = new CrashReportNotifier(
		{
			showError: async (message, ...actions) => {
				shown.push({ message, actions });
				return answer;
			},
			openFile: async (path) => {
				opened.push(path);
			},
		},
		crashDir,
	);
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
		const report = { reportPath: join(crashDir, "lsp-1.txt"), summary: "panic in hover" };
		expect(await notifier.handle(report)).toBe(true);
		expect(await notifier.handle(report)).toBe(false);
		expect(await notifier.handle({ reportPath: join(crashDir, "lsp-2.txt"), summary: "again" })).toBe(true);
		expect(shown.length).toBe(2);
		expect(shown[0].actions).toEqual([OPEN_REPORT_ACTION]);
		expect(shown[0].message).toContain("panic in hover");
		expect(opened).toEqual([join(crashDir, "lsp-1.txt"), join(crashDir, "lsp-2.txt")]);
	});

	test("dismissing the notification opens nothing", async () => {
		const { notifier, opened } = harness(undefined);
		await notifier.handle({ reportPath: join(crashDir, "lsp-3.txt"), summary: "" });
		expect(opened).toEqual([]);
	});

	test("a missing report file does not throw", async () => {
		const notifier = new CrashReportNotifier(
			{
				showError: async () => OPEN_REPORT_ACTION,
				openFile: async () => {
					throw new Error("ENOENT");
				},
			},
			crashDir,
		);
		expect(await notifier.handle({ reportPath: join(crashDir, "lsp-1.txt"), summary: "" })).toBe(true);
	});

	test("opens only lsp-*.txt files directly in the crash directory", async () => {
		expect(trustedCrashReportPath(join(crashDir, "lsp-1.txt"), crashDir)).toBe(join(crashDir, "lsp-1.txt"));
		expect(trustedCrashReportPath(join(crashDir, "other.txt"), crashDir)).toBeUndefined();
		expect(trustedCrashReportPath(join(crashDir, "nested", "lsp-9.txt"), crashDir)).toBeUndefined();
		expect(trustedCrashReportPath(join(crashDir, "nested", "..", "..", "secret.txt"), crashDir)).toBeUndefined();
		expect(trustedCrashReportPath(join(crashDir, "lsp-link.txt"), crashDir)).toBeUndefined();
		expect(trustedCrashReportPath(join(crashDir, "lsp-missing.txt"), crashDir)).toBeUndefined();
		expect(trustedCrashReportPath("lsp-1.txt", crashDir)).toBeUndefined();

		const { notifier, shown, opened } = harness(OPEN_REPORT_ACTION);
		expect(await notifier.handle({ reportPath: join(root, "secret.txt"), summary: "x" })).toBe(false);
		expect(await notifier.handle({ reportPath: join(crashDir, "lsp-link.txt"), summary: "x" })).toBe(false);
		expect(shown).toEqual([]);
		expect(opened).toEqual([]);
	});
});
