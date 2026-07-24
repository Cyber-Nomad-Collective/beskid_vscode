import { describe, expect, test } from "bun:test";
import {
	isAuthHttpStatus,
	registryErrorMessage,
} from "../src/core/pckgErrors.js";

describe("pckgErrors", () => {
	test("isAuthHttpStatus detects 401 and 403", () => {
		expect(isAuthHttpStatus(401)).toBe(true);
		expect(isAuthHttpStatus(403)).toBe(true);
		expect(isAuthHttpStatus(404)).toBe(false);
	});

	test("registryErrorMessage maps auth failures", () => {
		expect(registryErrorMessage(401)).toContain("authentication");
		expect(registryErrorMessage(403)).toContain("API Key");
	});

	test("registryErrorMessage uses fallback for network errors", () => {
		expect(registryErrorMessage(undefined, "offline")).toBe("offline");
	});
});
