// Types for the Drizzle Runner feature
export type QueryTab = {
    id: string;
    name: string;
    content: string;
    isDirty: boolean;
};

export type QueryResult = {
    columns: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
    executionTime: number;
    error?: string;
};

export type RunnerTab = "queries" | "schema";

export type SchemaTable = {
    name: string;
    columns: SchemaColumn[];
};

export type SchemaColumn = {
    name: string;
    type: string;
    nullable: boolean;
    primaryKey: boolean;
    defaultValue?: string;
};

export type RunnerState = {
    activeTab: RunnerTab;
    queries: QueryTab[];
    activeQueryId: string | null;
    result: QueryResult | null;
    isExecuting: boolean;
    showJson: boolean;
};
