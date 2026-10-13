import { existsSync } from "node:fs";
import {
	type CliProcessRunner,
	describeIncompatibility,
	negotiateCliCapabilities,
} from "./cliCapabilities.js";
import { cliLspInstallArgs } from "./cliCommandSurface.js";
import { appendCliProcessLog, runCliProcess } from "./cliProcess.js";
import { defaultLspInstallPath } from "./lspPlatform.js";
import { resolveLspReleaseTag } from "./releaseTags.js";

export type LspInstallResult = {
	path: string;
	version: string;
	releaseTag: string;
};

export type LspInstallOutput = {
	appendLine: (line: string) => void;
	show?: (preserveFocus?: boolean) => void;
};

export type LspInstallDeps = {
	run: CliProcessRunner;
	resolveTag: (tag: string) => Promise<string>;
	installPath: () => string;
	exists: (path: string) => boolean;
};

const DEFAULT_DEPS: LspInstallDeps = {
	run: runCliProcess,
	resolveTag: resolveLspReleaseTag,
	installPath: () => defaultLspInstallPath(),
	exists: existsSync,
};

const INSTALLED_LINE = /Installed Beskid LSP (\S+) \(([^)]+)\)/;

/**
 * Installs the managed language server through the CLI:
 * `beskid dev lsp install --release-tag <tag>`. Fails closed with upgrade
 * guidance when the CLI does not negotiate the 0.6 surface; the extension
 * never downloads the language server itself.
 */
export async function installBeskidLsp(
	cliPath: string,
	outputChannel: LspInstallOutput,
	releaseTag: string,
	deps: Partial<LspInstallDeps> = {},
): Promise<LspInstallResult> {
	const { run, resolveTag, installPath, exists } = { ...DEFAULT_DEPS, ...deps };

	const compatibility = await negotiateCliCapabilities(cliPath, deps.run);
	if (!compatibility.compatible) {
		const message = describeIncompatibility(compatibility);
		outputChannel.appendLine(`[Beskid toolchain] ${message}`);
		throw new Error(message);
	}

	const tag = await resolveTag(releaseTag);
	const args = cliLspInstallArgs(tag);
	outputChannel.show?.(true);
	const result = await run(cliPath, args);
	appendCliProcessLog(outputChannel, cliPath, args, undefined, result);
	if (result.exitCode !== 0) {
		const stderr = result.stderr.trim();
		throw new Error(
			`\`beskid ${args.join(" ")}\` failed (exit ${result.exitCode})` +
				(stderr ? `: ${stderr}` : "."),
		);
	}

	const path = installPath();
	if (!exists(path)) {
		throw new Error(
			`\`beskid ${args.join(" ")}\` succeeded but ${path} does not exist.`,
		);
	}
	const installed = INSTALLED_LINE.exec(result.stdout);
	return {
		path,
		version: installed?.[1] ?? "unknown",
		releaseTag: installed?.[2] ?? tag,
	};
}
