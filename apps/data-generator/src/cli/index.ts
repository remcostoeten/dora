#!/usr/bin/env node

import { program } from 'commander';
import { runInteractiveMode } from './menus/main-menu';
import { handleGenerateCommand } from './commands/generate-command';
import { handleTableCommand } from './commands/table-command';
import { handleConfigCommand } from './commands/config-command';
import chalk from 'chalk';

program
  .name('data-gen')
  .description('Interactive CLI tool for generating realistic dummy database tables with fake data')
  .version('1.0.0');

program
  .command('interactive')
  .alias('i')
  .description('Run interactive mode')
  .action(runInteractiveMode);

program
  .command('generate')
  .alias('g')
  .description('Generate data using a preset or custom table')
  .option('-p, --preset <name>', 'Use a preset template')
  .option('-t, --table <name>', 'Table name for custom table')
  .option('-c, --columns <definitions>', 'Column definitions (format: name:type,name:type)')
  .option('-r, --rows <number>', 'Number of rows to generate', '100')
  .option('-l, --locale <code>', 'Locale for faker data', 'en')
  .option('-s, --seed <number>', 'Seed for reproducible data')
  .option('-f, --format <format>', 'Export format (json, csv, sql, typescript, prisma)', 'json')
  .option('-o, --output <path>', 'Output file path')
  .option('-d, --database <connection>', 'Database connection string')
  .option('--batch-size <number>', 'Batch size for database inserts', '1000')
  .option('--drop-table', 'Drop table before inserting', false)
  .option('--truncate-table', 'Truncate table before inserting', false)
  .action(handleGenerateCommand);

program
  .command('table')
  .description('Build custom table schema')
  .option('-n, --name <name>', 'Table name')
  .option('-c, --columns <definitions>', 'Column definitions (format: name:type,name:type)')
  .option('-o, --output <path>', 'Output file path for schema')
  .option('--save-preset <name>', 'Save as preset with given name')
  .action(handleTableCommand);

program
  .command('config')
  .description('Manage configuration')
  .option('--get <key>', 'Get configuration value')
  .option('--set <key=value>', 'Set configuration value')
  .option('--reset', 'Reset to default configuration')
  .option('--show', 'Show all configuration')
  .action(handleConfigCommand);

program
  .command('presets')
  .description('List available presets')
  .action(() => {
    const { getPresetNames, presets } = require('../presets/index');
    console.log(chalk.blue('Available Presets:'));
    getPresetNames().forEach((name: string) => {
      const preset = presets.find((p: any) => p.name === name);
      console.log(`  ${chalk.green(name)}: ${preset.description}`);
    });
  });

program
  .command('locales')
  .description('List available locales')
  .action(() => {
    console.log(chalk.blue('Available Locales:'));
    const locales = [
      'en', 'en_US', 'en_GB', 'en_AU', 'en_CA', 'en_IN',
      'es', 'es_MX', 'fr', 'de', 'it', 'ja', 'ko', 'zh_CN', 'zh_TW',
      'pt_BR', 'ru', 'nl', 'sv', 'da', 'no', 'fi', 'pl', 'uk', 'vi',
      'th', 'id', 'ms', 'tr', 'ar', 'he', 'el', 'cs', 'ro', 'hu', 'sk'
    ];
    locales.forEach(locale => {
      console.log(`  ${chalk.green(locale)}`);
    });
  });

if (process.argv.length === 2) {
  runInteractiveMode();
} else {
  program.parse();
}

process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\nOperation cancelled by user'));
  process.exit(0);
});