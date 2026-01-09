import { Pool, PoolClient } from 'pg';
import { TableSchema, DatabaseConnection } from '../../types';
import { generateCreateTable } from '../../exporters/sql-exporter';

const connectToPostgreSQL = async (connection: DatabaseConnection): Promise<Pool> => {
  const config: any = {};

  if (connection.connectionString) {
    config.connectionString = connection.connectionString;
  } else {
    config.host = connection.host || 'localhost';
    config.port = connection.port || 5432;
    config.database = connection.database;
    config.user = connection.user;
    config.password = connection.password;
  }

  const pool = new Pool(config);
  return pool;
};

const testConnection = async (connection: DatabaseConnection): Promise<boolean> => {
  try {
    const pool = await connectToPostgreSQL(connection);
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    await pool.end();
    return true;
  } catch (error) {
    return false;
  }
};

const createTable = async (pool: Pool, schema: TableSchema): Promise<void> => {
  const client = await pool.connect();
  try {
    const sql = generateCreateTable(schema, 'postgresql');
    await client.query(sql);
  } finally {
    client.release();
  }
};

const insertData = async (pool: Pool, schema: TableSchema, data: Record<string, any>[], batchSize = 1000): Promise<number> => {
  const client = await pool.connect();
  let insertedCount = 0;

  try {
    const columns = schema.columns.map(col => col.name);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const insertSql = `INSERT INTO ${schema.name} (${columns.join(', ')}) VALUES (${placeholders})`;

    const batches = Math.ceil(data.length / batchSize);

    for (let i = 0; i < batches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, data.length);
      const batch = data.slice(start, end);

      await client.query('BEGIN');

      for (const row of batch) {
        const values = columns.map(col => {
          const value = row[col];
          if (value === null) {
            return null;
          }
          return value;
        });

        await client.query(insertSql, values);
      }

      await client.query('COMMIT');
      insertedCount += batch.length;
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return insertedCount;
};

const dropTable = async (pool: Pool, tableName: string): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query(`DROP TABLE IF EXISTS ${tableName}`);
  } finally {
    client.release();
  }
};

const truncateTable = async (pool: Pool, tableName: string): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query(`TRUNCATE TABLE ${tableName}`);
  } finally {
    client.release();
  }
};

export {
  connectToPostgreSQL,
  testConnection,
  createTable,
  insertData,
  dropTable,
  truncateTable
};