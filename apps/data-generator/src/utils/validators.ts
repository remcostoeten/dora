const RESERVED_KEYWORDS = [
  'select', 'from', 'where', 'insert', 'update', 'delete', 'create', 'drop',
  'alter', 'table', 'index', 'view', 'join', 'inner', 'outer', 'left', 'right',
  'union', 'distinct', 'order', 'group', 'having', 'limit', 'offset', 'and',
  'or', 'not', 'null', 'is', 'in', 'between', 'like', 'as', 'into', 'values',
  'set', 'primary', 'key', 'foreign', 'references', 'constraint', 'unique',
  'check', 'default', 'cascade', 'restrict', 'no', 'action', 'set', 'case',
  'when', 'then', 'else', 'end', 'exists', 'any', 'all', 'some', 'true',
  'false', 'current_date', 'current_time', 'current_timestamp', 'user',
  'session_user', 'system_user'
];

const validators = {
  tableName: (name: string): { valid: boolean; error?: string } => {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'Table name cannot be empty' };
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return { valid: false, error: 'Table name must start with letter or underscore and contain only letters, numbers, and underscores' };
    }

    if (RESERVED_KEYWORDS.includes(name.toLowerCase())) {
      return { valid: false, error: 'Table name cannot be a reserved SQL keyword' };
    }

    return { valid: true };
  },

  columnName: (name: string): { valid: boolean; error?: string } => {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'Column name cannot be empty' };
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return { valid: false, error: 'Column name must start with letter or underscore and contain only letters, numbers, and underscores' };
    }

    if (RESERVED_KEYWORDS.includes(name.toLowerCase())) {
      return { valid: false, error: 'Column name cannot be a reserved SQL keyword' };
    }

    return { valid: true };
  },

  rowCount: (count: number): { valid: boolean; error?: string } => {
    if (isNaN(count) || count < 1) {
      return { valid: false, error: 'Row count must be a positive number' };
    }

    if (count > 1000000) {
      return { valid: false, error: 'Row count cannot exceed 1,000,000' };
    }

    return { valid: true };
  },

  connectionString: (connectionString: string): { valid: boolean; error?: string } => {
    if (!connectionString || connectionString.trim().length === 0) {
      return { valid: false, error: 'Connection string cannot be empty' };
    }

    if (!connectionString.includes('://')) {
      return { valid: false, error: 'Invalid connection string format' };
    }

    return { valid: true };
  },

  filePath: (path: string): { valid: boolean; error?: string } => {
    if (!path || path.trim().length === 0) {
      return { valid: false, error: 'File path cannot be empty' };
    }

    return { valid: true };
  }
};

export default validators;