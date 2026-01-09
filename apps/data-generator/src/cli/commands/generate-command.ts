import { getPreset } from '../../presets';
import { generateRows } from '../../generators/schema-builder';
import { exportToJson } from '../../exporters/json-exporter';
import { exportToCsv } from '../../exporters/csv-exporter';
import { exportToSql } from '../../exporters/sql-exporter';
import { exportToTypeScript } from '../../exporters/json-exporter';
import { exportToPrismaSchema } from '../../exporters/sql-exporter';
import { TableSchema, GenerationConfig, DatabaseConnection } from '../../types';
import { connectToSQLite, createTable, insertData, dropTable, truncateTable } from '../../database/connectors/sqlite-connector';
import { connectToPostgreSQL, createTable as createPostgresTable, insertData as insertPostgresData, dropTable as dropPostgresTable, truncateTable as truncatePostgresTable } from '../../database/connectors/postgresql-connector';
import { connectToMySQL, createTable as createMysqlTable, insertData as insertMysqlData, dropTable as dropMysqlTable, truncateTable as truncateMysqlTable } from '../../database/connectors/mysql-connector';
import validators from '../../utils/validators';
import formatters from '../../utils/formatters';
import logger from '../../utils/logger';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';

interface GenerateOptions {
  preset?: string;
  table?: string;
  columns?: string;
  rows: string;
  locale: string;
  seed?: string;
  format: string;
  output?: string;
  database?: string;
  batchSize: string;
  dropTable: boolean;
  truncateTable: boolean;
}

export async function handleGenerateCommand(options: GenerateOptions) {
  try {
    const {
      preset,
      table,
      columns,
      rows,
      locale,
      seed,
      format,
      output,
      database,
      batchSize,
      dropTable: dropTableOpt,
      truncateTable: truncateTableOpt
    } = options;

    let schema: TableSchema;
    let rowCount = parseInt(rows);

    if (preset) {
      const selectedPreset = getPreset(preset);
      if (!selectedPreset) {
        logger.error(`Preset "${preset}" not found`);
        process.exit(1);
      }
      schema = selectedPreset.schema;
      rowCount = rowCount || selectedPreset.defaultRowCount;
    } else if (table && columns) {
      const columnDefs = columns.split(',').map(col => {
        const [name, type] = col.split(':');
        return { name, type: type || 'text' };
      });

      schema = {
        name: table,
        columns: columnDefs.map(col => ({
          name: col.name,
          type: col.type as any
        }))
      };
    } else {
      logger.error('Either --preset or both --table and --columns must be specified');
      process.exit(1);
    }

    const rowCountValidation = validators.rowCount(rowCount);
    if (!rowCountValidation.valid) {
      logger.error(rowCountValidation.error || 'Invalid row count');
      process.exit(1);
    }

    const config: GenerationConfig = {
      rowCount,
      locale,
      seed: seed ? parseInt(seed) : undefined,
      batchSize: parseInt(batchSize)
    };

    const spinner = ora(chalk.cyan('Generating data...')).start();
    const startTime = Date.now();

    const data = generateRows(schema, rowCount, locale, config.seed);

    spinner.succeed(chalk.green(`Generated ${formatters.number(rowCount)} rows in ${formatters.timeElapsed(Date.now() - startTime)}`));

    if (database) {
      await insertToDatabase(schema, data, database, {
        dropTable: dropTableOpt,
        truncateTable: truncateTableOpt,
        batchSize: parseInt(batchSize)
      });
    } else if (output) {
      await exportToFile(schema, data, output, format);
    } else {
      console.log(JSON.stringify(data, null, 2));
    }

  } catch (error: any) {
    logger.error(`Failed to generate data: ${error.message}`);
    process.exit(1);
  }
}

async function insertToDatabase(schema: TableSchema, data: Record<string, any>[], connectionString: string, options: { dropTable: boolean; truncateTable: boolean; batchSize: number }) {
  const spinner = ora(chalk.cyan('Connecting to database...')).start();

  try {
    let dbType: 'sqlite' | 'postgresql' | 'mysql';

    if (connectionString.startsWith('sqlite:')) {
      dbType = 'sqlite';
      const filePath = connectionString.replace('sqlite:', '');
      const db = connectToSQLite({ type: 'sqlite', filePath });

      if (options.dropTable) {
        spinner.text = 'Dropping table...';
        dropTable(db, schema.name);
      }

      if (options.truncateTable) {
        spinner.text = 'Truncating table...';
        truncateTable(db, schema.name);
      }

      spinner.text = 'Creating table...';
      createTable(db, schema);

      spinner.text = 'Inserting data...';
      const inserted = insertData(db, schema, data, options.batchSize);

      spinner.succeed(chalk.green(`Inserted ${formatters.number(inserted)} rows`));

      db.close();
    } else if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
      dbType = 'postgresql';
      const pool = await connectToPostgreSQL({ type: 'postgresql', connectionString });

      if (options.dropTable) {
        spinner.text = 'Dropping table...';
        await dropPostgresTable(pool, schema.name);
      }

      if (options.truncateTable) {
        spinner.text = 'Truncating table...';
        await truncatePostgresTable(pool, schema.name);
      }

      spinner.text = 'Creating table...';
      await createPostgresTable(pool, schema);

      spinner.text = 'Inserting data...';
      const inserted = await insertPostgresData(pool, schema, data, options.batchSize);

      spinner.succeed(chalk.green(`Inserted ${formatters.number(inserted)} rows`));

      await pool.end();
    } else if (connectionString.startsWith('mysql://')) {
      dbType = 'mysql';
      const conn = await connectToMySQL({ type: 'mysql', connectionString });

      if (options.dropTable) {
        spinner.text = 'Dropping table...';
        await dropMysqlTable(conn, schema.name);
      }

      if (options.truncateTable) {
        spinner.text = 'Truncating table...';
        await truncateMysqlTable(conn, schema.name);
      }

      spinner.text = 'Creating table...';
      await createMysqlTable(conn, schema);

      spinner.text = 'Inserting data...';
      const inserted = await insertMysqlData(conn, schema, data, options.batchSize);

      spinner.succeed(chalk.green(`Inserted ${formatters.number(inserted)} rows`));

      await conn.end();
    } else {
      throw new Error('Unsupported database type');
    }

  } catch (error: any) {
    spinner.fail(chalk.red('Failed to insert data'));
    logger.error(error.message);
    process.exit(1);
  }
}

async function exportToFile(schema: TableSchema, data: Record<string, any>[], outputPath: string, format: string) {
  const spinner = ora(chalk.cyan('Exporting data...')).start();

  try {
    switch (format) {
      case 'json':
        exportToJson(data, outputPath);
        break;
      case 'csv':
        await exportToCsv(data, outputPath, schema.columns.map(col => col.name));
        break;
      case 'sql':
        exportToSql(schema, data, outputPath, 'sqlite');
        break;
      case 'typescript':
        exportToTypeScript(schema, outputPath);
        break;
      case 'prisma':
        exportToPrismaSchema(schema, outputPath);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    spinner.succeed(chalk.green(`Data exported to: ${outputPath}`));

    const stats = fs.statSync(outputPath);
    logger.info(`File size: ${formatters.fileSize(stats.size)}`);

  } catch (error: any) {
    spinner.fail(chalk.red('Failed to export data'));
    logger.error(error.message);
    process.exit(1);
  }
}