import { existsSync } from "node:fs";
import { dirname } from "node:path";
import type { ExtensionContext } from "vscode";
import * as vscode from "vscode";
import { readCliReleaseTag, resolveCliExecutablePath } from "../config/workspaceSettings.js";
import { appendToolchainFailure, formatToolchainError } from "./cliErrors.js";
import { installBeskidCli, type CliInstallResult } from "./cliInstall.js";
import { resolveCliPlatformAsset } from "./cliPlatform.js";
import { appendCliProcessLog, runCliProcess } from "./cliProcess.js";
import { discoverBootstrapProjects } from "./discoverBootstrapProjects.js";

const BOOTSTRAP_STATE_KEY = "beskid.toolchain.bootstrapped";

export type CliBootstrapResult = {
  cliPath: string;
  installed: boolean;
  install?: CliInstallResult;
  fetchAttempted: boolean;
  fetchFailures: { project: string; exitCode: number }[];
};

function readAutoFetchDependencies(): boolean {
  return (
    vscode.workspace.getConfiguration("beskid").get<boolean>("toolchain.autoFetchDependencies", true) ??
    true
  );
}

async function verifyCliSupportsLsp(
  cliPath: string,
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  outputChannel.appendLine(`[Beskid toolchain] Verifying ${cliPath} supports 'lsp'…`);
  const result = await runCliProcess(cliPath, ["lsp", "--help"]);
  appendCliProcessLog(outputChannel, cliPath, ["lsp", "--help"], undefined, result);
  if (result.exitCode !== 0) {
    throw new Error(
      `Installed CLI does not support 'beskid lsp' (exit ${result.exitCode}). ` +
        "Download a current release (default tag: cli-latest) or point beskid.cli.path at a local build.",
    );
  }
}

async function runProjectFetch(
  cliPath: string,
  projectUri: vscode.Uri,
  outputChannel: vscode.OutputChannel,
): Promise<number> {
  const manifest = projectUri.fsPath;
  const cwd = dirname(manifest);
  outputChannel.appendLine(`[Beskid toolchain] Fetching dependencies for ${manifest}`);
  const result = await runCliProcess(cliPath, ["fetch", "--project", manifest], { cwd });
  appendCliProcessLog(outputChannel, cliPath, ["fetch", "--project", manifest], cwd, result);
  return result.exitCode;
}

async function fetchWorkspaceDependencies(
  cliPath: string,
  outputChannel: vscode.OutputChannel,
): Promise<{ attempted: boolean; failures: { project: string; exitCode: number }[] }> {
  const projects = await discoverBootstrapProjects();
  if (projects.length === 0) {
    outputChannel.appendLine(
      "[Beskid toolchain] No Workspace.proj or Project.proj found in open folders; skipping fetch.",
    );
    return { attempted: false, failures: [] };
  }

  const failures: { project: string; exitCode: number }[] = [];
  for (const project of projects) {
    const exitCode = await runProjectFetch(cliPath, project, outputChannel);
    if (exitCode !== 0) {
      failures.push({ project: project.fsPath, exitCode });
    }
  }
  return { attempted: true, failures };
}

async function installManagedCli(
  outputChannel: vscode.OutputChannel,
  releaseTag: string,
): Promise<CliInstallResult> {
  const asset = resolveCliPlatformAsset();
  outputChannel.appendLine("[Beskid toolchain] Installing CLI from GitHub release…");
  outputChannel.appendLine(`  release tag: ${releaseTag}`);
  outputChannel.appendLine(`  platform: ${process.platform}-${process.arch}`);
  if (asset) {
    outputChannel.appendLine(`  asset: ${asset.releaseAsset}`);
  }
  outputChannel.show(true);
  return installBeskidCli(outputChannel, releaseTag);
}

/**
 * Ensures a managed CLI is present (downloads cli-latest by default), optionally fetches
 * workspace dependencies once, and verifies `beskid lsp` before the language server starts.
 */
export async function bootstrapBeskidToolchain(
  context: ExtensionContext,
  outputChannel: vscode.OutputChannel,
): Promise<CliBootstrapResult> {
  const releaseTag = readCliReleaseTag();
  let cliPath = resolveCliExecutablePath();
  let installed = false;
  let install: CliInstallResult | undefined;

  try {
    if (!cliPath) {
      install = await installManagedCli(outputChannel, releaseTag);
      cliPath = install.path;
      installed = true;
      outputChannel.appendLine(
        `[Beskid toolchain] Installed Beskid CLI ${install.version} → ${install.path}`,
      );
    } else {
      outputChannel.appendLine(`[Beskid toolchain] Using CLI at ${cliPath}`);
    }

    if (!existsSync(cliPath)) {
      throw new Error(`CLI path does not exist: ${cliPath}`);
    }

    const verifiedCliPath = context.globalState.get<string>("beskid.toolchain.verifiedCliPath");
    if (verifiedCliPath !== cliPath) {
      await verifyCliSupportsLsp(cliPath, outputChannel);
      await context.globalState.update("beskid.toolchain.verifiedCliPath", cliPath);
    }

    let fetchAttempted = false;
    const fetchFailures: { project: string; exitCode: number }[] = [];
    const alreadyBootstrapped = context.globalState.get<boolean>(BOOTSTRAP_STATE_KEY, false);
    const autoFetch = readAutoFetchDependencies();

    if (autoFetch && !alreadyBootstrapped) {
      const fetchResult = await fetchWorkspaceDependencies(cliPath, outputChannel);
      fetchAttempted = fetchResult.attempted;
      fetchFailures.push(...fetchResult.failures);

      if (fetchFailures.length === 0) {
        await context.globalState.update(BOOTSTRAP_STATE_KEY, true);
      } else {
        const summary = fetchFailures
          .map((f) => `${f.project} (exit ${f.exitCode})`)
          .join("; ");
        const detail = formatToolchainError("Dependency fetch", new Error(summary), {
          "release tag": releaseTag,
          cli: cliPath,
        });
        outputChannel.appendLine(detail);
        void vscode.window.showErrorMessage(
          "Beskid could not fetch all project dependencies. See the Beskid LSP output for details.",
          "Open Output",
        ).then((choice) => {
          if (choice === "Open Output") {
            outputChannel.show(true);
          }
        });
      }
    } else if (!autoFetch) {
      outputChannel.appendLine("[Beskid toolchain] autoFetchDependencies disabled; skipping fetch.");
    } else {
      outputChannel.appendLine("[Beskid toolchain] Dependencies already bootstrapped; skipping fetch.");
    }

    return { cliPath, installed, install, fetchAttempted, fetchFailures };
  } catch (error) {
    const asset = resolveCliPlatformAsset();
    const detail = appendToolchainFailure(outputChannel, "Toolchain bootstrap", error, {
      "release tag": releaseTag,
      platform: `${process.platform}-${process.arch}`,
      asset: asset?.releaseAsset,
    });
    void vscode.window.showErrorMessage(
      "Beskid toolchain setup failed. See the Beskid LSP output for details.",
      "Open Output",
    ).then((choice) => {
      if (choice === "Open Output") {
        outputChannel.show(true);
      }
    });
    throw new Error(detail);
  }
}
