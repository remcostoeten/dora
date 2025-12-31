import { commands, type JsonValue } from "@/lib/bindings";
import type { SqlQueryResult } from "./types";

export async function executeSqlQuery(
  connectionId: string,
  query: string
): Promise<SqlQueryResult> {
  try {
    const startResult = await commands.startQuery(connectionId, query);
    if (startResult.status !== "ok" || !startResult.data[0]) {
      throw new Error("Failed to start query");
    }

    const queryId = startResult.data[0];
    const fetchResult = await commands.fetchQuery(queryId);
    
    if (fetchResult.status !== "ok") {
      throw new Error("Failed to fetch query results");
    }

    const pageInfo = fetchResult.data;
    const columnsResult = await commands.getColumns(queryId);

    const columns = columnsResult.status === "ok" && Array.isArray(columnsResult.data)
      ? columnsResult.data.map((col: any) => ({
          name: col.name,
          type: col.data_type || col.type || "unknown",
          nullable: col.is_nullable ?? col.nullable ?? false,
          primaryKey: col.is_primary_key ?? col.primary_key ?? false,
        }))
      : [];

    const rows: Record<string, unknown>[] = Array.isArray(pageInfo.first_page)
      ? pageInfo.first_page.map((row): Record<string, unknown> => {
          if (typeof row === 'object' && row !== null && !Array.isArray(row)) {
            return row as Record<string, unknown>;
          }
          return {};
        })
      : [];

    const isError = pageInfo.status === "Error";
    
    return {
      columns: columns.map(c => c.name),
      rows,
      rowCount: pageInfo.affected_rows ?? rows.length,
      executionTime: 0,
      error: isError ? pageInfo.error ?? undefined : undefined,
      queryType: getQueryType(query),
    };
  } catch (error) {
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTime: 0,
      error: error instanceof Error ? error.message : "Unknown error",
      queryType: "OTHER",
    };
  }
}

function getQueryType(query: string): "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "OTHER" {
  const trimmed = query.trim().toUpperCase();
  if (trimmed.startsWith("SELECT")) return "SELECT";
  if (trimmed.startsWith("INSERT")) return "INSERT";
  if (trimmed.startsWith("UPDATE")) return "UPDATE";
  if (trimmed.startsWith("DELETE")) return "DELETE";
  return "OTHER";
}

export async function getSnippets(connectionId: string | null): Promise<any[]> {
  const result = await commands.getScripts(connectionId);
  if (result.status === "ok") {
    return result.data.map((script: any) => ({
      id: script.id.toString(),
      name: script.name,
      content: script.query_text,
      createdAt: new Date(script.created_at),
      updatedAt: new Date(script.updated_at),
      isFolder: false,
      parentId: null,
    }));
  }
  return [];
}

export async function saveSnippet(
  name: string,
  content: string,
  connectionId: string | null,
  description: string | null = null
): Promise<void> {
  const result = await commands.saveScript(name, content, connectionId, description);
  if (result.status === "error") {
    throw new Error(result.error as string);
  }
}

export async function updateSnippet(
  id: number,
  name: string,
  content: string,
  connectionId: string | null,
  description: string | null = null
): Promise<void> {
  const result = await commands.updateScript(id, name, content, connectionId, description);
  if (result.status === "error") {
    throw new Error(result.error as string);
  }
}

export async function deleteSnippet(id: number): Promise<void> {
  const result = await commands.deleteScript(id);
  if (result.status === "error") {
    throw new Error(result.error as string);
  }
}
