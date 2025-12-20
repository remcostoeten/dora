# Mock REST API Design

**Purpose**: Spreadsheet-style frontend mock API that mirrors Tauri 2.0 backend data handling patterns

**Base URL**: `https://api.example.com/v1`

## Core Concepts

The API design mirrors your existing Tauri backend structure:
- Uses `QueryId` for tracking queries
- Returns paginated `Page` responses (arrays of arrays)
- Follows `StatementInfo` response patterns
- Supports the same pagination model as your backend

## Endpoints

### 1. Get Tables List
```
GET /tables
```

**Response:**
```json
{
  "tables": [
    {
      "name": "users",
      "displayName": "Users",
      "rowCount": 1250,
      "schema": "public"
    },
    {
      "name": "orders",
      "displayName": "Orders",
      "rowCount": 5432,
      "schema": "public"
    },
    {
      "name": "product_category",
      "displayName": "Product Categories",
      "rowCount": 12,
      "schema": "public"
    },
    {
      "name": "orders_items",
      "displayName": "Order Items",
      "rowCount": 15847,
      "schema": "public"
    },
    {
      "name": "active_users",
      "displayName": "Active Users",
      "rowCount": 89,
      "schema": "public"
    },
    {
      "name": "order_summary",
      "displayName": "Order Summary",
      "rowCount": 3,
      "schema": "public"
    },
    {
      "name": "empty_table",
      "displayName": "Empty Table",
      "rowCount": 0,
      "schema": "public"
    }
  ]
}
```

### 2. Get Table Data (Paginated)
```
GET /tables/{tableName}
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `pageSize`: Records per page (default: 100, max: 1000)
- `sort`: Column to sort by (default: "id")
- `order`: Sort direction "asc" or "desc" (default: "asc")
- `filter`: Optional filter expression
- `columns`: Comma-separated list of columns (default: all)

**Response:**
```json
{
  "queryId": "uuid-string",
  "tableName": "users",
  "status": "Completed",
  "returns_values": true,
  "columns": [
    "id", "email", "firstName", "lastName", "status", "createdAt", "lastLoginAt", "isActive", "role", "department", "note"
  ],
  "affected_rows": null,
  "error": null,
  "pagination": {
    "currentPage": 1,
    "pageSize": 100,
    "totalPages": 13,
    "totalRows": 1250,
    "hasNext": true,
    "hasPrevious": false
  },
  "first_page": [
    [1, "john.doe@company.com", "John", "Doe", "active", "2024-01-15T10:30:00Z", "2024-12-19T15:45:00Z", true, "admin", "Engineering", "Premium user"],
    [2, "jane.smith@company.com", "Jane", "Smith", "active", "2024-01-16T14:22:00Z", "2024-12-18T09:30:00Z", true, "user", "Sales", null],
    [3, "mike.wilson@company.com", "Mike", "Wilson", "inactive", "2024-02-01T08:15:00Z", "2024-11-30T16:20:00Z", false, "user", "Support", "On leave"],
    // ... more rows
  ]
}
```

### 3. Fetch Additional Pages
```
GET /tables/{tableName}/pages/{queryId}/{pageIndex}
```

**Response:**
```json
{
  "queryId": "uuid-string",
  "tableName": "users",
  "pageIndex": 2,
  "page": [
    [101, "user101@company.com", "Alice", "Johnson", "inactive", "2024-02-01T09:15:00Z", "2024-10-15T11:30:00Z", false, "user", "HR", "Churned user"],
    [102, "user102@company.com", "Bob", "Brown", "active", "2024-02-02T11:45:00Z", "2024-12-19T14:20:00Z", true, "moderator", "Operations", null],
    // ... more rows
  ]
}
```

### 4. Get Query Status
```
GET /queries/{queryId}/status
```

**Response:**
```json
{
  "queryId": "uuid-string",
  "status": "Running",
  "progress": 45,
  "estimatedTimeRemaining": 1200,
  "rowsProcessed": 562
}
```

### 5. Execute Custom Query
```
POST /queries
```

**Request:**
```json
{
  "query": "SELECT * FROM users WHERE status = 'active' AND role = 'admin'",
  "connectionId": "default"
}
```

**Response:**
```json
{
  "queryIds": ["uuid-string"],
  "statementInfos": [
    {
      "returns_values": true,
      "status": "Completed",
      "first_page": [[...]],
      "affected_rows": null,
      "error": null,
      "columns": ["id", "email", "firstName", "lastName", "status", "createdAt", "lastLoginAt", "isActive", "role", "department", "note"]
    }
  ]
}
```

## Table Schemas

### 1. Users Table (1,250 rows)
```typescript
interface User {
  id: number                  // Primary key
  email: string              // User email (unique)
  firstName: string          // First name
  lastName: string           // Last name
  status: 'active' | 'inactive' | 'suspended'  // Account status
  createdAt: string          // ISO timestamp
  lastLoginAt: string | null // Last login timestamp
  isActive: boolean          // Active flag
  role: 'admin' | 'user' | 'moderator'  // User role
  department: string | null  // Department name
  note: string | null        // Optional notes
}
```

### 2. Orders Table (5,432 rows)
```typescript
interface Order {
  id: number                  // Primary key
  orderNumber: string        // Order number (ORD-XXXXX)
  userId: number             // Foreign key to users
  customerEmail: string      // Customer email
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  totalAmount: number        // Order total
  currency: string           // Currency code (USD, EUR, etc.)
  createdAt: string          // Order created timestamp
  shippedAt: string | null   // Shipped timestamp
  deliveredAt: string | null // Delivered timestamp
  isPriority: boolean        // Priority flag
  trackingNumber: string | null // Tracking number
  note: string | null        // Customer notes
}
```

### 3. Product_Category Table (12 rows)
```typescript
interface ProductCategory {
  id: number                  // Primary key
  name: string              // Category name
  slug: string              // URL slug
  description: string | null // Category description
  parentId: number | null   // Parent category ID
  status: 'active' | 'inactive'
  createdAt: string          // Created timestamp
  isActive: boolean          // Active flag
  sortOrder: number          // Display order
  note: string | null        // Admin notes
}
```

### 4. Orders_Items Table (15,847 rows)
```typescript
interface OrderItem {
  id: number                  // Primary key
  orderId: number            // Foreign key to orders
  productId: number          // Product ID
  sku: string                // Product SKU
  productName: string        // Product name
  quantity: number           // Quantity ordered
  unitPrice: number          // Price per unit
  totalPrice: number         // Total price (quantity * unitPrice)
  status: 'ordered' | 'shipped' | 'returned' | 'cancelled'
  createdAt: string          // Line item created timestamp
  isGift: boolean            // Gift wrap flag
  discountApplied: boolean   // Discount applied flag
  note: string | null        // Line item notes
}
```

### 5. Active_Users Table (89 rows)
```typescript
interface ActiveUser {
  id: number                  // Primary key
  email: string              // User email
  name: string               // Full name
  status: 'online' | 'offline' | 'away'  // Current status
  lastSeenAt: string         // Last activity timestamp
  currentSessionStart: string // Current session start
  createdAt: string          // Account created timestamp
  isActive: boolean          // Active flag
  deviceType: 'desktop' | 'mobile' | 'tablet'  // Current device
  location: string | null    // User location
  note: string | null        // Status notes
}
```

### 6. Order_Summary Table (3 rows)
```typescript
interface OrderSummary {
  id: number                  // Primary key
  period: string             // Period identifier (2024-Q1, 2024-Q2, etc.)
  totalOrders: number        // Total orders in period
  totalRevenue: number       // Total revenue in period
  status: 'completed' | 'pending'  // Summary status
  createdAt: string          // Summary created timestamp
  isActive: boolean          // Active flag
  averageOrderValue: number  // Average order value
  note: string | null        // Summary notes
}
```

### 7. Empty Table (0 rows for testing)
```typescript
interface EmptyTable {
  id: number
  email: string
  name: string
  status: string
  createdAt: string
  isActive: boolean
  note: string | null
}
```

## Error Handling Format

All API errors follow this format:

```json
{
  "error": {
    "code": "TABLE_NOT_FOUND",
    "message": "Table 'nonexistent' does not exist",
    "details": {
      "tableName": "nonexistent",
      "availableTables": ["users", "orders", "product_category", "orders_items", "active_users", "order_summary", "empty_table"]
    }
  },
  "timestamp": "2024-12-20T10:30:00Z",
  "requestId": "req-uuid-string"
}
```

**Common Error Codes:**
- `TABLE_NOT_FOUND` - Requested table doesn't exist
- `QUERY_ID_NOT_FOUND` - Invalid query ID
- `PAGE_OUT_OF_RANGE` - Requested page doesn't exist
- `INVALID_SORT_COLUMN` - Sort column doesn't exist
- `PAGE_SIZE_TOO_LARGE` - Page size exceeds maximum
- `FILTER_SYNTAX_ERROR` - Invalid filter expression

## Usage Examples

### Example 1: Load first page of users
```javascript
const response = await fetch('/api/v1/tables/users?page=1&pageSize=50&sort=createdAt&order=desc')
const data = await response.json()
console.log(`Loaded ${data.first_page.length} users of ${data.pagination.totalRows}`)
```

### Example 2: Load next page using queryId
```javascript
const nextPageResponse = await fetch(`/api/v1/tables/users/pages/${data.queryId}/2`)
const nextPageData = await nextPageResponse.json()
```

### Example 3: Filter orders by status
```javascript
const filteredOrders = await fetch('/api/v1/tables/orders?filter=status="shipped"&pageSize=200')
const ordersData = await filteredOrders.json()
```

### Example 4: Sort products by category
```javascript
const sortedProducts = await fetch('/api/v1/tables/product_category?sort=sortOrder&order=asc')
```

### Example 5: Get specific columns
```javascript
const userColumns = await fetch('/api/v1/tables/users?columns=id,email,name,status')
```

## Real-time Updates (Future)

For real-time capabilities, add WebSocket support:

```
ws://api.example.com/v1/ws
```

**Message Format:**
```json
{
  "type": "query_progress",
  "queryId": "uuid-string",
  "data": {
    "status": "Running",
    "progress": 75,
    "currentPage": 3,
    "rowsProcessed": 7500
  }
}
```

## Frontend Integration Notes

### Tab Management
- Each tab should maintain its own `queryId` for pagination
- Store tab state: `{ queryId, tableName, currentPage, columns, filters }`
- Use `queryId` to fetch additional pages for that tab

### Pagination Strategy
- Load first page immediately for responsive UI
- Preload next page in background for smooth scrolling
- Cache pages already loaded to reduce API calls

### Error Handling
- Display user-friendly messages for common errors
- Retry mechanism for network failures
- Graceful degradation for large datasets

### Performance Considerations
- Use appropriate page sizes (50-200 rows for UI)
- Implement virtual scrolling for large tables
- Debounce filter and sort requests
- Cancel pending requests when switching tabs

This API design provides everything needed for your spreadsheet interface while maintaining compatibility with your existing Tauri backend patterns.