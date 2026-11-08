import { Platform, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { NotificationReminderConfig } from '../models/NoctisModels';
import { InputSanitizer } from '../security/InputSanitizer';

export class ScheduledNotificationRecord {
  public id: string = '';
  public taskId: string = '';
  public title: string = '';
  public body: string = '';
  public triggerTimestamp: number = 0;
  public recurrence: NotificationReminderConfig['type'] = 'none';
  public osNotificationId: string = '';

  constructor(init?: Partial<ScheduledNotificationRecord>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class NotificationReminderService {
  public static readonly CHANNEL_ID: string = 'noctis_todo_reminders';
  public static readonly CHANNEL_NAME: string = 'To-Do Reminders';

  private static readonly WEEKDAY_NAMES: readonly string[] = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];

  private static isSubsystemInitialized: boolean = false;
  private static scheduledReminders: Map<string, ScheduledNotificationRecord> = new Map();
  private static onReminderTriggeredCallback: ((title: string, body: string) => void) | null = null;
  private static notificationReceivedListener: Notifications.Subscription | null = null;
  private static notificationResponseListener: Notifications.Subscription | null = null;

  public static getWeekdayName(dayIndex: number = 1): string {
    const safeIdx = Math.max(0, Math.min(6, Math.floor(dayIndex)));
    return this.WEEKDAY_NAMES[safeIdx] || 'Monday';
  }

  public static async initializeService(
    onReminderTriggered?: (title: string, body: string) => void,
    onNotificationTapped?: (taskId: string) => void
  ): Promise<void> {
    if (onReminderTriggered) {
      this.onReminderTriggeredCallback = onReminderTriggered;
    }

    if (this.isSubsystemInitialized) {
      return;
    }

    try {
      // 1. Configure foreground notification presentation handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      // 2. Configure Android Notification Channel (Required for Android 8.0+ / API 26+)
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(this.CHANNEL_ID, {
          name: this.CHANNEL_NAME,
          description: 'Timely reminders for prioritized to-do tasks in Noctis',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#D4AF37',
          enableVibrate: true,
          showBadge: true,
          sound: 'default',
        });
      }

      // 3. Listen for foreground notification delivery to trigger in-app banners/haptics
      if (!this.notificationReceivedListener) {
        this.notificationReceivedListener = Notifications.addNotificationReceivedListener(
          (notification) => {
            const { title, body, data } = notification.request.content;
            const safeTitle = InputSanitizer.sanitizeString(title || 'Task Reminder', 120);
            const safeBody = InputSanitizer.sanitizeString(body || '', 300);

            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } catch {
              // Haptic feedback fallback
            }

            if (this.onReminderTriggeredCallback) {
              this.onReminderTriggeredCallback(safeTitle, safeBody);
            }
          }
        );
      }

      // 4. Listen for user interactions (tapping notification banner/tray)
      if (!this.notificationResponseListener && onNotificationTapped) {
        this.notificationResponseListener = Notifications.addNotificationResponseReceivedListener(
          (response) => {
            const data = response.notification.request.content.data;
            const taskId = data && typeof data.taskId === 'string' ? data.taskId : '';
            if (taskId) {
              onNotificationTapped(taskId);
            }
          }
        );
      }

      this.isSubsystemInitialized = true;
    } catch {
      // Graceful fallback if native notification runtime fails to bind
      this.isSubsystemInitialized = false;
    }
  }

  public static setOnReminderTriggered(callback: (title: string, body: string) => void): void {
    this.onReminderTriggeredCallback = callback;
  }

  public static async requestNotificationPermissions(): Promise<boolean> {
    try {
      const existingPermissions = await Notifications.getPermissionsAsync();
      let finalStatus = existingPermissions.status;

      if (finalStatus !== 'granted') {
        const requested = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        finalStatus = requested.status;
      }

      return finalStatus === 'granted';
    } catch {
      return false;
    }
  }

  public static calculateNextTriggerTimestamp(config: NotificationReminderConfig): number | null {
    const now = new Date();

    if (config.type === 'custom') {
      if (!config.customDateTime) return null;
      const parsed = new Date(config.customDateTime).getTime();
      return isNaN(parsed) ? null : parsed;
    }

    const [hoursStr, minutesStr] = (config.time || '09:00').split(':');
    const targetHours = parseInt(hoursStr || '9', 10);
    const targetMinutes = parseInt(minutesStr || '0', 10);

    if (config.type === 'daily') {
      const nextDate = new Date();
      nextDate.setHours(targetHours, targetMinutes, 0, 0);
      if (nextDate.getTime() <= now.getTime()) {
        nextDate.setDate(nextDate.getDate() + 1);
      }
      return nextDate.getTime();
    }

    if (config.type === 'weekly') {
      const targetDayOfWeek = typeof config.dayOfWeek === 'number' ? config.dayOfWeek : 1;
      const nextDate = new Date();
      const currentDayOfWeek = nextDate.getDay();
      const daysUntilTarget = (targetDayOfWeek - currentDayOfWeek + 7) % 7;
      nextDate.setDate(nextDate.getDate() + daysUntilTarget);
      nextDate.setHours(targetHours, targetMinutes, 0, 0);
      if (nextDate.getTime() <= now.getTime()) {
        nextDate.setDate(nextDate.getDate() + 7);
      }
      return nextDate.getTime();
    }

    if (config.type === 'monthly') {
      const targetDay = config.dayOfMonth || 1;
      const nextDate = new Date();
      nextDate.setDate(targetDay);
      nextDate.setHours(targetHours, targetMinutes, 0, 0);
      if (nextDate.getTime() <= now.getTime()) {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }
      return nextDate.getTime();
    }

    if (config.type === 'annually') {
      const [monthStr, dayStr] = (config.monthAndDay || '01-01').split('-');
      const targetMonth = parseInt(monthStr || '1', 10) - 1;
      const targetDay = parseInt(dayStr || '1', 10);
      const nextDate = new Date();
      nextDate.setMonth(targetMonth);
      nextDate.setDate(targetDay);
      nextDate.setHours(targetHours, targetMinutes, 0, 0);
      if (nextDate.getTime() <= now.getTime()) {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      }
      return nextDate.getTime();
    }

    return null;
  }

  public static buildNotificationTrigger(
    config: NotificationReminderConfig
  ): Notifications.NotificationTriggerInput | null {
    const [hoursStr, minutesStr] = (config.time || '09:00').split(':');
    const targetHours = Math.max(0, Math.min(23, parseInt(hoursStr || '9', 10)));
    const targetMinutes = Math.max(0, Math.min(59, parseInt(minutesStr || '0', 10)));

    if (config.type === 'custom') {
      if (!config.customDateTime) return null;
      const parsedTime = new Date(config.customDateTime).getTime();
      if (isNaN(parsedTime) || parsedTime <= Date.now()) {
        return null; // Cannot schedule for the past
      }
      return {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(parsedTime),
        channelId: this.CHANNEL_ID,
      };
    }

    if (config.type === 'daily') {
      return {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: targetHours,
        minute: targetMinutes,
        channelId: this.CHANNEL_ID,
      };
    }

    if (config.type === 'weekly') {
      const targetDayOfWeek = typeof config.dayOfWeek === 'number' ? config.dayOfWeek : 1;
      // In expo-notifications, 1 = Sunday, 2 = Monday, ..., 7 = Saturday
      const expoWeekday = ((targetDayOfWeek % 7) + 1);
      return {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: expoWeekday,
        hour: targetHours,
        minute: targetMinutes,
        channelId: this.CHANNEL_ID,
      };
    }

    if (config.type === 'monthly') {
      const targetDay = Math.max(1, Math.min(31, config.dayOfMonth || 1));
      return {
        type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
        day: targetDay,
        hour: targetHours,
        minute: targetMinutes,
        channelId: this.CHANNEL_ID,
      };
    }

    if (config.type === 'annually') {
      const [monthStr, dayStr] = (config.monthAndDay || '01-01').split('-');
      const targetMonth = Math.max(0, Math.min(11, parseInt(monthStr || '1', 10) - 1));
      const targetDay = Math.max(1, Math.min(31, parseInt(dayStr || '1', 10)));
      return {
        type: Notifications.SchedulableTriggerInputTypes.YEARLY,
        month: targetMonth,
        day: targetDay,
        hour: targetHours,
        minute: targetMinutes,
        channelId: this.CHANNEL_ID,
      };
    }

    return null;
  }

  public static async scheduleReminder(
    taskId: string,
    title: string,
    config: NotificationReminderConfig
  ): Promise<string> {
    if (!config || config.type === 'none') {
      await this.cancelReminder(taskId, config?.notificationId);
      return '';
    }

    const sanitizedTitle = InputSanitizer.sanitizeString(title, 120) || 'Task Reminder';
    const cleanTaskId = InputSanitizer.sanitizeString(taskId, 100);

    // Cancel any previous notification for this task to avoid duplicates
    await this.cancelReminder(taskId, config.notificationId);

    const trigger = this.buildNotificationTrigger(config);
    if (!trigger) {
      return '';
    }

    try {
      const hasPermission = await this.requestNotificationPermissions();
      if (!hasPermission) {
        return '';
      }

      const osNotificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: sanitizedTitle,
          body: `Reminder: ${sanitizedTitle}`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          data: {
            taskId: cleanTaskId,
            type: 'todo_reminder',
          },
          ...(Platform.OS === 'android' ? { channelId: this.CHANNEL_ID } : {}),
        },
        trigger,
      });

      const nextTimestamp = this.calculateNextTriggerTimestamp(config) || Date.now();
      const record = new ScheduledNotificationRecord({
        id: `rem_${cleanTaskId}_${Date.now()}`,
        taskId: cleanTaskId,
        title: sanitizedTitle,
        body: `Reminder: ${sanitizedTitle}`,
        triggerTimestamp: nextTimestamp,
        recurrence: config.type,
        osNotificationId,
      });

      this.scheduledReminders.set(cleanTaskId, record);
      return osNotificationId;
    } catch {
      return '';
    }
  }

  public static async cancelReminder(taskId: string, notificationId?: string): Promise<void> {
    const cleanTaskId = InputSanitizer.sanitizeString(taskId, 100);
    const existing = this.scheduledReminders.get(cleanTaskId);
    const targetOsId = notificationId || existing?.osNotificationId;

    if (targetOsId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(targetOsId);
      } catch {
        // Ignored if notification was already fired or dismissed
      }
    }

    this.scheduledReminders.delete(cleanTaskId);
  }

  public static async cancelAllReminders(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch {
      // Ignored if platform does not support
    }
    this.scheduledReminders.clear();
  }

  public static async syncActiveTodoReminders(
    todos: Array<{ id: string; title: string; completed: boolean; reminder?: NotificationReminderConfig }>
  ): Promise<void> {
    for (const todo of todos) {
      if (!todo.completed && todo.reminder && todo.reminder.type !== 'none') {
        const newOsId = await this.scheduleReminder(todo.id, todo.title, todo.reminder);
        if (newOsId) {
          todo.reminder.notificationId = newOsId;
        }
      } else if (todo.completed) {
        await this.cancelReminder(todo.id, todo.reminder?.notificationId);
      }
    }
  }

  public static triggerNotificationAlert(title: string, body: string): void {
    const sanitizedTitle = InputSanitizer.sanitizeString(title, 120);
    const sanitizedBody = InputSanitizer.sanitizeString(body, 300);

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {
      // Haptics fallback
    }

    if (this.onReminderTriggeredCallback) {
      this.onReminderTriggeredCallback(sanitizedTitle, sanitizedBody);
    } else {
      Alert.alert(`🔔 ${sanitizedTitle}`, sanitizedBody, [{ text: 'Done', style: 'default' }]);
    }
  }

  public static formatReminderLabel(config: NotificationReminderConfig): string {
    if (!config || config.type === 'none') {
      return 'No reminder';
    }
    if (config.type === 'daily') {
      return `Daily at ${config.time || '09:00'}`;
    }
    if (config.type === 'weekly') {
      const dayLabel = this.getWeekdayName(config.dayOfWeek ?? 1);
      return `Every ${dayLabel} at ${config.time || '09:00'}`;
    }
    if (config.type === 'monthly') {
      return `Monthly on day ${config.dayOfMonth || 1} at ${config.time || '09:00'}`;
    }
    if (config.type === 'annually') {
      return `Annually on ${config.monthAndDay || '01-01'} at ${config.time || '09:00'}`;
    }
    if (config.type === 'custom') {
      return config.customDateTime ? `At ${config.customDateTime.replace('T', ' ')}` : 'Custom Date & Time';
    }
    return 'Reminder set';
  }
}
