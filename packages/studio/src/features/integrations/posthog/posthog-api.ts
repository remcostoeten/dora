import { assertTauriRuntime } from "@studio/core/platform/runtime";
import {
  commands,
  type PosthogConfig,
  type PosthogQueryResult,
  type PosthogRegion,
} from "@studio/lib/bindings";

export type { PosthogConfig, PosthogQueryResult, PosthogRegion };

export async function isPosthogConnected(): Promise<boolean> {
  assertTauriRuntime();
  return commands.posthogIsConnected();
}

// Validates the pasted personal API key against the project/region by running a
// trivial HogQL query, then persists the credential set encrypted on-device.
export async function savePosthogCredentials(
  apiKey: string,
  region: PosthogRegion,
  projectId: string,
): Promise<void> {
  assertTauriRuntime();
  const result = await commands.posthogSaveCredentials(apiKey, region, projectId);
  if (result.status === "error") {
    throw result.error;
  }
}

export async function runPosthogQuery(hogql: string): Promise<PosthogQueryResult> {
  assertTauriRuntime();
  const result = await commands.posthogRunQuery(hogql);
  if (result.status === "error") {
    throw result.error;
  }
  return result.data;
}

// The connected project's region and id (never the API key), used to prefill
// the connect form and show which project is active.
export async function getPosthogConfig(): Promise<PosthogConfig | null> {
  assertTauriRuntime();
  const result = await commands.posthogConfig();
  if (result.status === "error") {
    throw result.error;
  }
  return result.data;
}

export async function disconnectPosthog(): Promise<void> {
  assertTauriRuntime();
  const result = await commands.posthogDisconnect();
  if (result.status === "error") {
    throw result.error;
  }
}
