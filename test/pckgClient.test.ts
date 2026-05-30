import { describe, expect, test } from "bun:test";
import {
  buildRegistryPackageUrl,
  clearPckgCaches,
  createPckgFetch,
  getPackageDetails,
  listPackages,
  searchPackages,
} from "../src/packages/pckgClient.js";

describe("pckgClient", () => {
  test("buildRegistryPackageUrl encodes package name", () => {
    expect(buildRegistryPackageUrl("http://localhost:5000/", "my/pkg")).toBe(
      "http://localhost:5000/packages/my%2Fpkg",
    );
  });

  test("createPckgFetch adds Authorization when apiKey set", async () => {
    let auth: string | undefined;
    const mockFetch: typeof fetch = async (_input, init) => {
      const headers = new Headers(init?.headers);
      auth = headers.get("Authorization") ?? undefined;
      return new Response(JSON.stringify([]), { status: 200 });
    };
    const fetchFn = createPckgFetch(
      { baseUrl: "http://localhost:5000", apiKey: "secret" },
      mockFetch,
    );
    await searchPackages(fetchFn, "http://localhost:5000", "core", 10);
    expect(auth).toBe("Bearer secret");
  });

  test("createPckgFetch omits Authorization when apiKey empty", async () => {
    let auth: string | null = "unset";
    const mockFetch: typeof fetch = async (_input, init) => {
      const headers = new Headers(init?.headers);
      auth = headers.get("Authorization");
      return new Response(JSON.stringify([]), { status: 200 });
    };
    const fetchFn = createPckgFetch({ baseUrl: "http://localhost:5000" }, mockFetch);
    await searchPackages(fetchFn, "http://localhost:5000", "x", 5);
    expect(auth).toBeNull();
  });

  test("searchPackages caches repeated queries", async () => {
    clearPckgCaches();
    let calls = 0;
    const mockFetch: typeof fetch = async () => {
      calls += 1;
      return new Response(
        JSON.stringify([{ package: { name: "a", description: "", category: "", totalDownloads: 0, updatedAtUtc: "" } }]),
        { status: 200 },
      );
    };
    const base = "http://localhost:5000";
    await searchPackages(mockFetch, base, "q", 10);
    await searchPackages(mockFetch, base, "q", 10);
    expect(calls).toBe(1);
  });

  test("listPackages uses GET /api/packages", async () => {
    clearPckgCaches();
    let url = "";
    const mockFetch: typeof fetch = async (input) => {
      url = String(input);
      return new Response(
        JSON.stringify([{ name: "corelib", description: "", category: "", totalDownloads: 0, updatedAtUtc: "" }]),
        { status: 200 },
      );
    };
    const result = await listPackages(mockFetch, "http://localhost:5000", 10);
    expect(url).toContain("/api/packages");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows[0]?.package.name).toBe("corelib");
    }
  });

  test("getPackageDetails caches repeated package lookups", async () => {
    clearPckgCaches();
    let calls = 0;
    const mockFetch: typeof fetch = async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          package: { name: "corelib", description: "", category: "", totalDownloads: 0, updatedAtUtc: "" },
          versions: [],
          dependencies: [],
        }),
        { status: 200 },
      );
    };
    const base = "http://localhost:5000";
    await getPackageDetails(mockFetch, base, "corelib");
    await getPackageDetails(mockFetch, base, "corelib");
    expect(calls).toBe(1);
  });
});
