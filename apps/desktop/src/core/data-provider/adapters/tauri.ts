import type { DataAdapter, AdapterResult, QueryResult } from "../types";
import type {
    ConnectionInfo,
    DatabaseSchema,
    MutationResult,
    QueryHistoryEntry,
    JsonValue,
    DatabaseInfo
} from "@/lib/bindings";
import { commands } from "@/lib/bindings";
import type { TableData, SortDescriptor, FilterDescriptor, ColumnDefinition } from "@/features/database-studio/types";

function ok<T>(data: T): AdapterResult<T> {
    return { ok: true, data };
}

function err<T>(error: string): AdapterResult<T> {
    return { ok: false, error };
}

export function createTauriAdapter(): DataAdapter {
    return {
        async getConnections(): Promise<AdapterResult<ConnectionInfo[]>> {
            const result = await commands.getConnections();
            if (result.status === "ok") {
                return ok(result.data);
            }
            return err(String(result.error));
        },

        async addConnection(name: string, databaseType: DatabaseInfo, sshConfig: JsonValue | null): Promise<AdapterResult<ConnectionInfo>> {
            const result = await commands.addConnection(name, databaseType, sshConfig);
            if (result.status === "ok") {
                return ok(result.data);
            }
            return err(String(result.error));
        },

        async updateConnection(id: string, name: string, databaseType: DatabaseInfo, sshConfig: JsonValue | null): Promise<AdapterResult<ConnectionInfo>> {
            const result = await commands.updateConnection(id, name, databaseType, sshConfig);
            if (result.status === "ok") {
                return ok(result.data);
            }
            return err(String(result.error));
        },

        async removeConnection(id: string): Promise<AdapterResult<void>> {
            const result = await commands.removeConnection(id);
            if (result.status === "ok") {
                return ok(undefined);
            }
            return err(String(result.error));
        },

        async connectToDatabase(connectionId: string): Promise<AdapterResult<boolean>> {
            const result = await commands.connectToDatabase(connectionId);
            if (result.status === "ok") {
                return ok(result.data);
            }
            return err(String(result.error));
        },

        async disconnectFromDatabase(connectionId: string): Promise<AdapterResult<void>> {
            const result = await commands.disconnectFromDatabase(connectionId);
            if (result.status === "ok") {
                return ok(undefined);
            }
            return err(String(result.error));
        },

        async testConnection(connectionId: string): Promise<AdapterResult<boolean>> {
            const result = await commands.getConnections();
            if (result.status !== "ok") {
                return err(String(result.error));
            }
            const conn = result.data.find(function (c) { return c.id === connectionId; });
            if (!conn) {
                return err("Connection not found");
            }
            const testResult = await commands.testConnection(conn.database_type);
            if (testResult.status === "ok") {
                return ok(testResult.data);
            }
            return err(String(testResult.error));
        },

        async getSchema(connectionId: string): Promise<AdapterResult<DatabaseSchema>> {
            const result = await commands.getDatabaseSchema(connectionId);
            if (result.status === "ok") {
                return ok(result.data);
            }
            return err(String(result.error));
        },

        async fetchTableData(
            connectionId: string,
            tableName: string,
            page: number,
            pageSize: number,
            sort?: SortDescriptor,
            filters?: FilterDescriptor[]
        ): Promise<AdapterResult<TableData>> {
            let query = `SELECT * FROM "${tableName}"`;

            if (filters && filters.length > 0) {
                const conditions = filters.map(function (f) {
                    return `"${f.column}" ${operatorToSql(f.operator)} '${f.value}'`;
                });
                query += " WHERE " + conditions.join(" AND ");
            }

            if (sort) {
                query += ` ORDER BY "${sort.column}" ${sort.direction.toUpperCase()}`;
            }

            query += ` LIMIT ${pageSize} OFFSET ${page * pageSize}`;

            const startResult = await commands.startQuery(connectionId, query);
            if (startResult.status !== "ok" || !startResult.data[0]) {
                return err("Failed to start query");
            }

            const queryId = startResult.data[0];
            let pageInfo;
            let attempts = 0;
            const maxAttempts = 50;

            while (attempts < maxAttempts) {
                const fetchResult = await commands.fetchQuery(queryId);
                if (fetchResult.status !== "ok") {
                    return err("Failed to fetch query results");
                }

                pageInfo = fetchResult.data;
                if (pageInfo.status === "Completed" || pageInfo.status === "Error") {
                    break;
                }

                await delay(100);
                attempts++;
            }

            if (!pageInfo) {
                return err("Query timed out");
            }

            if (pageInfo.status === "Error") {
                return err(pageInfo.error || "Query failed");
            }

            const columnsResult = await commands.getColumns(queryId);
            if (columnsResult.status !== "ok" || !columnsResult.data) {
                return err("Failed to get columns");
            }

            const columns = parseColumns(columnsResult.data);
            const rows = parseRows(pageInfo.first_page, columns);

            return ok({
                columns,
                rows,
                totalCount: pageInfo.affected_rows ?? 0,
                executionTime: 0,
            });
        },

        async executeQuery(connectionId: string, query: string): Promise<AdapterResult<QueryResult>> {
            const startResult = await commands.startQuery(connectionId, query);
            if (startResult.status !== "ok" || !startResult.data[0]) {
                return err("Failed to start query");
            }

            const queryId = startResult.data[0];
            const fetchResult = await commands.fetchQuery(queryId);
            if (fetchResult.status !== "ok") {
                return err("Failed to fetch query results");
            }

            const pageInfo = fetchResult.data;
            const columnsResult = await commands.getColumns(queryId);

            return ok({
                rows: pageInfo.first_page ?? [],
                columns: columnsResult.status === "ok" ? columnsResult.data ?? [] : [],
                rowCount: pageInfo.affected_rows ?? 0,
            });
        },

        async updateCell(
            connectionId: string,
            tableName: string,
            primaryKeyColumn: string,
            primaryKeyValue: JsonValue,
            columnName: string,
            newValue: JsonValue
        ): Promise<AdapterResult<MutationResult>> {
            const result = await commands.updateCell(
                connectionId,
                tableName,
                null,
                primaryKeyColumn,
                primaryKeyValue,
                columnName,
                newValue
            );
            if (result.status === "ok") {
                return ok(result.data);
            }
            return err(String(result.error));
        },

        async deleteRows(
            connectionId: string,
            tableName: string,
            primaryKeyColumn: string,
            primaryKeyValues: JsonValue[]
        ): Promise<AdapterResult<MutationResult>> {
            const result = await commands.deleteRows(
                connectionId,
                tableName,
                null,
                primaryKeyColumn,
                primaryKeyValues
            );
            if (result.status === "ok") {
                return ok(result.data);
            }
            return err(String(result.error));
        },

        async insertRow(
            connectionId: string,
            tableName: string,
            rowData: Record<string, JsonValue>
        ): Promise<AdapterResult<MutationResult>> {
            const result = await commands.insertRow(connectionId, tableName, null, rowData);
            if (result.status === "ok") {
                return ok(result.data);
            }
            return err(String(result.error));
        },

        async getQueryHistory(connectionId: string, limit?: number): Promise<AdapterResult<QueryHistoryEntry[]>> {
            const result = await commands.getQueryHistory(connectionId, limit ?? null);
            if (result.status === "ok") {
                return ok(result.data);
            }
            return err(String(result.error));
        },
    };
}

function operatorToSql(op: string): string {
    const map: Record<string, string> = {
        eq: "=",
        neq: "!=",
        gt: ">",
        gte: ">=",
        lt: "<",
        lte: "<=",
        ilike: "ILIKE",
        contains: "LIKE",
    };
    return map[op] || "=";
}

function delay(ms: number): Promise<void> {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
}

function parseColumns(data: JsonValue): ColumnDefinition[] {
    if (!Array.isArray(data)) return [];

    return data.map(function (col: any) {
        if (typeof col === "string") {
            return { name: col, type: "unknown", nullable: false, primaryKey: false };
        }
        return {
            name: col.name,
            type: col.data_type || col.type || "unknown",
            nullable: col.is_nullable ?? col.nullable ?? false,
            primaryKey: col.is_primary_key ?? col.primary_key ?? false,
        };
    });
}

function parseRows(data: JsonValue, columns: ColumnDefinition[]): Record<string, unknown>[] {
    if (!Array.isArray(data)) return [];

    return data.map(function (row: any) {
        if (typeof row === "object" && row !== null && !Array.isArray(row)) {
            return row as Record<string, unknown>;
        }
        if (Array.isArray(row)) {
            const obj: Record<string, unknown> = {};
            columns.forEach(function (col, i) {
                obj[col.name] = row[i] !== undefined ? row[i] : null;
            });
            return obj;
        }
        return {};
    });
}
