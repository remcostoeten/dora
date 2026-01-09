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
  console.log("[API] fetchTableData query:", query);

  const startResult = await commands.startQuery(connectionId, query);
  console.log("[API] startQuery status:", startResult.status);

  if (startResult.status !== "ok") {
    console.error("[API] startQuery failed:", startResult);
    throw new Error("Failed to start query: " + JSON.stringify(startResult.error));
  }

  // Now TypeScript knows startResult.data exists since status === "ok"
  console.log("[API] startQuery data type:", typeof startResult.data, Array.isArray(startResult.data));
  console.log("[API] startQuery data:", startResult.data);

  if (!startResult.data || startResult.data.length === 0) {
    console.error("[API] startQuery returned no query IDs:", startResult.data);
    throw new Error("Failed to start query: no query ID returned");
  }

  const queryId = startResult.data[0];
  console.log("[API] queryId:", queryId);

  // Poll for query completion - backend may return "Running" initially
  let pageInfo;
  let attempts = 0;
  const maxAttempts = 50; // 5 seconds max with 100ms intervals

  while (attempts < maxAttempts) {
    const fetchResult = await commands.fetchQuery(queryId);
    console.log("[API] fetchQuery attempt", attempts, "status:", fetchResult.status);

    if (fetchResult.status !== "ok") {
      throw new Error("Failed to fetch query results");
    }

    pageInfo = fetchResult.data;

    // Check if query is complete
    if (pageInfo.status === "Completed" || pageInfo.status === "Error") {
      console.log("[API] Query completed with status:", pageInfo.status);
      break;
    }

    // Query still running, wait and retry
    console.log("[API] Query still running, waiting...");
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }

  if (!pageInfo) {
    throw new Error("Query timed out");
  }

  console.log("[API] pageInfo:", pageInfo);
  console.log("[API] first_page:", pageInfo.first_page);

  if (pageInfo.status === "Error") {
    throw new Error("Query failed: " + (pageInfo.error || "Unknown error"));
  }

  if (!pageInfo.returns_values) {
    console.log("[API] No return values, returning empty");
    return {
      columns: [],
      rows: [],
      totalCount: pageInfo.affected_rows ?? 0,
      executionTime: 0,
    };
  }

  const columnsResult = await commands.getColumns(queryId);
  console.log("[API] columnsResult:", columnsResult);
  if (columnsResult.status !== "ok" || !columnsResult.data) {
    throw new Error("Failed to get columns");
  }

  const columns = Array.isArray(columnsResult.data)
    ? columnsResult.data.map((col: any) => {
      if (typeof col === 'string') {
        return {
          name: col,
          type: "unknown",
          nullable: false,
          primaryKey: false,
        };
      }
      return {
        name: col.name,
        type: col.data_type || col.type || "unknown",
        nullable: col.is_nullable ?? col.nullable ?? false,
        primaryKey: col.is_primary_key ?? col.primary_key ?? false,
      };
    })
    : [];
  console.log("[API] columns:", columns);

  const rows: Record<string, unknown>[] = Array.isArray(pageInfo.first_page)
    ? pageInfo.first_page.map((row, rowIdx): Record<string, unknown> => {
      if (typeof row === 'object' && row !== null && !Array.isArray(row)) {
        return row as Record<string, unknown>;
      }
      if (Array.isArray(row)) {
        const rowObj: Record<string, unknown> = {};
        columns.forEach((col, colIdx) => {
          rowObj[col.name] = row[colIdx] !== undefined ? row[colIdx] : null;
        });
        console.log(`[API] Converted row ${rowIdx} from array to object:`, rowObj);
        return rowObj;
      }
      console.warn(`[API] Unexpected row format at index ${rowIdx}:`, typeof row, row);
      return {};
    })
    : [];
  console.log("[API] rows:", rows);
  console.log("[API] First row sample:", rows[0]);

  const result = {
    columns,
    rows,
    totalCount: pageInfo.affected_rows ?? 0,
    executionTime: 0,
  };
  console.log("[API] Final result:", result);
  return result;
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
