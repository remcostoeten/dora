// Core API types matching Tauri 2.0 backend patterns

export type QueryId = string

export type StatementInfo = {
  queryId: QueryId
  sql: string
  executedAt: string
  rowsAffected?: number
}

export type Pagination = {
  page: number
  pageSize: number
  totalPages: number
  totalRows: number
  hasNext: boolean
  hasPrevious: boolean
}

// Table List Response
export type TableListResponse = {
  tables: TableMetadata[]
}

export type TableMetadata = {
  name: string
  schema: string
  rowCount: number
  type: "table" | "view"
}

// Paginated Response (initial request)
export type PaginatedResponse<T = unknown[][]> = {
  queryId: QueryId
  statement: StatementInfo
  columns: string[]
  data: T
  pagination: Pagination
}

// Page Response (subsequent pages)
export type PageResponse<T = unknown[][]> = {
  queryId: QueryId
  data: T
  pagination: Pagination
}

// Query Status Response
export type QueryStatusResponse = {
  queryId: QueryId
  status: "pending" | "running" | "completed" | "failed"
  progress?: number
  rowsFetched?: number
  error?: string
}

// Error Response
export type ApiErrorResponse = {
  error: ErrorDetails
}

export type ErrorDetails = {
  code: ErrorCode
  message: string
  details?: Record<string, unknown>
  timestamp: string
  requestId: string
}

export type ErrorCode =
  | "TABLE_NOT_FOUND"
  | "QUERY_ID_NOT_FOUND"
  | "PAGE_OUT_OF_RANGE"
  | "INVALID_SORT_COLUMN"
  | "PAGE_SIZE_TOO_LARGE"
  | "FILTER_SYNTAX_ERROR"

// Table Schemas
export interface UserRecord {
  id: number
  email: string
  firstName: string | null
  lastName: string | null
  status: "active" | "inactive" | "pending"
  subscriptionTier: "free" | "pro" | "enterprise" | null
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export interface OrderRecord {
  id: number
  userId: number
  orderNumber: string
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled"
  totalAmount: number
  currency: string
  shippingAddress: string | null
  orderDate: string
  shippedDate: string | null
  deliveredDate: string | null
}

export interface ProductCategoryRecord {
  id: number
  name: string
  slug: string
  description: string | null
  parentId: number | null
  isActive: boolean
  displayOrder: number
}

export interface OrderItemRecord {
  id: number
  orderId: number
  productId: number
  productName: string
  quantity: number
  unitPrice: number
  discount: number
  totalPrice: number
  sku: string | null
}

export interface ActiveUserRecord {
  userId: number
  email: string
  firstName: string | null
  lastName: string | null
  lastLoginAt: string
  sessionCount: number
  totalOrders: number
  lifetimeValue: number
}

export interface OrderSummaryRecord {
  status: string
  orderCount: number
  totalRevenue: number
}

export interface ProductRecord {
  id: number
  name: string
  description: string | null
  price: number
  category: string
  inStock: boolean
}

export type EmptyTableRecord = {}

