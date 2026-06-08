import { describe, expect, test } from "bun:test";
import {
  buildFallbackDocsUrl,
  buildPckgDocsUrl,
  resolveDocumentationUrl,
} from "../src/commands/docsUrls.js";

describe("resolveDocumentationUrl", () => {
  test("passes through absolute http URLs", () => {
    expect(resolveDocumentationUrl("https://pckg.beskid-lang.org/docs/corelib@1.0.0")).toBe(
      "https://pckg.beskid-lang.org/docs/corelib@1.0.0",
    );
  });

  test("joins /platform-spec paths with default site root", () => {
    expect(
      resolveDocumentationUrl(
        "/platform-spec/core-library/stability-and-api-shape/corelib-api-shape/",
        { specBaseUrl: "https://beskid-lang.org/platform-spec" },
      ),
    ).toBe(
      "https://beskid-lang.org/platform-spec/core-library/stability-and-api-shape/corelib-api-shape/",
    );
  });
});

describe("buildPckgDocsUrl", () => {
  test("builds registry docs URL with encoded package and version", () => {
    expect(
      buildPckgDocsUrl("corelib", "1.2.3", "Console.Style", {
        pckgBaseUrl: "https://pckg.beskid-lang.org",
      }),
    ).toBe("https://pckg.beskid-lang.org/docs/corelib@1.2.3#Console.Style");
  });

  test("omits fragment when symbol is absent", () => {
    expect(buildPckgDocsUrl("demo", "latest", undefined, { pckgBaseUrl: "https://pckg.beskid-lang.org" })).toBe(
      "https://pckg.beskid-lang.org/docs/demo@latest",
    );
  });
});

describe("buildFallbackDocsUrl", () => {
  test("includes book search query when symbol provided", () => {
    expect(buildFallbackDocsUrl("Widget::value", { bookBaseUrl: "https://beskid-lang.org" })).toBe(
      "https://beskid-lang.org/book/?q=Widget%3A%3Avalue",
    );
  });
});
