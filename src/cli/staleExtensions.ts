import { readdirSync } from "node:fs";
import { join } from "node:path";

/** Publisher ids of the Beskid extension; the first is current. */
export const CURRENT_PUBLISHER = "beskid";
export const OLD_PUBLISHER_IDS: readonly string[] = ["beskid-lang"];
export const EXTENSION_NAME = "beskid-vscode";

type ParsedVersion = { core: [number, number, number]; prerelease: boolean };

function parseVersion(version: string): ParsedVersion | undefined {
	const match = /^(\d+)\.(\d+)\.(\d+)(?:([-+])[0-9A-Za-z.-]+)?$/.exec(version);
	if (!match) {
		return undefined;
	}
	const core = [Number(match[1]), Number(match[2]), Number(match[3])] as [number, number, number];
	if (!core.every(Number.isSafeInteger)) {
		return undefined;
	}
	return { core, prerelease: match[4] !== undefined };
}

/**
 * -1 when `a` is older than `b`, 0 when they are the same release, 1 when
 * newer, undefined when the order is not certain: an unparsable version, or
 * equal X.Y.Z where either side has a prerelease or build suffix.
 */
export function compareReleaseVersions(a: string, b: string): -1 | 0 | 1 | undefined {
	const left = parseVersion(a);
	const right = parseVersion(b);
	if (!left || !right) {
		return undefined;
	}
	for (let i = 0; i < 3; i += 1) {
		if (left.core[i] !== right.core[i]) {
			return left.core[i] < right.core[i] ? -1 : 1;
		}
	}
	if (left.prerelease || right.prerelease) {
		return a === b ? 0 : undefined;
	}
	return 0;
}

/**
 * Folder names look like `<publisher>.<name>-<version>[-<target>]`. Returns the
 * folders in `extensionsDir` that are older than the running extension: lower
 * versions of the current id, and lower or equal versions under an old
 * publisher id. A newer version, or one whose order is not certain, is kept.
 */
export function findStaleExtensionFolders(
	folderNames: readonly string[],
	currentVersion: string,
): string[] {
	const stale: string[] = [];
	for (const name of folderNames) {
		const match = /^([^.]+)\.beskid-vscode-(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/i.exec(name);
		if (!match) {
			continue;
		}
		const publisher = match[1].toLowerCase();
		const rest = match[2];
		const isCurrentPublisher = publisher === CURRENT_PUBLISHER;
		const isOldPublisher = OLD_PUBLISHER_IDS.includes(publisher);
		if (!isCurrentPublisher && !isOldPublisher) {
			continue;
		}
		const version = rest.replace(/-(darwin|linux|win32|alpine)-(x64|arm64|armhf)$/i, "");
		const order = compareReleaseVersions(version, currentVersion);
		if (order === -1 || (isOldPublisher && order === 0)) {
			stale.push(name);
		}
	}
	return stale.sort();
}

export function listStaleExtensionFolders(
	extensionsDir: string,
	currentVersion: string,
	list: (dir: string) => string[] = (dir) => readdirSync(dir),
): string[] {
	try {
		return findStaleExtensionFolders(list(extensionsDir), currentVersion).map(
			(name) => join(extensionsDir, name),
		);
	} catch {
		return [];
	}
}
