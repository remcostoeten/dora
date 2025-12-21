import { generateUsers } from "./users"
import { generateOrders } from "./orders"
import { generateProductCategories } from "./product-category"
import { generateOrderItems } from "./order-items"
import { generateActiveUsers } from "./active-users"
import { generateOrderSummary } from "./order-summary"
import { generateEmptyTable } from "./empty-table"

// Generate all data once and cache it
export const MOCK_DATA = {
  users: generateUsers(),
  orders: generateOrders(),
  product_category: generateProductCategories(),
  order_items: generateOrderItems(),
  active_users: generateActiveUsers(),
  order_summary: generateOrderSummary(),
  empty_table: generateEmptyTable(),
} as const

export type TableName = keyof typeof MOCK_DATA

export function getTableData(tableName: string): unknown[] {
  if (tableName in MOCK_DATA) {
    return MOCK_DATA[tableName as TableName]
  }
  throw new Error(`Table not found: ${tableName}`)
}

export function getTableNames(): TableName[] {
  return Object.keys(MOCK_DATA) as TableName[]
}
