import type { CompletionContext, ChainState, ArgKind, Schema, SchemaTable } from "../types";
import type { MachineState } from "./types";
import { parse, getContextAtPosition } from "../parser";
import { processAst, createInitialState, enterArgument } from "./machine";
import { DRIZZLE_METHODS, findMethod } from "./graph";

export function resolveContext(
    source: string,
    position: number,
    schema: Schema
): CompletionContext {
    const ctx = getContextAtPosition(source, position);
    const machineState = processAst(ctx.result.ast);

    let prefix = "";
    if (ctx.lastToken && ctx.lastToken.kind === "identifier") {
        prefix = ctx.lastToken.value;
    }

    const lines = source.substring(0, position).split("\n");
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;

    const textBefore = source.substring(0, position);
    const textAfter = source.substring(position);

    let inArg = ctx.inCall;
    let argKind: ArgKind = "none";
    let argIndex = 0;

    if (inArg && machineState.method) {
        const method = findMethod(DRIZZLE_METHODS, machineState.kind, machineState.method);
        if (method && method.args.length > 0) {
            argKind = method.args[0];
        }
    }

    const chainState: ChainState = {
        kind: machineState.kind,
        tables: machineState.tables,
        columns: machineState.columns,
        depth: machineState.depth,
        inArg,
        argIndex,
        argKind,
        method: machineState.method,
        incomplete: ctx.result.incomplete,
    };

    return {
        state: chainState,
        position,
        line,
        column,
        prefix,
        textBefore,
        textAfter,
    };
}

export function detectCompletionTrigger(
    source: string,
    position: number
): "dot" | "openParen" | "identifier" | "comma" | "none" {
    if (position === 0) return "none";

    const charBefore = source[position - 1];

    if (charBefore === ".") return "dot";
    if (charBefore === "(") return "openParen";
    if (charBefore === ",") return "comma";
    if (/[a-zA-Z_$]/.test(charBefore)) return "identifier";

    return "none";
}

export function getSchemaTable(schema: Schema, name: string): SchemaTable | null {
    for (let i = 0; i < schema.tables.length; i++) {
        if (schema.tables[i].name === name) {
            return schema.tables[i];
        }
    }
    return null;
}

export function getColumnsForTables(schema: Schema, tableNames: string[]): string[] {
    const columns: string[] = [];

    for (let i = 0; i < tableNames.length; i++) {
        const table = getSchemaTable(schema, tableNames[i]);
        if (table) {
            for (let j = 0; j < table.columns.length; j++) {
                const colName = tableNames[i] + "." + table.columns[j].name;
                if (!columns.includes(colName)) {
                    columns.push(colName);
                }
            }
        }
    }

    return columns;
}

export function inferCurrentMethod(source: string, position: number): string | null {
    const ctx = getContextAtPosition(source, position);
    const state = processAst(ctx.result.ast);
    return state.method;
}

export function isAfterDot(source: string, position: number): boolean {
    const ctx = getContextAtPosition(source, position);
    return ctx.afterDot;
}

export function isInsideCall(source: string, position: number): boolean {
    const ctx = getContextAtPosition(source, position);
    return ctx.inCall;
}

export function findEnclosingCall(source: string, position: number): string | null {
    let depth = 0;
    let methodStart = -1;

    for (let i = position - 1; i >= 0; i--) {
        const ch = source[i];

        if (ch === ")") {
            depth++;
        } else if (ch === "(") {
            if (depth === 0) {
                methodStart = i;
                break;
            }
            depth--;
        }
    }

    if (methodStart < 0) return null;

    let methodEnd = methodStart;
    for (let i = methodStart - 1; i >= 0; i--) {
        const ch = source[i];
        if (/[a-zA-Z_$0-9]/.test(ch)) {
            methodEnd = i;
        } else {
            break;
        }
    }

    if (methodEnd < methodStart) {
        return source.substring(methodEnd, methodStart);
    }

    return null;
}
