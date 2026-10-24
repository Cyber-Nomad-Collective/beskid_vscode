import { readdirSync } from "node:fs";
import { join } from "node:path";

/** Publisher ids of the Beskid extension; the first is current. */
export const CURRENT_PUBLISHER = "beskid";
export const OLD_PUBLISHER_IDS: readonly string[] = ["beskid-lang"];
export const EXTENSION_NAME = "beskid-vscode";

/**
 * Folder names look like `<publisher>.<name>-<version>[-<target>]`. Returns the
 * folders in `extensionsDir` that are not the running extension: other versions
 * of the current id, and any version under an old publisher id.
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
		if (isCurrentPublisher && version === currentVersion) {
			continue;
		}
		stale.push(name);
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
