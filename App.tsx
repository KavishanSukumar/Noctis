import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  AppState as RNAppState,
  AppStateStatus,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StatusBar,
  Dimensions,
  ScaledSize,
  Animated,
  Alert,
  Keyboard,
  EmitterSubscription,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import {
  DiaryEntry,
  SecondBrainNote,
  InlineTaskItem,
  GoogleSSOUserProfile,
  NoctisVaultSnapshot,
  SyncManifest,
  BookItem,
  KnowledgeItem,
  ReferenceLinkItem,
  DailyRecurringTask,
  ProjectItem,
  GeneralTodoItem,
  UserSettingsConfig,
  GlobalSearchResult,
} from './src/models/NoctisModels';
import { NoctisTheme, ResponsiveMetrics, ColorPaletteDefinition } from './src/theme/NoctisTheme';
import { InputSanitizer } from './src/security/InputSanitizer';
import { CryptoSecurityService } from './src/security/CryptoSecurityService';
import { BiometricPrivacyGuard } from './src/security/BiometricPrivacyGuard';
import { DeviceKeySecurityService } from './src/security/DeviceKeySecurityService';
import { NetworkConnectivityGuard } from './src/security/NetworkConnectivityGuard';
import { GoogleSSOAuthService } from './src/services/GoogleSSOAuthService';
import { EncryptedLocalVaultStorage } from './src/services/EncryptedLocalVaultStorage';
import { GoogleDriveStealthSyncService } from './src/services/GoogleDriveStealthSyncService';
import { DailyDiaryService } from './src/services/DailyDiaryService';
import { SecondBrainPKMService } from './src/services/SecondBrainPKMService';
import { NotificationReminderService } from './src/services/NotificationReminderService';
import { VoiceCommandService } from './src/services/VoiceCommandService';
import { NotionBlockEditorView } from './src/components/NotionBlockEditorView';
import { KnowledgeGraphView } from './src/components/KnowledgeGraphView';
import { StealthDriveSyncModal } from './src/components/StealthDriveSyncModal';
import { SecondBrainHubView } from './src/components/SecondBrainHubView';
import { GeneralTodoView } from './src/components/GeneralTodoView';
import { GlobalSearchModal } from './src/components/GlobalSearchModal';
import { ThemeSettingsModal } from './src/components/ThemeSettingsModal';
import { JournalDatePickerModal } from './src/components/JournalDatePickerModal';
import { ConfigurationMenuModal } from './src/components/ConfigurationMenuModal';
import { ConfigurationView } from './src/components/ConfigurationView';
import { AppConfigStorageService } from './src/services/AppConfigStorageService';

export class NoctisAppProps {}

export class NoctisAppState {
  public isUnlocked: boolean = false;
  public isAppBackgrounded: boolean = false;
  public userSettings: UserSettingsConfig = new UserSettingsConfig();
  public activeTab: 'diary' | 'brain' | 'todos' | 'notes' | 'graph' | 'config' = 'diary';
  public userProfile: GoogleSSOUserProfile | null = null;
  public activeVaultKey: string = '';

  // Core Data Stores
  public diaryEntries: DiaryEntry[] = [];
  public selectedDiaryKey: string = DailyDiaryService.getTodayDateKey();
  public isJournalEditMode: boolean = true;

  public secondBrainNotes: SecondBrainNote[] = [];
  public selectedNoteId: string | null = null;
  public noteSearchQuery: string = '';

  public books: BookItem[] = [];
  public knowledgeItems: KnowledgeItem[] = [];
  public referenceLinks: ReferenceLinkItem[] = [];
  public dailyRecurringTasks: DailyRecurringTask[] = [];
  public dailyTaskCompletions: { [dateKey: string]: { [taskId: string]: boolean } } = {};
  public projects: ProjectItem[] = [];
  public generalTodos: GeneralTodoItem[] = [];

  // Modals & UI States
  public showSyncModal: boolean = false;
  public showSearchModal: boolean = false;
  public showSettingsModal: boolean = false;
  public showConfigModal: boolean = false;
  public showDatePickerModal: boolean = false;
  public isSyncing: boolean = false;
  public syncMessage: string = '';
  public streakCount: number = 0;
  public errorBanner: string | null = null;
  public inAppNotificationBanner: { title: string; body: string } | null = null;
  public isKeyboardVisible: boolean = false;
  public keyboardHeight: number = 0;

  // Layout & Animation
  public windowWidth: number = Dimensions.get('window').width;
  public windowHeight: number = Dimensions.get('window').height;
  public tabFadeAnim: Animated.Value = new Animated.Value(1);
}

export default class NoctisApp extends React.Component<NoctisAppProps, NoctisAppState> {
  private styles = NoctisAppStyles.styles;
  private appStateSubscription: { remove: () => void } | null = null;
  private dimensionsSubscription: { remove: () => void } | null = null;
  private keyboardDidShowSubscription: EmitterSubscription | null = null;
  private keyboardDidHideSubscription: EmitterSubscription | null = null;
  private journalScrollViewRef: any = null;

  // Debounced + serialized encrypted-vault persistence (prevents per-keystroke crypto and out-of-order writes)
  private static readonly PERSIST_DEBOUNCE_MS: number = 600;
  private persistDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private persistInFlight: Promise<void> | null = null;
  private persistQueued: boolean = false;

  constructor(props: NoctisAppProps) {
    super(props);
    const today = DailyDiaryService.getTodayDateKey();
    const win = Dimensions.get('window');

    this.state = {
      isUnlocked: false,
      isAppBackgrounded: false,
      userSettings: new UserSettingsConfig({
        themePaletteId: 'obsidian_gold',
        isDark: true,
        defaultJournalMode: 'edit',
      }),
      activeTab: 'diary',
      userProfile: null,
      activeVaultKey: '',

      diaryEntries: [DailyDiaryService.createDefaultDailyTemplate(today)],
      selectedDiaryKey: today,
      isJournalEditMode: true,

      secondBrainNotes: [
        SecondBrainPKMService.createNewNote('Welcome to Noctis PKM', 'inbox'),
      ],
      selectedNoteId: null,
      noteSearchQuery: '',

      books: [
        SecondBrainPKMService.createNewBook(
          'Deep Work',
          'Cal Newport',
          today,
          '',
          true
        ),
      ],
      knowledgeItems: [
        SecondBrainPKMService.createNewKnowledgeItem(
          'Zero-Knowledge Client-Side Cryptography',
          'All user data in Noctis is encrypted locally using AES-256-GCM. Never store plain credentials.'
        ),
      ],
      referenceLinks: [
        SecondBrainPKMService.createNewReferenceLink(
          'OWASP Mobile Top 10',
          'Official guidelines for mobile client security',
          'https://owasp.org/www-project-mobile-top-10/'
        ),
      ],
      dailyRecurringTasks: [
        SecondBrainPKMService.createRecurringTask(
          'Morning Clarity & Journaling',
          [0, 1, 2, 3, 4, 5, 6],
          'Daily 10-minute quiet reflection'
        ),
        SecondBrainPKMService.createRecurringTask(
          'Gym & Physical Exercise',
          [1, 2, 4, 5],
          'Monday, Tuesday, Thursday, Friday workout'
        ),
      ],
      dailyTaskCompletions: {},
      projects: [
        SecondBrainPKMService.createNewProject(
          'Personal Knowledge Operating System',
          'Building high-velocity digital sanctuary and PKM'
        ),
      ],
      generalTodos: [
        new GeneralTodoItem({
          id: 'todo_welcome_1',
          title: 'Review today’s reading notes in Books',
          details: 'Add key quotes from current book',
          dueDate: today,
          completed: false,
        }),
      ],

      showSyncModal: false,
      showSearchModal: false,
      showSettingsModal: false,
      showConfigModal: false,
      showDatePickerModal: false,
      isSyncing: false,
      syncMessage: '',
      streakCount: 1,
      errorBanner: null,
      inAppNotificationBanner: null,
      isKeyboardVisible: false,
      keyboardHeight: 0,

      windowWidth: win.width,
      windowHeight: win.height,
      tabFadeAnim: new Animated.Value(1),
    };
  }

  public override componentDidMount(): void {
    this.initializeSecuritySubsystems();
    this.initializeNotificationSubsystem();
    this.appStateSubscription = RNAppState.addEventListener('change', this.handleAppStateChange);
    this.dimensionsSubscription = Dimensions.addEventListener('change', this.handleDimensionChange);
    const onKeyboardShow = (e: any) => {
      const height = e?.endCoordinates?.height || 300;
      this.setState({ isKeyboardVisible: true, keyboardHeight: height });
    };
    const onKeyboardHide = () => {
      this.setState({ isKeyboardVisible: false, keyboardHeight: 0 });
    };
    this.keyboardDidShowSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      onKeyboardShow
    );
    this.keyboardDidHideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      onKeyboardHide
    );
  }

  public override componentWillUnmount(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    if (this.dimensionsSubscription) {
      this.dimensionsSubscription.remove();
    }
    if (this.keyboardDidShowSubscription) {
      this.keyboardDidShowSubscription.remove();
    }
    if (this.keyboardDidHideSubscription) {
      this.keyboardDidHideSubscription.remove();
    }
    // Flush any pending debounced write so no journal text is lost
    void this.flushPendingPersist();
  }

  private handleDimensionChange = ({ window }: { window: ScaledSize }): void => {
    this.setState({
      windowWidth: window.width,
      windowHeight: window.height,
    });
  };

  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    if (nextAppState.match(/inactive|background/)) {
      // Do not lock the vault or abort speech if an external native speech dialog (e.g. Android RecognizerIntent) is active
      if (VoiceCommandService.isExternalSpeechDialogActive()) {
        return;
      }

      // Write any pending (debounced) edits to the encrypted vault before zeroizing key material
      void this.flushPendingPersist();

      VoiceCommandService.stopListeningAndZeroize();
      BiometricPrivacyGuard.zeroizeSensitiveMemory();
      DeviceKeySecurityService.zeroizeSensitiveMemory();
      this.setState({ isAppBackgrounded: true, isUnlocked: false, activeVaultKey: '' });

      // If user is authenticated and auto backup is enabled, trigger background auto-backup
      if (this.state.userProfile && this.state.userSettings.backupMode === 'auto') {
        this.executeAutoBackupSilent();
      }
    } else if (nextAppState === 'active') {
      this.setState({ isAppBackgrounded: false });
    }
  };

  private initializeNotificationSubsystem = async (): Promise<void> => {
    await NotificationReminderService.initializeService(
      (title, body) => {
        this.setState({ inAppNotificationBanner: { title, body } });
        setTimeout(() => {
          this.setState({ inAppNotificationBanner: null });
        }, 7000);
      },
      (taskId) => {
        // Tapping a reminder notification brings the user directly to their to-do list
        this.setState({ activeTab: 'todos' });
      }
    );
  };

  private initializeSecuritySubsystems = async (): Promise<void> => {
    try {
      await BiometricPrivacyGuard.initializePrivacyShield();

      const storedProfile = await GoogleSSOAuthService.getStoredUserProfile();
      if (storedProfile) {
        this.setState({ userProfile: storedProfile });
      }

      // Pre-load standalone configuration file (tab visibility, theme, backup preferences)
      const fileConfig = await AppConfigStorageService.loadConfigFile();
      if (fileConfig) {
        const sanitizedHidden = AppConfigStorageService.sanitizeHiddenTabs(fileConfig.hiddenTabs);
        let targetTab: NoctisAppState['activeTab'] = 'diary';
        if (sanitizedHidden.includes(targetTab)) {
          const allTabIds: NoctisAppState['activeTab'][] = ['diary', 'brain', 'todos', 'notes', 'graph'];
          const firstVisible = allTabIds.find((id) => !sanitizedHidden.includes(id));
          if (firstVisible) targetTab = firstVisible;
        }
        this.setState({
          userSettings: new UserSettingsConfig({
            ...this.state.userSettings,
            ...fileConfig,
            hiddenTabs: sanitizedHidden,
          }),
          activeTab: targetTab,
          showConfigModal: false,
        });
      }

      // Authenticate BEFORE deriving or storing the hardware master key (Fail-Closed: OWASP M3 / A07:2021)
      const authSuccess = await BiometricPrivacyGuard.authenticateBiometrics('Unlock Your Private Sanctuary');
      if (authSuccess) {
        const deviceMasterKey = await DeviceKeySecurityService.deriveLocalMasterKey();
        this.setState({ isUnlocked: true, activeVaultKey: deviceMasterKey, errorBanner: null });
        await this.loadEncryptedVaultSnapshot(deviceMasterKey);
      } else {
        this.setState({ isUnlocked: false, activeVaultKey: '' });
      }
    } catch {
      // Fail closed on any authentication or security subsystem error
      this.setState({ isUnlocked: false, activeVaultKey: '' });
    }
  };

  private unlockManually = async (): Promise<void> => {
    try {
      const success = await BiometricPrivacyGuard.authenticateBiometrics('Unlock Your Private Sanctuary');
      if (success) {
        const deviceMasterKey = await DeviceKeySecurityService.deriveLocalMasterKey();
        this.setState({ isUnlocked: true, activeVaultKey: deviceMasterKey, errorBanner: null });
        await this.loadEncryptedVaultSnapshot(deviceMasterKey);
      } else {
        this.setState({
          isUnlocked: false,
          activeVaultKey: '',
          errorBanner: 'Biometric or device passcode verification is required to unlock your sanctuary.',
        });
      }
    } catch {
      this.setState({
        isUnlocked: false,
        activeVaultKey: '',
        errorBanner: 'Authentication failed. Vault remains locked.',
      });
    }
  };

  private loadEncryptedVaultSnapshot = async (explicitKey?: string): Promise<void> => {
    try {
      const keyToUse = explicitKey || this.state.activeVaultKey || (await DeviceKeySecurityService.deriveLocalMasterKey());
      const ownerSub = this.state.userProfile?.sub || 'device_owner_local';
      const exists = await EncryptedLocalVaultStorage.vaultExists(ownerSub);
      const fileConfig = await AppConfigStorageService.loadConfigFile();

      if (exists) {
        const snapshot = await EncryptedLocalVaultStorage.loadDecryptedVault(
          ownerSub,
          keyToUse
        );
        if (snapshot) {
          const recomputed = SecondBrainPKMService.recomputeBacklinks(snapshot.secondBrainNotes || []);
          const streak = DailyDiaryService.calculateStreak(snapshot.diaryEntries || []);
          let userSettings = snapshot.settings ? new UserSettingsConfig(snapshot.settings) : this.state.userSettings;

          if (fileConfig) {
            userSettings = new UserSettingsConfig({
              ...userSettings,
              ...fileConfig,
              hiddenTabs: AppConfigStorageService.sanitizeHiddenTabs(fileConfig.hiddenTabs),
            });
          }

          const loadedTodos = snapshot.generalTodos || this.state.generalTodos;
          await NotificationReminderService.syncActiveTodoReminders(loadedTodos);

          let targetTab: NoctisAppState['activeTab'] =
            this.state.activeTab === 'config' ? 'diary' : this.state.activeTab;
          const sanitizedHidden = AppConfigStorageService.sanitizeHiddenTabs(userSettings.hiddenTabs);
          if (sanitizedHidden.includes(targetTab)) {
            const allTabIds: NoctisAppState['activeTab'][] = ['diary', 'brain', 'todos', 'notes', 'graph'];
            const firstVisible = allTabIds.find((id) => !sanitizedHidden.includes(id));
            if (firstVisible) targetTab = firstVisible;
          }

          this.setState({
            diaryEntries: snapshot.diaryEntries && snapshot.diaryEntries.length > 0
              ? snapshot.diaryEntries
              : this.state.diaryEntries,
            secondBrainNotes: recomputed,
            books: snapshot.books || this.state.books,
            knowledgeItems: snapshot.knowledgeItems || this.state.knowledgeItems,
            referenceLinks: snapshot.referenceLinks || this.state.referenceLinks,
            dailyRecurringTasks: snapshot.dailyRecurringTasks || this.state.dailyRecurringTasks,
            dailyTaskCompletions: snapshot.dailyTaskCompletions || {},
            projects: snapshot.projects || this.state.projects,
            generalTodos: loadedTodos,
            userSettings,
            activeTab: targetTab,
            showConfigModal: false,
            streakCount: streak,
            isJournalEditMode: userSettings.defaultJournalMode === 'edit',
            activeVaultKey: keyToUse,
          });
        }
      }
    } catch {
      // First load fallback
    }
  };

  /**
   * Serialized persistence: at most one encrypted write runs at a time. Requests that arrive
   * while a write is in flight are coalesced into one follow-up write that snapshots the
   * latest state, so an older snapshot can never overwrite a newer one.
   */
  private persistCurrentVaultState = (): Promise<void> => {
    if (this.persistDebounceTimer) {
      clearTimeout(this.persistDebounceTimer);
      this.persistDebounceTimer = null;
    }
    this.persistQueued = true;
    if (!this.persistInFlight) {
      this.persistInFlight = (async () => {
        try {
          while (this.persistQueued) {
            this.persistQueued = false;
            await this.writeEncryptedVaultSnapshot();
          }
        } finally {
          this.persistInFlight = null;
        }
      })();
    }
    return this.persistInFlight;
  };

  /** Debounced persistence for high-frequency edits such as typing. */
  private schedulePersist = (): void => {
    if (this.persistDebounceTimer) {
      clearTimeout(this.persistDebounceTimer);
    }
    this.persistDebounceTimer = setTimeout(() => {
      this.persistDebounceTimer = null;
      void this.persistCurrentVaultState();
    }, NoctisApp.PERSIST_DEBOUNCE_MS);
  };

  /** Immediately writes any pending debounced edits (used on background / unmount). */
  private flushPendingPersist = (): Promise<void> => {
    if (this.persistDebounceTimer) {
      return this.persistCurrentVaultState();
    }
    return this.persistInFlight || Promise.resolve();
  };

  /** Upserts the diary for the selected date (creates it if this day was never saved). */
  private upsertCurrentDiary = (
    patch: (entry: DiaryEntry) => DiaryEntry,
    persistMode: 'immediate' | 'debounced'
  ): void => {
    const { entry: currentDiary } = DailyDiaryService.getOrCreateDiaryForDate(
      this.state.diaryEntries,
      this.state.selectedDiaryKey
    );
    const entryExists = this.state.diaryEntries.some((d) => d.id === currentDiary.id);
    const updated = entryExists
      ? this.state.diaryEntries.map((d) => (d.id === currentDiary.id ? patch(d) : d))
      : [patch(currentDiary), ...this.state.diaryEntries];

    this.setState({ diaryEntries: updated }, () => {
      if (persistMode === 'immediate') {
        void this.persistCurrentVaultState();
      } else {
        this.schedulePersist();
      }
    });
  };

  private writeEncryptedVaultSnapshot = async (): Promise<void> => {
    try {
      const ownerSub = this.state.userProfile?.sub || 'device_owner_local';
      const subHash = await CryptoSecurityService.computeOpaqueSubHash(ownerSub);
      const allTasks = SecondBrainPKMService.extractAllInlineTasks(
        this.state.secondBrainNotes,
        this.state.diaryEntries,
        this.state.generalTodos
      );

      const snapshot = new NoctisVaultSnapshot({
        userProfile: this.state.userProfile || undefined,
        diaryEntries: this.state.diaryEntries,
        secondBrainNotes: this.state.secondBrainNotes,
        books: this.state.books,
        knowledgeItems: this.state.knowledgeItems,
        referenceLinks: this.state.referenceLinks,
        dailyRecurringTasks: this.state.dailyRecurringTasks,
        dailyTaskCompletions: this.state.dailyTaskCompletions,
        projects: this.state.projects,
        generalTodos: this.state.generalTodos,
        settings: this.state.userSettings,
        inlineTasks: allTasks,
        manifest: new SyncManifest({
          vaultId: `vlt_${subHash}`,
          ownerSubHash: subHash,
          lastSyncTimestamp: Date.now(),
          totalEntries: this.state.diaryEntries.length,
          totalNotes: this.state.secondBrainNotes.length,
        }),
      });

      const keyToUse = this.state.activeVaultKey || (await DeviceKeySecurityService.deriveLocalMasterKey());
      await EncryptedLocalVaultStorage.saveEncryptedVault(
        ownerSub,
        snapshot,
        keyToUse
      );
      await AppConfigStorageService.saveConfigFile(this.state.userSettings);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Storage write failed';
      this.setState({ errorBanner: `Storage write failed: ${msg}` });
    }
  };

  private handleUpdateSettings = (newSettings: UserSettingsConfig): void => {
    let nextActiveTab = this.state.activeTab;
    const hiddenTabs = newSettings.hiddenTabs || [];
    if (hiddenTabs.includes(nextActiveTab)) {
      const allTabIds: NoctisAppState['activeTab'][] = ['diary', 'brain', 'todos', 'notes', 'graph'];
      const firstVisible = allTabIds.find((id) => !hiddenTabs.includes(id));
      if (firstVisible) {
        nextActiveTab = firstVisible;
      }
    }

    this.setState({ userSettings: newSettings, activeTab: nextActiveTab }, () => {
      void AppConfigStorageService.saveConfigFile(newSettings);
      void this.persistCurrentVaultState();
    });
  };

  private switchTab = (tab: NoctisAppState['activeTab']): void => {
    if (tab === this.state.activeTab) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Animated.sequence([
      Animated.timing(this.state.tabFadeAnim, {
        toValue: 0.3,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(this.state.tabFadeAnim, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();

    this.setState({ activeTab: tab, selectedNoteId: null });
  };

  private navigateJournalDate = (offsetDays: number): void => {
    const nextKey = DailyDiaryService.getAdjacentDateKey(this.state.selectedDiaryKey, offsetDays);
    const { entry, updatedEntries } = DailyDiaryService.getOrCreateDiaryForDate(
      this.state.diaryEntries,
      nextKey
    );

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    this.setState(
      {
        selectedDiaryKey: nextKey,
        diaryEntries: updatedEntries,
        isJournalEditMode: this.state.userSettings.defaultJournalMode === 'edit',
      },
      () => this.persistCurrentVaultState()
    );
  };

  private handleSelectJournalDate = (dateKey: string): void => {
    if (!DailyDiaryService.isValidDateKey(dateKey)) {
      return;
    }

    const { entry, updatedEntries } = DailyDiaryService.getOrCreateDiaryForDate(
      this.state.diaryEntries,
      dateKey
    );

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    this.setState(
      {
        selectedDiaryKey: dateKey,
        diaryEntries: updatedEntries,
        showDatePickerModal: false,
        isJournalEditMode: this.state.userSettings.defaultJournalMode === 'edit',
      },
      () => this.persistCurrentVaultState()
    );
  };

  private handleJournalBlockFocus = (blockIndex: number): void => {
    if (!this.journalScrollViewRef) return;
    const targetY = Math.max(0, 240 + blockIndex * 48 - 70);
    setTimeout(() => {
      this.journalScrollViewRef?.scrollTo({ y: targetY, animated: true });
    }, 120);
  };

  private handleResetDayJournal = (): void => {
    Alert.alert(
      'Reset Daily Reflections',
      `Are you sure you want to clear and reset the reflections for ${this.state.selectedDiaryKey} back to a fresh template?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
            const fresh = DailyDiaryService.createDefaultDailyTemplate(this.state.selectedDiaryKey);
            const updated = this.state.diaryEntries.map((d) =>
              d.dateKey === this.state.selectedDiaryKey ? fresh : d
            );
            this.setState({ diaryEntries: updated }, () => this.persistCurrentVaultState());
          },
        },
      ]
    );
  };

  private handleDeleteNote = (noteId: string, noteTitle: string): void => {
    Alert.alert(
      'Delete Note',
      `Delete "${noteTitle}"? This will permanently remove this mind fragment.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
            const remaining = this.state.secondBrainNotes.filter((n) => n.id !== noteId);
            const recomputed = SecondBrainPKMService.recomputeBacklinks(remaining);
            this.setState(
              {
                secondBrainNotes: recomputed,
                selectedNoteId: this.state.selectedNoteId === noteId ? null : this.state.selectedNoteId,
              },
              () => this.persistCurrentVaultState()
            );
          },
        },
      ]
    );
  };

  private toggleDailyTaskCompletion = (dateKey: string, taskId: string): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const currentComps = { ...this.state.dailyTaskCompletions };
    const dateComps = { ...(currentComps[dateKey] || {}) };
    dateComps[taskId] = !dateComps[taskId];
    currentComps[dateKey] = dateComps;

    this.setState({ dailyTaskCompletions: currentComps }, () => this.persistCurrentVaultState());
  };

  private handleSelectSearchResult = (result: GlobalSearchResult): void => {
    if (result.module === 'books') {
      this.switchTab('brain');
    } else if (result.module === 'knowledge') {
      this.switchTab('brain');
    } else if (result.module === 'links') {
      this.switchTab('brain');
    } else if (result.module === 'daily_tasks') {
      this.switchTab('brain');
    } else if (result.module === 'projects') {
      this.switchTab('brain');
    } else if (result.module === 'journal') {
      this.setState({ selectedDiaryKey: result.targetId });
      this.switchTab('diary');
    } else if (result.module === 'todos') {
      this.switchTab('todos');
    }
  };

  // Google SSO & Backup Handlers
  private handleGoogleLogin = async (): Promise<void> => {
    try {
      this.setState({ isSyncing: true, syncMessage: 'Signing in with Google...' });
      const profile = await GoogleSSOAuthService.executeGoogleSSO();
      this.setState({ userProfile: profile, isSyncing: false, syncMessage: 'Signed in successfully.' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await this.persistCurrentVaultState();

      // Check auto-backup preference
      if (this.state.userSettings.backupMode === 'auto') {
        const netCheck = await NetworkConnectivityGuard.validateBackupNetworkCondition(
          this.state.userSettings.backupWifiOnly !== false
        );

        if (netCheck.canProceed) {
          this.setState({
            inAppNotificationBanner: {
              title: 'Auto-Backup in Progress',
              body: 'Backing up local sanctuary to your Google Account over Wi-Fi...',
            },
          });
          await this.executeAutoBackupSilent();
        } else {
          this.setState({
            inAppNotificationBanner: {
              title: 'Account Connected',
              body: `Auto-backup waiting: ${netCheck.reason}`,
            },
          });
        }
      } else {
        this.setState({
          inAppNotificationBanner: {
            title: 'Account Connected',
            body: 'Manual backup mode active. You can back up anytime in Sync settings.',
          },
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In Failed';
      this.setState({ isSyncing: false, errorBanner: msg });
    }
  };

  private executeAutoBackupSilent = async (): Promise<void> => {
    try {
      const token = await GoogleSSOAuthService.getStoredAccessToken();
      if (!token || !this.state.userProfile) return;

      const netCheck = await NetworkConnectivityGuard.validateBackupNetworkCondition(
        this.state.userSettings.backupWifiOnly !== false
      );
      if (!netCheck.canProceed) return;

      // Use the wrapped cloud recovery passphrase key & salt rather than the device-local hardware key (OWASP M1 / M10)
      const cloudBackupKey = await BiometricPrivacyGuard.retrieveWrappedVaultKey();
      const cloudBackupSalt = await BiometricPrivacyGuard.retrieveWrappedVaultSalt();
      if (!cloudBackupKey || !cloudBackupSalt) {
        return;
      }

      const subHash = await CryptoSecurityService.computeOpaqueSubHash(this.state.userProfile.sub);

      const snapshot = new NoctisVaultSnapshot({
        userProfile: this.state.userProfile || undefined,
        diaryEntries: this.state.diaryEntries,
        secondBrainNotes: this.state.secondBrainNotes,
        books: this.state.books,
        knowledgeItems: this.state.knowledgeItems,
        referenceLinks: this.state.referenceLinks,
        dailyRecurringTasks: this.state.dailyRecurringTasks,
        dailyTaskCompletions: this.state.dailyTaskCompletions,
        projects: this.state.projects,
        generalTodos: this.state.generalTodos,
        settings: this.state.userSettings,
      });

      const encryptedEnvelope = await CryptoSecurityService.encryptPayload(
        JSON.stringify(snapshot),
        cloudBackupKey,
        cloudBackupSalt
      );

      const manifest = new SyncManifest({
        vaultId: `vlt_${subHash}`,
        ownerSubHash: subHash,
        lastSyncTimestamp: Date.now(),
        totalEntries: this.state.diaryEntries.length,
        totalNotes: this.state.secondBrainNotes.length,
      });

      await GoogleDriveStealthSyncService.backupVaultToCloud(token, encryptedEnvelope, manifest);

      const updatedSettings = new UserSettingsConfig({
        ...this.state.userSettings,
        lastBackupTimestamp: Date.now(),
        lastBackupStatus: 'success',
      });
      this.setState({
        userSettings: updatedSettings,
        inAppNotificationBanner: {
          title: 'Backup Secured',
          body: 'Your encrypted sanctuary was safely backed up to Google Drive.',
        },
      });
      setTimeout(() => {
        this.setState({ inAppNotificationBanner: null });
      }, 5000);
    } catch {
      // Silent failure for background routine
    }
  };

  private handleUpdateBackupSettings = (updates: Partial<UserSettingsConfig>): void => {
    const updated = new UserSettingsConfig({
      ...this.state.userSettings,
      ...updates,
    });
    this.setState({ userSettings: updated }, () => this.persistCurrentVaultState());
  };

  private handleGoogleSignOut = async (): Promise<void> => {
    await GoogleSSOAuthService.signOut();
    await BiometricPrivacyGuard.clearStoredVaultKey();
    this.setState({ userProfile: null, showSyncModal: false, showConfigModal: false });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  private handleLockVault = (): void => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    void this.flushPendingPersist();
    VoiceCommandService.stopListeningAndZeroize();
    BiometricPrivacyGuard.zeroizeSensitiveMemory();
    DeviceKeySecurityService.zeroizeSensitiveMemory();
    this.setState({
      isUnlocked: false,
      activeVaultKey: '',
      showConfigModal: false,
      showSettingsModal: false,
      showSyncModal: false,
      showSearchModal: false,
      showDatePickerModal: false,
      activeTab: 'diary',
    });
  };

  private handleLogOut = async (): Promise<void> => {
    Alert.alert(
      'Log Out of Noctis',
      'Are you sure you want to log out? Active session credentials will be cleared and the encrypted vault will be locked.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            try {
              await GoogleSSOAuthService.signOut();
              await BiometricPrivacyGuard.clearStoredVaultKey();
            } catch {
              // Best effort cleanup
            }
            this.setState({ userProfile: null, showSyncModal: false, showConfigModal: false });
            this.handleLockVault();
          },
        },
      ]
    );
  };

  private handleStealthBackup = async (passphrase: string): Promise<void> => {
    try {
      const token = await GoogleSSOAuthService.getStoredAccessToken();
      if (!token) throw new Error('Please sign in with Google before backing up.');

      // Enforce Network Constraint
      const isWifiOnly = this.state.userSettings.backupWifiOnly !== false;
      const netCheck = await NetworkConnectivityGuard.validateBackupNetworkCondition(isWifiOnly);
      if (!netCheck.canProceed) {
        throw new Error(netCheck.reason);
      }

      this.setState({ isSyncing: true, syncMessage: 'Deriving master cryptographic envelope...' });
      const saltHex = await CryptoSecurityService.generateRandomBytesHex(16);
      const derivedKey = await CryptoSecurityService.deriveMasterKey(passphrase, saltHex, '2.0');

      this.setState({ syncMessage: 'Encrypting sanctuary vault...' });
      const snapshot = new NoctisVaultSnapshot({
        userProfile: this.state.userProfile || undefined,
        diaryEntries: this.state.diaryEntries,
        secondBrainNotes: this.state.secondBrainNotes,
        books: this.state.books,
        knowledgeItems: this.state.knowledgeItems,
        referenceLinks: this.state.referenceLinks,
        dailyRecurringTasks: this.state.dailyRecurringTasks,
        dailyTaskCompletions: this.state.dailyTaskCompletions,
        projects: this.state.projects,
        generalTodos: this.state.generalTodos,
        settings: this.state.userSettings,
      });

      const encryptedEnvelope = await CryptoSecurityService.encryptPayload(
        JSON.stringify(snapshot),
        derivedKey,
        saltHex
      );

      const ownerSub = this.state.userProfile?.sub || 'device_owner_local';
      const subHash = await CryptoSecurityService.computeOpaqueSubHash(ownerSub);

      const manifest = new SyncManifest({
        vaultId: `vlt_${subHash}`,
        ownerSubHash: subHash,
        lastSyncTimestamp: Date.now(),
        totalEntries: this.state.diaryEntries.length,
        totalNotes: this.state.secondBrainNotes.length,
      });

      this.setState({ syncMessage: 'Uploading stealth backup to private cloud folder...' });
      await GoogleDriveStealthSyncService.backupVaultToCloud(token, encryptedEnvelope, manifest);

      // Store wrapped cloud backup key and salt in hardware-backed SecureStore without overwriting local hardware key
      await BiometricPrivacyGuard.storeWrappedVaultKey(derivedKey, saltHex);
      const localHardwareKey =
        this.state.activeVaultKey || (await DeviceKeySecurityService.deriveLocalMasterKey());

      const updatedSettings = new UserSettingsConfig({
        ...this.state.userSettings,
        lastBackupTimestamp: Date.now(),
        lastBackupStatus: 'success',
      });

      this.setState({
        isSyncing: false,
        syncMessage: 'Backup complete! Safely stored in your zero-knowledge cloud folder.',
        activeVaultKey: localHardwareKey,
        userSettings: updatedSettings,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Backup failed';
      this.setState({ isSyncing: false, errorBanner: msg });
    }
  };

  private handleStealthRestore = async (passphrase: string): Promise<void> => {
    try {
      const token = await GoogleSSOAuthService.getStoredAccessToken();
      if (!token) throw new Error('Please sign in with Google before restoring.');

      this.setState({ isSyncing: true, syncMessage: 'Fetching stealth vault from Google Drive...' });
      const { envelope } = await GoogleDriveStealthSyncService.restoreVaultFromCloud(token);

      if (!envelope) throw new Error('No backup found in your private appDataFolder.');

      this.setState({ syncMessage: 'Decrypting authenticated envelope...' });
      const derivedKey = await CryptoSecurityService.deriveMasterKey(
        passphrase,
        envelope.saltHex,
        envelope.formatVersion || '2.0'
      );
      const decryptedJson = await CryptoSecurityService.decryptPayload(envelope, derivedKey);
      const rawSnapshot = InputSanitizer.sanitizeSafeJsonParse<NoctisVaultSnapshot>(decryptedJson);

      if (!rawSnapshot || !InputSanitizer.validateVaultSnapshot(rawSnapshot)) {
        throw new Error('Decryption failed or backup payload failed integrity validation.');
      }

      const snapshot = new NoctisVaultSnapshot(rawSnapshot);
      const recomputed = SecondBrainPKMService.recomputeBacklinks(snapshot.secondBrainNotes || []);
      const streak = DailyDiaryService.calculateStreak(snapshot.diaryEntries || []);
      const baseSettings = snapshot.settings
        ? new UserSettingsConfig(snapshot.settings)
        : this.state.userSettings;
      const userSettings = new UserSettingsConfig({
        ...baseSettings,
        hiddenTabs: AppConfigStorageService.sanitizeHiddenTabs(baseSettings.hiddenTabs),
      });

      // Store wrapped cloud backup key and salt separately and preserve local hardware key for local storage
      await BiometricPrivacyGuard.storeWrappedVaultKey(derivedKey, envelope.saltHex);
      const localHardwareKey =
        this.state.activeVaultKey || (await DeviceKeySecurityService.deriveLocalMasterKey());

      this.setState({
        diaryEntries: snapshot.diaryEntries || [],
        secondBrainNotes: recomputed,
        books: snapshot.books || [],
        knowledgeItems: snapshot.knowledgeItems || [],
        referenceLinks: snapshot.referenceLinks || [],
        dailyRecurringTasks: snapshot.dailyRecurringTasks || [],
        dailyTaskCompletions: snapshot.dailyTaskCompletions || {},
        projects: snapshot.projects || [],
        generalTodos: snapshot.generalTodos || [],
        userSettings,
        streakCount: streak,
        activeVaultKey: localHardwareKey,
        isSyncing: false,
        syncMessage: 'Sanctuary vault restored successfully.',
        showSyncModal: false,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await this.persistCurrentVaultState();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Restore failed';
      this.setState({ isSyncing: false, errorBanner: msg });
    }
  };

  private handleUpdateMoodRating = (rating: number): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    this.upsertCurrentDiary(
      (d) => ({
        ...d,
        moodHabit: {
          ...d.moodHabit,
          moodRating: rating,
          loggedAt: Date.now(),
        },
        updatedAt: Date.now(),
      }),
      'immediate'
    );
  };

  private handleUpdateEnergyLevel = (level: number): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    this.upsertCurrentDiary(
      (d) => ({
        ...d,
        moodHabit: {
          ...d.moodHabit,
          energyLevel: level,
          loggedAt: Date.now(),
        },
        updatedAt: Date.now(),
      }),
      'immediate'
    );
  };

  public override render() {
    const {
      isUnlocked,
      isAppBackgrounded,
      activeTab,
      windowWidth,
      windowHeight,
      userSettings,
      userProfile,
      isSyncing,
      syncMessage,
      selectedDiaryKey,
      isJournalEditMode,
      tabFadeAnim,
    } = this.state;

    const palette: ColorPaletteDefinition = NoctisTheme.getPalette(userSettings.themePaletteId, userSettings.isDark);
    const metrics: ResponsiveMetrics = NoctisTheme.getResponsiveMetrics(windowWidth, windowHeight);

    // Biometric & Privacy Curtain Screen
    if (isAppBackgrounded || !isUnlocked) {
      return (
        <View style={[this.styles.lockScreen, { backgroundColor: palette.background, paddingTop: metrics.safeTopInset }]}>
          <StatusBar barStyle={palette.isDark ? 'light-content' : 'dark-content'} />
          <View style={[this.styles.lockContent, { backgroundColor: palette.cardBackground, borderColor: palette.glassBorder }]}>
            <View style={[this.styles.lockShieldBadge, { backgroundColor: palette.calloutBg, borderColor: palette.accent }]}>
              <Text style={this.styles.lockLogo}>🌙</Text>
            </View>
            <Text style={[this.styles.lockTitle, { color: palette.textPrimary }]}>Noctis</Text>
            <Text style={[this.styles.lockSubtitle, { color: palette.accent }]}>
              Personal Knowledge Sanctuary
            </Text>
            <Text style={[this.styles.lockPrivacyNote, { color: palette.textMuted }]}>
              Protected with AES-256 client-side zero-knowledge encryption and biometric device hardware bounds.
            </Text>
            <TouchableOpacity
              onPress={this.unlockManually}
              hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
              accessibilityRole="button"
              accessibilityLabel="Unlock Noctis Vault"
              style={[this.styles.unlockButton, { backgroundColor: palette.accent }]}
            >
              <Text style={[this.styles.unlockButtonText, { color: palette.accentContrast }]}>🔓 Tap to Unlock</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const { entry: currentDiary } = DailyDiaryService.getOrCreateDiaryForDate(
      this.state.diaryEntries,
      selectedDiaryKey
    );

    const graphData = SecondBrainPKMService.buildKnowledgeGraph(
      this.state.secondBrainNotes,
      this.state.diaryEntries,
      this.state.books,
      this.state.projects
    );

    return (
      <View style={[this.styles.container, { backgroundColor: palette.background }]}>
        <StatusBar barStyle={palette.isDark ? 'light-content' : 'dark-content'} />

        {/* Top Header Bar */}
        <BlurView
          intensity={palette.blurIntensity}
          tint={palette.blurTint}
          style={[
            this.styles.headerBar,
            {
              paddingTop: metrics.safeTopInset + 4,
              borderBottomColor: palette.glassBorder,
              backgroundColor: palette.glassSurface,
            },
          ]}
        >
          <View style={[this.styles.headerInner, { maxWidth: metrics.maxContainerWidth, alignSelf: 'center', width: '100%', paddingHorizontal: metrics.horizontalPadding }]}>
            <View>
              <Text style={[this.styles.headerTitle, { color: palette.textPrimary }]}>Noctis</Text>
              <View style={[this.styles.streakPill, { backgroundColor: palette.calloutBg, borderColor: palette.accent + '44' }]}>
                <Text style={[this.styles.headerSubtitle, { color: palette.accent }]}>
                  🔥 {this.state.streakCount} Day Streak
                </Text>
              </View>
            </View>

            <View style={this.styles.headerRight}>
              {/* Global Search Button */}
              <TouchableOpacity
                onPress={() => this.setState({ showSearchModal: true })}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={[this.styles.iconButton, { backgroundColor: palette.glassElevated, borderColor: palette.glassBorder }]}
                accessibilityRole="button"
                accessibilityLabel="Global Search"
              >
                <Text style={this.styles.headerIcon}>🔍</Text>
              </TouchableOpacity>

              {/* Quick Lock Sanctuary Button */}
              <TouchableOpacity
                onPress={this.handleLockVault}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={[this.styles.iconButton, { backgroundColor: palette.glassElevated, borderColor: palette.glassBorder }]}
                accessibilityRole="button"
                accessibilityLabel="Quick Lock Vault"
              >
                <Text style={this.styles.headerIcon}>🔒</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>

        {/* In-App Notification / Reminder Banner */}
        {this.state.inAppNotificationBanner && (
          <View style={[this.styles.inAppNotification, { backgroundColor: palette.accent }]}>
            <Text style={this.styles.inAppNotificationIcon}>🔔</Text>
            <View style={{ flex: 1 }}>
              <Text style={[this.styles.inAppNotificationTitle, { color: palette.accentContrast }]}>
                {this.state.inAppNotificationBanner.title}
              </Text>
              <Text style={[this.styles.inAppNotificationBody, { color: palette.accentContrast }]}>
                {this.state.inAppNotificationBanner.body}
              </Text>
            </View>
            <TouchableOpacity onPress={() => this.setState({ inAppNotificationBanner: null })}>
              <Text style={[this.styles.inAppNotificationClose, { color: palette.accentContrast }]}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Error Banner */}
        {this.state.errorBanner && (
          <View style={[this.styles.errorBanner, { backgroundColor: palette.danger }]}>
            <Text style={this.styles.errorBannerText} numberOfLines={2}>
              {this.state.errorBanner}
            </Text>
            <TouchableOpacity onPress={() => this.setState({ errorBanner: null })}>
              <Text style={this.styles.errorDismiss}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Main Content Area */}
        <KeyboardAvoidingView
          style={this.styles.contentArea}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <Animated.View style={[this.styles.contentArea, { opacity: tabFadeAnim }]}>
          {/* TAB 1: DAILY JOURNAL */}
          {activeTab === 'diary' && currentDiary && (
            <ScrollView
              ref={(r) => {
                this.journalScrollViewRef = r;
              }}
              style={this.styles.scrollPage}
              contentContainerStyle={{
                paddingBottom: (this.state.isKeyboardVisible ? this.state.keyboardHeight + 160 : 120) + metrics.safeBottomInset,
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={true}
              keyboardDismissMode="none"
            >
              <View style={[this.styles.responsiveCenterContainer, { maxWidth: metrics.maxContainerWidth, paddingHorizontal: metrics.horizontalPadding }]}>
                {/* Date Navigator Bar */}
                <View style={[this.styles.journalDateNavCard, { backgroundColor: palette.cardBackground, borderColor: palette.cardBorder }]}>
                  <TouchableOpacity
                    onPress={() => this.navigateJournalDate(-1)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel="Previous Day"
                    style={this.styles.dateNavPillBtn}
                  >
                    <Text style={[this.styles.dateNavPillText, { color: palette.accent }]}>◀ Prev</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      Haptics.selectionAsync();
                      this.setState({ showDatePickerModal: true });
                    }}
                    style={this.styles.dateNavCenter}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Open date picker calendar"
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <Text style={[this.styles.journalDateHeading, { color: palette.textPrimary }]}>
                        {DailyDiaryService.formatDateKeyToReadable(selectedDiaryKey)}
                      </Text>
                      <Text style={{ fontSize: 15 }}>📅</Text>
                    </View>
                    {selectedDiaryKey === DailyDiaryService.getTodayDateKey() ? (
                      <View style={[this.styles.journalTodayPill, { backgroundColor: palette.calloutBg, borderColor: palette.accent }]}>
                        <Text style={{ color: palette.accent, fontSize: 11, fontWeight: '700' }}>Today</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          this.handleSelectJournalDate(DailyDiaryService.getTodayDateKey());
                        }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        style={[this.styles.journalTodayPill, { backgroundColor: palette.glassElevated, borderColor: palette.glassBorder }]}
                      >
                        <Text style={{ color: palette.accent, fontSize: 11, fontWeight: '600' }}>Jump to Today</Text>
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => this.navigateJournalDate(1)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel="Next Day"
                    style={this.styles.dateNavPillBtn}
                  >
                    <Text style={[this.styles.dateNavPillText, { color: palette.accent }]}>Next ▶</Text>
                  </TouchableOpacity>
                </View>

                {/* View Mode vs Edit Mode Segmented Control & Reset Day Option */}
                <View style={this.styles.modeToggleRow}>
                  <View style={[this.styles.segmentedContainer, { backgroundColor: palette.glassElevated, borderColor: palette.glassBorder }]}>
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.selectionAsync();
                        this.setState({ isJournalEditMode: false });
                      }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      accessibilityRole="button"
                      accessibilityLabel="View mode"
                      style={[
                        this.styles.segmentBtn,
                        {
                          backgroundColor: !isJournalEditMode ? palette.accent : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          this.styles.segmentBtnText,
                          { color: !isJournalEditMode ? palette.accentContrast : palette.textSecondary },
                        ]}
                      >
                        📖 Reading
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        Haptics.selectionAsync();
                        this.setState({ isJournalEditMode: true });
                      }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      accessibilityRole="button"
                      accessibilityLabel="Edit mode"
                      style={[
                        this.styles.segmentBtn,
                        {
                          backgroundColor: isJournalEditMode ? palette.accent : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          this.styles.segmentBtnText,
                          { color: isJournalEditMode ? palette.accentContrast : palette.textSecondary },
                        ]}
                      >
                        ✏️ Editing
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {isJournalEditMode && (
                    <TouchableOpacity
                      onPress={this.handleResetDayJournal}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      accessibilityRole="button"
                      accessibilityLabel="Reset day journal"
                      style={[this.styles.actionPillOutline, { borderColor: palette.danger, backgroundColor: palette.glassElevated }]}
                    >
                      <Text style={[this.styles.actionPillOutlineText, { color: palette.danger }]}>
                        🔄 Reset Day
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Mood & Energy Habit Bar with Interactive Tap-to-Rate */}
                <View style={[this.styles.moodHabitCard, { backgroundColor: palette.cardBackground, borderColor: palette.cardBorder }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={[this.styles.sectionLabel, { color: palette.accent, marginBottom: 0 }]}>
                      DAILY CALM & REFLECTION
                    </Text>
                    <Text style={{ fontSize: 11, color: palette.textSecondary }}>
                      Tap to log
                    </Text>
                  </View>

                  {/* Mood Selector Row */}
                  <View style={this.styles.ratingRowContainer}>
                    <View style={this.styles.ratingHeader}>
                      <Text style={[this.styles.ratingCategoryTitle, { color: palette.textPrimary }]}>
                        Mindset Mood:
                      </Text>
                      <Text style={[this.styles.ratingDescriptor, { color: palette.accent }]}>
                        {(() => {
                          const r = currentDiary.moodHabit?.moodRating || 5;
                          if (r === 1) return 'Low / Heavy';
                          if (r === 2) return 'Slightly Down';
                          if (r === 3) return 'Balanced';
                          if (r === 4) return 'Calm & Positive';
                          return 'Radiant';
                        })()}
                      </Text>
                    </View>
                    <View style={this.styles.starsButtonRow}>
                      {[1, 2, 3, 4, 5].map((val) => {
                        const isSelected = (currentDiary.moodHabit?.moodRating || 5) >= val;
                        return (
                          <TouchableOpacity
                            key={`mood_${val}`}
                            onPress={() => this.handleUpdateMoodRating(val)}
                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                            accessibilityRole="button"
                            accessibilityLabel={`Rate mood ${val} out of 5`}
                            style={[
                              this.styles.ratingCircleBtn,
                              {
                                backgroundColor: isSelected ? palette.calloutBg : palette.glassElevated,
                                borderColor: isSelected ? palette.accent : palette.glassBorder,
                              },
                            ]}
                          >
                            <Text style={{ fontSize: 18, opacity: isSelected ? 1 : 0.35 }}>⭐</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Energy Selector Row */}
                  <View style={[this.styles.ratingRowContainer, { marginTop: 12 }]}>
                    <View style={this.styles.ratingHeader}>
                      <Text style={[this.styles.ratingCategoryTitle, { color: palette.textPrimary }]}>
                        Vitality Energy:
                      </Text>
                      <Text style={[this.styles.ratingDescriptor, { color: palette.accent }]}>
                        {(() => {
                          const e = currentDiary.moodHabit?.energyLevel || 5;
                          if (e === 1) return 'Depleted';
                          if (e === 2) return 'Tired';
                          if (e === 3) return 'Steady';
                          if (e === 4) return 'Vibrant';
                          return 'Peak Energy';
                        })()}
                      </Text>
                    </View>
                    <View style={this.styles.starsButtonRow}>
                      {[1, 2, 3, 4, 5].map((val) => {
                        const isSelected = (currentDiary.moodHabit?.energyLevel || 5) >= val;
                        return (
                          <TouchableOpacity
                            key={`energy_${val}`}
                            onPress={() => this.handleUpdateEnergyLevel(val)}
                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                            accessibilityRole="button"
                            accessibilityLabel={`Rate energy ${val} out of 5`}
                            style={[
                              this.styles.ratingCircleBtn,
                              {
                                backgroundColor: isSelected ? palette.calloutBg : palette.glassElevated,
                                borderColor: isSelected ? palette.accent : palette.glassBorder,
                              },
                            ]}
                          >
                            <Text style={{ fontSize: 18, opacity: isSelected ? 1 : 0.35 }}>⚡</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {/* Complete Unified Daily Journal Block */}
                <View style={[this.styles.diaryBlockSection, { backgroundColor: palette.cardBackground, borderColor: palette.cardBorder }]}>
                  <NotionBlockEditorView
                    isDark={userSettings.isDark}
                    palette={palette}
                    readOnly={!isJournalEditMode}
                    scrollEnabled={false}
                    onBlockFocus={this.handleJournalBlockFocus}
                    blocks={DailyDiaryService.getUnifiedJournalBlocks(currentDiary)}
                    onBlocksChange={(blocks) =>
                      this.upsertCurrentDiary(
                        (d) => ({ ...d, dailyLog: blocks, morningIntentions: [], eveningReflection: [], updatedAt: Date.now() }),
                        'debounced'
                      )
                    }
                  />
                </View>
              </View>
            </ScrollView>
          )}

          {/* TAB 2: SECOND BRAIN PKM HUB (Books, Knowledge, Links, Daily Tasks, Projects) */}
          {activeTab === 'brain' && (
            <SecondBrainHubView
              palette={palette}
              metrics={metrics}
              isDark={userSettings.isDark}
              isKeyboardVisible={this.state.isKeyboardVisible}
              keyboardHeight={this.state.keyboardHeight}
              books={this.state.books}
              knowledgeItems={this.state.knowledgeItems}
              referenceLinks={this.state.referenceLinks}
              dailyRecurringTasks={this.state.dailyRecurringTasks}
              dailyTaskCompletions={this.state.dailyTaskCompletions}
              projects={this.state.projects}
              onUpdateBooks={(books) => this.setState({ books }, () => this.persistCurrentVaultState())}
              onUpdateKnowledge={(knowledgeItems) => this.setState({ knowledgeItems }, () => this.persistCurrentVaultState())}
              onUpdateLinks={(referenceLinks) => this.setState({ referenceLinks }, () => this.persistCurrentVaultState())}
              onUpdateDailyTasks={(dailyRecurringTasks) => this.setState({ dailyRecurringTasks }, () => this.persistCurrentVaultState())}
              onToggleDailyTaskCompletion={this.toggleDailyTaskCompletion}
              onUpdateProjects={(projects) => this.setState({ projects }, () => this.persistCurrentVaultState())}
            />
          )}

          {/* TAB 3: GENERAL TO-DOS (With Push Reminders & Strikethrough Filter) */}
          {activeTab === 'todos' && (
            <GeneralTodoView
              palette={palette}
              metrics={metrics}
              todos={this.state.generalTodos}
              isKeyboardVisible={this.state.isKeyboardVisible}
              keyboardHeight={this.state.keyboardHeight}
              onUpdateTodos={(generalTodos) => this.setState({ generalTodos }, () => this.persistCurrentVaultState())}
            />
          )}

          {/* TAB 4: FREEFORM NOTES (PARA Inbox & Quick Capture) */}
          {activeTab === 'notes' && (
            <View style={[this.styles.notesViewArea, { maxWidth: metrics.maxContainerWidth, alignSelf: 'center', width: '100%', paddingHorizontal: metrics.horizontalPadding }]}>
              {this.state.selectedNoteId ? (
                // Single Note Editor View + Delete Note
                <View style={{ flex: 1 }}>
                  <View style={this.styles.detailTopBar}>
                    <TouchableOpacity
                      onPress={() => this.setState({ selectedNoteId: null })}
                      style={this.styles.backBtn}
                    >
                      <Text style={[this.styles.backBtnText, { color: palette.accent }]}>← Notes</Text>
                    </TouchableOpacity>

                    {(() => {
                      const note = this.state.secondBrainNotes.find((n) => n.id === this.state.selectedNoteId);
                      if (!note) return null;
                      return (
                        <TouchableOpacity
                          onPress={() => this.handleDeleteNote(note.id, note.title)}
                          style={[this.styles.actionPillOutline, { borderColor: palette.danger, backgroundColor: palette.glassElevated }]}
                        >
                          <Text style={[this.styles.actionPillOutlineText, { color: palette.danger }]}>🗑 Delete Note</Text>
                        </TouchableOpacity>
                      );
                    })()}
                  </View>

                  {(() => {
                    const note = this.state.secondBrainNotes.find((n) => n.id === this.state.selectedNoteId);
                    if (!note) return null;
                    return (
                      <View style={{ flex: 1 }}>
                        <TextInput
                          style={[
                            this.styles.noteTitleInput,
                            {
                              color: palette.textPrimary,
                              backgroundColor: palette.cardBackground,
                              borderColor: palette.cardBorder,
                            },
                          ]}
                          value={note.title}
                          placeholder="Untitled note"
                          placeholderTextColor={palette.textMuted}
                          maxLength={InputSanitizer.MAX_TITLE_LENGTH}
                          accessibilityLabel="Note title"
                          returnKeyType="done"
                          onChangeText={(txt) => {
                            const safeTitle = InputSanitizer.sanitizeInputContent(txt, InputSanitizer.MAX_TITLE_LENGTH).replace(/[\r\n]+/g, ' ');
                            const updated = this.state.secondBrainNotes.map((n) =>
                              n.id === note.id ? { ...n, title: safeTitle, updatedAt: Date.now() } : n
                            );
                            this.setState({ secondBrainNotes: updated }, () => this.schedulePersist());
                          }}
                        />
                        <NotionBlockEditorView
                          isDark={userSettings.isDark}
                          palette={palette}
                          blocks={note.blocks}
                          onBlocksChange={(blocks) => {
                            const updated = this.state.secondBrainNotes.map((n) =>
                              n.id === note.id ? { ...n, blocks, updatedAt: Date.now() } : n
                            );
                            this.setState({ secondBrainNotes: updated }, () => this.schedulePersist());
                          }}
                        />
                      </View>
                    );
                  })()}
                </View>
              ) : (
                // Notes List View
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{
                    paddingBottom: (this.state.isKeyboardVisible ? this.state.keyboardHeight + 120 : 120) + metrics.safeBottomInset,
                  }}
                >
                  <View style={this.styles.listHeaderRow}>
                    <Text style={[this.styles.listHeading, { color: palette.textPrimary }]}>
                      Quick Notes ({this.state.secondBrainNotes.length})
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        const newNote = SecondBrainPKMService.createNewNote('New Thought', 'inbox');
                        const updated = [newNote, ...this.state.secondBrainNotes];
                        this.setState({ secondBrainNotes: updated, selectedNoteId: newNote.id }, () =>
                          this.persistCurrentVaultState()
                        );
                      }}
                      style={[this.styles.actionPill, { backgroundColor: palette.accent }]}
                    >
                      <Text style={[this.styles.actionPillText, { color: palette.accentContrast }]}>+ New Note</Text>
                    </TouchableOpacity>
                  </View>

                  {this.state.secondBrainNotes.map((note) => (
                    <TouchableOpacity
                      key={note.id}
                      onPress={() => this.setState({ selectedNoteId: note.id })}
                      style={[this.styles.noteCard, { backgroundColor: palette.cardBackground, borderColor: palette.cardBorder }]}
                    >
                      <View style={this.styles.cardTopRow}>
                        <Text style={[this.styles.noteCardTitle, { color: palette.textPrimary }]}>{note.title}</Text>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            this.handleDeleteNote(note.id, note.title);
                          }}
                          style={this.styles.cardActionIconBtn}
                        >
                          <Text style={[this.styles.cardActionIconText, { color: palette.danger }]}>🗑</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={[this.styles.noteCardSnippet, { color: palette.textSecondary }]} numberOfLines={2}>
                        {note.blocks.map((b) => b.content).join(' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* TAB 5: KNOWLEDGE GRAPH CONNECTIONS */}
          {activeTab === 'graph' && (
            <KnowledgeGraphView
              isDark={userSettings.isDark}
              nodes={graphData.nodes}
              links={graphData.links}
              onNodeSelect={(id, type) => {
                if (type === 'note') {
                  this.setState({ activeTab: 'notes', selectedNoteId: id });
                } else if (type === 'diary') {
                  this.setState({ activeTab: 'diary' });
                } else if (type === 'book') {
                  this.setState({ activeTab: 'brain' });
                } else if (type === 'project') {
                  this.setState({ activeTab: 'brain' });
                }
              }}
            />
          )}

          {/* TAB 6: CONFIGURATION & SETTINGS */}
          {activeTab === 'config' && (
            <ConfigurationView
              palette={palette}
              metrics={metrics}
              settings={userSettings}
              profile={userProfile}
              isSyncing={isSyncing}
              syncStatusMessage={syncMessage}
              onUpdateSettings={this.handleUpdateSettings}
              onGoogleLogin={this.handleGoogleLogin}
              onGoogleSignOut={this.handleGoogleSignOut}
              onLockVault={this.handleLockVault}
              onLogOut={this.handleLogOut}
              onTriggerBackup={
                userProfile
                  ? () => {
                      this.setState({ showSyncModal: true });
                    }
                  : undefined
              }
            />
          )}
        </Animated.View>
        </KeyboardAvoidingView>

        {/* Anchored Curved Glass Pill Navigation Dock */}
        {!this.state.isKeyboardVisible && (
          <View style={[this.styles.tabBarWrapper, { bottom: metrics.safeBottomInset, left: metrics.horizontalPadding, right: metrics.horizontalPadding }]}>
            <BlurView
              intensity={palette.blurIntensity}
              tint={palette.blurTint}
              style={[
                this.styles.tabBar,
                {
                  backgroundColor: palette.glassSurface,
                  borderColor: palette.glassBorder,
                },
              ]}
            >
              {[
                { id: 'diary', icon: '📖', label: 'Journal' },
                { id: 'brain', icon: '🧠', label: 'Brain' },
                { id: 'todos', icon: '☑️', label: 'To-Dos' },
                { id: 'notes', icon: '📝', label: 'Notes' },
                { id: 'graph', icon: '🔗', label: 'Graph' },
                { id: 'config', icon: '⚙️', label: 'Config' },
              ]
                .filter((tab) => tab.id === 'config' || !(userSettings.hiddenTabs || []).includes(tab.id))
                .map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    onPress={() => this.switchTab(tab.id as NoctisAppState['activeTab'])}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    accessibilityRole="button"
                    accessibilityLabel={`${tab.label} tab`}
                    accessibilityState={{ selected: isActive }}
                    style={[
                      this.styles.tabItem,
                      isActive && {
                        backgroundColor: palette.calloutBg,
                        borderColor: palette.accent + '44',
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Text style={[this.styles.tabIcon, { opacity: isActive ? 1 : (palette.isDark ? 0.55 : 0.75) }]}>
                      {tab.icon}
                    </Text>
                    <Text
                      style={[
                        this.styles.tabLabel,
                        {
                          color: isActive ? palette.accent : palette.textSecondary,
                          fontWeight: isActive ? '700' : '600',
                        },
                      ]}
                    >
                      {tab.label}
                    </Text>
                    {isActive && (
                      <View style={[this.styles.activeTabDot, { backgroundColor: palette.accent }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </BlurView>
          </View>
        )}

        {/* Global Breadcrumb Search Modal */}
        <GlobalSearchModal
          visible={this.state.showSearchModal}
          palette={palette}
          metrics={metrics}
          books={this.state.books}
          knowledgeItems={this.state.knowledgeItems}
          referenceLinks={this.state.referenceLinks}
          dailyRecurringTasks={this.state.dailyRecurringTasks}
          projects={this.state.projects}
          diaryEntries={this.state.diaryEntries}
          secondBrainNotes={this.state.secondBrainNotes}
          generalTodos={this.state.generalTodos}
          onClose={() => this.setState({ showSearchModal: false })}
          onSelectResult={this.handleSelectSearchResult}
        />

        {/* Configuration & Tab Visibility Menu Modal */}
        <ConfigurationMenuModal
          visible={this.state.showConfigModal}
          palette={palette}
          metrics={metrics}
          settings={this.state.userSettings}
          profile={this.state.userProfile}
          isSyncing={this.state.isSyncing}
          syncStatusMessage={this.state.syncMessage}
          onClose={() => this.setState({ showConfigModal: false })}
          onUpdateSettings={this.handleUpdateSettings}
          onGoogleLogin={this.handleGoogleLogin}
          onGoogleSignOut={this.handleGoogleSignOut}
          onLockVault={this.handleLockVault}
          onLogOut={this.handleLogOut}
          onTriggerBackup={
            this.state.userProfile
              ? () => {
                  this.setState({ showConfigModal: false, showSyncModal: true });
                }
              : undefined
          }
        />

        {/* Theme Settings Modal */}
        <ThemeSettingsModal
          visible={this.state.showSettingsModal}
          palette={palette}
          metrics={metrics}
          settings={this.state.userSettings}
          onClose={() => this.setState({ showSettingsModal: false })}
          onUpdateSettings={this.handleUpdateSettings}
        />

        {/* Stealth Cloud Backup Modal */}
        <StealthDriveSyncModal
          visible={this.state.showSyncModal}
          isDark={userSettings.isDark}
          profile={this.state.userProfile}
          userSettings={this.state.userSettings}
          isSyncing={this.state.isSyncing}
          syncStatusMessage={this.state.syncMessage}
          onClose={() => this.setState({ showSyncModal: false })}
          onGoogleLogin={this.handleGoogleLogin}
          onGoogleSignOut={this.handleGoogleSignOut}
          onTriggerBackup={this.handleStealthBackup}
          onTriggerRestore={this.handleStealthRestore}
          onUpdateBackupSettings={this.handleUpdateBackupSettings}
        />

        {/* Journal Date Picker Modal */}
        <JournalDatePickerModal
          visible={this.state.showDatePickerModal}
          selectedDateKey={this.state.selectedDiaryKey}
          existingDateKeys={this.state.diaryEntries.map((d) => d.dateKey)}
          palette={palette}
          metrics={metrics}
          isDark={userSettings.isDark}
          onSelectDate={this.handleSelectJournalDate}
          onClose={() => this.setState({ showDatePickerModal: false })}
        />
      </View>
    );
  }
}

export class NoctisAppStyles {
  public static readonly styles = StyleSheet.create({
    container: {
      flex: 1,
    } as ViewStyle,
    lockScreen: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    } as ViewStyle,
    lockContent: {
      alignItems: 'center',
      paddingHorizontal: 32,
      paddingVertical: 36,
      borderRadius: 28,
      borderWidth: 1,
      maxWidth: 380,
      width: '90%',
    } as ViewStyle,
    lockShieldBadge: {
      width: 88,
      height: 88,
      borderRadius: 44,
      borderWidth: 2,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    } as ViewStyle,
    lockLogo: {
      fontSize: 44,
    } as TextStyle,
    lockTitle: {
      fontSize: 28,
      fontWeight: '800',
      marginBottom: 6,
      letterSpacing: -0.5,
    } as TextStyle,
    lockSubtitle: {
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 10,
      textAlign: 'center',
      letterSpacing: 0.2,
    } as TextStyle,
    lockPrivacyNote: {
      fontSize: 12,
      textAlign: 'center',
      marginBottom: 26,
      lineHeight: 18,
      maxWidth: 290,
    } as TextStyle,
    unlockButton: {
      borderRadius: 999,
      paddingVertical: 14,
      paddingHorizontal: 32,
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
    } as ViewStyle,
    unlockButtonText: {
      color: '#0B0B0E',
      fontSize: 15,
      fontWeight: '700',
    } as TextStyle,
    headerBar: {
      borderBottomWidth: 1,
      paddingBottom: 10,
    } as ViewStyle,
    headerInner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    } as ViewStyle,
    headerTitle: {
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.4,
    } as TextStyle,
    headerSubtitle: {
      fontSize: 11,
      fontWeight: '700',
    } as TextStyle,
    streakPill: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
      marginTop: 2,
      alignSelf: 'flex-start',
    } as ViewStyle,
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    } as ViewStyle,
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 999,
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
    } as ViewStyle,
    headerIcon: {
      fontSize: 16,
    } as TextStyle,
    syncShieldBtn: {
      width: 40,
      height: 40,
      borderWidth: 1,
      borderRadius: 999,
      justifyContent: 'center',
      alignItems: 'center',
    } as ViewStyle,
    inAppNotification: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      marginHorizontal: 16,
      marginTop: 6,
      borderRadius: 14,
      gap: 10,
    } as ViewStyle,
    inAppNotificationIcon: {
      fontSize: 20,
    } as TextStyle,
    inAppNotificationTitle: {
      color: '#0B0B0E',
      fontSize: 14,
      fontWeight: '700',
    } as TextStyle,
    inAppNotificationBody: {
      color: '#0B0B0E',
      fontSize: 12,
      marginTop: 1,
    } as TextStyle,
    inAppNotificationClose: {
      color: '#0B0B0E',
      fontSize: 16,
      fontWeight: '700',
      padding: 4,
    } as TextStyle,
    errorBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
    } as ViewStyle,
    errorBannerText: {
      color: '#FFFFFF',
      fontSize: 12,
      flex: 1,
    } as TextStyle,
    errorDismiss: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
      paddingLeft: 8,
    } as TextStyle,
    contentArea: {
      flex: 1,
    } as ViewStyle,
    scrollPage: {
      flex: 1,
      paddingTop: 8,
    } as ViewStyle,
    responsiveCenterContainer: {
      alignSelf: 'center',
      width: '100%',
    } as ViewStyle,
    journalDateNavCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 20,
      padding: 12,
      marginBottom: 10,
    } as ViewStyle,
    dateNavPillBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
    } as ViewStyle,
    dateNavPillText: {
      fontSize: 13,
      fontWeight: '700',
    } as TextStyle,
    dateNavCenter: {
      alignItems: 'center',
    } as ViewStyle,
    journalDateHeading: {
      fontSize: 15,
      fontWeight: '700',
    } as TextStyle,
    journalTodayPill: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
      marginTop: 4,
    } as ViewStyle,
    modeToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
      paddingHorizontal: 2,
    } as ViewStyle,
    segmentedContainer: {
      flexDirection: 'row',
      borderRadius: 999,
      borderWidth: 1,
      padding: 3,
      alignItems: 'center',
    } as ViewStyle,
    segmentBtn: {
      paddingHorizontal: 16,
      paddingVertical: 7,
      borderRadius: 999,
    } as ViewStyle,
    segmentBtnText: {
      fontSize: 12,
      fontWeight: '700',
    } as TextStyle,
    actionPillOutline: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
    } as ViewStyle,
    actionPillOutlineText: {
      fontSize: 12,
      fontWeight: '700',
    } as TextStyle,
    moodHabitCard: {
      borderWidth: 1,
      borderRadius: 20,
      padding: 16,
      marginBottom: 12,
    } as ViewStyle,
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
      marginBottom: 6,
    } as TextStyle,
    ratingRowContainer: {
      marginTop: 4,
    } as ViewStyle,
    ratingHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    } as ViewStyle,
    ratingCategoryTitle: {
      fontSize: 13,
      fontWeight: '600',
    } as TextStyle,
    ratingDescriptor: {
      fontSize: 12,
      fontWeight: '700',
    } as TextStyle,
    starsButtonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
    } as ViewStyle,
    ratingCircleBtn: {
      flex: 1,
      height: 42,
      borderRadius: 12,
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
    } as ViewStyle,
    ratingRow: {
      flexDirection: 'row',
      gap: 20,
    } as ViewStyle,
    ratingText: {
      fontSize: 14,
      fontWeight: '600',
    } as TextStyle,
    diaryBlockSection: {
      borderWidth: 1,
      borderRadius: 22,
      marginBottom: 14,
    } as ViewStyle,
    notesViewArea: {
      flex: 1,
      paddingTop: 10,
    } as ViewStyle,
    detailTopBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    } as ViewStyle,
    backBtn: {
      marginBottom: 8,
    } as ViewStyle,
    backBtnText: {
      fontSize: 14,
      fontWeight: '700',
    } as TextStyle,
    noteTitleInput: {
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
    } as TextStyle,
    listHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    } as ViewStyle,
    listHeading: {
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: -0.3,
    } as TextStyle,
    actionPill: {
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 7,
    } as ViewStyle,
    actionPillText: {
      color: '#0B0B0E',
      fontSize: 12,
      fontWeight: '700',
    } as TextStyle,
    cardTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    } as ViewStyle,
    cardActionIconBtn: {
      paddingHorizontal: 6,
      paddingVertical: 2,
    } as ViewStyle,
    cardActionIconText: {
      fontSize: 15,
      fontWeight: '700',
    } as TextStyle,
    noteCard: {
      borderWidth: 1,
      borderRadius: 18,
      padding: 16,
      marginBottom: 10,
    } as ViewStyle,
    noteCardTitle: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 6,
      flex: 1,
    } as TextStyle,
    noteCardSnippet: {
      fontSize: 13,
      lineHeight: 18,
    } as TextStyle,
    tabBarWrapper: {
      position: 'absolute',
      left: 16,
      right: 16,
      alignItems: 'center',
      zIndex: 999,
    } as ViewStyle,
    tabBar: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
      maxWidth: 440,
      width: '100%',
      elevation: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      overflow: 'hidden',
    } as ViewStyle,
    tabItem: {
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 14,
      minWidth: 46,
    } as ViewStyle,
    tabIcon: {
      fontSize: 17,
      marginBottom: 2,
    } as TextStyle,
    tabLabel: {
      fontSize: 10,
      fontWeight: '600',
    } as TextStyle,
    activeTabDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      marginTop: 2,
    } as ViewStyle,
  });
}
