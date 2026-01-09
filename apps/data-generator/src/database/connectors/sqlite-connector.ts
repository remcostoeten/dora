import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { TableSchema, DatabaseConnection } from '../../types';
import { generateCreateTable } from '../../exporters/sql-exporter';

const connectToSQLite = (connection: DatabaseConnection): Database.Database => {
  if (!connection.filePath) {
    throw new Error('SQLite file path is required');
  }

  const dir = path.dirname(connection.filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(connection.filePath);
  return db;
};

const testConnection = (connection: DatabaseConnection): boolean => {
  try {
    const db = connectToSQLite(connection);
    db.prepare('SELECT 1').get();
    db.close();
    return true;
  } catch (error) {
    return false;
  }
};

const createTable = (db: Database.Database, schema: TableSchema): void => {
  const sql = generateCreateTable(schema, 'sqlite');
  db.exec(sql);
};

const insertData = (db: Database.Database, schema: TableSchema, data: Record<string, any>[], batchSize = 1000): number => {
  const columns = schema.columns.map(col => col.name);
  const placeholders = columns.map(() => '?').join(', ');
  const insert = db.prepare(`INSERT INTO ${schema.name} (${columns.join(', ')}) VALUES (${placeholders})`);

  const insertMany = db.transaction((rows) => {
    for (const row of rows) {
      const values = columns.map(col => row[col]);
      insert.run(values);
    }
  });

  const batches = Math.ceil(data.length / batchSize);

  for (let i = 0; i < batches; i++) {
    const start = i * batchSize;
    const end = Math.min(start + batchSize, data.length);
    const batch = data.slice(start, end);
    insertMany(batch);
  }

  return data.length;
};

const dropTable = (db: Database.Database, tableName: string): void => {
  db.exec(`DROP TABLE IF EXISTS ${tableName}`);
};

const truncateTable = (db: Database.Database, tableName: string): void => {
  db.exec(`DELETE FROM ${tableName}`);
};

export {
  connectToSQLite,
  testConnection,
  createTable,
  insertData,
  dropTable,
  truncateTable
};