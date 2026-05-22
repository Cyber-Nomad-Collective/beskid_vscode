import type { ExtensionContext } from "vscode";
import { readPckgBaseUrl } from "../config/workspaceSettings.js";
import { registryErrorMessage } from "../core/pckgErrors.js";
import type { LspProjectApi } from "../workspace/lspProjectApi.js";
import {
  buildRegistryPackageUrl,
  clearPckgCaches,
  createPckgFetchFromContext,
  getPackageDetails,
  searchPackages,
  type PckgSearchResult,
} from "./pckgClient.js";
import type { PackageDetails } from "./pckgTypes.js";

export class PckgService {
  constructor(
    private readonly context: ExtensionContext,
    private readonly lspApi: LspProjectApi,
    private readonly getWorkspaceProjUri: () => string | undefined,
  ) {}

  clearCaches(): void {
    clearPckgCaches();
  }

  async resolveRegistryBaseUrl(): Promise<string> {
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
