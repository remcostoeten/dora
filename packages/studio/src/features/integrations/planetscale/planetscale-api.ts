import { assertTauriRuntime } from "@studio/core/platform/runtime";
import {
  commands,
  type PlanetscaleBranch,
  type PlanetscaleDatabase,
  type PlanetscaleOrganization,
  type PlanetscalePassword,
} from "@studio/lib/bindings";

export type {
  PlanetscaleBranch,
  PlanetscaleDatabase,
  PlanetscaleOrganization,
  PlanetscalePassword,
};

export async function isPlanetscaleConnected(): Promise<boolean> {
  assertTauriRuntime();
  return commands.planetscaleIsConnected();
}

// Validates a PlanetScale service token (by listing organizations), then stores
// it encrypted on-device. PlanetScale's API uses an `<id>:<token>` service token
// in the Authorization header, so there's no OAuth flow.
export async function savePlanetscaleToken(token: string): Promise<void> {
  assertTauriRuntime();
  const result = await commands.planetscaleSaveToken(token);
  if (result.status === "error") {
    throw result.error;
  }
}

// The PlanetScale organizations the stored token can access — used to show which
// account the connection is authenticated as.
export async function getPlanetscaleAccount(): Promise<PlanetscaleOrganization[]> {
  assertTauriRuntime();
  const result = await commands.planetscaleAccount();
  if (result.status === "error") {
    throw result.error;
  }
  return result.data;
}

export async function listPlanetscaleDatabases(
  organization: string,
): Promise<PlanetscaleDatabase[]> {
  assertTauriRuntime();
  const result = await commands.planetscaleListDatabases(organization);
  if (result.status === "error") {
    throw result.error;
  }
  return result.data;
}

export async function listPlanetscaleBranches(
  organization: string,
  database: string,
  defaultBranch: string,
): Promise<PlanetscaleBranch[]> {
  assertTauriRuntime();
  const result = await commands.planetscaleListBranches(
    organization,
    database,
    defaultBranch,
  );
  if (result.status === "error") {
    throw result.error;
  }
  return result.data;
}

// Mints a fresh MySQL password on a branch. PlanetScale returns the plaintext
// password only at creation, so the connect flow builds the connection string
// from this immediately — the user never copies a secret.
export async function createPlanetscalePassword(
  organization: string,
  database: string,
  branch: string,
): Promise<PlanetscalePassword> {
  assertTauriRuntime();
  const result = await commands.planetscaleCreatePassword(
    organization,
    database,
    branch,
  );
  if (result.status === "error") {
    throw result.error;
  }
  return result.data;
}

export async function disconnectPlanetscale(): Promise<void> {
  assertTauriRuntime();
  const result = await commands.planetscaleDisconnect();
  if (result.status === "error") {
    throw result.error;
  }
}
