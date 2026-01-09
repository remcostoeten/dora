import type { ChainKind, ArgKind, MethodDef } from "../types";

export type GraphNode = {
    kind: ChainKind;
    methods: MethodDef[];
};

export type MethodGraph = Map<ChainKind, GraphNode>;

function method(
    name: string,
    args: ArgKind[],
    returns: ChainKind,
    doc: string,
    terminal: boolean = false
): MethodDef {
    return { name, args, returns, doc, terminal };
}

export function createMethodGraph(): MethodGraph {
    const graph = new Map<ChainKind, GraphNode>();

    graph.set("db", {
        kind: "db",
        methods: [
            method("select", ["none"], "select", "Start a SELECT query", false),
            method("select", ["columns"], "select", "Start a SELECT query with specific columns", false),
            method("insert", ["table"], "insert", "Start an INSERT query", false),
            method("update", ["table"], "update", "Start an UPDATE query", false),
            method("delete", ["table"], "delete", "Start a DELETE query", false),
            method("execute", ["sql"], "terminal", "Execute raw SQL", true),
        ],
    });

    graph.set("select", {
        kind: "select",
        methods: [
            method("from", ["table"], "selectFrom", "Specify the table to select from", false),
        ],
    });

    graph.set("selectFrom", {
        kind: "selectFrom",
        methods: [
            method("where", ["condition"], "query", "Filter results with a condition", false),
            method("orderBy", ["columns"], "query", "Order results by columns", false),
            method("groupBy", ["columns"], "query", "Group results by columns", false),
            method("having", ["condition"], "query", "Filter groups with a condition", false),
            method("limit", ["number"], "query", "Limit the number of results", false),
            method("offset", ["number"], "query", "Offset the results", false),
            method("leftJoin", ["table", "condition"], "selectFrom", "Left join another table", false),
            method("rightJoin", ["table", "condition"], "selectFrom", "Right join another table", false),
            method("innerJoin", ["table", "condition"], "selectFrom", "Inner join another table", false),
            method("fullJoin", ["table", "condition"], "selectFrom", "Full outer join another table", false),
            method("execute", ["none"], "terminal", "Execute the query", true),
        ],
    });

    graph.set("query", {
        kind: "query",
        methods: [
            method("where", ["condition"], "query", "Filter results with a condition", false),
            method("orderBy", ["columns"], "query", "Order results by columns", false),
            method("groupBy", ["columns"], "query", "Group results by columns", false),
            method("having", ["condition"], "query", "Filter groups with a condition", false),
            method("limit", ["number"], "query", "Limit the number of results", false),
            method("offset", ["number"], "query", "Offset the results", false),
            method("execute", ["none"], "terminal", "Execute the query", true),
        ],
    });

    graph.set("insert", {
        kind: "insert",
        methods: [
            method("values", ["values"], "insertValues", "Provide values to insert", false),
        ],
    });

    graph.set("insertValues", {
        kind: "insertValues",
        methods: [
            method("returning", ["none"], "returning", "Return inserted rows", false),
            method("onConflictDoNothing", ["none"], "insertValues", "Ignore conflicts", false),
            method("onConflictDoUpdate", ["value"], "insertValues", "Update on conflict", false),
            method("execute", ["none"], "terminal", "Execute the insert", true),
        ],
    });

    graph.set("update", {
        kind: "update",
        methods: [
            method("set", ["values"], "updateSet", "Set values to update", false),
        ],
    });

    graph.set("updateSet", {
        kind: "updateSet",
        methods: [
            method("where", ["condition"], "updateSet", "Filter rows to update", false),
            method("returning", ["none"], "returning", "Return updated rows", false),
            method("execute", ["none"], "terminal", "Execute the update", true),
        ],
    });

    graph.set("delete", {
        kind: "delete",
        methods: [
            method("where", ["condition"], "deleteWhere", "Filter rows to delete", false),
        ],
    });

    graph.set("deleteWhere", {
        kind: "deleteWhere",
        methods: [
            method("returning", ["none"], "returning", "Return deleted rows", false),
            method("execute", ["none"], "terminal", "Execute the delete", true),
        ],
    });

    graph.set("returning", {
        kind: "returning",
        methods: [
            method("execute", ["none"], "terminal", "Execute the query", true),
        ],
    });

    graph.set("terminal", {
        kind: "terminal",
        methods: [],
    });

    graph.set("void", {
        kind: "void",
        methods: [],
    });

    return graph;
}

export function getMethodsForState(graph: MethodGraph, kind: ChainKind): MethodDef[] {
    const node = graph.get(kind);
    if (!node) return [];
    return node.methods;
}

export function getUniqueMethodsForState(graph: MethodGraph, kind: ChainKind): MethodDef[] {
    const methods = getMethodsForState(graph, kind);
    const seen = new Set<string>();
    const unique: MethodDef[] = [];

    for (let i = 0; i < methods.length; i++) {
        const m = methods[i];
        if (!seen.has(m.name)) {
            seen.add(m.name);
            unique.push(m);
        }
    }

    return unique;
}

export function findMethod(graph: MethodGraph, kind: ChainKind, name: string): MethodDef | null {
    const methods = getMethodsForState(graph, kind);
    for (let i = 0; i < methods.length; i++) {
        if (methods[i].name === name) {
            return methods[i];
        }
    }
    return null;
}

export function getNextState(graph: MethodGraph, currentKind: ChainKind, methodName: string): ChainKind {
    const method = findMethod(graph, currentKind, methodName);
    if (method) {
        return method.returns;
    }
    return currentKind;
}

export function isTerminalMethod(graph: MethodGraph, kind: ChainKind, name: string): boolean {
    const method = findMethod(graph, kind, name);
    return method ? method.terminal : false;
}

export const DRIZZLE_METHODS = createMethodGraph();
