import { TableItem, Schema } from "./types";

export const MOCK_SCHEMAS: Schema[] = [
  { id: "public", name: "public" },
  { id: "auth", name: "auth" },
  { id: "storage", name: "storage" },
];

export const MOCK_TABLES: TableItem[] = [
  {
    id: "categories",
    name: "categories",
    rowCount: 8,
    type: "table",
  },
  {
    id: "customers",
    name: "customers",
    rowCount: 93,
    type: "table",
    sortedColumns: [
      { id: "contact_name_asc", name: "contact_name ASC", direction: "ASC" },
      { id: "contact_name_asc_2", name: "contact_name ASC", direction: "ASC" },
    ],
  },
  {
    id: "employee_territories",
    name: "employee_territories",
    rowCount: 49,
    type: "table",
  },
  {
    id: "employees",
    name: "employees",
    rowCount: 9,
    type: "table",
  },
  {
    id: "order_details",
    name: "order_details",
    rowCount: "2.15K",
    type: "table",
  },
  {
    id: "orders",
    name: "orders",
    rowCount: 830,
    type: "table",
  },
  {
    id: "products",
    name: "products",
    rowCount: 77,
    type: "table",
  },
  {
    id: "regions",
    name: "regions",
    rowCount: 4,
    type: "table",
  },
  {
    id: "shippers",
    name: "shippers",
    rowCount: 3,
    type: "table",
  },
  {
    id: "suppliers",
    name: "suppliers",
    rowCount: 29,
    type: "table",
  },
  {
    id: "territories",
    name: "territories",
    rowCount: 53,
    type: "table",
  },
  {
    id: "customer_and_suppliers_by_city",
    name: "customer_and_supplie...",
    rowCount: 122,
    type: "view",
  },
  {
    id: "invoices",
    name: "invoices",
    rowCount: "2.15K",
    type: "view",
  },
  {
    id: "order_subtotals",
    name: "order_subtotals",
    rowCount: 830,
    type: "view",
  },
  {
    id: "products_above_average_price",
    name: "products_above_avera...",
    rowCount: 25,
    type: "view",
  },
  {
    id: "products_by_category",
    name: "products_by_category",
    rowCount: 69,
    type: "view",
  },
  {
    id: "summary_of_sales",
    name: "summary_of_sales",
    rowCount: 809,
    type: "view",
  },
];
