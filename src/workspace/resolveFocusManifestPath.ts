import {
	discoverProjectFileFromPath,
	isProjectManifestUri,
	isWorkspaceManifestUri,
} from "./manifestPath.js";

export type FocusManifestInput =
	| string
	| { nodeType: string; projectUri?: string }
	| undefined
	| null;

function isTreeItemTarget(
	input: unknown,
): input is { nodeType: string; projectUri?: string } {
	return typeof input === "object" && input !== null && "nodeType" in input;
}

function manifestPathFromFilePath(filePath: string): string | undefined {
	const normalized = filePath.replaceAll("\\", "/");
	if (isProjectManifestUri(normalized)) {
		return normalized;
	}
	if (isWorkspaceManifestUri(normalized)) {
		return undefined;
	}
	const discovered = discoverProjectFileFromPath(normalized);
	if (discovered && isProjectManifestUri(discovered)) {
		return discovered;
	}
	return undefined;
}

function filePathFromUriString(uri: string): string | undefined {
	if (!uri.includes("://")) {
		return uri;
	}
	try {
		const parsed = new URL(uri);
		if (parsed.protocol !== "file:") {
			return undefined;
		}
		let pathname = decodeURIComponent(parsed.pathname);
		if (/^\/[A-Za-z]:/.test(pathname)) {
			pathname = pathname.slice(1);
		}
		return pathname;
	} catch {
		return undefined;
	}
}

/** Resolve a focus target to a `.bproj` manifest path, if possible. */
export function resolveFocusManifestPath(
	input: FocusManifestInput,
): string | undefined {
	if (input === undefined || input === null) {
		return undefined;
	}

	if (isTreeItemTarget(input)) {
		const projectUri = input.projectUri?.trim();
		return projectUri ? resolveFocusManifestPath(projectUri) : undefined;
	}

	const trimmed = input.trim();
	if (!trimmed) {
		return undefined;
	}

	const filePath = filePathFromUriString(trimmed);
	if (!filePath) {
		return undefined;
	}
	return manifestPathFromFilePath(filePath);
}
