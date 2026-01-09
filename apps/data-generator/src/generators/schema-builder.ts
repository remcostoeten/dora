import { faker } from '@faker-js/faker';
import { TableSchema, ColumnDefinition } from '../types';
import { generateValue } from './faker-generator';

const generateRow = (schema: TableSchema, rowIndex: number, locale: string = 'en', seed?: number): Record<string, any> => {
  const row: Record<string, any> = {};

  faker.seed(seed ? seed + rowIndex : rowIndex);

  for (const column of schema.columns) {
    row[column.name] = generateValue(column, locale);
  }

  return row;
};

const generateRows = (schema: TableSchema, rowCount: number, locale: string = 'en', seed?: number): Record<string, any>[] => {
  const rows: Record<string, any>[] = [];

  for (let i = 0; i < rowCount; i++) {
    rows.push(generateRow(schema, i, locale, seed));
  }

  return rows;
};

const generateRowsBatch = async (schema: TableSchema, rowCount: number, batchSize: number, locale: string = 'en', seed?: number): Promise<Record<string, any>[]> => {
  const rows: Record<string, any>[] = [];
  const batches = Math.ceil(rowCount / batchSize);

  for (let i = 0; i < batches; i++) {
    const start = i * batchSize;
    const end = Math.min(start + batchSize, rowCount);
    const batchCount = end - start;

    const batchSeed = seed !== undefined ? seed + start : undefined;
    const batchRows = generateRows(schema, batchCount, locale, batchSeed);
    rows.push(...batchRows);
  }

  return rows;
};

export { generateRow, generateRows, generateRowsBatch };