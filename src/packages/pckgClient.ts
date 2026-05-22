import type { ExtensionContext } from "vscode";
import { registryErrorMessage } from "../core/pckgErrors.js";
import type {
  PackageDetails,
  PackageSearchRow,
  PckgFetchOptions,
} from "./pckgTypes.js";

export type PckgFetchOk<T> = { ok: true; data: T };
export type PckgFetchErr = { ok: false; status?: number; error: string };
export type PckgFetchResult<T> = PckgFetchOk<T> | PckgFetchErr;

export type PckgSearchResult =
  | { ok: true; rows: PackageSearchRow[] }
  | { ok: false; error: string; needsApiKey?: boolean };

export const PCKG_API_KEY_SECRET = "beskid.pckg.apiKey";

export async function readPckgApiKey(context: ExtensionContext): Promise<string | undefined> {
  const stored = await context.secrets.get(PCKG_API_KEY_SECRET);
  return stored?.trim() || undefined;
}

export async function writePckgApiKey(
  context: ExtensionContext,
  apiKey: string | undefined,
): Promise<void> {
  if (!apiKey?.trim()) {
    await context.secrets.delete(PCKG_API_KEY_SECRET);
    return;
  }
  await context.secrets.store(PCKG_API_KEY_SECRET, apiKey.trim());
}

export async function createPckgFetchFromContext(
  context: ExtensionContext,
  baseUrl: string,
): Promise<typeof fetch> {
  const apiKey = await readPckgApiKey(context);
  return createPckgFetch({ baseUrl, apiKey });
}

/** Cached registry client bound to extension SecretStorage. */
export class PckgClient {
  constructor(private readonly context: ExtensionContext) {}

  clearCache(): void {
    clearPckgCaches();
  }

  async searchPackages(
    baseUrl: string,
    query: string,
    limit = 50,
  ): Promise<PckgSearchResult> {
    const fetchFn = await createPckgFetchFromContext(this.context, baseUrl);
    return searchPackages(fetchFn, baseUrl, query, limit);
  }

  async getPackageDetails(
    baseUrl: string,
    packageName: string,
  ): Promise<
    | { ok: true; data: PackageDetails }
    | { ok: false; error: string; needsApiKey?: boolean }
  > {
    const fetchFn = await createPckgFetchFromContext(this.context, baseUrl);
    const result = await getPackageDetails(fetchFn, baseUrl, packageName);
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

const SEARCH_TTL_MS = 30_000;
const DETAILS_TTL_MS = 60_000;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const searchCache = new Map<string, CacheEntry<PackageSearchRow[]>>();
const detailsCache = new Map<string, CacheEntry<PackageDetails>>();

function cacheKey(baseUrl: string, suffix: string): string {
  return `${baseUrl.replace(/\/$/, "")}::${suffix}`;
}

function readCache<T>(map: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = map.get(key);
  if (!entry) {
    return undefined;
  }
  if (Date.now() > entry.expiresAt) {
    map.delete(key);
    return undefined;
  }
  return entry.value;
}

function writeCache<T>(map: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number): void {
  map.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function clearPckgCaches(): void {
  searchCache.clear();
  detailsCache.clear();
}

export function buildRegistryPackageUrl(baseUrl: string, packageName: string): string {
  const root = baseUrl.replace(/\/$/, "");
  return `${root}/packages/${encodeURIComponent(packageName)}`;
}

export function createPckgFetch(
  options: PckgFetchOptions,
  underlying: typeof fetch = fetch,
): typeof fetch {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.apiKey?.trim()) {
    headers.Authorization = `Bearer ${options.apiKey.trim()}`;
  }
  return (input, init) =>
    underlying(input, {
      ...init,
      headers: {
        ...headers,
        ...(init?.headers as Record<string, string> | undefined),
      },
    });
}

async function fetchPckgJson<T>(
  fetchFn: typeof fetch,
  baseUrl: string,
  pathname: string,
  searchParams: Record<string, string>,
): Promise<PckgFetchResult<T>> {
  try {
    const url = new URL(pathname, baseUrl);
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
    const response = await fetchFn(url);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: registryErrorMessage(response.status),
      };
    }
    return { ok: true, data: (await response.json()) as T };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: registryErrorMessage(undefined, msg) };
  }
}

export async function searchPackages(
  fetchFn: typeof fetch,
  baseUrl: string,
  query: string,
  limit = 50,
): Promise<PckgSearchResult> {
  const key = cacheKey(baseUrl, `search:${query}:${limit}`);
  const cached = readCache(searchCache, key);
  if (cached) {
    return { ok: true, rows: cached };
  }
  const params: Record<string, string> = { limit: String(limit) };
  if (query.length > 0) {
    params.q = query;
  }
  const result = await fetchPckgJson<PackageSearchRow[]>(fetchFn, baseUrl, "/api/search", params);
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      needsApiKey: result.status === 401 || result.status === 403,
    };
  }
  if (!Array.isArray(result.data)) {
    return { ok: false, error: "Unexpected registry response." };
  }
  writeCache(searchCache, key, result.data, SEARCH_TTL_MS);
  return { ok: true, rows: result.data };
}

export async function getPackageDetails(
  fetchFn: typeof fetch,
  baseUrl: string,
  packageName: string,
): Promise<PckgFetchResult<PackageDetails>> {
  const key = cacheKey(baseUrl, `details:${packageName}`);
  const cached = readCache(detailsCache, key);
  if (cached) {
    return { ok: true, data: cached };
  }
  const result = await fetchPckgJson<PackageDetails>(
    fetchFn,
    baseUrl,
    `/api/packages/${encodeURIComponent(packageName)}`,
    {},
  );
  if (!result.ok) {
    return result;
  }
  if (!result.data?.package?.name) {
    return { ok: false, error: "Package not found." };
  }
  writeCache(detailsCache, key, result.data, DETAILS_TTL_MS);
  return result;
}
