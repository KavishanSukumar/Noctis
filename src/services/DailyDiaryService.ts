import { DiaryEntry, BlockItem, MoodHabitLog, BlockFormattingStyle } from '../models/NoctisModels';
import { InputSanitizer } from '../security/InputSanitizer';

export class DailyDiaryService {
  public static getTodayDateKey(date: Date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  public static isValidDateKey(dateKey: string): boolean {
    if (!dateKey || typeof dateKey !== 'string') return false;
    const sanitized = InputSanitizer.sanitizeString(dateKey).trim();
    const regex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
    if (!regex.test(sanitized)) return false;

    const [year, month, day] = sanitized.split('-').map((v) => parseInt(v, 10));
    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  public static formatDateKeyToReadable(dateKey: string): string {
    try {
      const [year, month, day] = dateKey.split('-').map((v) => parseInt(v, 10));
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateKey;
    }
  }

  public static getAdjacentDateKey(dateKey: string, offsetDays: number): string {
    try {
      const [year, month, day] = dateKey.split('-').map((v) => parseInt(v, 10));
      const date = new Date(year, month - 1, day);
      date.setDate(date.getDate() + offsetDays);
      return this.getTodayDateKey(date);
    } catch {
      return this.getTodayDateKey();
    }
  }

  public static getUnifiedJournalBlocks(entry: DiaryEntry): BlockItem[] {
    if (!entry) return [];

    const hasLegacyMorning = Array.isArray(entry.morningIntentions) && entry.morningIntentions.length > 0;
    const hasLegacyEvening = Array.isArray(entry.eveningReflection) && entry.eveningReflection.length > 0;
    const currentDailyLog = Array.isArray(entry.dailyLog) ? entry.dailyLog : [];

    // If legacy partitioned blocks exist, merge them into a single unified array
    if (hasLegacyMorning || hasLegacyEvening) {
      const unified = [
        ...(entry.morningIntentions || []),
        ...currentDailyLog,
        ...(entry.eveningReflection || []),
      ];
      return unified.length > 0 ? unified : this.createStarterBlocks(entry.title || entry.dateKey, entry.dateKey);
    }

    if (currentDailyLog.length > 0) {
      return currentDailyLog;
    }

    return this.createStarterBlocks(entry.title || entry.dateKey, entry.dateKey);
  }

  public static createStarterBlocks(titleOrDate: string, seedId?: string): BlockItem[] {
    const formatted = this.isValidDateKey(titleOrDate)
      ? this.formatDateKeyToReadable(titleOrDate)
      : titleOrDate;

    // Deterministic IDs keep React keys stable across re-renders until the first save,
    // preventing TextInputs from remounting (and losing focus) on unsaved days.
    const rawSeed = seedId || (this.isValidDateKey(titleOrDate) ? titleOrDate : `${Date.now()}`);
    const seed = rawSeed.replace(/[^A-Za-z0-9_-]/g, '');

    return [
      new BlockItem({
        id: `blk_${seed}_starter_h`,
        type: 'heading2',
        content: `📖 ${formatted}`,
        style: new BlockFormattingStyle({ bold: true, textColor: '#E2A154' }),
      }),
      new BlockItem({
        id: `blk_${seed}_starter_t`,
        type: 'text',
        content: '',
      }),
    ];
  }

  public static createDefaultDailyTemplate(dateKey: string): DiaryEntry {
    const formattedDate = this.formatDateKeyToReadable(dateKey);
    const dailyLog: BlockItem[] = this.createStarterBlocks(dateKey, dateKey);

    return new DiaryEntry({
      id: `diary_${dateKey}`,
      dateKey,
      title: formattedDate,
      morningIntentions: [],
      dailyLog,
      eveningReflection: [],
      moodHabit: new MoodHabitLog({
        moodRating: 5,
        energyLevel: 5,
        gratitudePrompt: 'Grateful for quiet morning clarity.',
        habits: {
          'Mindful Breathing': true,
          'Hydration': true,
          'Reading': false,
        },
      }),
      linkedNoteIds: [],
      tags: ['daily-journal'],
      isEncrypted: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  public static getOrCreateDiaryForDate(
    entries: DiaryEntry[],
    dateKey: string
  ): { entry: DiaryEntry; isNew: boolean; updatedEntries: DiaryEntry[] } {
    const existing = entries.find((e) => e.dateKey === dateKey);
    if (existing) {
      return { entry: existing, isNew: false, updatedEntries: entries };
    }

    const newEntry = this.createDefaultDailyTemplate(dateKey);
    const updatedEntries = [newEntry, ...entries].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    return { entry: newEntry, isNew: true, updatedEntries };
  }

  public static calculateStreak(entries: DiaryEntry[]): number {
    if (!entries || entries.length === 0) {
      return 0;
    }

    const dateSet = new Set(entries.map((e) => e.dateKey));
    let streak = 0;
    const current = new Date();

    while (true) {
      const key = this.getTodayDateKey(current);
      if (dateSet.has(key)) {
        streak++;
        current.setDate(current.getDate() - 1);
      } else {
        if (streak === 0) {
          current.setDate(current.getDate() - 1);
          const yesterdayKey = this.getTodayDateKey(current);
          if (dateSet.has(yesterdayKey)) {
            streak++;
            current.setDate(current.getDate() - 1);
            continue;
          }
        }
        break;
      }
    }
    return streak;
  }
}
