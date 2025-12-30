export type TableItem = {
  id: string;
  name: string;
  rowCount: number | string;
  type: "table" | "view" | "materialized-view";
  sortedColumns?: SortedColumn[];
};

export type SortedColumn = {
  id: string;
  name: string;
  direction: "ASC" | "DESC";
};

export type Schema = {
  id: string;
  name: string;
};
