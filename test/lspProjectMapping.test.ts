import { describe, expect, test } from "bun:test";
import { mapLspProjectDependencies } from "../src/workspace/lspProjectMapping.js";

describe("mapLspProjectDependencies", () => {
  test("maps declared, locked, and unresolved entries", () => {
    const mapped = mapLspProjectDependencies({
      declared: [{ name: "lib", version: "1.0.0", source: "path" }],
      locked: [
        {
          name: "lib",
          resolvedVersion: "1.0.0",
          materializedRoot: "/obj/deps/lib",
          registry: "default",
        },
      ],
      unresolved: [{ dependencyName: "missing-pkg" }, "legacy-string"],
    });
    expect(mapped.declared).toEqual([
      { name: "lib", version: "1.0.0", source: "path", registry: undefined },
    ]);
    expect(mapped.locked[0]).toEqual({
      name: "lib",
      version: "1.0.0",
      source: undefined,
      registry: "default",
      materializedPath: "/obj/deps/lib",
    });
    expect(mapped.unresolved).toEqual(["missing-pkg", "legacy-string"]);
  });

  test("prefers materializedPath alias when materializedRoot absent", () => {
    const mapped = mapLspProjectDependencies({
      locked: [{ name: "a", materializedPath: "/cache/a" }],
    });
    expect(mapped.locked[0]?.materializedPath).toBe("/cache/a");
  });
});
