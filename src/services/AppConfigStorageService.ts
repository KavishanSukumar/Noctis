import * as FileSystem from 'expo-file-system/legacy';
import { UserSettingsConfig } from '../models/NoctisModels';
import { InputSanitizer } from '../security/InputSanitizer';

export class AppConfigStorageService {
  private static readonly CONFIG_DIR: string = `${FileSystem.documentDirectory}noctis_config/`;
  private static readonly CONFIG_FILE_PATH: string = `${AppConfigStorageService.CONFIG_DIR}user_config.json`;

  public static readonly ALLOWED_TAB_IDS: readonly string[] = [
    'diary',
    'brain',
    'todos',
    'notes',
    'graph',
  ];

  public static async ensureConfigDirectory(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(this.CONFIG_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.CONFIG_DIR, { intermediates: true });
    }
  }

  public static sanitizeHiddenTabs(rawHiddenTabs: unknown): string[] {
    if (!Array.isArray(rawHiddenTabs)) {
      return [];
    }
    const sanitized: string[] = [];
    for (const item of rawHiddenTabs) {
      if (typeof item === 'string' && this.ALLOWED_TAB_IDS.includes(item)) {
        if (!sanitized.includes(item)) {
          sanitized.push(item);
        }
      }
    }

    // Safety constraint: Never allow all tabs to be hidden (at least one tab must remain visible)
    if (sanitized.length >= this.ALLOWED_TAB_IDS.length) {
      // Keep 'diary' visible by default
      return sanitized.filter((id) => id !== 'diary');
    }

    return sanitized;
  }

  public static async loadConfigFile(): Promise<UserSettingsConfig | null> {
    try {
      await this.ensureConfigDirectory();
      const fileInfo = await FileSystem.getInfoAsync(this.CONFIG_FILE_PATH);
      if (!fileInfo.exists) {
        return null;
      }

      const rawJson = await FileSystem.readAsStringAsync(this.CONFIG_FILE_PATH, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const parsed = InputSanitizer.sanitizeSafeJsonParse<Partial<UserSettingsConfig>>(rawJson);
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      const config = new UserSettingsConfig(parsed);
      config.hiddenTabs = this.sanitizeHiddenTabs(parsed.hiddenTabs);
      return config;
    } catch {
      // Fail-safe default
      return null;
    }
  }

  public static async saveConfigFile(settings: UserSettingsConfig): Promise<void> {
    try {
      await this.ensureConfigDirectory();
      const tempPath = `${this.CONFIG_FILE_PATH}.tmp`;

      const safeSettings = new UserSettingsConfig({
        ...settings,
        hiddenTabs: this.sanitizeHiddenTabs(settings.hiddenTabs),
      });

      const jsonPayload = JSON.stringify(safeSettings, null, 2);

      // Atomic write pattern: write to .tmp then move to eliminate race conditions
      await FileSystem.writeAsStringAsync(tempPath, jsonPayload, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await FileSystem.moveAsync({
        from: tempPath,
        to: this.CONFIG_FILE_PATH,
      });
    } catch (err: unknown) {
      console.warn('AppConfigStorageService save failed:', err);
    }
  }
}
