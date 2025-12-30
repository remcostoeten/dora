export type ColumnDefinition = {
    name: string;
    type: string;
    nullable: boolean;
    primaryKey: boolean;
};

export type TableData = {
    columns: ColumnDefinition[];
    rows: Record<string, unknown>[];
    totalCount: number;
    executionTime: number;
};

export type PaginationState = {
    limit: number;
    offset: number;
};

export type ViewMode = "content" | "structure";
