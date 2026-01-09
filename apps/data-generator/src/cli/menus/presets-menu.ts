import { select, text, confirm } from '@clack/prompts';
import chalk from 'chalk';
import { presets, getPreset } from '../../presets';
import settings from '../../config/settings';
import logger from '../../utils/logger';

export async function handleManagePresets() {
  console.clear();
  console.log(chalk.cyan.bold('\n📦 Manage Presets\n'));

  const action = await select({
    message: 'What would you like to do?',
    options: [
      { value: 'list', label: 'List Presets' },
      { value: 'view', label: 'View Preset Details' },
      { value: 'delete', label: 'Delete Custom Preset' },
      { value: 'back', label: '← Back' }
    ]
  });

  if (typeof action !== 'string' || action === 'back') return;

  switch (action) {
    case 'list':
      await listPresets();
      break;
    case 'view':
      await viewPreset();
      break;
    case 'delete':
      await deletePreset();
      break;
  }
}

async function listPresets() {
  console.clear();
  console.log(chalk.cyan.bold('\n📦 Available Presets\n'));

  console.log(chalk.yellow('Built-in Presets:'));
  presets.forEach(preset => {
    console.log(`  ${chalk.green(preset.name)}: ${preset.description}`);
    console.log(`    Default rows: ${preset.defaultRowCount}`);
    console.log(`    Columns: ${preset.schema.columns.length}`);
    console.log();
  });

  const customPresets = settings.get('customPresets') || [];
  if (customPresets.length > 0) {
    console.log(chalk.yellow('Custom Presets:'));
    customPresets.forEach((preset: any) => {
      console.log(`  ${chalk.green(preset.name)}: ${preset.description}`);
      console.log(`    Default rows: ${preset.defaultRowCount}`);
      console.log(`    Columns: ${preset.schema.columns.length}`);
      console.log();
    });
  }

  await confirm({ message: 'Press Enter to continue...', initialValue: true });
}

async function viewPreset() {
  console.clear();
  console.log(chalk.cyan.bold('\n📦 View Preset Details\n'));

  const allPresets = [...presets, ...(settings.get('customPresets') || [])];

  const presetName = await select({
    message: 'Select a preset:',
    options: allPresets.map((preset: any) => ({
      value: preset.name,
      label: `${preset.name} - ${preset.description}`
    }))
  });

  if (typeof presetName !== 'string') return;

  const preset = getPreset(presetName) || (settings.get('customPresets') || []).find((p: any) => p.name === presetName);

  if (!preset) {
    logger.error('Preset not found');
    return;
  }

  console.clear();
  console.log(chalk.cyan.bold(`\n📦 ${preset.name}\n`));
  console.log(`Description: ${preset.description}`);
  console.log(`Default Row Count: ${preset.defaultRowCount}`);
  console.log(`Table Name: ${preset.schema.name}`);
  console.log(`\nColumns (${preset.schema.columns.length}):`);

  preset.schema.columns.forEach((col: any) => {
    console.log(`  ${chalk.green(col.name)}: ${col.type}`);
    if (col.constraints) {
      const constraints = [];
      if (col.constraints.primaryKey) constraints.push('PRIMARY KEY');
      if (col.constraints.unique) constraints.push('UNIQUE');
      if (col.constraints.notNull) constraints.push('NOT NULL');
      if (col.constraints.defaultValue !== undefined) constraints.push(`DEFAULT ${col.constraints.defaultValue}`);
      if (constraints.length > 0) {
        console.log(`    ${constraints.join(', ')}`);
      }
    }
  });

  await confirm({ message: 'Press Enter to continue...', initialValue: true });
}

async function deletePreset() {
  console.clear();
  console.log(chalk.cyan.bold('\n🗑️ Delete Custom Preset\n'));

  const customPresets = settings.get('customPresets') || [];

  if (customPresets.length === 0) {
    logger.info('No custom presets to delete');
    await confirm({ message: 'Press Enter to continue...', initialValue: true });
    return;
  }

  const presetName = await select({
    message: 'Select a preset to delete:',
    options: customPresets.map((preset: any) => ({
      value: preset.name,
      label: `${preset.name} - ${preset.description}`
    }))
  });

  if (typeof presetName !== 'string') return;

  const confirmDelete = await confirm({
    message: `Are you sure you want to delete "${presetName}"?`,
    initialValue: false
  });

  if (!confirmDelete) {
    logger.info('Cancelled');
    return;
  }

  const updatedPresets = customPresets.filter((preset: any) => preset.name !== presetName);
  settings.set('customPresets', updatedPresets);

  logger.success(`Preset "${presetName}" deleted`);
  await confirm({ message: 'Press Enter to continue...', initialValue: true });
}