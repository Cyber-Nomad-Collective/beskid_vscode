import type {
  PckgConnectionStatus,
  PckgValidateConnectionResult,
  PckgValidationState,
} from "./pckgConnectionTypes.js";

function mapPckgValidation(raw: Record<string, unknown> | undefined): PckgValidationState {
  const validation = raw ?? {};
  return {
    status: (validation.status as PckgValidationState["status"]) ?? "unknown",
    message: (validation.message as string | null | undefined) ?? null,
  };
}

export function mapPckgConnectionStatus(raw: Record<string, unknown>): PckgConnectionStatus {
  return {
    baseUrl: String(raw.baseUrl ?? ""),
    registryName: (raw.registryName as string | null | undefined) ?? null,
    workspaceDefaultRegistryUrl:
      (raw.workspaceDefaultRegistryUrl as string | null | undefined) ?? null,
    workspaceDefaultRegistryName:
      (raw.workspaceDefaultRegistryName as string | null | undefined) ?? null,
    authConfigured: Boolean(raw.authConfigured),
    validation: mapPckgValidation(raw.validation as Record<string, unknown> | undefined),
    connected: Boolean(raw.connected),
  };
}

export function mapPckgValidateConnectionResult(
  raw: Record<string, unknown>,
): PckgValidateConnectionResult {
  return {
    ok: Boolean(raw.ok),
    error: (raw.error as string | null | undefined) ?? null,
    validation: mapPckgValidation(raw.validation as Record<string, unknown> | undefined),
  };
}
