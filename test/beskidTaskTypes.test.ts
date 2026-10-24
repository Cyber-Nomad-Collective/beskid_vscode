import { describe, expect, test } from "bun:test";
import {
	BESKID_TASK_TYPES,
	taskBelongsToProvider,
	taskSpecsForType,
} from "../src/cli/beskidTaskTypes.js";

describe("task providers return only their own type", () => {
	for (const type of Object.keys(BESKID_TASK_TYPES)) {
		test(`${type} offers exactly one task of ${type}`, () => {
			const specs = taskSpecsForType(type, "${workspaceFolder}");
			expect(specs.length).toBe(1);
			expect(specs.every((spec) => spec.definition.type === type)).toBe(true);
			expect(specs[0].operation).toBe(BESKID_TASK_TYPES[type]);
		});
	}

	test("an unknown type offers nothing", () => {
		expect(taskSpecsForType("beskid-other", "x")).toEqual([]);
	});

	test("a provider resolves only tasks of its type", () => {
		expect(taskBelongsToProvider("beskid-test", "beskid-test")).toBe(true);
		expect(taskBelongsToProvider("beskid-test", "beskid-fetch")).toBe(false);
		expect(taskBelongsToProvider("beskid-test", undefined)).toBe(false);
		expect(taskBelongsToProvider("shell", "shell")).toBe(false);
	});
});
