/** Stable JSON shape for `beskid.pckg.getConnectionStatus` (LSP + dashboard cards). */

export type PckgValidationState = {
  status: "unknown" | "ok" | "error";
  message?: string | null;
};

export type PckgConnectionStatus = {
  baseUrl: string;
  registryName?: string | null;
  workspaceDefaultRegistryUrl?: string | null;
  workspaceDefaultRegistryName?: string | null;
  authConfigured: boolean;
  validation: PckgValidationState;
  connected: boolean;
};

export type PckgValidateConnectionResult = {
  ok: boolean;
  error?: string | null;
  validation: PckgValidationState;
};
