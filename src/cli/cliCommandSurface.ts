import { dirname } from "node:path";

/**
 * Beskid 0.6 CLI command surface used by the extension.
 *
 * Every CLI argument vector the extension spawns is built here so retired
 * 0.5 spellings (`analyze`, `lsp`, `fetch`, `lock`, `pckg`, ...) cannot leak
 * back in. Pure module: no `vscode` import, safe for unit tests.
 */

/** Language server over stdio: `beskid dev lsp`. */
export const CLI_LSP_ARGS: readonly string[] = ["dev", "lsp"];

/** Managed language server install: `beskid dev lsp install [--release-tag <tag>]`. */
export function cliLspInstallArgs(releaseTag?: string): string[] {
	const tag = releaseTag?.trim();
	return [...CLI_LSP_ARGS, "install", ...(tag ? ["--release-tag", tag] : [])];
}

/** Capability negotiation: `beskid dev capabilities --json`. */
export const CLI_CAPABILITIES_ARGS: readonly string[] = [
	"dev",
	"capabilities",
	"--json",
];

/** Project operations the extension runs through the CLI. */
export const BESKID_CLI_OPERATIONS = [
	"fetch",
	"lock",
	"build",
	"test",
	"check",
] as const;

export type BeskidCliOperation = (typeof BESKID_CLI_OPERATIONS)[number];

const OPERATION_ARGS: Record<BeskidCliOperation, readonly string[]> = {
	fetch: ["dev", "project", "fetch"],
	lock: ["dev", "project", "lock"],
	build: ["build"],
	test: ["test"],
	check: ["check"],
};

/** Root commands the extension requires in the capability document. */
export const REQUIRED_ROOT_COMMANDS: readonly string[] = [
	"check",
	"build",
	"test",
];

/** `dev` commands the extension requires in the capability document. */
export const REQUIRED_DEV_COMMANDS: readonly string[] = ["lsp", "project"];

/** True when `path` names a `.bproj` manifest (the only `--project` target the extension passes). */
export function isProjectManifestPath(path: string | undefined): boolean {
	return typeof path === "string" && path.toLowerCase().endsWith(".bproj");
}

/**
 * Argument vector for a project operation. Passes `--project <bproj>` when a
 * focused project manifest is known.
 */
export function cliOperationArgs(
	operation: BeskidCliOperation,
	projectManifest?: string,
	extraArgs: readonly string[] = [],
): string[] {
	const args = [...OPERATION_ARGS[operation]];
	if (projectManifest && isProjectManifestPath(projectManifest)) {
		args.push("--project", projectManifest);
	}
	args.push(...extraArgs);
	return args;
}

/** Human-readable command label, e.g. `dev project fetch`. */
export function cliOperationLabel(operation: BeskidCliOperation): string {
	return OPERATION_ARGS[operation].join(" ");
}

/**
 * Task invocation for a `projectPath` task definition value (project directory
 * or `.bproj` manifest). A manifest becomes `--project <bproj>` with its
 * directory as cwd.
 */
export function cliTaskInvocation(
	operation: BeskidCliOperation,
	projectPath: string | undefined,
	defaultCwd: string,
): { cwd: string; args: string[] } {
	const trimmed = projectPath?.trim();
	if (trimmed && isProjectManifestPath(trimmed)) {
		return { cwd: dirname(trimmed), args: cliOperationArgs(operation, trimmed) };
	}
	return {
		cwd: trimmed && trimmed.length > 0 ? trimmed : defaultCwd,
		args: cliOperationArgs(operation),
	};
}

/** True when a launch argument vector is the CLI-hosted language server. */
export function isCliLspLaunch(args: readonly string[]): boolean {
	return args.length >= 2 && args[0] === "dev" && args[1] === "lsp";
}
