export type TokenKind =
    | "identifier"
    | "dot"
    | "openParen"
    | "closeParen"
    | "openBracket"
    | "closeBracket"
    | "openBrace"
    | "closeBrace"
    | "comma"
    | "colon"
    | "string"
    | "number"
    | "operator"
    | "templateStart"
    | "templateEnd"
    | "whitespace"
    | "newline"
    | "eof"
    | "unknown";

export type Token = {
    kind: TokenKind;
    value: string;
    start: number;
    end: number;
    line: number;
    column: number;
};

export type AstKind =
    | "identifier"
    | "member"
    | "call"
    | "chain"
    | "argument"
    | "literal"
    | "template"
    | "incomplete";

export type AstNode = {
    kind: AstKind;
    start: number;
    end: number;
    name?: string;
    object?: AstNode;
    property?: AstNode;
    callee?: AstNode;
    arguments?: AstNode[];
    nodes?: AstNode[];
    value?: string | number | boolean;
    raw?: string;
};

export type ArgKind =
    | "table"
    | "column"
    | "columns"
    | "expression"
    | "condition"
    | "value"
    | "values"
    | "number"
    | "sql"
    | "none";

export type MethodDef = {
    name: string;
    args: ArgKind[];
    returns: ChainKind;
    doc: string;
    terminal: boolean;
};

export type ChainKind =
    | "db"
    | "select"
    | "selectFrom"
    | "insert"
    | "insertValues"
    | "update"
    | "updateSet"
    | "delete"
    | "deleteWhere"
    | "query"
    | "returning"
    | "terminal"
    | "void";

export type ChainState = {
    kind: ChainKind;
    tables: string[];
    columns: string[];
    depth: number;
    inArg: boolean;
    argIndex: number;
    argKind: ArgKind;
    method: string | null;
    incomplete: boolean;
};

export type CursorIntent =
    | "openParen"
    | "closeParen"
    | "chainDot"
    | "stayInside"
    | "complete"
    | "none";

export type SuggestionKind =
    | "method"
    | "table"
    | "column"
    | "helper"
    | "keyword"
    | "value"
    | "snippet";

export type Suggestion = {
    label: string;
    kind: SuggestionKind;
    insert: string;
    detail: string;
    doc: string;
    sort: string;
    cursor: CursorIntent;
    snippet: boolean;
    command?: string;
};

export type CompletionContext = {
    state: ChainState;
    position: number;
    line: number;
    column: number;
    prefix: string;
    textBefore: string;
    textAfter: string;
};

export type SchemaColumn = {
    name: string;
    type: string;
    nullable: boolean;
    primaryKey: boolean;
    defaultValue?: string;
};

export type SchemaTable = {
    name: string;
    columns: SchemaColumn[];
};

export type Schema = {
    tables: SchemaTable[];
};
