import type { AstNode, AstKind } from "../types";

export function createNode(
    kind: AstKind,
    start: number,
    end: number,
    props?: Partial<AstNode>
): AstNode {
    return {
        kind,
        start,
        end,
        ...props,
    };
}

export function createIdentifier(name: string, start: number, end: number): AstNode {
    return createNode("identifier", start, end, { name });
}

export function createMember(object: AstNode, property: AstNode): AstNode {
    return createNode("member", object.start, property.end, { object, property });
}

export function createCall(callee: AstNode, args: AstNode[], end: number): AstNode {
    return createNode("call", callee.start, end, { callee, arguments: args });
}

export function createChain(nodes: AstNode[]): AstNode {
    if (nodes.length === 0) {
        return createNode("chain", 0, 0, { nodes: [] });
    }
    return createNode("chain", nodes[0].start, nodes[nodes.length - 1].end, { nodes });
}

export function createLiteral(value: string | number | boolean, raw: string, start: number, end: number): AstNode {
    return createNode("literal", start, end, { value, raw });
}

export function createIncomplete(start: number, end: number, name?: string): AstNode {
    return createNode("incomplete", start, end, { name });
}

export function isIdentifier(node: AstNode): boolean {
    return node.kind === "identifier";
}

export function isMember(node: AstNode): boolean {
    return node.kind === "member";
}

export function isCall(node: AstNode): boolean {
    return node.kind === "call";
}

export function isChain(node: AstNode): boolean {
    return node.kind === "chain";
}

export function isIncomplete(node: AstNode): boolean {
    return node.kind === "incomplete";
}

export function getCallName(node: AstNode): string | null {
    if (node.kind !== "call" || !node.callee) {
        return null;
    }
    if (node.callee.kind === "identifier") {
        return node.callee.name || null;
    }
    if (node.callee.kind === "member" && node.callee.property) {
        return node.callee.property.name || null;
    }
    return null;
}

export function getMemberName(node: AstNode): string | null {
    if (node.kind !== "member" || !node.property) {
        return null;
    }
    return node.property.name || null;
}

export function getChainCalls(node: AstNode): AstNode[] {
    if (node.kind !== "chain" || !node.nodes) {
        return [];
    }
    return node.nodes.filter(function (n) {
        return n.kind === "call";
    });
}

export function getLastNode(node: AstNode): AstNode {
    if (node.kind === "chain" && node.nodes && node.nodes.length > 0) {
        return node.nodes[node.nodes.length - 1];
    }
    return node;
}

export function walkAst(node: AstNode, visitor: (n: AstNode) => void): void {
    visitor(node);
    if (node.object) walkAst(node.object, visitor);
    if (node.property) walkAst(node.property, visitor);
    if (node.callee) walkAst(node.callee, visitor);
    if (node.arguments) {
        node.arguments.forEach(function (arg) {
            walkAst(arg, visitor);
        });
    }
    if (node.nodes) {
        node.nodes.forEach(function (n) {
            walkAst(n, visitor);
        });
    }
}

export function findNodeAtPosition(root: AstNode, position: number): AstNode | null {
    let result: AstNode | null = null;
    walkAst(root, function (node) {
        if (position >= node.start && position <= node.end) {
            result = node;
        }
    });
    return result;
}
