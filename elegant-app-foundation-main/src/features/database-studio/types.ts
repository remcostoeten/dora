export type TableInfo = {
  name: string;
  rowCount: number;
  type: "table" | "view";
};

export type ColumnInfo = {
  name: string;
  dataType: string;
  isPrimaryKey?: boolean;
};

export type FilterOperator = "equals" | "contains" | "gt" | "lt" | "gte" | "lte" | "neq";

export type FilterCondition = {
  id: string;
  column: string;
  operator: FilterOperator;
  value: string;
};

export type SortDirection = "asc" | "desc";

export type SortConfig = {
  column: string;
  direction: SortDirection;
};

export type TableRow = Record<string, unknown>;

export type CellDraft = {
  rowId: string;
  column: string;
  value: string;
  originalValue: unknown;
};
