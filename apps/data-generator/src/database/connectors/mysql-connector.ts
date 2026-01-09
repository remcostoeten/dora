import mysql from 'mysql2/promise';
import { TableSchema, DatabaseConnection } from '../../types';
import { generateCreateTable } from '../../exporters/sql-exporter';

const connectToMySQL = async (connection: DatabaseConnection): Promise<mysql.Connection> => {
  const config: mysql.ConnectionOptions = {};

  if (connection.connectionString) {
    const url = new URL(connection.connectionString);
    config.host = url.hostname;
    config.port = parseInt(url.port) || 3306;
    config.user = url.username;
    config.password = url.password;
    config.database = url.pathname.substring(1);
  } else {
    config.host = connection.host || 'localhost';
    config.port = connection.port || 3306;
    config.user = connection.user;
    config.password = connection.password;
    config.database = connection.database;
  }

  const conn = await mysql.createConnection(config);
  return conn;
};

const testConnection = async (connection: DatabaseConnection): Promise<boolean> => {
  try {
    const conn = await connectToMySQL(connection);
    await conn.query('SELECT 1');
    await conn.end();
    return true;
  } catch (error) {
    return false;
  }
};

const createTable = async (conn: mysql.Connection, schema: TableSchema): Promise<void> => {
  const sql = generateCreateTable(schema, 'mysql');
  await conn.query(sql);
};

const insertData = async (conn: mysql.Connection, schema: TableSchema, data: Record<string, any>[], batchSize = 1000): Promise<number> => {
  const columns = schema.columns.map(col => col.name);
  const placeholders = columns.map(() => '?').join(', ');
  const insertSql = `INSERT INTO ${schema.name} (${columns.join(', ')}) VALUES (${placeholders})`;

  const batches = Math.ceil(data.length / batchSize);
  let insertedCount = 0;

  for (let i = 0; i < batches; i++) {
    const start = i * batchSize;
    const end = Math.min(start + batchSize, data.length);
    const batch = data.slice(start, end);

    await conn.beginTransaction();

    for (const row of batch) {
      const values = columns.map(col => {
        const value = row[col];
        if (value === null) {
          return null;
        }
        if (typeof value === 'boolean') {
          return value ? 1 : 0;
        }
        return value;
      });

      await conn.query(insertSql, values);
    }

    await conn.commit();
    insertedCount += batch.length;
  }

  return insertedCount;
};

const dropTable = async (conn: mysql.Connection, tableName: string): Promise<void> => {
  await conn.query(`DROP TABLE IF EXISTS ${tableName}`);
};

const truncateTable = async (conn: mysql.Connection, tableName: string): Promise<void> => {
  await conn.query(`TRUNCATE TABLE ${tableName}`);
};

export {
  connectToMySQL,
  testConnection,
  createTable,
  insertData,
  dropTable,
  truncateTable
};