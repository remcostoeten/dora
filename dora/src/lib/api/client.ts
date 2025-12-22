// API client with mock data fallback for browser development
import type { TableListResponse, PaginatedResponse, PageResponse, QueryStatusResponse } from "./types"

// Mock data for browser development
const mockTablesResponse: TableListResponse = {
  tables: [
    { name: "users", schema: "public", rowCount: 1284, type: "table" as const },
    { name: "orders", schema: "public", rowCount: 8472, type: "table" as const },
    { name: "products", schema: "public", rowCount: 156, type: "table" as const },
    { name: "categories", schema: "public", rowCount: 12, type: "table" as const },
    { name: "order_items", schema: "public", rowCount: 24891, type: "table" as const },
    { name: "active_users", schema: "public", rowCount: 0, type: "view" as const },
    { name: "order_summary", schema: "public", rowCount: 0, type: "view" as const },
  ],
}

const mockUserData = [
  { id: 1, email: "john@example.com", firstName: "John", lastName: "Doe", status: "active", subscriptionTier: "pro", lastLoginAt: "2024-01-15T09:30:00Z", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-15T09:30:00Z" },
  { id: 2, email: "jane@example.com", firstName: "Jane", lastName: "Smith", status: "active", subscriptionTier: "basic", lastLoginAt: "2024-01-16T14:22:00Z", createdAt: "2024-01-02T00:00:00Z", updatedAt: "2024-01-16T14:22:00Z" },
  { id: 3, email: "bob@example.com", firstName: "Bob", lastName: "Wilson", status: "pending", subscriptionTier: null, lastLoginAt: null, createdAt: "2024-01-03T00:00:00Z", updatedAt: "2024-01-03T00:00:00Z" },
  { id: 4, email: "alice@example.com", firstName: "Alice", lastName: "Brown", status: "inactive", subscriptionTier: "enterprise", lastLoginAt: "2024-01-10T08:15:00Z", createdAt: "2024-01-04T00:00:00Z", updatedAt: "2024-01-18T08:15:00Z" },
  { id: 5, email: "charlie@example.com", firstName: "Charlie", lastName: "Davis", status: "active", subscriptionTier: "pro", lastLoginAt: "2024-01-19T16:00:00Z", createdAt: "2024-01-05T00:00:00Z", updatedAt: "2024-01-19T16:00:00Z" },
]

const mockOrderData = [
  { id: 1, userId: 1, orderNumber: "ORD-001", status: "completed", totalAmount: 299.99, currency: "USD", shippingAddress: "123 Main St", orderDate: "2024-01-10T10:00:00Z" },
  { id: 2, userId: 2, orderNumber: "ORD-002", status: "processing", totalAmount: 149.50, currency: "USD", shippingAddress: "456 Oak Ave", orderDate: "2024-01-12T14:30:00Z" },
  { id: 3, userId: 1, orderNumber: "ORD-003", status: "pending", totalAmount: 89.99, currency: "USD", shippingAddress: "123 Main St", orderDate: "2024-01-15T09:15:00Z" },
]

export class ApiClient {
  async getTables(): Promise<TableListResponse> {
    // Return mock data directly instead of making HTTP calls
    await delay(100)
    console.log("[v0] Mock getTables called")
    return mockTablesResponse
  }

  async getTableData(tableName: string, page = 0, pageSize = 100): Promise<PaginatedResponse> {
    await delay(150)
    console.log("[v0] Mock getTableData called:", tableName, page, pageSize)

    const data = tableName === "users" ? mockUserData :
      tableName === "orders" ? mockOrderData :
        mockUserData // fallback

    const columns = tableName === "users"
      ? ["id", "email", "firstName", "lastName", "status", "subscriptionTier", "lastLoginAt", "createdAt", "updatedAt"]
      : ["id", "userId", "orderNumber", "status", "totalAmount", "currency", "shippingAddress", "orderDate"]

    const start = page * pageSize
    const pageData = data.slice(start, start + pageSize)

    return {
      queryId: `mock-${Date.now()}`,
      statement: {
        queryId: `mock-${Date.now()}`,
        sql: `SELECT * FROM ${tableName}`,
        executedAt: new Date().toISOString()
      },
      columns,
      data: pageData.map(row => columns.map(col => row[col as keyof typeof row])),
      pagination: {
        page,
        pageSize,
        totalRows: data.length,
        totalPages: Math.ceil(data.length / pageSize),
        hasNext: page < Math.ceil(data.length / pageSize) - 1,
        hasPrevious: page > 0
      }
    }
  }

  async getPage(tableName: string, queryId: string, pageIndex: number, pageSize = 100): Promise<PageResponse> {
    const result = await this.getTableData(tableName, pageIndex, pageSize)
    return {
      queryId,
      data: result.data,
      pagination: result.pagination
    }
  }

  async getQueryStatus(queryId: string): Promise<QueryStatusResponse> {
    await delay(50)
    return {
      queryId,
      status: "completed",
      progress: 100
    }
  }
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export const apiClient = new ApiClient()
