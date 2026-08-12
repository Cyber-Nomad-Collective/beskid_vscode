import { describe, expect, test } from "bun:test";
import {
	normalizeCliReleaseTag,
	normalizeLspReleaseTag,
	resolveCliReleaseTag,
	resolveLspReleaseTag,
	pinnedCliReleaseTag,
	pinnedLspReleaseTag,
} from "../src/cli/releaseTags.js";

describe("normalizeCliReleaseTag", () => {
	test("keeps rolling and pinned tags", () => {
		expect(normalizeCliReleaseTag("cli-stable")).toBe("cli-stable");
		expect(normalizeCliReleaseTag("cli-v0.1.77")).toBe("cli-v0.1.77");
	});

	test("maps bare semver to pinned GitHub tag", () => {
		expect(normalizeCliReleaseTag("0.1.77")).toBe("cli-v0.1.77");
		expect(normalizeCliReleaseTag("v0.1.77")).toBe("cli-v0.1.77");
	});

	test("accepts explicit aliases", () => {
		expect(normalizeCliReleaseTag("stable")).toBe("cli-stable");
		expect(normalizeCliReleaseTag("unstable")).toBe("cli-unstable");
	});

	test("keeps latest alias for legacy migration", () => {
		expect(normalizeCliReleaseTag("cli-latest")).toBe("cli-latest");
	});

	test("defaults empty to rolling tag", () => {
		expect(normalizeCliReleaseTag("")).toBe("cli-stable");
		expect(normalizeCliReleaseTag("   ")).toBe("cli-stable");
	});
});

describe("normalizeLspReleaseTag", () => {
	test("keeps rolling and pinned tags", () => {
		expect(normalizeLspReleaseTag("lsp-stable")).toBe("lsp-stable");
		expect(normalizeLspReleaseTag("lsp-v0.1.77")).toBe("lsp-v0.1.77");
	});

	test("maps bare semver to pinned GitHub tag", () => {
		expect(normalizeLspReleaseTag("0.1.77")).toBe("lsp-v0.1.77");
		expect(normalizeLspReleaseTag("v0.1.77")).toBe("lsp-v0.1.77");
	});

	test("accepts explicit aliases", () => {
		expect(normalizeLspReleaseTag("stable")).toBe("lsp-stable");
		expect(normalizeLspReleaseTag("unstable")).toBe("lsp-unstable");
	});

	test("keeps latest alias for legacy migration", () => {
		expect(normalizeLspReleaseTag("lsp-latest")).toBe("lsp-latest");
	});
});

describe("resolve rolling tags", () => {
	test("falls back from missing cli-stable to latest cli-v tag", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = ((input: RequestInfo | URL) => {
			const url = typeof input === "string" ? input : input.toString();
			if (url.includes("/releases/tags/cli-stable")) {
				return Promise.resolve(new Response(null, { status: 404 }));
			}
			if (url.includes("/releases?per_page=100")) {
				return Promise.resolve(
					new Response(
						JSON.stringify([
							{ tag_name: "cli-v0.4.111" },
							{ tag_name: "cli-v0.4.112" },
							{ tag_name: "cli-latest" },
						]),
						{ status: 200 },
					),
				);
			}
			throw new Error(`Unexpected request to ${url}`);
		}) as typeof fetch;

		try {
			await expect(resolveCliReleaseTag("cli-stable")).resolves.toBe(
				"cli-v0.4.112",
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("prefers latest cli-v tag even when cli-stable exists (legacy alias)", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = ((input: RequestInfo | URL) => {
			const url = typeof input === "string" ? input : input.toString();
			if (url.includes("/releases/tags/cli-stable")) {
				return Promise.resolve(new Response(null, { status: 200 }));
			}
			if (url.includes("/releases?per_page=100")) {
				return Promise.resolve(
					new Response(
						JSON.stringify([
							{ tag_name: "cli-v0.1.77" },
							{ tag_name: "cli-v0.4.111" },
							{ tag_name: "cli-v0.4.112" },
							{ tag_name: "cli-latest" },
						]),
						{ status: 200 },
					),
				);
			}
			throw new Error(`Unexpected request to ${url}`);
		}) as typeof fetch;

		try {
			await expect(resolveCliReleaseTag("cli-stable")).resolves.toBe(
				"cli-v0.4.112",
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("falls back from missing lsp-stable to latest lsp-v tag", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = ((input: RequestInfo | URL) => {
			const url = typeof input === "string" ? input : input.toString();
			if (url.includes("/releases/tags/lsp-stable")) {
				return Promise.resolve(new Response(null, { status: 404 }));
			}
			if (url.includes("/releases?per_page=100")) {
				return Promise.resolve(
					new Response(
						JSON.stringify([
							{ tag_name: "lsp-v0.4.111" },
							{ tag_name: "lsp-v0.4.112" },
						]),
						{ status: 200 },
					),
				);
			}
			throw new Error(`Unexpected request to ${url}`);
		}) as typeof fetch;

		try {
			await expect(resolveLspReleaseTag("lsp-stable")).resolves.toBe(
				"lsp-v0.4.112",
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("resolves preferred major pinned stream when first release page only has other majors", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = ((input: RequestInfo | URL) => {
			const url = typeof input === "string" ? input : input.toString();
			if (url.includes("/releases/tags/cli-stable")) {
				return Promise.resolve(new Response(null, { status: 404 }));
			}
			if (url.includes("/releases?per_page=100&page=1")) {
				return Promise.resolve(
					new Response(
						JSON.stringify([
							{ tag_name: "cli-v1.0.77" },
							{ tag_name: "cli-v1.0.78" },
							...Array.from({ length: 98 }, () => ({ tag_name: "cli-latest" })),
						]),
						{ status: 200 },
					),
				);
			}
			if (url.includes("/releases?per_page=100&page=2")) {
				return Promise.resolve(
					new Response(
						JSON.stringify([
							{ tag_name: "cli-v0.4.112" },
							{ tag_name: "cli-v0.4.111" },
						]),
						{ status: 200 },
					),
				);
			}
			if (url.includes("/releases?per_page=100")) {
				throw new Error(`Unexpected request to ${url}`);
			}
			throw new Error(`Unexpected request to ${url}`);
		}) as typeof fetch;

		try {
			await expect(resolveCliReleaseTag("cli-stable")).resolves.toBe(
				"cli-v0.4.112",
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("does not fall back to rolling tag when no preferred major pinned stream exists", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = ((input: RequestInfo | URL) => {
			const url = typeof input === "string" ? input : input.toString();
			if (url.includes("/releases/tags/cli-stable")) {
				return Promise.resolve(new Response(null, { status: 200 }));
			}
			if (url.includes("/releases?per_page=100")) {
				return Promise.resolve(
					new Response(
						JSON.stringify([
							{ tag_name: "cli-v1.0.77" },
							{ tag_name: "cli-v1.0.78" },
						]),
						{ status: 200 },
					),
				);
			}
			throw new Error(`Unexpected request to ${url}`);
		}) as typeof fetch;

		try {
			await expect(resolveCliReleaseTag("cli-stable")).rejects.toThrow(
				"No cli-v* releases were found for rolling channel cli-stable.",
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("collects all release pages when resolving preferred major so stale major-0 results do not win", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = ((input: RequestInfo | URL) => {
			const url = typeof input === "string" ? input : input.toString();
			if (url.includes("/releases/tags/cli-stable")) {
				return Promise.resolve(new Response(null, { status: 404 }));
			}
			if (url.includes("/releases?per_page=100&page=1")) {
				return Promise.resolve(
					new Response(
						JSON.stringify([
							{ tag_name: "cli-v0.1.77" },
							{ tag_name: "cli-v0.1.78" },
							...Array.from({ length: 98 }, () => ({ tag_name: "cli-latest" })),
						]),
						{ status: 200 },
					),
				);
			}
			if (url.includes("/releases?per_page=100&page=2")) {
				return Promise.resolve(
					new Response(
						JSON.stringify([
							{ tag_name: "cli-v0.4.112" },
							{ tag_name: "cli-v0.4.113" },
						]),
						{ status: 200 },
					),
				);
			}
			if (url.includes("/releases?per_page=100&page=3")) {
				return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
			}
			if (url.includes("/releases?per_page=100")) {
				throw new Error(`Unexpected request to ${url}`);
			}
			throw new Error(`Unexpected request to ${url}`);
		}) as typeof fetch;

		try {
			await expect(resolveCliReleaseTag("cli-stable")).resolves.toBe(
				"cli-v0.4.113",
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test.each(["1", "1.0.77", "cli-v1.0.77"])(
		"migrates legacy CLI pin %s to the latest supported rolling release",
		async (legacyPin) => {
			const originalFetch = globalThis.fetch;
			globalThis.fetch = ((input: RequestInfo | URL) => {
				const url = typeof input === "string" ? input : input.toString();
				if (url.includes("/releases?per_page=100&page=1")) {
					return Promise.resolve(
						new Response(
							JSON.stringify([
								{ tag_name: "cli-v1.0.77" },
								{ tag_name: "cli-v0.4.114" },
								{ tag_name: "cli-v0.4.115" },
							]),
							{ status: 200 },
						),
					);
				}
				throw new Error(`Unexpected request to ${url}`);
			}) as typeof fetch;

			try {
				await expect(resolveCliReleaseTag(legacyPin)).resolves.toBe("cli-v0.4.115");
			} finally {
				globalThis.fetch = originalFetch;
			}
		},
	);

	test.each(["1", "1.0.77", "lsp-v1.0.77"])(
		"migrates legacy LSP pin %s to the latest supported rolling release",
		async (legacyPin) => {
			const originalFetch = globalThis.fetch;
			globalThis.fetch = ((input: RequestInfo | URL) => {
				const url = typeof input === "string" ? input : input.toString();
				if (url.includes("/releases?per_page=100&page=1")) {
					return Promise.resolve(
						new Response(
							JSON.stringify([
								{ tag_name: "lsp-v1.0.77" },
								{ tag_name: "lsp-v0.4.114" },
								{ tag_name: "lsp-v0.4.115" },
							]),
							{ status: 200 },
						),
					);
				}
				throw new Error(`Unexpected request to ${url}`);
			}) as typeof fetch;

			try {
				await expect(resolveLspReleaseTag(legacyPin)).resolves.toBe("lsp-v0.4.115");
			} finally {
				globalThis.fetch = originalFetch;
			}
		},
	);
	test("prefers latest lsp-v tag even when lsp-stable exists (legacy alias)", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = ((input: RequestInfo | URL) => {
			const url = typeof input === "string" ? input : input.toString();
			if (url.includes("/releases/tags/lsp-stable")) {
				return Promise.resolve(new Response(null, { status: 200 }));
			}
			if (url.includes("/releases?per_page=100")) {
				return Promise.resolve(
					new Response(
						JSON.stringify([
							{ tag_name: "lsp-v0.1.77" },
							{ tag_name: "lsp-v0.4.111" },
							{ tag_name: "lsp-v0.4.112" },
							{ tag_name: "lsp-latest" },
						]),
						{ status: 200 },
					),
				);
			}
			throw new Error(`Unexpected request to ${url}`);
		}) as typeof fetch;

		try {
			await expect(resolveLspReleaseTag("lsp-stable")).resolves.toBe(
				"lsp-v0.4.112",
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("migrates cli-latest alias to latest cli-v tag", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = ((input: RequestInfo | URL) => {
			const url = typeof input === "string" ? input : input.toString();
			if (url.includes("/releases/tags/cli-latest")) {
				return Promise.resolve(new Response(null, { status: 200 }));
			}
			if (url.includes("/releases/tags/cli-stable")) {
				return Promise.resolve(new Response(null, { status: 404 }));
			}
			if (url.includes("/releases?per_page=100")) {
				return Promise.resolve(
					new Response(
						JSON.stringify([
							{ tag_name: "cli-v0.4.111" },
							{ tag_name: "cli-v0.4.112" },
						]),
						{ status: 200 },
					),
				);
			}
			throw new Error(`Unexpected request to ${url}`);
		}) as typeof fetch;

		try {
			await expect(resolveCliReleaseTag("cli-latest")).resolves.toBe(
				"cli-v0.4.112",
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("migrates lsp-latest alias to latest lsp-v tag", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = ((input: RequestInfo | URL) => {
			const url = typeof input === "string" ? input : input.toString();
			if (url.includes("/releases/tags/lsp-latest")) {
				return Promise.resolve(new Response(null, { status: 200 }));
			}
			if (url.includes("/releases/tags/lsp-stable")) {
				return Promise.resolve(new Response(null, { status: 404 }));
			}
			if (url.includes("/releases?per_page=100")) {
				return Promise.resolve(
					new Response(
						JSON.stringify([
							{ tag_name: "lsp-v0.4.111" },
							{ tag_name: "lsp-v0.4.112" },
						]),
						{ status: 200 },
					),
				);
			}
			throw new Error(`Unexpected request to ${url}`);
		}) as typeof fetch;

		try {
			await expect(resolveLspReleaseTag("lsp-latest")).resolves.toBe(
				"lsp-v0.4.112",
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("keeps explicit tags unchanged when present", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = ((input: RequestInfo | URL) => {
			const url = typeof input === "string" ? input : input.toString();
			if (url.includes("/releases/tags/cli-v0.4.111")) {
				return Promise.resolve(new Response(null, { status: 200 }));
			}
			throw new Error(`Unexpected request to ${url}`);
		}) as typeof fetch;

		try {
			await expect(resolveCliReleaseTag("cli-v0.4.111")).resolves.toBe(
				"cli-v0.4.111",
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});

describe("pinned release helpers", () => {
	test("alias semver normalization", () => {
		expect(pinnedCliReleaseTag("0.1.77")).toBe("cli-v0.1.77");
		expect(pinnedLspReleaseTag("0.1.77")).toBe("lsp-v0.1.77");
	});
});
