import { execFileSync } from "node:child_process";
import {
	chmodSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
} from "node:fs";
import { join } from "node:path";

function readJson(path) {
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		throw new Error(`${path}: invalid JSON: ${error.message}`);
	}
}

export function resolvePackageReleaseVersion(extensionRoot, repoRoot = join(extensionRoot, "..")) {
	const packageJson = readJson(join(extensionRoot, "package.json"));
	const packageLock = readJson(join(extensionRoot, "package-lock.json"));
	const versions = [
		packageJson.version,
		packageLock.version,
		packageLock.packages?.[""]?.version,
	];
	if (versions.some((version) => typeof version !== "string") || new Set(versions).size !== 1) {
		throw new Error(
			`VS Code package versions must agree: package.json=${versions[0]}, ` +
				`package-lock.json=${versions[1]}, package-lock.json#packages[""]=${versions[2]}`,
		);
	}

	const editorVersionResolver = join(
		repoRoot,
		"scripts",
		"ci",
		"resolve-editor-authoring-version.mjs",
	);
	if (!existsSync(editorVersionResolver)) {
		throw new Error(
			`Editor release version resolver not found at ${editorVersionResolver}. ` +
				"Build from the aggregate beskid checkout.",
		);
	}
	const editorVersion = execFileSync(
		process.execPath,
		[editorVersionResolver, repoRoot, extensionRoot],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	).trim();
	if (editorVersion !== versions[0]) {
		throw new Error(
			`editor release version mismatch: shared authority=${editorVersion}, VS Code package=${versions[0]}`,
		);
	}
	return versions[0];
}

export function resolveHost(platform = process.platform, arch = process.arch) {
	const hosts = {
		"darwin-arm64": { rustTarget: "aarch64-apple-darwin", binaryName: "beskid_lsp" },
		"darwin-x64": { rustTarget: "x86_64-apple-darwin", binaryName: "beskid_lsp" },
		"linux-x64": { rustTarget: "x86_64-unknown-linux-gnu", binaryName: "beskid_lsp" },
		"win32-x64": { rustTarget: "x86_64-pc-windows-msvc", binaryName: "beskid_lsp.exe" },
	};
	const platformKey = `${platform}-${arch}`;
	const host = hosts[platformKey];
	if (!host) {
		throw new Error(`Unsupported release host: ${platformKey}`);
	}
	return { ...host, platformKey };
}

export function versionedVsixName(version, platformKey) {
	return `beskid-vscode-${version}-${platformKey}.vsix`;
}

export function clearVsixArtifacts(distRoot) {
	if (!existsSync(distRoot)) return;
	for (const entry of readdirSync(distRoot, { withFileTypes: true })) {
		if (entry.isFile() && entry.name.endsWith(".vsix")) {
			rmSync(join(distRoot, entry.name));
		}
	}
}

export function bundleExactHostLsp({
	extensionRoot,
	repoRoot = join(extensionRoot, ".."),
	platform = process.platform,
	arch = process.arch,
	releaseBuilder = join(repoRoot, "scripts", "ci", "build-release-artifact.sh"),
}) {
	const version = resolvePackageReleaseVersion(extensionRoot, repoRoot);
	const { binaryName, platformKey, rustTarget } = resolveHost(platform, arch);
	if (!existsSync(releaseBuilder)) {
		throw new Error(`Exact-version release builder not found at ${releaseBuilder}`);
	}

	const artifactName = `.local-beskid-lsp-${version}-${process.pid}${binaryName.endsWith(".exe") ? ".exe" : ""}`;
	const artifactPath = join(repoRoot, artifactName);
	const destinationDir = join(extensionRoot, "server", platformKey);
	const destination = join(destinationDir, binaryName);
	try {
		execFileSync(
			"bash",
			[releaseBuilder, "beskid_lsp", "beskid_lsp", rustTarget, artifactName, version],
			{ cwd: repoRoot, stdio: "inherit" },
		);
		if (!existsSync(artifactPath)) {
			throw new Error(`Exact-version release builder did not create ${artifactPath}`);
		}
		const actualVersion = execFileSync(artifactPath, ["--version"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
		const expectedVersion = `beskid_lsp ${version}`;
		if (actualVersion !== expectedVersion) {
			throw new Error(
				`bundled LSP version mismatch: expected ${expectedVersion}, got ${actualVersion || "<empty>"}`,
			);
		}

		mkdirSync(destinationDir, { recursive: true });
		copyFileSync(artifactPath, destination);
		if (platform !== "win32") chmodSync(destination, 0o755);
		return { destination, platformKey, version };
	} finally {
		rmSync(artifactPath, { force: true });
	}
}
