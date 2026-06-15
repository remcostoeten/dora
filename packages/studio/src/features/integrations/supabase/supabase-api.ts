import { commands, type SupabaseProject } from "@studio/lib/bindings";

export type SupabaseConnectionMode = "direct" | "session" | "transaction";

export async function isSupabaseConnected(): Promise<boolean> {
  return commands.supabaseIsConnected();
}

export async function saveSupabaseToken(token: string): Promise<void> {
  const result = await commands.supabaseSaveToken(token);
  if (result.status === "error") {
    throw result.error;
  }
}

// One-click OAuth: opens the system browser and resolves once the user has
// approved access and tokens have been stored on-device. Rejects on timeout,
// denial, or if the user closes the browser tab.
export async function connectSupabaseWithOauth(): Promise<void> {
  const result = await commands.supabaseOauthConnect();
  if (result.status === "error") {
    throw result.error;
  }
}

export async function listSupabaseProjects(): Promise<SupabaseProject[]> {
  const result = await commands.supabaseListProjects();
  if (result.status === "error") {
    throw result.error;
  }
  return result.data;
}

// Resolves the project's real Supavisor pooler host from the Management API.
// The cluster index (aws-0-, aws-1-, …) varies per project and can't be derived
// from the region, so guessing it produces an unresolvable hostname.
export async function getSupabasePoolerHost(projectRef: string): Promise<string> {
  const result = await commands.supabasePoolerHost(projectRef);
  if (result.status === "error") {
    throw result.error;
  }
  return result.data;
}

export async function disconnectSupabase(): Promise<void> {
  const result = await commands.supabaseDisconnect();
  if (result.status === "error") {
    throw result.error;
  }
}

export function buildSupabaseConnectionUrl(
  project: SupabaseProject,
  password: string,
  mode: SupabaseConnectionMode,
  // Real pooler host from getSupabasePoolerHost(). When omitted we fall back to
  // the most common cluster (aws-0-), which is only a best-effort guess.
  poolerHost?: string,
): string {
  const encodedPassword = encodeURIComponent(password);
  if (mode === "direct") {
    const host = project.dbHost || `db.${project.id}.supabase.co`;
    return `postgresql://postgres:${encodedPassword}@${host}:5432/postgres`;
  }

  const host = poolerHost || `aws-0-${project.region}.pooler.supabase.com`;
  const port = mode === "transaction" ? 6543 : 5432;
  return `postgresql://postgres.${project.id}:${encodedPassword}@${host}:${port}/postgres?pgbouncer=true`;
}
