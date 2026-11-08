import { NotificationReminderConfig, ParsedVoiceTodoCommand } from '../models/NoctisModels';
import { InputSanitizer } from '../security/InputSanitizer';
import { NotificationReminderService } from './NotificationReminderService';

export class VoiceCommandNLPService {
  private static readonly WEEKDAY_LOOKUP: { readonly [key: string]: number } = {
    sunday: 0,
    sun: 0,
    sundays: 0,
    monday: 1,
    mon: 1,
    mondays: 1,
    tuesday: 2,
    tue: 2,
    tues: 2,
    tuesdays: 2,
    wednesday: 3,
    wed: 3,
    wednesdays: 3,
    thursday: 4,
    thu: 4,
    thur: 4,
    thurs: 4,
    thursdays: 4,
    friday: 5,
    fri: 5,
    fridays: 5,
    saturday: 6,
    sat: 6,
    saturdays: 6,
  };

  private static readonly MONTH_LOOKUP: { readonly [key: string]: string } = {
    january: '01',
    jan: '01',
    february: '02',
    feb: '02',
    march: '03',
    mar: '03',
    april: '04',
    apr: '04',
    may: '05',
    june: '06',
    jun: '06',
    july: '07',
    jul: '07',
    august: '08',
    aug: '08',
    september: '09',
    sep: '09',
    sept: '09',
    october: '10',
    oct: '10',
    november: '11',
    nov: '11',
    december: '12',
    dec: '12',
  };

  public static parseVoiceCommand(rawSpeech: string, baseDate: Date = new Date()): ParsedVoiceTodoCommand {
    const sanitizedSpeech = InputSanitizer.sanitizeVoiceTranscript(rawSpeech);
    if (!sanitizedSpeech) {
      return new ParsedVoiceTodoCommand({
        rawTranscript: '',
        extractedTitle: '',
        extractedDetails: '',
        dueDate: '',
        reminderConfig: new NotificationReminderConfig({ type: 'none' }),
        confidenceScore: 0,
        humanSummary: 'Speak a command such as "Add a todo to send money to mom on every Monday"',
      });
    }

    let workingText = sanitizedSpeech;

    // 1. Strip conversational voice command prefixes
    workingText = this.stripIntentPrefix(workingText);

    // 2. Extract spoken time of day (e.g., "at 6pm", "at 9:30 am", "in the morning")
    const timeExtraction = this.extractTimeOfDay(workingText);
    const reminderTime = timeExtraction ? timeExtraction.time24 : '09:00';
    if (timeExtraction && timeExtraction.matchedFragment) {
      workingText = this.removeFragmentCaseInsensitive(workingText, timeExtraction.matchedFragment);
    }

    // 3. Extract recurrence or due date (Weekly, Daily, Monthly, Annually, or One-time Custom)
    const scheduleExtraction = this.extractSchedulePattern(workingText, reminderTime, baseDate);
    if (scheduleExtraction.matchedFragment) {
      workingText = this.removeFragmentCaseInsensitive(workingText, scheduleExtraction.matchedFragment);
    }

    // 4. Clean up residual prepositions & capitalize task title
    const finalTitle = this.finalizeTaskTitle(workingText, sanitizedSpeech);

    // 5. If user spoke a time ("at 5pm") without a date/recurrence, schedule it as a one-time custom reminder today/tomorrow
    let finalReminder = scheduleExtraction.reminderConfig;
    let finalDueDate = scheduleExtraction.dueDate;

    if (finalReminder.type === 'none' && timeExtraction) {
      const targetDate = new Date(baseDate.getTime());
      const [hStr, mStr] = reminderTime.split(':');
      targetDate.setHours(parseInt(hStr || '9', 10), parseInt(mStr || '0', 10), 0, 0);
      if (targetDate.getTime() <= baseDate.getTime()) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
      const dateStr = this.formatDateKey(targetDate);
      finalDueDate = dateStr;
      finalReminder = new NotificationReminderConfig({
        type: 'custom',
        time: reminderTime,
        customDateTime: `${dateStr}T${reminderTime}`,
      });
    }

    const reminderLabel = NotificationReminderService.formatReminderLabel(finalReminder);
    const humanSummary =
      finalReminder.type !== 'none'
        ? `Task: "${finalTitle}" • ${reminderLabel}`
        : `Task: "${finalTitle}" (No reminder time detected)`;

    return new ParsedVoiceTodoCommand({
      rawTranscript: sanitizedSpeech,
      extractedTitle: finalTitle,
      extractedDetails: `Created via On-Device Voice Command`,
      dueDate: finalDueDate,
      reminderConfig: finalReminder,
      confidenceScore: finalReminder.type !== 'none' ? 0.98 : 0.82,
      humanSummary,
    });
  }

  private static stripIntentPrefix(input: string): string {
    const prefixPatterns: readonly RegExp[] = [
      /^(?:hey\s+noctis\s*,?\s*)?(?:please\s+)?(?:can\s+you\s+)?(?:add|create|make|set|schedule|new)\s+(?:a\s+|an\s+)?(?:new\s+)?(?:to\s*-?\s*do\s+list\s+item|to\s*-?\s*do\s+list|to\s*-?\s*do|task|reminder)\s+(?:to\s+|for\s+|that\s+)?/i,
      /^(?:hey\s+noctis\s*,?\s*)?(?:please\s+)?remind\s+me\s+(?:to\s+|about\s+)?/i,
      /^(?:hey\s+noctis\s*,?\s*)?(?:please\s+)?(?:add|put)\s+to\s+(?:my\s+)?(?:to\s*-?\s*do\s+list|to\s*-?\s*dos|tasks)\s+(?:to\s+)?/i,
      /^(?:to\s*-?\s*do|task|reminder)\s*:\s*/i,
    ];

    let result = input.trim();
    for (const regex of prefixPatterns) {
      if (regex.test(result)) {
        result = result.replace(regex, '').trim();
        break;
      }
    }
    return result;
  }

  private static extractTimeOfDay(
    text: string
  ): { time24: string; matchedFragment: string } | null {
    // Pattern A: "at 5:30 pm", "at 9 am", "by 18:00", "at 6 p.m."
    const explicitTimeRegex = /\b(?:at|by|around)\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\b/i;
    const explicitMatch = text.match(explicitTimeRegex);
    if (explicitMatch) {
      let hours = parseInt(explicitMatch[1] || '9', 10);
      const minutes = parseInt(explicitMatch[2] || '0', 10);
      const meridiem = (explicitMatch[3] || '').toLowerCase().replace(/\./g, '');

      if (meridiem === 'pm' && hours < 12) {
        hours += 12;
      } else if (meridiem === 'am' && hours === 12) {
        hours = 0;
      }

      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        const hh = String(hours).padStart(2, '0');
        const mm = String(minutes).padStart(2, '0');
        return {
          time24: `${hh}:${mm}`,
          matchedFragment: explicitMatch[0],
        };
      }
    }

    // Pattern B: Standalone "5pm" or "9:30am" with explicit am/pm
    const standaloneMeridiemRegex = /\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i;
    const standaloneMatch = text.match(standaloneMeridiemRegex);
    if (standaloneMatch) {
      let hours = parseInt(standaloneMatch[1] || '9', 10);
      const minutes = parseInt(standaloneMatch[2] || '0', 10);
      const meridiem = (standaloneMatch[3] || '').toLowerCase().replace(/\./g, '');

      if (meridiem === 'pm' && hours < 12) {
        hours += 12;
      } else if (meridiem === 'am' && hours === 12) {
        hours = 0;
      }

      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        const hh = String(hours).padStart(2, '0');
        const mm = String(minutes).padStart(2, '0');
        return {
          time24: `${hh}:${mm}`,
          matchedFragment: standaloneMatch[0],
        };
      }
    }

    // Pattern C: Natural time-of-day phrases ("in the morning", "in the evening", "at night", "at noon")
    const naturalTimeRegex = /\b(?:in\s+the\s+morning|every\s+morning|morning)\b/i;
    if (naturalTimeRegex.test(text) && /\bin\s+the\s+morning\b/i.test(text)) {
      const m = text.match(/\bin\s+the\s+morning\b/i);
      if (m) return { time24: '09:00', matchedFragment: m[0] };
    }

    const afternoonRegex = /\b(?:in\s+the\s+afternoon|at\s+noon)\b/i;
    const afternoonMatch = text.match(afternoonRegex);
    if (afternoonMatch) {
      const isNoon = /noon/i.test(afternoonMatch[0]);
      return { time24: isNoon ? '12:00' : '14:00', matchedFragment: afternoonMatch[0] };
    }

    const eveningRegex = /\b(?:in\s+the\s+evening|at\s+night|tonight)\b/i;
    const eveningMatch = text.match(eveningRegex);
    if (eveningMatch) {
      const isNight = /night|tonight/i.test(eveningMatch[0]);
      return { time24: isNight ? '20:00' : '18:00', matchedFragment: eveningMatch[0] };
    }

    return null;
  }

  private static extractSchedulePattern(
    text: string,
    reminderTime: string,
    baseDate: Date
  ): {
    reminderConfig: NotificationReminderConfig;
    dueDate: string;
    matchedFragment: string;
  } {
    // 1. WEEKLY RECURRENCE: e.g., "on every monday", "every monday", "every week on friday", "on mondays"
    const weeklyRegex =
      /\b(?:on\s+)?(?:every\s+(?:week\s+on\s+)?|each\s+)(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b|\b(?:on\s+)(sundays|mondays|tuesdays|wednesdays|thursdays|fridays|saturdays)\b/i;
    const weeklyMatch = text.match(weeklyRegex);
    if (weeklyMatch) {
      const dayToken = (weeklyMatch[1] || weeklyMatch[2] || 'monday').toLowerCase();
      const dayOfWeek = this.WEEKDAY_LOOKUP[dayToken] ?? 1;
      const nextOccurrence = this.getNextWeekdayDate(baseDate, dayOfWeek, reminderTime);
      return {
        reminderConfig: new NotificationReminderConfig({
          type: 'weekly',
          dayOfWeek,
          time: reminderTime,
        }),
        dueDate: this.formatDateKey(nextOccurrence),
        matchedFragment: weeklyMatch[0],
      };
    }

    // 2. DAILY RECURRENCE: e.g., "on every day", "every day", "daily", "each day", "every morning", "every evening", "every night"
    const dailyRegex =
      /\b(?:on\s+)?(?:every\s+single\s+day|every\s+day|everyday|each\s+day|daily|every\s+morning|every\s+evening|every\s+night)\b/i;
    const dailyMatch = text.match(dailyRegex);
    if (dailyMatch) {
      let resolvedTime = reminderTime;
      if (/morning/i.test(dailyMatch[0]) && reminderTime === '09:00') {
        resolvedTime = '08:30';
      } else if (/evening/i.test(dailyMatch[0]) && reminderTime === '09:00') {
        resolvedTime = '18:00';
      } else if (/night/i.test(dailyMatch[0]) && reminderTime === '09:00') {
        resolvedTime = '20:30';
      }

      return {
        reminderConfig: new NotificationReminderConfig({
          type: 'daily',
          time: resolvedTime,
        }),
        dueDate: this.formatDateKey(baseDate),
        matchedFragment: dailyMatch[0],
      };
    }

    // 3. MONTHLY RECURRENCE: e.g., "every month on the 5th", "monthly on day 15", "on the 1st of every month", "every month"
    const monthlyDayRegex =
      /\b(?:(?:on\s+)?every\s+month\s+(?:on\s+)?(?:the\s+|day\s+)?(\d{1,2})(?:st|nd|rd|th)?|monthly\s+(?:on\s+)?(?:the\s+|day\s+)?(\d{1,2})(?:st|nd|rd|th)?|(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)?\s+of\s+(?:every|each)\s+month)\b/i;
    const monthlyDayMatch = text.match(monthlyDayRegex);
    if (monthlyDayMatch) {
      const rawDay = parseInt(
        monthlyDayMatch[1] || monthlyDayMatch[2] || monthlyDayMatch[3] || '1',
        10
      );
      const dayOfMonth = Math.max(1, Math.min(31, rawDay));
      const nextMonthDate = this.getNextMonthlyDate(baseDate, dayOfMonth);
      return {
        reminderConfig: new NotificationReminderConfig({
          type: 'monthly',
          dayOfMonth,
          time: reminderTime,
        }),
        dueDate: this.formatDateKey(nextMonthDate),
        matchedFragment: monthlyDayMatch[0],
      };
    }

    const genericMonthlyRegex = /\b(?:on\s+)?(?:every\s+month|each\s+month|monthly)\b/i;
    const genericMonthlyMatch = text.match(genericMonthlyRegex);
    if (genericMonthlyMatch) {
      const dayOfMonth = baseDate.getDate();
      return {
        reminderConfig: new NotificationReminderConfig({
          type: 'monthly',
          dayOfMonth,
          time: reminderTime,
        }),
        dueDate: this.formatDateKey(baseDate),
        matchedFragment: genericMonthlyMatch[0],
      };
    }

    // 4. ANNUAL RECURRENCE: e.g., "every year on October 25", "annually on 10-25"
    const annualNamedMonthRegex =
      /\b(?:every\s+year|each\s+year|annually|yearly)\s+(?:on\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i;
    const annualNamedMatch = text.match(annualNamedMonthRegex);
    if (annualNamedMatch) {
      const monthCode = this.MONTH_LOOKUP[(annualNamedMatch[1] || 'jan').toLowerCase()] || '01';
      const dayNum = Math.max(1, Math.min(31, parseInt(annualNamedMatch[2] || '1', 10)));
      const dd = String(dayNum).padStart(2, '0');
      const monthAndDay = `${monthCode}-${dd}`;
      return {
        reminderConfig: new NotificationReminderConfig({
          type: 'annually',
          monthAndDay,
          time: reminderTime,
        }),
        dueDate: `${baseDate.getFullYear()}-${monthAndDay}`,
        matchedFragment: annualNamedMatch[0],
      };
    }

    // 5. ONE-TIME RELATIVE DATES: "tomorrow", "today", "next monday", or "on monday"
    const tomorrowRegex = /\b(?:on\s+|for\s+)?tomorrow\b/i;
    const tomorrowMatch = text.match(tomorrowRegex);
    if (tomorrowMatch) {
      const tmrw = new Date(baseDate.getTime());
      tmrw.setDate(tmrw.getDate() + 1);
      const dateStr = this.formatDateKey(tmrw);
      return {
        reminderConfig: new NotificationReminderConfig({
          type: 'custom',
          time: reminderTime,
          customDateTime: `${dateStr}T${reminderTime}`,
        }),
        dueDate: dateStr,
        matchedFragment: tomorrowMatch[0],
      };
    }

    const todayRegex = /\b(?:on\s+|for\s+)?today\b/i;
    const todayMatch = text.match(todayRegex);
    if (todayMatch) {
      const dateStr = this.formatDateKey(baseDate);
      return {
        reminderConfig: new NotificationReminderConfig({
          type: 'custom',
          time: reminderTime,
          customDateTime: `${dateStr}T${reminderTime}`,
        }),
        dueDate: dateStr,
        matchedFragment: todayMatch[0],
      };
    }

    const singleWeekdayRegex =
      /\b(?:on\s+|next\s+|this\s+)(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/i;
    const singleWeekdayMatch = text.match(singleWeekdayRegex);
    if (singleWeekdayMatch) {
      const dayToken = (singleWeekdayMatch[1] || 'monday').toLowerCase();
      const dayOfWeek = this.WEEKDAY_LOOKUP[dayToken] ?? 1;
      const targetDate = this.getNextWeekdayDate(baseDate, dayOfWeek, reminderTime);
      const dateStr = this.formatDateKey(targetDate);
      return {
        reminderConfig: new NotificationReminderConfig({
          type: 'custom',
          time: reminderTime,
          customDateTime: `${dateStr}T${reminderTime}`,
        }),
        dueDate: dateStr,
        matchedFragment: singleWeekdayMatch[0],
      };
    }

    return {
      reminderConfig: new NotificationReminderConfig({ type: 'none' }),
      dueDate: '',
      matchedFragment: '',
    };
  }

  private static removeFragmentCaseInsensitive(source: string, fragment: string): string {
    if (!fragment) return source;
    const idx = source.toLowerCase().indexOf(fragment.toLowerCase());
    if (idx === -1) return source;
    const before = source.slice(0, idx);
    const after = source.slice(idx + fragment.length);
    return `${before} ${after}`.replace(/\s+/g, ' ').trim();
  }

  private static finalizeTaskTitle(cleanedText: string, fallbackRaw: string): string {
    let candidate = cleanedText
      .replace(/\b(?:on|at|by|for|in|the|every)\s*$/i, '')
      .replace(/^[,\-:\s]+|[,\-:\s.]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!candidate) {
      candidate = fallbackRaw.trim();
    }

    return candidate.charAt(0).toUpperCase() + candidate.slice(1);
  }

  private static getNextWeekdayDate(baseDate: Date, targetDayOfWeek: number, time24: string): Date {
    const result = new Date(baseDate.getTime());
    const [hStr, mStr] = (time24 || '09:00').split(':');
    const targetHours = parseInt(hStr || '9', 10);
    const targetMinutes = parseInt(mStr || '0', 10);

    const currentDay = result.getDay();
    let daysAhead = (targetDayOfWeek - currentDay + 7) % 7;
    result.setDate(result.getDate() + daysAhead);
    result.setHours(targetHours, targetMinutes, 0, 0);

    if (result.getTime() <= baseDate.getTime()) {
      result.setDate(result.getDate() + 7);
    }
    return result;
  }

  private static getNextMonthlyDate(baseDate: Date, dayOfMonth: number): Date {
    const result = new Date(baseDate.getTime());
    result.setDate(dayOfMonth);
    if (result.getTime() < baseDate.getTime()) {
      result.setMonth(result.getMonth() + 1);
    }
    return result;
  }

  private static formatDateKey(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
