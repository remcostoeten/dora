# Database Testing Companion App

Create a modern web application that serves as a testing companion for database connectivity, specifically designed to validate and compare against the Dora database application.

## Core Requirements

### Database Support
- **PostgreSQL** - Full connection and query support
- **MySQL** - Full connection and query support
- Extensible architecture for future databases (SQLite, etc.)

### Connection Management
- **Frontend Connection Interface**: 
  - Input field for connection URLs/strings
  - Support for standard formats:
    - PostgreSQL: `postgresql://user:password@host:port/database`
    - MySQL: `mysql://user:password@host:port/database`
  - Real-time connection validation
  - Connection status indicators (connected/disconnected/error)
  - Connection history/persistence

### Database Exploration & Visualization
- **Schema Browser**:
  - List all databases/schemas
  - List all tables with row counts
  - Show table structures (columns, types, constraints)
  - Display indexes and foreign keys

- **Data Grid**:
  - Paginated table data viewer
  - Sortable columns
  - Search/filter functionality
  - Cell editing capabilities (for testing mutations)

- **SQL Query Console**:
  - SQL editor with syntax highlighting
  - Query execution with results display
  - Query history
  - EXPLAIN plan visualization

### Real-time Features (for testing Dora's live polling)
- **Live Data Monitoring**:
  - Auto-refresh toggle (configurable intervals)
  - Visual indicators when data changes
  - Change log showing recent modifications
  - Timestamp tracking for updates

- **Mutation Testing**:
  - Inline cell editing in data grid
  - INSERT/UPDATE/DELETE operations
  - Batch operations support
  - Transaction rollback capability

### Data Comparison Tools
- **Export/Import**:
  - Export table data as JSON/CSV
  - Import data for testing
  - Data snapshot capabilities

- **Validation Suite**:
  - Connection test suite
  - Query execution validation
  - Data consistency checks

## Technical Implementation

### Frontend Requirements
- **Framework**: Next.js 15+ with TypeScript
- **UI Components**: shadcn/ui for consistent, modern interface
- **Database Connectivity**: 
  - Direct database connections via server API routes
  - PostgreSQL: `pg` library
  - MySQL: `mysql2` library
  - Connection pooling for performance

### Key Features Architecture
```typescript
// Connection Management
interface DatabaseConnection {
  id: string;
  type: 'postgresql' | 'mysql';
  connectionString: string;
  status: 'connected' | 'disconnected' | 'error';
  lastTested: Date;
}

// Real-time Monitoring
interface DataChange {
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  timestamp: Date;
  affectedRows: number;
}

// Query Results
interface QueryResult {
  columns: ColumnInfo[];
  rows: RowData[];
  totalRows: number;
  executionTime: number;
}
```

### UI/UX Requirements
- **Dashboard Layout**:
  - Left sidebar: Connection management
  - Main area: Database explorer and data grid
  - Right panel: SQL console and query results
  - Top bar: Connection status and real-time monitoring

- **Visual Design**:
  - Clean, professional interface similar to Dora
  - Dark/light theme support
  - Responsive design for various screen sizes
  - Loading states and error boundaries

### Security & Performance
- **Connection Security**:
  - SSL/TLS support for database connections
  - Credential encryption in storage
  - Connection timeout handling

- **Performance Optimization**:
  - Virtual scrolling for large datasets
  - Lazy loading for schema information
  - Query result caching
  - Connection pooling

## Testing Integration Features

### Dora Comparison Tools
- **Side-by-side Comparison Mode**:
  - Split screen view to compare results with Dora
  - Data diff visualization
  - Query performance comparison

- **Test Scenarios**:
  - Standardized test queries for validation
  - Performance benchmarking
  - Connection reliability testing

### Automation Support
- **API Endpoints**:
  - `/api/connections` - Manage database connections
  - `/api/query` - Execute SQL queries
  - `/api/schema` - Get database schema
  - `/api/monitor` - Real-time data changes

- **Webhook Support**:
  - Notify external systems of data changes
  - Integration with testing frameworks

## Success Criteria

1. **Reliable Connections**: Successfully connect to PostgreSQL and MySQL databases
2. **Data Accuracy**: Display identical results to standard database tools
3. **Real-time Updates**: Accurately detect and display data changes
4. **Performance**: Handle datasets with 10k+ rows efficiently
5. **Usability**: Intuitive interface for database testing workflows

## Technical Constraints

- **No Database Dependencies**: The app should not require its own database
- **State Management**: Use React state/localStorage for persistence
- **Error Handling**: Comprehensive error reporting and recovery
- **Browser Compatibility**: Modern browsers (Chrome, Firefox, Safari, Edge)

## Docker Helper UI

### Quick Database Setup
- **One-liner Commands**: Display ready-to-copy Docker commands for quick database setup
- **Docker Compose Templates**: Pre-configured compose files for different database combinations
- **Local Development Helper**: UI section with common database setup commands

#### Example Commands to Include:
```bash
# PostgreSQL
docker run --name postgres-dev -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:15

# MySQL  
docker run --name mysql-dev -e MYSQL_ROOT_PASSWORD=password -p 3306:3306 -d mysql:8

# Docker Compose (both databases)
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
  
  mysql:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: password
    ports:
      - "3306:3306"
```

**Note**: This is purely a UI helper - the app doesn't manage Docker containers, just provides convenient copy-paste commands for developers.

---

This application will serve as the "source of truth" for database connectivity testing, providing a reliable reference implementation to validate Dora's database features, connection handling, and real-time data synchronization capabilities.
