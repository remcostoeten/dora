import settings from '../../config/settings';
import logger from '../../utils/logger';
import chalk from 'chalk';

interface ConfigOptions {
  get?: string;
  set?: string;
  reset?: boolean;
  show?: boolean;
}

export async function handleConfigCommand(options: ConfigOptions) {
  try {
    const { get, set, reset, show } = options;

    if (get) {
      const value = settings.get(get as any);
      console.log(JSON.stringify(value, null, 2));
      return;
    }

    if (set) {
      const [key, value] = set.split('=');
      if (!key || value === undefined) {
        logger.error('Invalid format. Use: --set key=value');
        process.exit(1);
      }

      try {
        const parsedValue = JSON.parse(value);
        settings.set(key as any, parsedValue);
        logger.success(`Set ${key} to ${parsedValue}`);
      } catch {
        settings.set(key as any, value);
        logger.success(`Set ${key} to ${value}`);
      }
      return;
    }

    if (reset) {
      settings.reset();
      logger.success('Settings reset to defaults');
      return;
    }

    if (show) {
      const allSettings = settings.getAll();
      console.log(JSON.stringify(allSettings, null, 2));
      return;
    }

    logger.info('Use --get, --set, --reset, or --show options');

  } catch (error: any) {
    logger.error(`Failed to manage config: ${error.message}`);
    process.exit(1);
  }
}