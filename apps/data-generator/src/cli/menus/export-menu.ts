import { select, text, confirm } from '@clack/prompts';
import chalk from 'chalk';
import * as fs from 'fs';
import ora from 'ora';
import { exportToCsv } from '../../exporters/csv-exporter';
import logger from '../../utils/logger';

export async function handleExport() {
  console.clear();
  console.log(chalk.cyan.bold('\n📤 Export Data\n'));

  const action = await select({
    message: 'What would you like to do?',
    options: [
      { value: 'export', label: 'Export from generated data' },
      { value: 'convert', label: 'Convert existing file' },
      { value: 'back', label: '← Back' }
    ]
  });

  if (typeof action !== 'string' || action === 'back') return;

  switch (action) {
    case 'export':
      await handleExportData();
      break;
    case 'convert':
      await handleConvertFile();
      break;
  }
}

async function handleExportData() {
  logger.info('Use the Quick Generate or Custom Table Builder to export data');
  await confirm({ message: 'Press Enter to continue...', initialValue: true });
}

async function handleConvertFile() {
  const inputPath = await text({
    message: 'Input file path:',
    placeholder: './data/users.json'
  });

  if (typeof inputPath !== 'string') return;

  if (!fs.existsSync(inputPath)) {
    logger.error('File not found');
    return;
  }

  const targetFormat = await select({
    message: 'Select target format:',
    options: [
      { value: 'csv', label: 'CSV' },
      { value: 'sql', label: 'SQL' },
      { value: 'typescript', label: 'TypeScript' },
      { value: 'prisma', label: 'Prisma Schema' }
    ]
  });

  if (typeof targetFormat !== 'string') return;

  const outputPath = await text({
    message: 'Output file path:',
    placeholder: inputPath.replace(/\.[^.]+$/, `.${targetFormat}`)
  });

  if (typeof outputPath !== 'string') return;

  const spinner = ora(chalk.cyan('Converting file...')).start();

  try {
    const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

    switch (targetFormat) {
      case 'csv':
        const columns = Object.keys(data[0] || {});
        await exportToCsv(data, outputPath, columns);
        break;
      case 'sql':
        logger.error('SQL conversion requires schema information');
        spinner.stop();
        return;
      case 'typescript':
        logger.error('TypeScript conversion requires schema information');
        spinner.stop();
        return;
      case 'prisma':
        logger.error('Prisma conversion requires schema information');
        spinner.stop();
        return;
    }

    spinner.stop();
    logger.success(`File converted to: ${outputPath}`);

  } catch (error: any) {
    spinner.stop();
    logger.error(`Conversion failed: ${error.message}`);
  }
}