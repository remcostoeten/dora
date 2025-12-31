import { commands, type DatabaseSchema, type TableInfo, type StatementInfo, type JsonValue } from "@/lib/bindings";
import type { ColumnDefinition, TableData } from "@/features/database-studio/types";

export function backendToColumnDefinition(col: { name: string; data_type: string; is_nullable: boolean; is_primary_key: boolean }): ColumnDefinition {
  return {
    name: col.name,
    type: col.data_type,
    nullable: col.is_nullable,
    primaryKey: col.is_primary_key,
  };
}

export async function getSchema(connectionId: string): Promise<DatabaseSchema | null> {
  const result = await commands.getDatabaseSchema(connectionId);
  if (result.status === "ok") {
    return result.data;
  }
  return null;
}

export async function fetchTableData(
  connectionId: string,
  tableName: string,
  page: number = 0,
  pageSize: number = 50
): Promise<TableData | null> {
  const query = `SELECT * FROM "${tableName}" LIMIT ${pageSize} OFFSET ${page * pageSize}`;
  
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

  if (!pageInfo.returns_values) {
    return {
      columns: [],
      rows: [],
      totalCount: pageInfo.affected_rows ?? 0,
      executionTime: 0,
    };
  }

  const columnsResult = await commands.getColumns(queryId);
  if (columnsResult.status !== "ok" || !columnsResult.data) {
    throw new Error("Failed to get columns");
  }

  const columns = Array.isArray(columnsResult.data)
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

  return {
    columns,
    rows,
    totalCount: pageInfo.affected_rows ?? 0,
    executionTime: 0,
  };
}

export async function executeQuery(
  connectionId: string,
  query: string
): Promise<{ rows: JsonValue; columns: JsonValue; rowCount: number }> {
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

  return {
    rows: pageInfo.first_page ?? [],
    columns: columnsResult.status === "ok" ? columnsResult.data ?? [] : [],
    rowCount: pageInfo.affected_rows ?? 0,
  };
}

export async function updateCellValue(
  connectionId: string,
  tableName: string,
  columnName: string,
  primaryKeyColumn: string,
  primaryKeyValue: unknown,
  newValue: unknown
): Promise<boolean> {
  const query = `UPDATE "${tableName}" SET "${columnName}" = $1 WHERE "${primaryKeyColumn}" = $2`;
  
  const startResult = await commands.startQuery(connectionId, query);
  if (startResult.status !== "ok" || !startResult.data[0]) {
    throw new Error("Failed to start update query");
  }

  return true;
}

export async function deleteRow(
  connectionId: string,
  tableName: string,
  primaryKeyColumn: string,
  primaryKeyValue: unknown
): Promise<boolean> {
  const query = `DELETE FROM "${tableName}" WHERE "${primaryKeyColumn}" = $1`;
  
  const startResult = await commands.startQuery(connectionId, query);
  if (startResult.status !== "ok" || !startResult.data[0]) {
    throw new Error("Failed to start delete query");
  }

  return true;
}

export async function insertRow(
  connectionId: string,
  tableName: string,
  data: Record<string, unknown>
): Promise<boolean> {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
  const query = `INSERT INTO "${tableName}" ("${columns.join('", "')}") VALUES (${placeholders})`;
  
  const startResult = await commands.startQuery(connectionId, query);
  if (startResult.status !== "ok" || !startResult.data[0]) {
    throw new Error("Failed to start insert query");
  }

  return true;
}
