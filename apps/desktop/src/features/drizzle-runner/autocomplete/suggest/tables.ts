import type { Suggestion, Schema, SchemaTable, SchemaColumn } from "../types";

export function suggestTables(schema: Schema, closeAfter: boolean = true): Suggestion[] {
    const suggestions: Suggestion[] = [];

    for (let i = 0; i < schema.tables.length; i++) {
        const table = schema.tables[i];
        const insert = closeAfter ? table.name + ")" : table.name;

        suggestions.push({
            label: table.name,
            kind: "table",
            insert,
            detail: table.columns.length + " columns",
            doc: buildTableDoc(table),
            sort: padSort(i),
            cursor: closeAfter ? "chainDot" : "none",
            snippet: false,
            command: closeAfter ? "triggerSuggest" : undefined,
        });
    }

    return suggestions;
}

export function suggestColumns(schema: Schema, tableNames: string[]): Suggestion[] {
    const suggestions: Suggestion[] = [];
    let index = 0;

    for (let i = 0; i < tableNames.length; i++) {
        const table = findTable(schema, tableNames[i]);
        if (!table) continue;

        for (let j = 0; j < table.columns.length; j++) {
            const col = table.columns[j];
            const label = table.name + "." + col.name;

            suggestions.push({
                label,
                kind: "column",
                insert: label,
                detail: col.type + (col.nullable ? " (nullable)" : ""),
                doc: buildColumnDoc(col),
                sort: padSort(index),
                cursor: "none",
                snippet: false,
            });

            index++;
        }
    }

    return suggestions;
}

export function suggestAllColumns(schema: Schema): Suggestion[] {
    const suggestions: Suggestion[] = [];
    let index = 0;

    for (let i = 0; i < schema.tables.length; i++) {
        const table = schema.tables[i];

        for (let j = 0; j < table.columns.length; j++) {
            const col = table.columns[j];
            const label = table.name + "." + col.name;

            suggestions.push({
                label,
                kind: "column",
                insert: label,
                detail: col.type + (col.nullable ? " (nullable)" : ""),
                doc: buildColumnDoc(col),
                sort: padSort(index),
                cursor: "none",
                snippet: false,
            });

            index++;
        }
    }

    return suggestions;
}

export function suggestTableColumns(schema: Schema, tableName: string): Suggestion[] {
    const table = findTable(schema, tableName);
    if (!table) return [];

    const suggestions: Suggestion[] = [];

    for (let i = 0; i < table.columns.length; i++) {
        const col = table.columns[i];

        suggestions.push({
            label: col.name,
            kind: "column",
            insert: tableName + "." + col.name,
            detail: col.type + (col.nullable ? " (nullable)" : ""),
            doc: buildColumnDoc(col),
            sort: padSort(i),
            cursor: "none",
            snippet: false,
        });
    }

    return suggestions;
}

function findTable(schema: Schema, name: string): SchemaTable | null {
    for (let i = 0; i < schema.tables.length; i++) {
        if (schema.tables[i].name === name) {
            return schema.tables[i];
        }
    }
    return null;
}

function buildTableDoc(table: SchemaTable): string {
    const cols = table.columns.map(function (c) {
        return c.name + ": " + c.type;
    });
    return "Columns: " + cols.join(", ");
}

function buildColumnDoc(col: SchemaColumn): string {
    let doc = "Type: " + col.type;
    if (col.primaryKey) doc += " (PRIMARY KEY)";
    if (col.nullable) doc += " (nullable)";
    if (col.defaultValue) doc += " default=" + col.defaultValue;
    return doc;
}

function padSort(index: number): string {
    return String(index).padStart(4, "0");
}
