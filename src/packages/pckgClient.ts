import { registryErrorMessage } from "../core/pckgErrors.js";
import type {
  PackageDetails,
  PackageSearchRow,
  PackageSummary,
  PckgFetchOptions,
} from "./pckgTypes.js";

export type PckgFetchOk<T> = { ok: true; data: T };
export type PckgFetchErr = { ok: false; status?: number; error: string };
export type PckgFetchResult<T> = PckgFetchOk<T> | PckgFetchErr;

export type PckgSearchResult =
  | { ok: true; rows: PackageSearchRow[] }
  | { ok: false; error: string; needsApiKey?: boolean };

export const PCKG_API_KEY_SECRET = "beskid.pckg.apiKey";

const SEARCH_TTL_MS = 30_000;
const LIST_TTL_MS = 30_000;
const DETAILS_TTL_MS = 60_000;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const searchCache = new Map<string, CacheEntry<PackageSearchRow[]>>();
const listCache = new Map<string, CacheEntry<PackageSearchRow[]>>();
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
  listCache.clear();
  detailsCache.clear();
}

function rowsFromPackageSummaries(packages: PackageSummary[]): PackageSearchRow[] {
  return packages.map((pkg) => ({ package: pkg }));
}

export async function listPackages(
  fetchFn: typeof fetch,
  baseUrl: string,
  limit = 50,
): Promise<PckgSearchResult> {
  const key = cacheKey(baseUrl, `list:${limit}`);
  const cached = readCache(listCache, key);
  if (cached) {
    return { ok: true, rows: cached };
  }

  const listResult = await fetchPckgJson<PackageSummary[]>(fetchFn, baseUrl, "/api/packages", {});
  if (listResult.ok && Array.isArray(listResult.data)) {
    const rows = rowsFromPackageSummaries(listResult.data.slice(0, limit));
    writeCache(listCache, key, rows, LIST_TTL_MS);
    return { ok: true, rows };
  }

  const searchResult = await fetchPckgJson<PackageSearchRow[]>(
    fetchFn,
    baseUrl,
    "/api/search",
    { limit: String(limit) },
  );
  if (!searchResult.ok) {
    return {
      ok: false,
      error: searchResult.error,
      needsApiKey: searchResult.status === 401 || searchResult.status === 403,
    };
  }
  if (!Array.isArray(searchResult.data)) {
    return { ok: false, error: "Unexpected registry response." };
  }
  writeCache(listCache, key, searchResult.data, LIST_TTL_MS);
  return { ok: true, rows: searchResult.data };
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
