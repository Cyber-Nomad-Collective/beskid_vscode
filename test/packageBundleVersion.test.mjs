import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
	bundleExactHostLsp,
	clearVsixArtifacts,
	resolveHost,
	resolvePackageReleaseVersion,
	versionedVsixName,
} from "../scripts/exact-release-bundle.mjs";

const fixtures = [];

afterEach(() => {
	for (const fixture of fixtures.splice(0)) {
		rmSync(fixture, { force: true, recursive: true });
	}
});

function extensionFixture({ packageVersion = "0.4.598", lockVersion = packageVersion, rootLockVersion = lockVersion } = {}) {
	const root = mkdtempSync(join(tmpdir(), "beskid-vscode-package-"));
	fixtures.push(root);
	writeFileSync(join(root, "package.json"), JSON.stringify({ name: "beskid-vscode", version: packageVersion }));
	writeFileSync(
		join(root, "package-lock.json"),
		JSON.stringify({
			name: "beskid-vscode",
			version: lockVersion,
			lockfileVersion: 3,
			packages: { "": { name: "beskid-vscode", version: rootLockVersion } },
		}),
	);
	return root;
}

function repoFixture() {
	const repoRoot = mkdtempSync(join(tmpdir(), "beskid-vscode-repo-"));
	fixtures.push(repoRoot);
	const validatorDir = join(repoRoot, "scripts", "ci");
	mkdirSync(validatorDir, { recursive: true });
	copyFileSync(
		fileURLToPath(new URL("../../scripts/ci/release-version.mjs", import.meta.url)),
		join(validatorDir, "release-version.mjs"),
	);
	writeFileSync(
		join(validatorDir, "resolve-editor-authoring-version.mjs"),
		"#!/usr/bin/env node\nconsole.log('0.4.598');\n",
	);
	return repoRoot;
}

describe("exact VS Code release bundle", () => {
	test("rejects package and lock version drift", () => {
		const extensionRoot = extensionFixture({ rootLockVersion: "0.4.597" });
		expect(() => resolvePackageReleaseVersion(extensionRoot)).toThrow(
			"VS Code package versions must agree",
		);
	});

	test("rejects drift from the shared editor release authority", () => {
		const extensionRoot = extensionFixture();
		const repoRoot = repoFixture();
		writeFileSync(
			join(repoRoot, "scripts", "ci", "resolve-editor-authoring-version.mjs"),
			"#!/usr/bin/env node\nconsole.log('0.4.597');\n",
		);
		expect(() => resolvePackageReleaseVersion(extensionRoot, repoRoot)).toThrow(
			"editor release version mismatch",
		);
	});

	test("builds and verifies the bundled LSP at the package's exact version", () => {
		const extensionRoot = extensionFixture();
		const repoRoot = repoFixture();
		const builder = join(repoRoot, "build-release-artifact");
		writeFileSync(
			builder,
			`#!/usr/bin/env bash
set -euo pipefail
[[ "$1" == beskid_lsp ]]
[[ "$2" == beskid_lsp ]]
[[ "$3" == aarch64-apple-darwin ]]
[[ "$5" == 0.4.598 ]]
cat > "$PWD/$4" <<'LSP'
#!/usr/bin/env bash
printf '%s\\n' 'beskid_lsp 0.4.598'
LSP
chmod +x "$PWD/$4"
`,
		);
		chmodSync(builder, 0o755);

		const result = bundleExactHostLsp({
			extensionRoot,
			repoRoot,
			platform: "darwin",
			arch: "arm64",
			releaseBuilder: builder,
		});

		expect(result.version).toBe("0.4.598");
		expect(result.platformKey).toBe("darwin-arm64");
		expect(readFileSync(result.destination, "utf8")).toContain("beskid_lsp 0.4.598");
	});

	test("rejects a release builder that emits a different LSP version", () => {
		const extensionRoot = extensionFixture();
		const repoRoot = repoFixture();
		const builder = join(repoRoot, "build-release-artifact");
		writeFileSync(
			builder,
			`#!/usr/bin/env bash
set -euo pipefail
cat > "$PWD/$4" <<'LSP'
#!/usr/bin/env bash
printf '%s\\n' 'beskid_lsp 0.1.0'
LSP
chmod +x "$PWD/$4"
`,
		);
		chmodSync(builder, 0o755);

		expect(() =>
			bundleExactHostLsp({
				extensionRoot,
				repoRoot,
				platform: "darwin",
				arch: "arm64",
				releaseBuilder: builder,
			}),
		).toThrow("bundled LSP version mismatch");
	});

	test("uses an unambiguous versioned platform artifact name", () => {
		expect(versionedVsixName("0.4.598", "darwin-arm64")).toBe(
			"beskid-vscode-0.4.598-darwin-arm64.vsix",
		);
	});

	test("maps the official Intel macOS packaging lane", () => {
		expect(resolveHost("darwin", "x64")).toEqual({
			binaryName: "beskid_lsp",
			platformKey: "darwin-x64",
			rustTarget: "x86_64-apple-darwin",
		});
	});

	test("clears only generated VSIX files before a packaging attempt", () => {
		const dist = mkdtempSync(join(tmpdir(), "beskid-vscode-dist-"));
		fixtures.push(dist);
		writeFileSync(join(dist, "beskid.vsix"), "stale");
		writeFileSync(join(dist, "beskid-vscode-0.4.597-darwin-arm64.vsix"), "stale");
		writeFileSync(join(dist, "release-notes.txt"), "keep");

		clearVsixArtifacts(dist);

		expect(() => readFileSync(join(dist, "beskid.vsix"))).toThrow();
		expect(() => readFileSync(join(dist, "beskid-vscode-0.4.597-darwin-arm64.vsix"))).toThrow();
		expect(readFileSync(join(dist, "release-notes.txt"), "utf8")).toBe("keep");
	});
});
