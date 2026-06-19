import { assertTauriRuntime } from "@studio/core/platform/runtime";
import { commands, type XataAccount, type XataDatabase } from "@studio/lib/bindings";

export type { XataAccount, XataDatabase };

export async function isXataConnected(): Promise<boolean> {
  assertTauriRuntime();
  return commands.xataIsConnected();
}

// Validates a Xata API key (by listing workspaces), then stores it encrypted
// on-device. Xata's control-plane API is token-based (Bearer), so there's no
// OAuth flow.
export async function saveXataToken(token: string): Promise<void> {
  assertTauriRuntime();
  const result = await commands.xataSaveToken(token);
  if (result.status === "error") {
    throw result.error;
  }
}

// Lists the connectable Xata databases, flattened across the user's workspaces.
// Each entry carries its workspace id + region so a Postgres connection string
// can be minted for it without re-discovery.
export async function listXataDatabases(): Promise<XataDatabase[]> {
  assertTauriRuntime();
  const result = await commands.xataListDatabases();
  if (result.status === "error") {
    throw result.error;
  }
  return result.data;
}

// Mints the Postgres connection string for a database/branch on-device, with the
// stored API key embedded as the password — the key never crosses to the UI.
export async function buildXataConnectionString(
  workspaceId: string,
  region: string,
  databaseName: string,
  branch: string | null,
): Promise<string> {
  assertTauriRuntime();
  const result = await commands.xataBuildConnectionString(
    workspaceId,
    region,
    databaseName,
    branch,
  );
  if (result.status === "error") {
    throw result.error;
  }
  return result.data;
}

export async function disconnectXata(): Promise<void> {
  assertTauriRuntime();
  const result = await commands.xataDisconnect();
  if (result.status === "error") {
    throw result.error;
  }
}

// The Xata account the stored key belongs to — used to show which account the
// connection is authenticated as.
export async function getXataAccount(): Promise<XataAccount> {
  assertTauriRuntime();
  const result = await commands.xataAccount();
  if (result.status === "error") {
    throw result.error;
  }
  return result.data;
}
