const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/;
const CLI_COMPILER_REPO = "Cyber-Nomad-Collective/beskid_compiler";
const API_RELEASES_URL = `https://api.github.com/repos/${CLI_COMPILER_REPO}/releases?per_page=100`;

type Stream = "cli" | "lsp";

type GitHubRelease = {
	tag_name: string;
};

const FETCH_HEADERS = {
	"User-Agent": "beskid-vscode",
	Accept: "application/vnd.github+json",
};

const DEFAULT_ROLLING_MAJOR = 0;
const RELEASES_PER_PAGE = 100;

function majorPinnedVersion(tag: string, stream: Stream): number | undefined {
	const rawVersion = versionFromTag(stream, tag);
	const isPinnedTag = tag.startsWith(`${stream}-v`);
	const isBareMajor = /^\d+$/.test(tag);
	if (
		(!isPinnedTag && !isBareMajor) ||
		(!SEMVER_PATTERN.test(rawVersion) && !isBareMajor)
	) {
		return undefined;
	}
	return majorFromVersion(rawVersion);
}

function versionFromTag(prefix: Stream, tag: string): string {
	const pinnedPrefix = `${prefix}-v`;
	return tag.startsWith(pinnedPrefix) ? tag.slice(pinnedPrefix.length) : tag;
}

function majorFromVersion(version: string): number | undefined {
	const [major] = version.split(".");
	const parsed = Number.parseInt(major, 10);
	return Number.isNaN(parsed) ? undefined : parsed;
}

function compareVersions(left: string, right: string): number {
	const leftParts = left
		.split(".")
		.map((segment) => Number.parseInt(segment, 10));
	const rightParts = right
		.split(".")
		.map((segment) => Number.parseInt(segment, 10));
	const maxLength = Math.max(leftParts.length, rightParts.length);
	for (let i = 0; i < maxLength; i += 1) {
		const lv = Number.isNaN(leftParts[i] ?? 0) ? 0 : leftParts[i];
		const rv = Number.isNaN(rightParts[i] ?? 0) ? 0 : rightParts[i];
		if (lv !== rv) {
			return lv > rv ? 1 : -1;
		}
	}
	return 0;
}

async function hasReleaseTag(tag: string): Promise<boolean> {
	const response = await fetch(
		`https://api.github.com/repos/${CLI_COMPILER_REPO}/releases/tags/${encodeURIComponent(
			tag,
		)}`,
		{ headers: FETCH_HEADERS, method: "HEAD" },
	);
	return response.ok;
}

async function resolveLatestPinnedReleaseTag(
	stream: Stream,
	preferredMajor = DEFAULT_ROLLING_MAJOR,
): Promise<string | undefined> {
	const normalizedPrefix = `${stream}-v`;
	const allCandidates: { tag: string; version: string }[] = [];

	for (let page = 1; ; page += 1) {
		const response = await fetch(`${API_RELEASES_URL}&page=${page}`, {
			headers: FETCH_HEADERS,
		});
		if (!response.ok) {
			throw new Error(
				`Failed to list releases (${response.status} ${response.statusText}) for stream ${stream}.`,
			);
		}
		const releases = await response.json();
		if (!Array.isArray(releases) || releases.length === 0) {
			break;
		}

		const candidates = (releases as GitHubRelease[])
			.filter((release) => release.tag_name.startsWith(normalizedPrefix))
			.map((release) => ({
				tag: release.tag_name,
				version: versionFromTag(stream, release.tag_name),
			}))
			.filter((entry) => SEMVER_PATTERN.test(entry.version))
			.sort((a, b) => compareVersions(b.version, a.version));

		allCandidates.push(...candidates);
		if (releases.length < RELEASES_PER_PAGE) {
			break;
		}
	}

	const preferredCandidates =
		preferredMajor === null
			? allCandidates
			: allCandidates.filter(
					(entry) => majorFromVersion(entry.version) === preferredMajor,
				);

	if (preferredCandidates.length > 0) {
		preferredCandidates.sort((a, b) => compareVersions(b.version, a.version));
		return preferredCandidates[0].tag;
	}

	return undefined;
}

function isRollingAlias(tag: string, stream: Stream): boolean {
	return (
		tag === `${stream}-stable` ||
		tag === `${stream}-unstable` ||
		tag === "stable" ||
		tag === "unstable"
	);
}

async function resolveRollingReleaseTag(
	tag: string,
	stream: Stream,
): Promise<string> {
	const trimmed =
		stream === "cli" ? normalizeCliReleaseTag(tag) : normalizeLspReleaseTag(tag);
	const normalizedTag = trimmed.trim();
	const isLegacyLatest =
		normalizedTag === `${stream}-latest` || normalizedTag === "latest";
	if (isLegacyLatest) {
		const latestPinned = await resolveLatestPinnedReleaseTag(stream);
		if (latestPinned) {
			return latestPinned;
		}
		throw new Error(
			`No ${stream}-v* releases were found for legacy channel ${normalizedTag}. ` +
				`This likely indicates no supported major (default ${DEFAULT_ROLLING_MAJOR}) was published yet.`,
		);
	}
	const rollingTag =
		stream === "cli"
			? normalizedTag || "cli-stable"
			: normalizedTag || "lsp-stable";
	if (isRollingAlias(rollingTag, stream)) {
		const latestPinned = await resolveLatestPinnedReleaseTag(stream);
		if (latestPinned) {
			return latestPinned;
		}
		throw new Error(
			`No ${stream}-v* releases were found for rolling channel ${rollingTag}. ` +
				`This likely indicates no supported major (default ${DEFAULT_ROLLING_MAJOR}) was published yet.`,
		);
	}

	const pinnedMajor = majorPinnedVersion(rollingTag, stream);
	if (pinnedMajor !== undefined && pinnedMajor !== DEFAULT_ROLLING_MAJOR) {
		const latestPinned = await resolveLatestPinnedReleaseTag(stream);
		if (latestPinned) {
			return latestPinned;
		}
	}

	if (await hasReleaseTag(rollingTag)) {
		return rollingTag;
	}

	const latestPinned = await resolveLatestPinnedReleaseTag(stream);
	if (latestPinned) {
		return latestPinned;
	}

	throw new Error(
		`No releases found for stream ${stream} (${rollingTag}) and no fallback ${stream}-v* tags exist.`,
	);
}

export function normalizeCliReleaseTag(tag: string): string {
	const trimmed = tag.trim();
	if (trimmed === "cli-latest") {
		return "cli-latest";
	}
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
	if (trimmed === "lsp-latest") {
		return "lsp-latest";
	}
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

export async function resolveCliReleaseTag(tag: string): Promise<string> {
	return resolveRollingReleaseTag(tag, "cli");
}

export async function resolveLspReleaseTag(tag: string): Promise<string> {
	return resolveRollingReleaseTag(tag, "lsp");
}
