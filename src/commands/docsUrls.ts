const DEFAULT_BOOK_BASE = "https://beskid-lang.org";
const DEFAULT_SPEC_BASE = "https://beskid-lang.org/platform-spec";
const DEFAULT_PCKG_BASE = "https://pckg.beskid-lang.org";

/** Join site-relative `/platform-spec/...` paths with the configured spec base URL. */
export function resolveDocumentationUrl(
  url: string,
  options?: { specBaseUrl?: string; bookBaseUrl?: string },
): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith("/platform-spec/")) {
    const specBase = (options?.specBaseUrl ?? DEFAULT_SPEC_BASE).replace(/\/$/, "");
    const siteRoot = specBase.replace(/\/platform-spec\/?$/i, "").replace(/\/$/, "");
    return `${siteRoot || DEFAULT_BOOK_BASE}${trimmed}`;
  }
  if (trimmed.startsWith("/")) {
    const bookBase = (options?.bookBaseUrl ?? DEFAULT_BOOK_BASE).replace(/\/$/, "");
    return `${bookBase}${trimmed}`;
  }
  return trimmed;
}

export function buildFallbackDocsUrl(
  symbolName?: string,
  options?: { bookBaseUrl?: string },
): string {
  const bookBase = (options?.bookBaseUrl ?? DEFAULT_BOOK_BASE).replace(/\/$/, "");
  if (symbolName?.trim()) {
    return `${bookBase}/book/?q=${encodeURIComponent(symbolName.trim())}`;
  }
  return `${bookBase}/book/`;
}

export function buildPckgDocsUrl(
  packageName: string,
  version: string,
  symbol?: string,
  options?: { pckgBaseUrl?: string },
): string {
  const base = (options?.pckgBaseUrl ?? DEFAULT_PCKG_BASE).replace(/\/$/, "");
  const atVersion = `${encodeURIComponent(packageName)}@${encodeURIComponent(version)}`;
  const fragment = symbol?.trim() ? `#${encodeURIComponent(symbol.trim())}` : "";
  return `${base}/docs/${atVersion}${fragment}`;
}
