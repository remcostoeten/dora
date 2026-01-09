import { TableSchema, ColumnDefinition } from '../../types';
import * as fs from 'fs';
import validators from '../../utils/validators';
import logger from '../../utils/logger';
import chalk from 'chalk';
import settings from '../../config/settings';

interface TableOptions {
  name?: string;
  columns?: string;
  output?: string;
  savePreset?: string;
}

export async function handleTableCommand(options: TableOptions) {
  try {
    const { name, columns, output, savePreset } = options;

    if (!name) {
      logger.error('--name is required');
      process.exit(1);
    }

    if (!columns) {
      logger.error('--columns is required');
      process.exit(1);
    }

    const nameValidation = validators.tableName(name);
    if (!nameValidation.valid) {
      logger.error(nameValidation.error || 'Invalid table name');
      process.exit(1);
    }

    const columnDefs = columns.split(',').map(col => {
      const [colName, colType] = col.split(':');
      return { name: colName, type: colType || 'text' };
    });

    const schema: TableSchema = {
      name,
      columns: columnDefs.map(col => {
        const column: ColumnDefinition = {
          name: col.name,
          type: col.type as any
        };
        return column;
      })
    };

    const schemaJson = JSON.stringify(schema, null, 2);

    if (output) {
      fs.writeFileSync(output, schemaJson);
      logger.success(`Schema saved to: ${output}`);
    } else {
      console.log(schemaJson);
    }

    if (savePreset) {
      const customPresets = settings.get('customPresets') || [];
      customPresets.push({
        name: savePreset,
        description: `Custom preset for ${name}`,
        schema,
        defaultRowCount: 100
      });
      settings.set('customPresets', customPresets);
      logger.success(`Preset saved as: ${savePreset}`);
    }

  } catch (error: any) {
    logger.error(`Failed to create table schema: ${error.message}`);
    process.exit(1);
  }
}