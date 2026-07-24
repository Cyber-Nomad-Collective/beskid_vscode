export type PackageKind = "library" | "template" | "tool";

/** Mirrors `PackageSummaryResponse` in pckg `Contracts.cs` (subset used by the extension). */
export type PackageSummary = {
	id?: string;
	name: string;
	description: string;
	category: string;
	totalDownloads: number;
	updatedAtUtc: string;
	tags?: string[];
	isPublic?: boolean;
	iconUrl?: string | null;
	packageKind?: PackageKind;
	shortName?: string | null;
};

export type PackageSummaryResponse = PackageSummary;

export type PackageHealthSnapshotResponse = {
	state: string;
	subState: string;
	score: number;
};

export type PackageSearchResponse = PackageSearchRow & {
	health?: PackageHealthSnapshotResponse;
};

export type PackageSearchRow = {
	package: PackageSummary;
	reviewCount?: number;
};

export type PackageVersionSummary = {
	version: string;
	publishedAtUtc: string;
	isYanked?: boolean;
};

export type PackageDependency = {
	name: string;
	source: string;
	version?: string;
	registry?: string;
};

export type PackageDependencyResponse = PackageDependency;

export type PackageDetails = {
	package: PackageSummary;
	versions: PackageVersionSummary[];
	dependencies: PackageDependency[];
	dependentsCount: number;
	readme?: string | null;
	health?: PackageHealthSnapshotResponse;
	latestVersion?: string | null;
};

export type PackageDetailsResponse = PackageDetails;

export type PckgFetchOptions = {
	baseUrl: string;
	apiKey?: string;
};

export type ProjectDeclaredDependency = {
	name: string;
	source: string;
	version?: string | null;
	path?: string | null;
	registry?: string | null;
};

export type ProjectLockedDependency = {
	name: string;
	manifest: string;
	project: string;
	sourceRoot: string;
	materializedRoot: string;
	resolvedVersion?: string | null;
	registry?: string | null;
};

export type ProjectDependenciesResult = {
	projectUri: string;
	declared: ProjectDeclaredDependency[];
	locked: ProjectLockedDependency[];
	unresolved: Array<{
		dependencyName: string;
		kind: string;
		descriptor: string;
	}>;
};
