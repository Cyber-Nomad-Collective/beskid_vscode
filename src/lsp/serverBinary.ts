import { existsSync } from "node:fs";
import { join } from "node:path";

export function platformArchKey(): string | undefined {
	const platform = process.platform;
	const arch = process.arch;

	const normalizedPlatform =
		platform === "linux" || platform === "darwin" || platform === "win32"
			? platform
			: undefined;
	const normalizedArch = arch === "x64" || arch === "arm64" ? arch : undefined;

	if (!normalizedPlatform || !normalizedArch) {
		return undefined;
	}

	return `${normalizedPlatform}-${normalizedArch}`;
}

/** Platform keys to probe for a bundled binary (includes macOS cross-arch fallback). */
export function bundledPlatformArchKeys(): string[] {
	const primary = platformArchKey();
	if (!primary) {
		return [];
	}

	const keys = [primary];
	if (primary.startsWith("darwin-")) {
		const alternate = primary === "darwin-arm64" ? "darwin-x64" : "darwin-arm64";
		keys.push(alternate);
	}
	return keys;
}

export function compilerBinaryName(): string {
	return process.platform === "win32" ? "beskid_lsp.exe" : "beskid_lsp";
}

export function resolveBundledServerBinaryAt(
	extensionPath: string,
	keys: readonly string[],
): string | undefined {
	const binaryName = compilerBinaryName();
	for (const key of keys) {
		const bundledPath = join(extensionPath, "server", key, binaryName);
		if (existsSync(bundledPath)) {
			return bundledPath;
		}
	}
	return undefined;
}
