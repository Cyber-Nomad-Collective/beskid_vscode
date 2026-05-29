import { describe, expect, test } from "bun:test";
import { onboardingProgressMessage } from "../src/cli/toolchainAssessment.js";

describe("onboardingProgressMessage", () => {
  test("combines download and fetch messages", () => {
    expect(
      onboardingProgressMessage({
        requiresBootstrap: true,
        downloading: true,
        cliMissing: true,
        cliNeedsUpgrade: false,
        lspMissing: true,
        needsFetch: true,
      }),
    ).toBe("Downloading Beskid CLI and language server, then preparing workspace…");
  });

  test("download-only message", () => {
    expect(
      onboardingProgressMessage({
        requiresBootstrap: true,
        downloading: true,
        cliMissing: false,
        cliNeedsUpgrade: true,
        lspMissing: true,
        needsFetch: false,
      }),
    ).toBe("Downloading Beskid CLI and language server…");
  });

  test("fetch-only message", () => {
    expect(
      onboardingProgressMessage({
        requiresBootstrap: true,
        downloading: false,
        cliMissing: false,
        cliNeedsUpgrade: false,
        lspMissing: false,
        needsFetch: true,
      }),
    ).toBe("Preparing workspace dependencies…");
  });
});
