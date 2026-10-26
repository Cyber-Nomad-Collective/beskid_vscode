import { describe, expect, test } from "bun:test";
import {
	parseFailedTests,
	testDiagnostics,
} from "../src/cli/testFailures.js";

const record = (tests: unknown[]) =>
	JSON.stringify({ schemaVersion: 1, command: "test", event: "result", status: "failure", target: "app", summary: {}, tests });

const sample = [
	'{"schemaVersion":1,"command":"test","event":"progress","status":"ok"}',
	record([
		{ name: "Passes", qualified_name: "Main.Passes", outcome: "passed" },
		{
			name: "AddsNumbers",
			qualified_name: "Main.AddsNumbers",
			outcome: "failed",
			reason: "assertion failed: expected 3, found 4",
			failure: {
				kind: "assertion",
				headline: "expected 3, found 4",
				because: "adds",
				expected: "3",
				actual: "4",
				location: { file: "Src/Main.bd", line: 17, column: 5 },
			},
		},
		{
			name: "Divides",
			qualified_name: "Main.Divides",
			outcome: "failed",
			failure: {
				kind: "crash",
				trap: "unreachable_or_isle_invariant",
				reason: "division by zero",
				location: { file: "/abs/Src/Math.bd", line: 6, column: 3 },
			},
		},
		{
			name: "Unlocated",
			qualified_name: "Main.Unlocated",
			outcome: "failed",
			failure: { kind: "crash", reason: "boom" },
		},
	]),
].join("\n");

describe("beskid test --json failures", () => {
	test("parses only failed tests with their failure objects", () => {
		const failed = parseFailedTests(sample);
		expect(failed.map((f) => f.name)).toEqual(["AddsNumbers", "Divides", "Unlocated"]);
		expect(failed[0].failure).toMatchObject({ kind: "assertion", because: "adds" });
		expect(failed[0].failure).not.toHaveProperty("locationIsCallSite");
		expect(failed[1].failure).toEqual({
			kind: "crash",
			trap: "unreachable_or_isle_invariant",
			reason: "division by zero",
			location: { file: "/abs/Src/Math.bd", line: 6, column: 3 },
		});
	});

	test("ignores non-JSON lines and other events", () => {
		expect(parseFailedTests("warning: x\n{not json}\n")).toEqual([]);
	});

	test("an assertion is reported at failure.location with headline, because, expected and actual", () => {
		const diags = testDiagnostics(parseFailedTests(sample), "/p");
		expect(diags[0]).toEqual({
			file: "/p/Src/Main.bd",
			line: 17,
			column: 5,
			message: "AddsNumbers: expected 3, found 4\nbecause adds\nexpected: 3\nactual: 4",
		});
	});

	test("a crash is reported at failure.location", () => {
		const diags = testDiagnostics(parseFailedTests(sample), "/p");
		expect(diags[1]).toEqual({
			file: "/abs/Src/Math.bd",
			line: 6,
			column: 3,
			message: "Divides: test crashed: division by zero (unreachable_or_isle_invariant)",
		});
	});

	test("a failure without a location yields no diagnostic", () => {
		expect(testDiagnostics(parseFailedTests(sample), "/p")).toHaveLength(2);
	});
});
