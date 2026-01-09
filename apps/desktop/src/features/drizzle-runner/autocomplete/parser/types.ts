import type { Token, AstNode } from "../types";

export type LexerState = {
    source: string;
    pos: number;
    line: number;
    column: number;
    tokens: Token[];
};

export type ParseResult = {
    ast: AstNode | null;
    tokens: Token[];
    errors: ParseError[];
    incomplete: boolean;
};

export type ParseError = {
    message: string;
    start: number;
    end: number;
    line: number;
    column: number;
};

export type ParserState = {
    tokens: Token[];
    pos: number;
    errors: ParseError[];
};
