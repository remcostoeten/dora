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

export async function listSupabaseProjects(): Promise<SupabaseProject[]> {
  const result = await commands.supabaseListProjects();
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
): string {
  const encodedPassword = encodeURIComponent(password);
  if (mode === "direct") {
    const host = project.dbHost || `db.${project.id}.supabase.co`;
    return `postgresql://postgres:${encodedPassword}@${host}:5432/postgres`;
  }

  const port = mode === "transaction" ? 6543 : 5432;
  return `postgresql://postgres.${project.id}:${encodedPassword}@aws-${project.region}.pooler.supabase.com:${port}/postgres?pgbouncer=true`;
}
