export class GoogleSSOUserProfile {
  public sub: string = '';
  public email: string = '';
  public name: string = '';
  public picture: string = '';
  public emailVerified: boolean = false;

  constructor(init?: Partial<GoogleSSOUserProfile>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class OIDCTokenClaims {
  public iss: string = '';
  public aud: string = '';
  public sub: string = '';
  public exp: number = 0;
  public iat: number = 0;
  public nonce?: string;
  public email?: string;

  constructor(init?: Partial<OIDCTokenClaims>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class BlockFormattingStyle {
  public bold?: boolean = false;
  public italic?: boolean = false;
  public underline?: boolean = false;
  public strikethrough?: boolean = false;
  public textColor?: string;
  public backgroundColor?: string;

  constructor(init?: Partial<BlockFormattingStyle>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class BlockItem {
  public id: string = '';
  public type:
    | 'heading1'
    | 'heading2'
    | 'text'
    | 'todo'
    | 'quote'
    | 'callout'
    | 'code'
    | 'divider'
    | 'bullet'
    | 'numbered' = 'text';
  public content: string = '';
  public checked?: boolean = false;
  public indentLevel?: number = 0;
  public listNumber?: number;
  public style?: BlockFormattingStyle = new BlockFormattingStyle();
  public createdAt: number = Date.now();
  public updatedAt: number = Date.now();

  constructor(init?: Partial<BlockItem>) {
    if (init) {
      Object.assign(this, init);
      if (init.style) {
        this.style = new BlockFormattingStyle(init.style);
      }
    }
  }
}

export class InlineTaskItem {
  public id: string = '';
  public sourceId: string = '';
  public sourceType: 'diary' | 'note' | 'general' = 'note';
  public sourceTitle: string = '';
  public text: string = '';
  public completed: boolean = false;
  public dueDate?: string;
  public createdAt: number = Date.now();
  public completedAt?: number;

  constructor(init?: Partial<InlineTaskItem>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class MoodHabitLog {
  public moodRating: number = 5;
  public energyLevel: number = 5;
  public gratitudePrompt: string = '';
  public habits: { [habitName: string]: boolean } = {};
  public loggedAt: number = Date.now();

  constructor(init?: Partial<MoodHabitLog>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class DiaryEntry {
  public id: string = '';
  public dateKey: string = '';
  public title: string = '';
  public morningIntentions: BlockItem[] = [];
  public dailyLog: BlockItem[] = [];
  public eveningReflection: BlockItem[] = [];
  public moodHabit: MoodHabitLog = new MoodHabitLog();
  public linkedNoteIds: string[] = [];
  public tags: string[] = [];
  public isEncrypted: boolean = true;
  public createdAt: number = Date.now();
  public updatedAt: number = Date.now();

  constructor(init?: Partial<DiaryEntry>) {
    if (init) {
      Object.assign(this, init);
      if (init.morningIntentions) {
        this.morningIntentions = init.morningIntentions.map((b) => new BlockItem(b));
      }
      if (init.dailyLog) {
        this.dailyLog = init.dailyLog.map((b) => new BlockItem(b));
      }
      if (init.eveningReflection) {
        this.eveningReflection = init.eveningReflection.map((b) => new BlockItem(b));
      }
      if (init.moodHabit) {
        this.moodHabit = new MoodHabitLog(init.moodHabit);
      }
    }
  }
}

export class SecondBrainNote {
  public id: string = '';
  public title: string = '';
  public paraCategory: 'inbox' | 'projects' | 'areas' | 'resources' | 'archives' = 'inbox';
  public blocks: BlockItem[] = [];
  public wikiLinks: string[] = [];
  public backlinks: string[] = [];
  public tags: string[] = [];
  public isPinned: boolean = false;
  public isArchived: boolean = false;
  public isEncrypted: boolean = true;
  public createdAt: number = Date.now();
  public updatedAt: number = Date.now();

  constructor(init?: Partial<SecondBrainNote>) {
    if (init) {
      Object.assign(this, init);
      if (init.blocks) {
        this.blocks = init.blocks.map((b) => new BlockItem(b));
      }
    }
  }
}

// --------------------- NEW SECOND BRAIN MODULES ---------------------

export class BookQuoteBlock {
  public id: string = '';
  public type: 'quote' | 'note' | 'summary' = 'note';
  public content: string = '';
  public chapterOrPage?: string = '';
  public style?: BlockFormattingStyle = new BlockFormattingStyle();
  public createdAt: number = Date.now();
  public updatedAt: number = Date.now();

  constructor(init?: Partial<BookQuoteBlock>) {
    if (init) {
      Object.assign(this, init);
      if (init.style) {
        this.style = new BlockFormattingStyle(init.style);
      }
    }
  }
}

export class BookItem {
  public id: string = '';
  public title: string = '';
  public author: string = '';
  public startDate: string = ''; // YYYY-MM-DD
  public finishDate?: string = ''; // YYYY-MM-DD
  public isCurrentlyReading: boolean = true;
  public blocks: BookQuoteBlock[] = [];
  public tags: string[] = [];
  public createdAt: number = Date.now();
  public updatedAt: number = Date.now();

  constructor(init?: Partial<BookItem>) {
    if (init) {
      Object.assign(this, init);
      if (init.blocks) {
        this.blocks = init.blocks.map((b) => new BookQuoteBlock(b));
      }
    }
  }
}

export class KnowledgeItem {
  public id: string = '';
  public topic: string = '';
  public description: string = '';
  public blocks: BlockItem[] = [];
  public tags: string[] = [];
  public createdAt: number = Date.now();
  public updatedAt: number = Date.now();

  constructor(init?: Partial<KnowledgeItem>) {
    if (init) {
      Object.assign(this, init);
      if (init.blocks) {
        this.blocks = init.blocks.map((b) => new BlockItem(b));
      }
    }
  }
}

export class ReferenceLinkItem {
  public id: string = '';
  public title: string = '';
  public description: string = '';
  public url: string = '';
  public tags: string[] = [];
  public createdAt: number = Date.now();
  public updatedAt: number = Date.now();

  constructor(init?: Partial<ReferenceLinkItem>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class DailyRecurringTask {
  public id: string = '';
  public title: string = '';
  public note?: string = '';
  public daysOfWeek: number[] = [1, 2, 3, 4, 5]; // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  public isActive: boolean = true;
  public createdAt: number = Date.now();

  constructor(init?: Partial<DailyRecurringTask>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class BrainstormCard {
  public id: string = '';
  public title: string = '';
  public content: string = '';
  public colorTag?: string = '';
  public blocks: BlockItem[] = [];
  public createdAt: number = Date.now();
  public updatedAt: number = Date.now();

  constructor(init?: Partial<BrainstormCard>) {
    if (init) {
      Object.assign(this, init);
      if (init.blocks) {
        this.blocks = init.blocks.map((b) => new BlockItem(b));
      }
    }
  }
}

export class ProjectItem {
  public id: string = '';
  public name: string = '';
  public description: string = '';
  public status: 'active' | 'completed' | 'on_hold' = 'active';
  public cards: BrainstormCard[] = [];
  public createdAt: number = Date.now();
  public updatedAt: number = Date.now();

  constructor(init?: Partial<ProjectItem>) {
    if (init) {
      Object.assign(this, init);
      if (init.cards) {
        this.cards = init.cards.map((c) => new BrainstormCard(c));
      }
    }
  }
}

export class NotificationReminderConfig {
  public type: 'none' | 'daily' | 'weekly' | 'monthly' | 'annually' | 'custom' = 'none';
  public time?: string = '09:00'; // HH:mm
  public dayOfWeek?: number = 1; // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  public dayOfMonth?: number = 1; // 1-31
  public monthAndDay?: string = '01-01'; // MM-DD
  public customDateTime?: string = ''; // YYYY-MM-DDTHH:mm
  public notificationId?: string = '';

  constructor(init?: Partial<NotificationReminderConfig>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class ParsedVoiceTodoCommand {
  public rawTranscript: string = '';
  public extractedTitle: string = '';
  public extractedDetails: string = '';
  public dueDate: string = '';
  public reminderConfig: NotificationReminderConfig = new NotificationReminderConfig();
  public confidenceScore: number = 1.0;
  public humanSummary: string = '';

  constructor(init?: Partial<ParsedVoiceTodoCommand>) {
    if (init) {
      Object.assign(this, init);
      if (init.reminderConfig) {
        this.reminderConfig = new NotificationReminderConfig(init.reminderConfig);
      }
    }
  }
}

export class GeneralTodoItem {
  public id: string = '';
  public title: string = '';
  public details?: string = '';
  public dueDate?: string = ''; // YYYY-MM-DD
  public completed: boolean = false;
  public completedAt?: number;
  public reminder: NotificationReminderConfig = new NotificationReminderConfig();
  public style?: BlockFormattingStyle = new BlockFormattingStyle();
  public createdAt: number = Date.now();
  public updatedAt: number = Date.now();

  constructor(init?: Partial<GeneralTodoItem>) {
    if (init) {
      Object.assign(this, init);
      if (init.reminder) {
        this.reminder = new NotificationReminderConfig(init.reminder);
      }
      if (init.style) {
        this.style = new BlockFormattingStyle(init.style);
      }
    }
  }
}

export class UserSettingsConfig {
  public themePaletteId: string = 'obsidian_gold';
  public isDark: boolean = true;
  public defaultJournalMode: 'view' | 'edit' = 'view';
  public enablePushNotifications: boolean = true;
  public backupMode: 'auto' | 'manual' = 'auto';
  public backupWifiOnly: boolean = true;
  public lastBackupTimestamp?: number;
  public lastBackupStatus?: 'idle' | 'success' | 'failed' | 'in_progress' = 'idle';
  public lastBackupError?: string;
  public hiddenTabs: string[] = [];

  constructor(init?: Partial<UserSettingsConfig>) {
    if (init) {
      Object.assign(this, init);
      if (init.hiddenTabs && Array.isArray(init.hiddenTabs)) {
        this.hiddenTabs = [...init.hiddenTabs];
      }
    }
  }
}

export class GlobalSearchResult {
  public id: string = '';
  public title: string = '';
  public snippet: string = '';
  public breadcrumbs: string[] = [];
  public module:
    | 'books'
    | 'knowledge'
    | 'links'
    | 'daily_tasks'
    | 'projects'
    | 'journal'
    | 'todos' = 'books';
  public targetId: string = '';
  public subId?: string = '';
  public matchedKeyword: string = '';

  constructor(init?: Partial<GlobalSearchResult>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class KnowledgeGraphLink {
  public sourceId: string = '';
  public targetId: string = '';
  public label: string = 'links_to';
  public strength: number = 1;

  constructor(init?: Partial<KnowledgeGraphLink>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class EncryptedEnvelope {
  public formatVersion: string = '1.0';
  public saltHex: string = '';
  public ivHex: string = '';
  public ciphertextBase64: string = '';
  public tagHex: string = '';
  public timestamp: number = Date.now();
  public keyHash: string = '';

  constructor(init?: Partial<EncryptedEnvelope>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class SyncManifest {
  public vaultId: string = '';
  public ownerSubHash: string = '';
  public lastSyncTimestamp: number = 0;
  public schemaVersion: number = 2;
  public totalEntries: number = 0;
  public totalNotes: number = 0;
  public checksumSha256: string = '';

  constructor(init?: Partial<SyncManifest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class NoctisVaultSnapshot {
  public userProfile?: GoogleSSOUserProfile;
  public diaryEntries: DiaryEntry[] = [];
  public secondBrainNotes: SecondBrainNote[] = [];
  public books: BookItem[] = [];
  public knowledgeItems: KnowledgeItem[] = [];
  public referenceLinks: ReferenceLinkItem[] = [];
  public dailyRecurringTasks: DailyRecurringTask[] = [];
  public dailyTaskCompletions: { [dateKey: string]: { [taskId: string]: boolean } } = {};
  public projects: ProjectItem[] = [];
  public generalTodos: GeneralTodoItem[] = [];
  public settings: UserSettingsConfig = new UserSettingsConfig();
  public inlineTasks: InlineTaskItem[] = [];
  public manifest: SyncManifest = new SyncManifest();

  constructor(init?: Partial<NoctisVaultSnapshot>) {
    if (init) {
      Object.assign(this, init);
      if (init.diaryEntries) {
        this.diaryEntries = init.diaryEntries.map((d) => new DiaryEntry(d));
      }
      if (init.secondBrainNotes) {
        this.secondBrainNotes = init.secondBrainNotes.map((n) => new SecondBrainNote(n));
      }
      if (init.books) {
        this.books = init.books.map((b) => new BookItem(b));
      }
      if (init.knowledgeItems) {
        this.knowledgeItems = init.knowledgeItems.map((k) => new KnowledgeItem(k));
      }
      if (init.referenceLinks) {
        this.referenceLinks = init.referenceLinks.map((r) => new ReferenceLinkItem(r));
      }
      if (init.dailyRecurringTasks) {
        this.dailyRecurringTasks = init.dailyRecurringTasks.map((t) => new DailyRecurringTask(t));
      }
      if (init.projects) {
        this.projects = init.projects.map((p) => new ProjectItem(p));
      }
      if (init.generalTodos) {
        this.generalTodos = init.generalTodos.map((g) => new GeneralTodoItem(g));
      }
      if (init.settings) {
        this.settings = new UserSettingsConfig(init.settings);
      }
      if (init.manifest) {
        this.manifest = new SyncManifest(init.manifest);
      }
    }
  }
}
