import { describe, expect, test } from "bun:test";
import { renderPackageRegistryHtml } from "../src/packages/packageRegistryHtml.js";
import type { PackageDetails } from "../src/packages/pckgTypes.js";

const libraryDetails: PackageDetails = {
  package: {
    name: "corelib",
    packageKind: "library",
    description: "Standard library",
  },
  latestVersion: "0.4.0",
  versions: [{ version: "0.4.0", isYanked: false }],
};

describe("renderPackageRegistryHtml", () => {
  test("detail pane links library packages to pckg API docs", () => {
    const html = renderPackageRegistryHtml({
      query: "",
      loading: false,
      rows: [],
      selected: "corelib",
      details: libraryDetails,
      registryBaseUrl: "https://pckg.beskid-lang.org",
    });
    expect(html).toContain("Open API docs");
    expect(html).toContain("/docs/corelib@0.4.0");
  });
});
