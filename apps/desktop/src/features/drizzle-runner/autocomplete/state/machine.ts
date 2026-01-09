import type { ChainKind, ArgKind, AstNode } from "../types";
import type { MachineState, TransitionResult, StateTransition } from "./types";
import { DRIZZLE_METHODS, findMethod, getNextState } from "./graph";

export function createInitialState(): MachineState {
    return {
        kind: "db",
        tables: [],
        columns: [],
        depth: 0,
        inArg: false,
        argIndex: 0,
        argKind: "none",
        method: null,
        history: [],
    };
}

export function cloneState(state: MachineState): MachineState {
    return {
        kind: state.kind,
        tables: [...state.tables],
        columns: [...state.columns],
        depth: state.depth,
        inArg: state.inArg,
        argIndex: state.argIndex,
        argKind: state.argKind,
        method: state.method,
        history: [...state.history],
    };
}

export function transition(state: MachineState, methodName: string): TransitionResult {
    const method = findMethod(DRIZZLE_METHODS, state.kind, methodName);

    if (!method) {
        return { state, valid: false };
    }

    const newState = cloneState(state);
    const trans: StateTransition = {
        from: state.kind,
        method: methodName,
        to: method.returns,
    };

    newState.kind = method.returns;
    newState.method = methodName;
    newState.history.push(trans);

    if (method.args.length > 0 && method.args[0] !== "none") {
        newState.inArg = true;
        newState.argIndex = 0;
        newState.argKind = method.args[0];
    } else {
        newState.inArg = false;
        newState.argKind = "none";
    }

    return { state: newState, valid: true };
}

export function enterArgument(state: MachineState, index: number): MachineState {
    const newState = cloneState(state);
    const method = findMethod(DRIZZLE_METHODS, state.kind, state.method || "");

    if (method && index < method.args.length) {
        newState.inArg = true;
        newState.argIndex = index;
        newState.argKind = method.args[index];
    }

    return newState;
}

export function exitArgument(state: MachineState): MachineState {
    const newState = cloneState(state);
    newState.inArg = false;
    newState.argKind = "none";
    return newState;
}

export function addTable(state: MachineState, tableName: string): MachineState {
    const newState = cloneState(state);
    if (!newState.tables.includes(tableName)) {
        newState.tables.push(tableName);
    }
    return newState;
}

export function addColumn(state: MachineState, columnName: string): MachineState {
    const newState = cloneState(state);
    if (!newState.columns.includes(columnName)) {
        newState.columns.push(columnName);
    }
    return newState;
}

export function processAst(ast: AstNode | null): MachineState {
    if (!ast) {
        return createInitialState();
    }

    let state = createInitialState();

    function processNode(node: AstNode): void {
        if (node.kind === "identifier" && node.name === "db") {
            state.kind = "db";
            return;
        }

        if (node.kind === "call" && node.callee) {
            let methodName: string | null = null;

            if (node.callee.kind === "identifier") {
                methodName = node.callee.name || null;
            } else if (node.callee.kind === "member" && node.callee.property) {
                if (node.callee.object) {
                    processNode(node.callee.object);
                }
                methodName = node.callee.property.name || null;
            }

            if (methodName) {
                const result = transition(state, methodName);
                if (result.valid) {
                    state = result.state;
                }

                if (node.arguments && node.arguments.length > 0) {
                    for (let i = 0; i < node.arguments.length; i++) {
                        const arg = node.arguments[i];
                        if (arg.kind === "identifier" && arg.name) {
                            if (state.argKind === "table") {
                                state = addTable(state, arg.name);
                            } else if (state.argKind === "column" || state.argKind === "columns") {
                                state = addColumn(state, arg.name);
                            }
                        }
                    }
                }

                state = exitArgument(state);
            }
        }

        if (node.kind === "member" && node.object) {
            processNode(node.object);
        }

        if (node.kind === "chain" && node.nodes) {
            for (let i = 0; i < node.nodes.length; i++) {
                processNode(node.nodes[i]);
            }
        }
    }

    processNode(ast);
    return state;
}

export function getStateFromSource(source: string, parse: (s: string) => { ast: AstNode | null }): MachineState {
    const { ast } = parse(source);
    return processAst(ast);
}

export function isValidTransition(state: MachineState, methodName: string): boolean {
    const method = findMethod(DRIZZLE_METHODS, state.kind, methodName);
    return method !== null;
}

export function getExpectedArgKind(state: MachineState): ArgKind {
    if (!state.inArg) return "none";
    return state.argKind;
}
