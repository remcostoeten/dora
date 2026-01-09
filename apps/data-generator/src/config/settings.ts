import * as os from 'os';
import * as fsModule from 'fs';
import * as path from 'path';

interface Settings {
  defaultLocale: string;
  defaultRowCount: number;
  defaultExportFormat: 'json' | 'csv' | 'sql' | 'typescript' | 'prisma';
  defaultDatabase: 'sqlite' | 'postgresql' | 'mysql';
  defaultBatchSize: number;
  nullProbability: number;
  connections: Record<string, any>;
  customPresets: any[];
}

const defaultSettings: Settings = {
  defaultLocale: 'en',
  defaultRowCount: 100,
  defaultExportFormat: 'json',
  defaultDatabase: 'sqlite',
  defaultBatchSize: 1000,
  nullProbability: 0.05,
  connections: {},
  customPresets: []
};

class SettingsManager {
  private configPath: string;
  private settings: Settings;

  constructor() {
    const homeDir = os.homedir();
    this.configPath = path.join(homeDir, '.data-generator', 'config.json');
    this.settings = this.loadSettings();
  }

  private loadSettings(): Settings {
    try {
      if (fsModule.existsSync(this.configPath)) {
        const data = fsModule.readFileSync(this.configPath, 'utf-8');
        const loadedSettings = JSON.parse(data);
        return { ...defaultSettings, ...loadedSettings };
      }
    } catch (error) {
      console.warn('Failed to load settings, using defaults');
    }
    return { ...defaultSettings };
  }

  saveSettings(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fsModule.existsSync(dir)) {
        fsModule.mkdirSync(dir, { recursive: true });
      }
      fsModule.writeFileSync(this.configPath, JSON.stringify(this.settings, null, 2));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  get<T extends keyof Settings>(key: T): Settings[T] {
    return this.settings[key];
  }

  set<T extends keyof Settings>(key: T, value: Settings[T]): void {
    this.settings[key] = value;
    this.saveSettings();
  }

  getAll(): Settings {
    return { ...this.settings };
  }

  reset(): void {
    this.settings = { ...defaultSettings };
    this.saveSettings();
  }
}

export default new SettingsManager();