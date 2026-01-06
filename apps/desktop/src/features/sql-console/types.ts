// Types for the SQL Console feature
export type SqlSnippet = {
    id: string;
    name: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    isFolder?: boolean;
    parentId?: string | null;
};

export type SqlQueryResult = {
    columns: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
    executionTime: number;
    error?: string;
    affectedRows?: number;
    queryType: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "OTHER";
};

export type TableInfo = {
    name: string;
    type: "table" | "view";
    rowCount: number;
    columns?: {
        name: string;
        type: string;
        nullable?: boolean;
        primaryKey?: boolean;
        defaultValue?: string;
    }[];
};

export type ResultViewMode = "table" | "json";

export type ConsoleState = {
    snippets: SqlSnippet[];
    activeSnippetId: string | null;
    currentQuery: string;
    result: SqlQueryResult | null;
    isExecuting: boolean;
    viewMode: ResultViewMode;
    showLeftSidebar: boolean;
    showRightSidebar: boolean;
};
