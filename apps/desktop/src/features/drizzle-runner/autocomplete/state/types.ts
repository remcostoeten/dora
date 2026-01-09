import type { ChainKind, ArgKind } from "../types";

export type StateTransition = {
    from: ChainKind;
    method: string;
    to: ChainKind;
};

export type MachineState = {
    kind: ChainKind;
    tables: string[];
    columns: string[];
    depth: number;
    inArg: boolean;
    argIndex: number;
    argKind: ArgKind;
    method: string | null;
    history: StateTransition[];
};

export type TransitionResult = {
    state: MachineState;
    valid: boolean;
};
