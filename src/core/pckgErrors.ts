export function isAuthHttpStatus(status: number | undefined): boolean {
  return status === 401 || status === 403;
}

export function registryErrorMessage(status: number | undefined, fallback?: string): string {
  if (status === 401 || status === 403) {
    return "Registry authentication failed. Configure Beskid: Package Registry API Key.";
  }
  if (status !== undefined && status >= 500) {
    return `Registry server error (HTTP ${status}).`;
  }
  if (status !== undefined && status >= 400) {
    return `Registry request failed (HTTP ${status}).`;
  }
  return fallback ?? "Registry request failed. Check network or base URL.";
}
