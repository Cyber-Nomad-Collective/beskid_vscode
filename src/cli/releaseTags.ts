const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/;

export function normalizeCliReleaseTag(tag: string): string {
	const trimmed = tag.trim();
	if (!trimmed || trimmed === "cli-stable" || trimmed === "stable") {
		return "cli-stable";
	}
	if (trimmed === "cli-unstable" || trimmed === "unstable") {
		return "cli-unstable";
	}
	if (trimmed.startsWith("cli-v")) {
		return trimmed;
	}
	const version = trimmed.startsWith("v") ? trimmed.slice(1) : trimmed;
	if (SEMVER_PATTERN.test(version)) {
		return `cli-v${version}`;
	}
	return trimmed;
}

export function normalizeLspReleaseTag(tag: string): string {
	const trimmed = tag.trim();
	if (!trimmed || trimmed === "lsp-stable" || trimmed === "stable") {
		return "lsp-stable";
	}
	if (trimmed === "lsp-unstable" || trimmed === "unstable") {
		return "lsp-unstable";
	}
	if (trimmed.startsWith("lsp-v")) {
		return trimmed;
	}
	const version = trimmed.startsWith("v") ? trimmed.slice(1) : trimmed;
	if (SEMVER_PATTERN.test(version)) {
		return `lsp-v${version}`;
	}
	return trimmed;
}

export function pinnedCliReleaseTag(version: string): string {
	return normalizeCliReleaseTag(version);
}

export function pinnedLspReleaseTag(version: string): string {
	return normalizeLspReleaseTag(version);
}
