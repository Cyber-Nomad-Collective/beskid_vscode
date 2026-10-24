import { dirname, join } from "node:path";

/**
 * Toolchain selection for the editor. Pure module (no `vscode` import) so the
 * order and the version matching are unit-testable.
 *
 * Server order: explicit setting, then the bundled server, then
 * `~/.beskid/bin` only when its CLI reports the same version and runtime ABI
 * as the bundled server. Anything else in `~/.beskid/bin` is a stale toolchain.
 * The extension never downloads a toolchain and never calls `beskid-up`.
 */

/** Identity of one toolchain: what `beskid dev capabilities` reports. */
export type ToolchainIdentity = {
	version: string;
	runtimeAbi: number | undefined;
};

/** Two identities match only when both fields are known and equal (fail closed). */
export function identitiesMatch(
	expected: ToolchainIdentity,
	actual: ToolchainIdentity | undefined,
): boolean {
	if (!actual) {
		return false;
	}
	if (expected.runtimeAbi === undefined || actual.runtimeAbi === undefined) {
		return false;
	}
	return (
		normalizeVersion(expected.version) === normalizeVersion(actual.version) &&
		expected.runtimeAbi === actual.runtimeAbi
	);
}

export function normalizeVersion(version: string): string {
	return version.trim().replace(/^v/i, "");
}

export type ToolchainDeps = {
	exists: (path: string) => boolean;
	/** Runs `beskid dev capabilities --json` on `cliPath`; undefined when it fails. */
	probe: (cliPath: string) => Promise<ToolchainIdentity | undefined>;
};

export type ServerSelectionInput = {
	/** The bundled-toolchain identity the extension was built against. */
	expected: ToolchainIdentity;
	explicitServerPath: string | undefined;
	bundledServerPath: string | undefined;
	/** `~/.beskid/bin` */
	managedDir: string;
	platform: NodeJS.Platform;
};

export type StaleToolchain = {
	dir: string;
	/** Files found in the directory that belong to the stale toolchain. */
	files: string[];
	/** What the stale CLI reported, when it answered at all. */
	found: ToolchainIdentity | undefined;
};

export type ServerSelection = {
	source: "explicit" | "bundled" | "managed" | "none";
	serverPath?: string;
	/** CLI that belongs to the same toolchain as the selected server. */
	siblingCliPath?: string;
	stale?: StaleToolchain;
};

function exe(name: string, platform: NodeJS.Platform): string {
	return platform === "win32" ? `${name}.exe` : name;
}

export async function selectServer(
	input: ServerSelectionInput,
	deps: ToolchainDeps,
): Promise<ServerSelection> {
	const { platform, managedDir, expected } = input;
	const managedServer = join(managedDir, exe("beskid_lsp", platform));
	const managedCli = join(managedDir, exe("beskid", platform));
	const present = [managedServer, managedCli].filter((p) => deps.exists(p));

	let managedMatches = false;
	let found: ToolchainIdentity | undefined;
	if (deps.exists(managedCli)) {
		found = await deps.probe(managedCli);
		managedMatches =
			deps.exists(managedServer) && identitiesMatch(expected, found);
	}
	const stale: StaleToolchain | undefined =
		present.length > 0 && !managedMatches
			? { dir: managedDir, files: present, found }
			: undefined;

	if (input.explicitServerPath) {
		return withStale(
			{ source: "explicit", serverPath: input.explicitServerPath, ...sibling(input.explicitServerPath, platform, deps) },
			stale,
		);
	}
	if (input.bundledServerPath) {
		return withStale(
			{ source: "bundled", serverPath: input.bundledServerPath, ...sibling(input.bundledServerPath, platform, deps) },
			stale,
		);
	}
	if (managedMatches) {
		return { source: "managed", serverPath: managedServer, siblingCliPath: managedCli };
	}
	return withStale({ source: "none" }, stale);
}

function withStale(
	selection: ServerSelection,
	stale: StaleToolchain | undefined,
): ServerSelection {
	return stale ? { ...selection, stale } : selection;
}

function sibling(
	serverPath: string,
	platform: NodeJS.Platform,
	deps: ToolchainDeps,
): { siblingCliPath?: string } {
	const candidate = join(dirname(serverPath), exe("beskid", platform));
	return deps.exists(candidate) ? { siblingCliPath: candidate } : {};
}

export type CliSelectionInput = {
	expected: ToolchainIdentity;
	/** `beskid.cli.path` when the user set it to something other than the default. */
	explicitCliPath: string | undefined;
	server: ServerSelection;
	/** Command name looked up on PATH. */
	pathCommand: string;
};

export type CliSelection =
	| { source: "explicit" | "toolchain" | "path"; cliPath: string }
	| { source: "none"; reason: string };

/** CLI order: setting, the CLI of the server's toolchain, then PATH only when its version matches. */
export async function selectCli(
	input: CliSelectionInput,
	deps: ToolchainDeps,
): Promise<CliSelection> {
	if (input.explicitCliPath) {
		return { source: "explicit", cliPath: input.explicitCliPath };
	}
	if (input.server.siblingCliPath) {
		return { source: "toolchain", cliPath: input.server.siblingCliPath };
	}
	const found = await deps.probe(input.pathCommand);
	if (identitiesMatch(input.expected, found)) {
		return { source: "path", cliPath: input.pathCommand };
	}
	return {
		source: "none",
		reason: found
			? `\`${input.pathCommand}\` on PATH is ${describeIdentity(found)}, but this extension needs ${describeIdentity(input.expected)}.`
			: `No Beskid CLI of ${describeIdentity(input.expected)} was found.`,
	};
}

export function describeIdentity(identity: ToolchainIdentity): string {
	const abi = identity.runtimeAbi === undefined ? "unknown ABI" : `ABI ${identity.runtimeAbi}`;
	return `${normalizeVersion(identity.version)} (${abi})`;
}

export function staleToolchainMessage(
	stale: StaleToolchain,
	expected: ToolchainIdentity,
): string {
	const found = stale.found
		? describeIdentity(stale.found)
		: "a toolchain that did not answer `beskid dev capabilities`";
	return (
		`${stale.dir} holds ${found}, but this extension ships ${describeIdentity(expected)}. ` +
		"The extension ignores it."
	);
}
