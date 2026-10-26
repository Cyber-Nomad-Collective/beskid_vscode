import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	bundleExactHostLsp,
	bundleVerifiedReleaseLsp,
	checkRuntimeAbi,
	clearVsixArtifacts,
	compilerRuntimeAbiSource,
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

function extensionFixture({
	packageVersion = "0.4.598",
	lockVersion = packageVersion,
	rootLockVersion = lockVersion,
	runtimeAbi = 5,
} = {}) {
	const root = mkdtempSync(join(tmpdir(), "beskid-vscode-package-"));
	fixtures.push(root);
	writeFileSync(join(root, "package.json"), JSON.stringify({ name: "beskid-vscode", version: packageVersion, beskidToolchain: { runtimeAbi } }),
	);
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

function repoFixture({ abiSource = "pub const BESKID_RUNTIME_ABI_VERSION: u32 = 5;\n" } = {}) {
	const repoRoot = mkdtempSync(join(tmpdir(), "beskid-vscode-repo-"));
	fixtures.push(repoRoot);
	if (abiSource !== null) {
		const abiPath = compilerRuntimeAbiSource(repoRoot);
		mkdirSync(join(abiPath, ".."), { recursive: true });
		writeFileSync(abiPath, abiSource);
	}
	const validatorDir = join(repoRoot, "scripts", "ci");
	mkdirSync(validatorDir, { recursive: true });
	writeFileSync(
		join(validatorDir, "resolve-editor-authoring-version.mjs"),
		"#!/usr/bin/env node\nconsole.log('0.4.598');\n",
	);
	return repoRoot;
}

describe("exact VS Code release bundle", () => {
	test("stages checksum-verified native evidence without running a release build", () => {
		const extensionRoot = extensionFixture();
		const repoRoot = repoFixture();
		const artifactPath = join(repoRoot, "windows-lsp.exe");
		writeFileSync(artifactPath, "native Windows payload");
		const sha256 = createHash("sha256").update(readFileSync(artifactPath)).digest("hex");
		const options = { extensionRoot, repoRoot, platformKey: "win32-x64", artifactPath, sha256, version: "0.4.598" };
		const staged = bundleVerifiedReleaseLsp(options);
		expect(readFileSync(staged.destination, "utf8")).toBe("native Windows payload");
		expect(() => bundleVerifiedReleaseLsp({ ...options, version: "0.5.1" })).toThrow("version");
		writeFileSync(artifactPath, "tampered payload");
		expect(() => bundleVerifiedReleaseLsp(options)).toThrow("checksum mismatch");
	});

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

	test("checkRuntimeAbi accepts only an equal, parsable compiler constant", () => {
		const source = "//! ABI\npub const BESKID_RUNTIME_ABI_VERSION: u32 = 5;\n";
		expect(checkRuntimeAbi(source, 5)).toBe(5);
		expect(() => checkRuntimeAbi(source, 4)).toThrow("runtime ABI mismatch");
		expect(() => checkRuntimeAbi(source, undefined)).toThrow("runtime ABI mismatch");
		expect(() => checkRuntimeAbi("pub const OTHER: u32 = 5;", 5)).toThrow("could not be parsed");
		expect(() => checkRuntimeAbi("pub const BESKID_RUNTIME_ABI_VERSION: u32 = five;", 5)).toThrow(
			"could not be parsed",
		);
		expect(() => checkRuntimeAbi(undefined, 5)).toThrow("missing");
	});

	test("refuses to invoke the release builder when the runtime ABI is missing or differs", () => {
		const extensionRoot = extensionFixture({ runtimeAbi: 4 });
		const builder = join(mkdtempSync(join(tmpdir(), "beskid-vscode-builder-")), "builder");
		fixtures.push(join(builder, ".."));
		const marker = `${builder}.ran`;
		writeFileSync(builder, `#!/usr/bin/env bash\ntouch "${marker}"\n`);
		chmodSync(builder, 0o755);
		const run = (repoRoot) => () =>
			bundleExactHostLsp({ extensionRoot, repoRoot, platform: "darwin", arch: "arm64", releaseBuilder: builder });

		expect(run(repoFixture())).toThrow("runtime ABI mismatch");
		expect(run(repoFixture({ abiSource: null }))).toThrow("runtime ABI source is missing");
		expect(() => readFileSync(marker)).toThrow();
	});

	test("verified release staging also checks the runtime ABI", () => {
		const extensionRoot = extensionFixture({ runtimeAbi: 6 });
		const repoRoot = repoFixture();
		const artifactPath = join(repoRoot, "lsp");
		writeFileSync(artifactPath, "payload");
		const sha256 = createHash("sha256").update(readFileSync(artifactPath)).digest("hex");
		expect(() =>
			bundleVerifiedReleaseLsp({ extensionRoot, repoRoot, platformKey: "linux-x64", artifactPath, sha256, version: "0.4.598" }),
		).toThrow("runtime ABI mismatch");
	});

	test("the real compiler constant matches package.json when the aggregate checkout is present", async () => {
		const extensionRoot = join(import.meta.dir, "..");
		const source = compilerRuntimeAbiSource(join(extensionRoot, ".."));
		let text;
		try {
			text = readFileSync(source, "utf8");
		} catch {
			return;
		}
		const pkg = JSON.parse(readFileSync(join(extensionRoot, "package.json"), "utf8"));
		expect(checkRuntimeAbi(text, pkg.beskidToolchain.runtimeAbi)).toBe(5);
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
