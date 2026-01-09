import { select, text, confirm } from '@clack/prompts';
import chalk from 'chalk';
import ora from 'ora';
import { getPresetNames } from '../../presets';
import { handleQuickGenerate } from './quick-generate-menu';
import { handleCustomTableBuilder } from './custom-table-menu';
import { handleManagePresets } from './presets-menu';
import { handleDatabaseConnection } from './database-menu';
import { handleSettings } from './settings-menu';
import { handleExport } from './export-menu';

export async function runInteractiveMode() {
  console.clear();
  console.log(chalk.cyan.bold('\n📊 Data Generator CLI\n'));

  while (true) {
    const action = await select({
      message: 'What would you like to do?',
      options: [
        { value: 'quick', label: '⚡ Quick Generate (use preset)' },
        { value: 'custom', label: '🛠️ Custom Table Builder' },
        { value: 'presets', label: '📦 Manage Presets' },
        { value: 'database', label: '🔌 Database Connection' },
        { value: 'settings', label: '⚙️ Settings' },
        { value: 'export', label: '📤 Export Data' },
        { value: 'exit', label: '❌ Exit' }
      ]
    });

    if (typeof action !== 'string' || action === 'exit') {
      console.log(chalk.yellow('\nGoodbye! 👋\n'));
      process.exit(0);
    }

    switch (action) {
      case 'quick':
        await handleQuickGenerate();
        break;
      case 'custom':
        await handleCustomTableBuilder();
        break;
      case 'presets':
        await handleManagePresets();
        break;
      case 'database':
        await handleDatabaseConnection();
        break;
      case 'settings':
        await handleSettings();
        break;
      case 'export':
        await handleExport();
        break;
    }

    console.log();
    const shouldContinue = await confirm({
      message: 'Continue?',
      initialValue: true
    });

    if (!shouldContinue) {
      console.log(chalk.yellow('\nGoodbye! 👋\n'));
      process.exit(0);
    }
  }
}