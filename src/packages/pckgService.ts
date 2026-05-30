import type { ExtensionContext } from "vscode";
import { readPckgBaseUrl, readPckgApiKey } from "../config/workspaceSettings.js";
import { registryErrorMessage } from "../core/pckgErrors.js";
import type { LspProjectApi } from "../workspace/lspProjectApi.js";
import type { LspPckgApi } from "./lspPckgApi.js";
import type { PckgConnectionStatus, PckgValidateConnectionResult } from "./pckgConnectionTypes.js";
import {
  buildRegistryPackageUrl,
  clearPckgCaches,
  createPckgFetch,
  getPackageDetails,
  listPackages,
  searchPackages,
  type PckgSearchResult,
} from "./pckgClient.js";
import type { PackageDetails } from "./pckgTypes.js";

async function createPckgFetchFromContext(
  context: ExtensionContext,
  baseUrl: string,
): Promise<typeof fetch> {
  const apiKey = await readPckgApiKey(context);
  return createPckgFetch({ baseUrl, apiKey });
}

export class PckgService {
  private connectionStatusCache: PckgConnectionStatus | undefined;

  constructor(
    private readonly context: ExtensionContext,
    private readonly lspApi: LspProjectApi,
    private readonly lspPckg: LspPckgApi,
    private readonly getWorkspaceProjUri: () => string | undefined,
  ) {}

  clearCaches(): void {
    clearPckgCaches();
    this.connectionStatusCache = undefined;
  }

  async getConnectionStatus(forceRefresh = false): Promise<PckgConnectionStatus> {
    if (!forceRefresh && this.connectionStatusCache) {
      return this.connectionStatusCache;
    }
    const authConfigured = Boolean(await readPckgApiKey(this.context));
    const workspaceUri = this.getWorkspaceProjUri();
    const fromLsp = await this.lspPckg.getConnectionStatus({ workspaceUri, authConfigured });
    if (fromLsp?.baseUrl) {
      this.connectionStatusCache = fromLsp;
      return fromLsp;
    }

    const fallbackUrl = await this.resolveRegistryBaseUrlFromManifest();
    const status: PckgConnectionStatus = {
      baseUrl: fallbackUrl,
      registryName: null,
      workspaceDefaultRegistryUrl: fallbackUrl || null,
      workspaceDefaultRegistryName: fallbackUrl ? "default" : null,
      authConfigured,
      validation: { status: "unknown", message: null },
      connected: false,
    };
    this.connectionStatusCache = status;
    return status;
  }

  async probePublicCatalog(): Promise<void> {
    await this.validateConnection();
  }

  async validateConnection(apiKey?: string): Promise<PckgValidateConnectionResult> {
    const workspaceUri = this.getWorkspaceProjUri();
    const baseUrl = (await this.getConnectionStatus()).baseUrl || undefined;
    const result = await this.lspPckg.validateConnection({
      workspaceUri,
      baseUrl,
      apiKey,
    });
    this.connectionStatusCache = undefined;
    if (result) {
      return result;
    }
    return {
      ok: false,
      error: "Language server unavailable.",
      validation: { status: "error", message: "Language server unavailable." },
    };
  }

  async resolveRegistryBaseUrl(): Promise<string> {
    const status = await this.getConnectionStatus();
    if (status.baseUrl) {
      return status.baseUrl.replace(/\/$/, "");
    }
    return readPckgBaseUrl().replace(/\/$/, "");
  }

  private async resolveRegistryBaseUrlFromManifest(): Promise<string> {
    const workspaceUri = this.getWorkspaceProjUri();
    if (workspaceUri) {
      const summary = await this.lspApi.getWorkspaceSummary(workspaceUri);
      const defaultRegistry = summary?.registries?.default?.trim();
      if (defaultRegistry) {
        return defaultRegistry.replace(/\/$/, "");
      }
    }
    return readPckgBaseUrl().replace(/\/$/, "");
  }

  buildPackageUrl(baseUrl: string, packageName: string): string {
    return buildRegistryPackageUrl(baseUrl, packageName);
  }

  async list(limit = 50): Promise<PckgSearchResult> {
    const base = await this.resolveRegistryBaseUrl();
    const fetchFn = await createPckgFetchFromContext(this.context, base);
    return listPackages(fetchFn, base, limit);
  }

  async search(query: string, limit = 50): Promise<PckgSearchResult> {
    const base = await this.resolveRegistryBaseUrl();
    const fetchFn = await createPckgFetchFromContext(this.context, base);
    return searchPackages(fetchFn, base, query, limit);
  }

  async getDetails(
    packageName: string,
  ): Promise<
    | { ok: true; data: PackageDetails }
    | { ok: false; error: string; needsApiKey?: boolean }
  > {
    const base = await this.resolveRegistryBaseUrl();
    const fetchFn = await createPckgFetchFromContext(this.context, base);
    const result = await getPackageDetails(fetchFn, base, packageName);
    if (!result.ok) {
      return {
        ok: false,
        error: registryErrorMessage(result.status),
        needsApiKey: result.status === 401 || result.status === 403,
      };
    }
    if (!result.data?.package?.name) {
      return { ok: false, error: "Package not found." };
    }
    return { ok: true, data: result.data };
  }
}
