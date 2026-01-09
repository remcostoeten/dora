export interface ColumnDefinition {
  name: string;
  type: FakerType;
  constraints?: {
    primaryKey?: boolean;
    unique?: boolean;
    notNull?: boolean;
    defaultValue?: any;
    min?: number;
    max?: number;
    format?: string;
    enum?: any[];
    nullProbability?: number;
  };
}

export type FakerType =
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'email'
  | 'username'
  | 'password'
  | 'sentence'
  | 'paragraph'
  | 'word'
  | 'slug'
  | 'integer'
  | 'float'
  | 'price'
  | 'percentage'
  | 'date'
  | 'futureDate'
  | 'pastDate'
  | 'recentDate'
  | 'timestamp'
  | 'url'
  | 'domainName'
  | 'ipAddress'
  | 'userAgent'
  | 'uuid'
  | 'phoneNumber'
  | 'streetAddress'
  | 'city'
  | 'country'
  | 'zipCode'
  | 'state'
  | 'latitude'
  | 'longitude'
  | 'companyName'
  | 'jobTitle'
  | 'department'
  | 'productName'
  | 'productDescription'
  | 'category'
  | 'imageUrl'
  | 'avatarUrl'
  | 'boolean'
  | 'json'
  | 'literal'
  | 'range';

export interface TableSchema {
  name: string;
  columns: ColumnDefinition[];
}

export interface GenerationConfig {
  rowCount: number;
  locale: string;
  seed?: number;
  incrementalId?: boolean;
  relationships?: Relationship[];
  nullProbability?: number;
  batchSize?: number;
}

export interface Relationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
}

export interface DatabaseConnection {
  type: 'sqlite' | 'postgresql' | 'mysql';
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  filePath?: string;
}

export interface ExportConfig {
  format: 'json' | 'csv' | 'sql' | 'typescript' | 'prisma';
  output?: string;
  compress?: boolean;
}

export interface Preset {
  name: string;
  description: string;
  schema: TableSchema;
  defaultRowCount: number;
}

export interface GenerationResult {
  tableName: string;
  rowsGenerated: number;
  timeElapsed: number;
  fileSize?: number;
  errors?: string[];
}