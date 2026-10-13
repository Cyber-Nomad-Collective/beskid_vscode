import { statSync } from "node:fs";
import {
	CLI_CAPABILITIES_ARGS,
	REQUIRED_DEV_COMMANDS,
	REQUIRED_ROOT_COMMANDS,
} from "./cliCommandSurface.js";
import { type CliProcessResult, runCliProcess } from "./cliProcess.js";

/** Schema-1 document printed by `beskid dev capabilities --json`. */
export type CliCapabilityDocument = {
	schemaVersion: number;
	cliVersion: string;
	commands: string[];
	devCommands: string[];
	outputSchemas: unknown[];
};

export type CliCompatibility =
	| { compatible: true; cliPath: string; document: CliCapabilityDocument }
	| {
			compatible: false;
			cliPath: string;
			/** Missing capabilities, e.g. `check`, `dev lsp`, `dev capabilities`. */
			missing: string[];
			/** Upgrade guidance suitable for an error notification. */
			guidance: string;
			/** Extra diagnostic detail (exit code, stderr, parse error). */
			detail?: string;
			/** Set when the CLI process could not be started at all. */
			spawnError?: NodeJS.ErrnoException;
	  };

export type CliProcessRunner = (
	command: string,
	args: string[],
) => Promise<CliProcessResult>;

const SUPPORTED_SCHEMA_VERSION = 1;

export function cliUpgradeGuidance(cliPath: string, missing: string[]): string {
	return (
		`Beskid CLI ${cliPath} does not support the 0.6 command surface ` +
		`(missing: ${missing.join(", ")}). ` +
		"Run `beskid toolchain update` or install Beskid 0.6."
	);
}

function stringArray(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}
	return value.every((entry) => typeof entry === "string")
		? (value as string[])
		: undefined;
}

/** Parses the capability document; undefined when stdout is not a schema-1 document. */
export function parseCliCapabilities(
	stdout: string,
): CliCapabilityDocument | undefined {
	let raw: unknown;
	try {
		raw = JSON.parse(stdout.trim());
	} catch {
		return undefined;
	}
	if (!raw || typeof raw !== "object") {
		return undefined;
	}
	const record = raw as Record<string, unknown>;
	if (record.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
		return undefined;
	}
	const commands = stringArray(record.commands);
	if (!commands) {
		return undefined;
	}
	return {
		schemaVersion: SUPPORTED_SCHEMA_VERSION,
		cliVersion: typeof record.cliVersion === "string" ? record.cliVersion : "",
		commands,
		devCommands: stringArray(record.devCommands) ?? [],
		outputSchemas: Array.isArray(record.outputSchemas)
			? record.outputSchemas
			: [],
	};
}

/** Checks a parsed document against the commands the extension invokes. */
export function evaluateCliCapabilities(
	cliPath: string,
	document: CliCapabilityDocument,
): CliCompatibility {
	const missing = [
		...REQUIRED_ROOT_COMMANDS.filter((c) => !document.commands.includes(c)),
		...REQUIRED_DEV_COMMANDS.filter(
			(c) => !document.devCommands.includes(c),
		).map((c) => `dev ${c}`),
	];
	if (missing.length === 0) {
		return { compatible: true, cliPath, document };
	}
	return {
		compatible: false,
		cliPath,
		missing,
		guidance: cliUpgradeGuidance(cliPath, missing),
	};
}

const compatibleCache = new Map<string, CliCompatibility>();

function cacheKey(cliPath: string): string | undefined {
	try {
		const stat = statSync(cliPath);
		return `${cliPath}\u0000${stat.mtimeMs}\u0000${stat.size}`;
	} catch {
		return undefined;
	}
}

export function clearCliCapabilityCache(): void {
	compatibleCache.clear();
}

/**
 * Runs `beskid dev capabilities --json` and decides whether the CLI exposes the
 * 0.6 surface. Never probes retired spellings: a failing or incomplete answer
 * is incompatible and carries upgrade guidance. Compatible answers are cached
 * per executable path, mtime and size.
 */
export async function negotiateCliCapabilities(
	cliPath: string,
	run: CliProcessRunner = runCliProcess,
): Promise<CliCompatibility> {
	const key = run === runCliProcess ? cacheKey(cliPath) : undefined;
	const cached = key ? compatibleCache.get(key) : undefined;
	if (cached) {
		return cached;
	}

	let result: CliProcessResult;
	try {
		result = await run(cliPath, [...CLI_CAPABILITIES_ARGS]);
	} catch (error) {
		const errno = error as NodeJS.ErrnoException;
		const missing = ["dev capabilities"];
		return {
			compatible: false,
			cliPath,
			missing,
			guidance: cliUpgradeGuidance(cliPath, missing),
			detail: errno?.message ?? String(error),
			spawnError: errno,
		};
	}

	if (result.exitCode !== 0) {
		const missing = ["dev capabilities"];
		const stderr = result.stderr.trim();
		return {
			compatible: false,
			cliPath,
			missing,
			guidance: cliUpgradeGuidance(cliPath, missing),
			detail: `exit ${result.exitCode}${stderr ? `: ${stderr}` : ""}`,
		};
	}

	const document = parseCliCapabilities(result.stdout);
	if (!document) {
		const missing = ["dev capabilities schema 1"];
		return {
			compatible: false,
			cliPath,
			missing,
			guidance: cliUpgradeGuidance(cliPath, missing),
			detail: "capability document is not valid schema-1 JSON",
		};
	}

	const compatibility = evaluateCliCapabilities(cliPath, document);
	if (compatibility.compatible && key) {
		compatibleCache.set(key, compatibility);
	}
	return compatibility;
}

/** Formats an incompatibility for the output channel. */
export function describeIncompatibility(
	compatibility: Extract<CliCompatibility, { compatible: false }>,
): string {
	return compatibility.detail
		? `${compatibility.guidance} (${compatibility.detail})`
		: compatibility.guidance;
}
