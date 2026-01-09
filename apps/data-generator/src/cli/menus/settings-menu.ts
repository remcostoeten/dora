import { select, text, confirm } from '@clack/prompts';
import chalk from 'chalk';
import settings from '../../config/settings';
import logger from '../../utils/logger';

export async function handleSettings() {
  console.clear();
  console.log(chalk.cyan.bold('\n⚙️ Settings\n'));

  while (true) {
    const action = await select({
      message: 'What would you like to configure?',
      options: [
        { value: 'locale', label: `🌍 Default Locale (${settings.get('defaultLocale')})` },
        { value: 'rowCount', label: `📊 Default Row Count (${settings.get('defaultRowCount')})` },
        { value: 'exportFormat', label: `📤 Default Export Format (${settings.get('defaultExportFormat')})` },
        { value: 'database', label: `🔌 Default Database (${settings.get('defaultDatabase')})` },
        { value: 'batchSize', label: `📦 Batch Size (${settings.get('defaultBatchSize')})` },
        { value: 'nullProbability', label: `❓ Null Probability (${settings.get('nullProbability')})` },
        { value: 'show', label: '👀 Show All Settings' },
        { value: 'reset', label: '🔄 Reset to Defaults' },
        { value: 'back', label: '← Back' }
      ]
    });

    if (typeof action !== 'string' || action === 'back') break;

    switch (action) {
      case 'locale':
        await configureLocale();
        break;
      case 'rowCount':
        await configureRowCount();
        break;
      case 'exportFormat':
        await configureExportFormat();
        break;
      case 'database':
        await configureDatabase();
        break;
      case 'batchSize':
        await configureBatchSize();
        break;
      case 'nullProbability':
        await configureNullProbability();
        break;
      case 'show':
        await showAllSettings();
        break;
      case 'reset':
        await resetSettings();
        break;
    }
  }
}

async function configureLocale() {
  const locale = await select({
    message: 'Select default locale:',
    options: [
      { value: 'en', label: 'English' },
      { value: 'es', label: 'Spanish' },
      { value: 'fr', label: 'French' },
      { value: 'de', label: 'German' },
      { value: 'ja', label: 'Japanese' },
      { value: 'zh_CN', label: 'Chinese (Simplified)' }
    ]
  });

  if (typeof locale === 'string') {
    settings.set('defaultLocale', locale);
    logger.success(`Default locale set to: ${locale}`);
  }
}

async function configureRowCount() {
  const rowCountInput = await text({
    message: 'Enter default row count:',
    placeholder: settings.get('defaultRowCount').toString(),
    defaultValue: settings.get('defaultRowCount').toString()
  });

  if (typeof rowCountInput === 'string') {
    const rowCount = parseInt(rowCountInput);
    if (!isNaN(rowCount) && rowCount > 0) {
      settings.set('defaultRowCount', rowCount);
      logger.success(`Default row count set to: ${rowCount}`);
    } else {
      logger.error('Invalid row count');
    }
  }
}

async function configureExportFormat() {
  const format = await select({
    message: 'Select default export format:',
    options: [
      { value: 'json', label: 'JSON' },
      { value: 'csv', label: 'CSV' },
      { value: 'sql', label: 'SQL' },
      { value: 'typescript', label: 'TypeScript' },
      { value: 'prisma', label: 'Prisma' }
    ]
  });

  if (typeof format === 'string') {
    settings.set('defaultExportFormat', format as 'json' | 'csv' | 'sql' | 'typescript' | 'prisma');
    logger.success(`Default export format set to: ${format}`);
  }
}

async function configureDatabase() {
  const database = await select({
    message: 'Select default database:',
    options: [
      { value: 'sqlite', label: 'SQLite' },
      { value: 'postgresql', label: 'PostgreSQL' },
      { value: 'mysql', label: 'MySQL' }
    ]
  });

  if (typeof database === 'string') {
    settings.set('defaultDatabase', database as 'sqlite' | 'postgresql' | 'mysql');
    logger.success(`Default database set to: ${database}`);
  }
}

async function configureBatchSize() {
  const batchSizeInput = await text({
    message: 'Enter default batch size:',
    placeholder: settings.get('defaultBatchSize').toString(),
    defaultValue: settings.get('defaultBatchSize').toString()
  });

  if (typeof batchSizeInput === 'string') {
    const batchSize = parseInt(batchSizeInput);
    if (!isNaN(batchSize) && batchSize > 0) {
      settings.set('defaultBatchSize', batchSize);
      logger.success(`Default batch size set to: ${batchSize}`);
    } else {
      logger.error('Invalid batch size');
    }
  }
}

async function configureNullProbability() {
  const nullProbabilityInput = await text({
    message: 'Enter null probability (0.0 - 1.0):',
    placeholder: settings.get('nullProbability').toString(),
    defaultValue: settings.get('nullProbability').toString()
  });

  if (typeof nullProbabilityInput === 'string') {
    const nullProbability = parseFloat(nullProbabilityInput);
    if (!isNaN(nullProbability) && nullProbability >= 0 && nullProbability <= 1) {
      settings.set('nullProbability', nullProbability);
      logger.success(`Null probability set to: ${nullProbability}`);
    } else {
      logger.error('Invalid null probability (must be between 0.0 and 1.0)');
    }
  }
}

async function showAllSettings() {
  console.clear();
  console.log(chalk.cyan.bold('\n⚙️ Current Settings\n'));

  const allSettings = settings.getAll();
  Object.entries(allSettings).forEach(([key, value]) => {
    console.log(`${chalk.green(key)}: ${JSON.stringify(value)}`);
  });

  await confirm({ message: 'Press Enter to continue...', initialValue: true });
}

async function resetSettings() {
  const confirmReset = await confirm({
    message: 'Are you sure you want to reset all settings to defaults?',
    initialValue: false
  });

  if (confirmReset) {
    settings.reset();
    logger.success('Settings reset to defaults');
  }
}