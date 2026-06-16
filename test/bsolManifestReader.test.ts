import { describe, expect, test } from "bun:test";
import { parseBprojManifest } from "../src/workspace/bsolManifestReader.js";

const SAMPLE_BPROJ = `corelib_runtime {
  name = "corelib_runtime"
  version = "0.1.0"
  root = "src"
}

dependency "corelib_foundation" {
  source = "path"
  path = "../foundation"
}

dependency "registry_pkg" {
  source = registry
  version = "1.2.3"
}

target "RuntimeLib" {
  kind = Lib
}

target "RuntimeTests" {
  kind = Test
}
`;

describe("parseBprojManifest", () => {
  test("extracts BSOL target blocks", () => {
    const snapshot = parseBprojManifest(SAMPLE_BPROJ);
    expect(snapshot.targets).toEqual([{ name: "RuntimeLib" }, { name: "RuntimeTests" }]);
  });

  test("extracts declared dependencies with version and source", () => {
    const snapshot = parseBprojManifest(SAMPLE_BPROJ);
    expect(snapshot.dependencies).toEqual([
      { name: "corelib_foundation", version: undefined, source: "path" },
      { name: "registry_pkg", version: "1.2.3", source: "registry" },
    ]);
  });

  test("returns empty collections for manifests without targets or deps", () => {
    const snapshot = parseBprojManifest('project { name = "solo" }');
    expect(snapshot).toEqual({ targets: [], dependencies: [] });
  });
});
