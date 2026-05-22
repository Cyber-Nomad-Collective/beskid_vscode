import { describe, expect, test } from "bun:test";
import {
  buildRegistryPackageUrl,
  clearPckgCaches,
  createPckgFetch,
  getPackageDetails,
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
});
