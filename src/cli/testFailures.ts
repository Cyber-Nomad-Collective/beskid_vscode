import { isAbsolute, join } from "node:path";

/**
 * Failures reported by `beskid test --json`. Pure module: no `vscode` import.
 * The command prints one JSON record per line; the `result` record carries
 * `tests[]`, and a failed test carries a `failure` object.
 */

export type TestLocation = { file: string; line: number; column: number };

export type TestFailure =
	| {
			kind: "assertion";
			headline: string;
			because?: string;
			expected?: string;
			actual?: string;
			location?: TestLocation;
			locationIsCallSite: boolean;
	  }
	| { kind: "crash"; trap?: string; reason: string };

export type FailedTest = {
	name: string;
	qualifiedName: string;
	failure: TestFailure | undefined;
	reason?: string;
};

function str(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function parseLocation(value: unknown): TestLocation | undefined {
	if (!value || typeof value !== "object") {
		return undefined;
	}
	const { file, line, column } = value as Record<string, unknown>;
	if (typeof file !== "string" || typeof line !== "number") {
		return undefined;
	}
	return { file, line, column: typeof column === "number" ? column : 1 };
}

function parseFailure(value: unknown): TestFailure | undefined {
	if (!value || typeof value !== "object") {
		return undefined;
	}
	const record = value as Record<string, unknown>;
	if (record.kind === "assertion") {
		return {
			kind: "assertion",
			headline: str(record.headline) ?? "assertion failed",
			because: str(record.because),
			expected: str(record.expected),
			actual: str(record.actual),
			location: parseLocation(record.location),
			locationIsCallSite: record.location_is_call_site === true,
		};
	}
	if (record.kind === "crash") {
		return {
			kind: "crash",
			trap: str(record.trap),
			reason: str(record.reason) ?? "test crashed",
		};
	}
	return undefined;
}

/** Failed tests of every `result` record in the stdout of `beskid test --json`. */
export function parseFailedTests(stdout: string): FailedTest[] {
	const failed: FailedTest[] = [];
	for (const line of stdout.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed.startsWith("{")) {
			continue;
		}
		let record: unknown;
		try {
			record = JSON.parse(trimmed);
		} catch {
			continue;
		}
		const tests = (record as { event?: unknown; tests?: unknown }).tests;
		if (
			(record as { event?: unknown }).event !== "result" ||
			!Array.isArray(tests)
		) {
			continue;
		}
		for (const test of tests) {
			if (!test || typeof test !== "object") {
				continue;
			}
			const t = test as Record<string, unknown>;
			if (t.outcome !== "failed") {
				continue;
			}
			failed.push({
				name: str(t.name) ?? "",
				qualifiedName: str(t.qualified_name) ?? str(t.name) ?? "",
				failure: parseFailure(t.failure),
				reason: str(t.reason),
			});
		}
	}
	return failed;
}

export type TestDiagnostic = {
	file: string;
	/** 1-based */
	line: number;
	/** 1-based */
	column: number;
	message: string;
};

export function assertionMessage(
	failure: Extract<TestFailure, { kind: "assertion" }>,
): string {
	const lines = [failure.headline];
	if (failure.because) {
		lines.push(`because ${failure.because}`);
	}
	if (failure.expected !== undefined) {
		lines.push(`expected: ${failure.expected}`);
	}
	if (failure.actual !== undefined) {
		lines.push(`actual: ${failure.actual}`);
	}
	return lines.join("\n");
}

export type DeclarationSource = { path: string; text: string };

/** Position of `test <Name>` in the given sources (1-based), or undefined. */
export function findTestDeclaration(
	name: string,
	sources: readonly DeclarationSource[],
): { file: string; line: number; column: number } | undefined {
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const pattern = new RegExp(`^(\\s*)test\\s+(${escaped})\\b`);
	for (const source of sources) {
		const lines = source.text.split(/\r?\n/);
		for (let i = 0; i < lines.length; i += 1) {
			const match = pattern.exec(lines[i]);
			if (match) {
				return { file: source.path, line: i + 1, column: match[1].length + 1 };
			}
		}
	}
	return undefined;
}

/**
 * Error diagnostics for failed tests. An assertion is shown at `failure.location`
 * (the Assert call, or the test declaration when the CLI could not find the call);
 * a crash is shown on the test declaration, found in `sources`.
 */
export function testDiagnostics(
	failed: readonly FailedTest[],
	baseDir: string,
	sources: readonly DeclarationSource[],
): TestDiagnostic[] {
	const out: TestDiagnostic[] = [];
	for (const test of failed) {
		const failure = test.failure;
		if (failure?.kind === "assertion" && failure.location) {
			const { file, line, column } = failure.location;
			out.push({
				file: isAbsolute(file) ? file : join(baseDir, file),
				line,
				column,
				message: `${test.name}: ${assertionMessage(failure)}`,
			});
			continue;
		}
		const declaration = findTestDeclaration(test.name, sources);
		if (!declaration) {
			continue;
		}
		const detail =
			failure?.kind === "crash"
				? `test crashed: ${failure.reason}${failure.trap ? ` (${failure.trap})` : ""}`
				: failure?.kind === "assertion"
					? assertionMessage(failure)
					: (test.reason ?? "test failed");
		out.push({ ...declaration, message: `${test.name}: ${detail}` });
	}
	return out;
}
