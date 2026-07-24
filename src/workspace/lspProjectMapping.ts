import type { ProjectDependenciesResult } from "./lspProjectTypes.js";

type RawDependencyRecord = {
	name?: unknown;
	version?: unknown;
	source?: unknown;
	registry?: unknown;
	resolvedVersion?: unknown;
	materializedRoot?: unknown;
	materializedPath?: unknown;
};

type RawUnresolvedEntry = {
	dependencyName?: unknown;
};

/** Map raw LSP `getProjectDependencies` JSON into extension tree models. */
export function mapLspProjectDependencies(raw: {
	declared?: RawDependencyRecord[];
	locked?: RawDependencyRecord[];
	unresolved?: Array<RawUnresolvedEntry | string>;
}): ProjectDependenciesResult {
	const declared = (raw.declared ?? []).map((d) => ({
		name: String(d.name ?? ""),
		version: typeof d.version === "string" ? d.version : undefined,
		source: typeof d.source === "string" ? d.source : undefined,
		registry: typeof d.registry === "string" ? d.registry : undefined,
	}));
	const locked = (raw.locked ?? []).map((d) => ({
		name: String(d.name ?? ""),
		version:
			(typeof d.resolvedVersion === "string" ? d.resolvedVersion : undefined) ??
			(typeof d.version === "string" ? d.version : undefined),
		source: typeof d.source === "string" ? d.source : undefined,
		registry: typeof d.registry === "string" ? d.registry : undefined,
		materializedPath:
			(typeof d.materializedRoot === "string" ? d.materializedRoot : undefined) ??
			(typeof d.materializedPath === "string" ? d.materializedPath : undefined),
	}));
	const unresolved = (raw.unresolved ?? []).map((entry) => {
		if (typeof entry === "string") {
			return entry;
		}
		return String(entry.dependencyName ?? "");
	});
	return { declared, locked, unresolved };
}
