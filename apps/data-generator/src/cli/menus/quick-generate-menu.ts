import { select, text, confirm } from '@clack/prompts';
import chalk from 'chalk';
import ora from 'ora';
import { getPreset } from '../../presets';
import { generateRows } from '../../generators/schema-builder';
import { exportToJson, exportToTypeScript } from '../../exporters/json-exporter';
import { exportToCsv } from '../../exporters/csv-exporter';
import { exportToSql, exportToPrismaSchema } from '../../exporters/sql-exporter';
import { TableSchema, GenerationConfig } from '../../types';
import validators from '../../utils/validators';
import formatters from '../../utils/formatters';
import logger from '../../utils/logger';
import * as fs from 'fs';

export async function handleQuickGenerate() {
  console.clear();
  console.log(chalk.cyan.bold('\n⚡ Quick Generate\n'));

  const presetName = await select({
    message: 'Select a preset:',
    options: [
      { value: 'users', label: '👤 Users (100 rows)' },
      { value: 'products', label: '🛍️ Products (500 rows)' },
      { value: 'posts', label: '📝 Blog Posts (200 rows)' },
      { value: 'orders', label: '📦 Orders (1,000 rows)' },
      { value: 'companies', label: '🏢 Companies (50 rows)' }
    ]
  });

  if (typeof presetName !== 'string') return;

  const preset = getPreset(presetName);
  if (!preset) {
    logger.error('Preset not found');
    return;
  }

  const rowCountInput = await text({
    message: 'Number of rows to generate:',
    placeholder: preset.defaultRowCount.toString(),
    defaultValue: preset.defaultRowCount.toString()
  });

  if (typeof rowCountInput !== 'string') return;

  const rowCount = parseInt(rowCountInput);
  const validationResult = validators.rowCount(rowCount);
  if (!validationResult.valid) {
    logger.error(validationResult.error || 'Invalid row count');
    return;
  }

  const locale = await select({
    message: 'Select locale:',
    options: [
      { value: 'en', label: 'English' },
      { value: 'es', label: 'Spanish' },
      { value: 'fr', label: 'French' },
      { value: 'de', label: 'German' },
      { value: 'ja', label: 'Japanese' },
      { value: 'zh_CN', label: 'Chinese (Simplified)' }
    ]
  });

  if (typeof locale !== 'string') return;

  const useSeed = await confirm({
    message: 'Use a seed for reproducible data?',
    initialValue: false
  });

  let seed: number | undefined;
  if (useSeed) {
    const seedInput = await text({
      message: 'Enter seed value:',
      placeholder: '12345'
    });

    if (typeof seedInput === 'string') {
      seed = parseInt(seedInput);
    }
  }

  const exportFormat = await select({
    message: 'Select export format:',
    options: [
      { value: 'json', label: 'JSON' },
      { value: 'csv', label: 'CSV' },
      { value: 'sql', label: 'SQL' },
      { value: 'typescript', label: 'TypeScript Types' },
      { value: 'prisma', label: 'Prisma Schema' }
    ]
  });

  if (typeof exportFormat !== 'string') return;

  const outputInput = await text({
    message: 'Output file path:',
    placeholder: `./output/${preset.schema.name}.${exportFormat}`
  });

  if (typeof outputInput !== 'string') return;

  const spinner = ora(chalk.cyan('Generating data...')).start();

  const startTime = Date.now();

  try {
    const config: GenerationConfig = {
      rowCount,
      locale,
      seed,
      batchSize: 1000
    };

    const data = generateRows(preset.schema, rowCount, locale, seed);

    switch (exportFormat) {
      case 'json':
        exportToJson(data, outputInput);
        break;
      case 'csv':
        await exportToCsv(data, outputInput, preset.schema.columns.map((col: any) => col.name));
        break;
      case 'sql':
        exportToSql(preset.schema, data, outputInput, 'sqlite');
        break;
      case 'typescript':
        exportToTypeScript(preset.schema, outputInput);
        break;
      case 'prisma':
        exportToPrismaSchema(preset.schema, outputInput);
        break;
    }

    const timeElapsed = Date.now() - startTime;

    spinner.stop();

    logger.success(`Generated ${formatters.number(rowCount)} rows in ${formatters.timeElapsed(timeElapsed)}`);
    logger.info(`Data exported to: ${outputInput}`);

    const stats = fs.statSync(outputInput);
    logger.info(`File size: ${formatters.fileSize(stats.size)}`);

  } catch (error: any) {
    spinner.stop();
    logger.error(`Failed to generate data: ${error.message}`);
  }
}