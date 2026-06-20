import { assertTauriRuntime } from "@studio/core/platform/runtime";
import { commands, type VercelAccount, type VercelStore } from "@studio/lib/bindings";

export type { VercelAccount, VercelStore };

export async function isVercelConnected(): Promise<boolean> {
  assertTauriRuntime();
  return commands.vercelIsConnected();
}

// Validates a Vercel access token (by listing projects), then stores it
// encrypted on-device. Vercel's API is token-based (Bearer), so there's no
// OAuth flow.
export async function saveVercelToken(token: string): Promise<void> {
  assertTauriRuntime();
  const result = await commands.vercelSaveToken(token);
  if (result.status === "error") {
    throw result.error;
  }
}

// Lists the connectable Postgres stores (one per project). A store carries its
// connection string when the API could read it; otherwise the user pastes the
// POSTGRES_URL for that store in the connect flow.
export async function listVercelStores(): Promise<VercelStore[]> {
  assertTauriRuntime();
  const result = await commands.vercelListStores();
  if (result.status === "error") {
    throw result.error;
  }
  return result.data;
}

export async function disconnectVercel(): Promise<void> {
  assertTauriRuntime();
  const result = await commands.vercelDisconnect();
  if (result.status === "error") {
    throw result.error;
  }
}

// The Vercel account the stored token belongs to — used to show which account
// the connection is authenticated as.
export async function getVercelAccount(): Promise<VercelAccount> {
  assertTauriRuntime();
  const result = await commands.vercelAccount();
  if (result.status === "error") {
    throw result.error;
  }
  return result.data;
}
