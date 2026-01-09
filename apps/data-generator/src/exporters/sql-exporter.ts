import { TableSchema, ColumnDefinition } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export const generateCreateTable = (schema: TableSchema, dbType: 'sqlite' | 'postgresql' | 'mysql'): string => {
  const columns = schema.columns.map(col => {
    let sqlType = 'TEXT';
    const constraints: string[] = [];

    if (col.constraints?.primaryKey) {
      constraints.push('PRIMARY KEY');
    }

    if (col.constraints?.unique) {
      constraints.push('UNIQUE');
    }

    if (col.constraints?.notNull) {
      constraints.push('NOT NULL');
    }

    if (col.constraints?.defaultValue !== undefined) {
      constraints.push(`DEFAULT ${typeof col.constraints.defaultValue === 'string' ? `'${col.constraints.defaultValue}'` : col.constraints.defaultValue}`);
    }

    if (dbType === 'sqlite') {
      if (['integer', 'float', 'price', 'percentage', 'latitude', 'longitude', 'range'].includes(col.type)) {
        sqlType = 'INTEGER';
      } else if (col.type === 'boolean') {
        sqlType = 'INTEGER';
      } else if (col.type === 'json') {
        sqlType = 'TEXT';
      } else {
        sqlType = 'TEXT';
      }
    } else if (dbType === 'postgresql') {
      if (['integer'].includes(col.type)) {
        sqlType = 'INTEGER';
      } else if (['float', 'price', 'percentage', 'latitude', 'longitude', 'range'].includes(col.type)) {
        sqlType = 'NUMERIC';
      } else if (col.type === 'boolean') {
        sqlType = 'BOOLEAN';
      } else if (col.type === 'json') {
        sqlType = 'JSONB';
      } else {
        sqlType = 'TEXT';
      }
    } else if (dbType === 'mysql') {
      if (['integer'].includes(col.type)) {
        sqlType = 'INT';
      } else if (['float', 'price', 'percentage', 'latitude', 'longitude', 'range'].includes(col.type)) {
        sqlType = 'DECIMAL(10,2)';
      } else if (col.type === 'boolean') {
        sqlType = 'TINYINT(1)';
      } else if (col.type === 'json') {
        sqlType = 'JSON';
      } else {
        sqlType = 'VARCHAR(255)';
      }
    }

    const constraintStr = constraints.length > 0 ? ' ' + constraints.join(' ') : '';
    return `  ${col.name} ${sqlType}${constraintStr}`;
  }).join(',\n');

  return `CREATE TABLE IF NOT EXISTS ${schema.name} (\n${columns}\n);`;
};

const generateInsertStatements = (schema: TableSchema, data: Record<string, any>[], dbType: 'sqlite' | 'postgresql' | 'mysql'): string => {
  const columns = schema.columns.map(col => col.name);
  const placeholders = dbType === 'postgresql' ? Array(columns.length).fill('$' + (i => i + 1)(0)).map((_, i) => `$${i + 1}`) : Array(columns.length).fill('?');

  const statements = data.map(row => {
    const values = columns.map(col => {
      const value = row[col];
      if (value === null) {
        return 'NULL';
      }
      if (typeof value === 'string') {
        return `'${value.replace(/'/g, "''")}'`;
      }
      if (typeof value === 'boolean') {
        return dbType === 'mysql' ? (value ? 1 : 0) : value;
      }
      return value;
    });

    return `INSERT INTO ${schema.name} (${columns.join(', ')}) VALUES (${values.join(', ')});`;
  });

  return statements.join('\n');
};

const exportToSql = (schema: TableSchema, data: Record<string, any>[], outputPath: string, dbType: 'sqlite' | 'postgresql' | 'mysql' = 'sqlite'): void => {
  const dir = path.dirname(outputPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const createTable = generateCreateTable(schema, dbType);
  const insertStatements = generateInsertStatements(schema, data, dbType);

  const sqlContent = `${createTable}\n\n${insertStatements}`;
  fs.writeFileSync(outputPath, sqlContent);
};

const generatePrismaSchema = (schema: TableSchema): string => {
  const model = schema.name.charAt(0).toUpperCase() + schema.name.slice(1);
  const fields = schema.columns.map(col => {
    let prismaType = 'String';
    const modifiers: string[] = [];

    if (col.constraints?.primaryKey) {
      modifiers.push('@id');
    }

    if (col.constraints?.unique) {
      modifiers.push('@unique');
    }

    if (col.constraints?.defaultValue !== undefined) {
      const defaultVal = typeof col.constraints.defaultValue === 'string' ? `"${col.constraints.defaultValue}"` : col.constraints.defaultValue;
      modifiers.push(`@default(${defaultVal})`);
    }

    if (col.constraints?.notNull === false) {
      modifiers.push('?');
    }

    const stringTypes = ['firstName', 'lastName', 'fullName', 'email', 'username', 'password', 'sentence', 'paragraph', 'word', 'slug', 'date', 'futureDate', 'pastDate', 'recentDate', 'timestamp', 'url', 'domainName', 'ipAddress', 'userAgent', 'uuid', 'phoneNumber', 'streetAddress', 'city', 'country', 'zipCode', 'state', 'companyName', 'jobTitle', 'department', 'productName', 'productDescription', 'category', 'imageUrl', 'avatarUrl', 'literal'];
    const numberTypes = ['integer', 'float', 'price', 'percentage', 'latitude', 'longitude', 'range'];
    const booleanTypes = ['boolean'];
    const jsonTypes = ['json'];

    if (stringTypes.includes(col.type)) {
      prismaType = 'String';
    } else if (numberTypes.includes(col.type)) {
      prismaType = col.type === 'integer' ? 'Int' : 'Float';
    } else if (booleanTypes.includes(col.type)) {
      prismaType = 'Boolean';
    } else if (jsonTypes.includes(col.type)) {
      prismaType = 'Json';
    }

    const modifiersStr = modifiers.length > 0 ? ' ' + modifiers.join(' ') : '';
    return `  ${col.name}${modifiersStr.includes('?') ? '?' : ''}  ${prismaType}${modifiersStr.replace('?', '')}`;
  }).join('\n');

  return `model ${model} {\n${fields}\n}`;
};

const exportToPrismaSchema = (schema: TableSchema, outputPath: string): void => {
  const prismaSchema = generatePrismaSchema(schema);
  fs.writeFileSync(outputPath, prismaSchema);
};

export { exportToSql, generatePrismaSchema, exportToPrismaSchema };