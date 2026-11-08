import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Modal,
  Alert,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  GeneralTodoItem,
  NotificationReminderConfig,
  BlockFormattingStyle,
  ParsedVoiceTodoCommand,
} from '../models/NoctisModels';
import { ColorPaletteDefinition, ResponsiveMetrics } from '../theme/NoctisTheme';
import { NotificationReminderService } from '../services/NotificationReminderService';
import { VoiceCommandNLPService } from '../services/VoiceCommandNLPService';
import {
  VoiceCommandService,
  VoiceRecognitionSessionCallbacks,
} from '../services/VoiceCommandService';
import { DailyDiaryService } from '../services/DailyDiaryService';
import { InputSanitizer } from '../security/InputSanitizer';

export class GeneralTodoViewProps {
  public palette: ColorPaletteDefinition = new ColorPaletteDefinition();
  public metrics: ResponsiveMetrics = new ResponsiveMetrics();
  public todos: GeneralTodoItem[] = [];
  public onUpdateTodos: (todos: GeneralTodoItem[]) => void = () => {};
  public isKeyboardVisible?: boolean = false;
  public keyboardHeight?: number = 0;
}

export class GeneralTodoViewState {
  public filterMode: 'active' | 'finished' | 'all' = 'active';
  public showAddModal: boolean = false;
  public showEditModal: boolean = false;
  public showVoiceModal: boolean = false;
  public searchQuery: string = '';

  // Hold-to-Record Voice Engine State
  public isPressRecording: boolean = false;
  public isProcessingSpeech: boolean = false;
  public pressRecordingTranscript: string = '';
  public toastBanner: { message: string; type: 'success' | 'info' | 'error' } | null = null;

  // Voice Command Studio Modal State
  public voiceRawTranscript: string = '';
  public isVoiceListening: boolean = false;
  public voiceStatusMessage: string = '';
  public parsedVoicePreview: ParsedVoiceTodoCommand = new ParsedVoiceTodoCommand();

  // Form State (Create & Edit)
  public editingTodoId: string | null = null;
  public formTitle: string = '';
  public formDetails: string = '';
  public formDueDate: string = ''; // YYYY-MM-DD
  public formReminderType: NotificationReminderConfig['type'] = 'none';
  public formReminderTime: string = '09:00';
  public formReminderDayOfWeek: number = 1; // 0=Sun..6=Sat
  public formReminderDayOfMonth: number = 1;
  public formReminderMonthAndDay: string = '01-01';
  public formReminderCustomDateTime: string = '';
  public formStyleBold: boolean = false;
  public formStyleItalic: boolean = false;
  public formStyleColor: string = '';
}

export class GeneralTodoView extends React.Component<
  GeneralTodoViewProps,
  GeneralTodoViewState
> {
  private static readonly SHORT_WEEKDAYS: readonly { label: string; value: number }[] = [
    { label: 'Sun', value: 0 },
    { label: 'Mon', value: 1 },
    { label: 'Tue', value: 2 },
    { label: 'Wed', value: 3 },
    { label: 'Thu', value: 4 },
    { label: 'Fri', value: 5 },
    { label: 'Sat', value: 6 },
  ];

  private styles = GeneralTodoViewStyles.styles;
  private voiceInputRef: TextInput | null = null;
  private pressStartTime: number = 0;
  private toastTimeout: ReturnType<typeof setTimeout> | null = null;
  private silenceAutoStopTimeout: ReturnType<typeof setTimeout> | null = null;
  private maxTapSessionTimeout: ReturnType<typeof setTimeout> | null = null;
  private liveTranscriptBuffer: string = '';
  private lastVoiceSessionError: string = '';
  private isTapToSpeakMode: boolean = false;
  private shouldStopOnCurrentPressOut: boolean = false;
  private isFinalizingSpeech: boolean = false;

  // Animation values for the top recording & spinning wheel indicators
  private pulseScaleAnim: Animated.Value = new Animated.Value(1);
  private pulseOpacityAnim: Animated.Value = new Animated.Value(0.8);
  private spinAnim: Animated.Value = new Animated.Value(0);
  private waveAnim1: Animated.Value = new Animated.Value(6);
  private waveAnim2: Animated.Value = new Animated.Value(12);
  private waveAnim3: Animated.Value = new Animated.Value(8);
  private waveAnim4: Animated.Value = new Animated.Value(14);
  private loopPulseAnimation: Animated.CompositeAnimation | null = null;
  private loopSpinAnimation: Animated.CompositeAnimation | null = null;

  // Animation values for the compact glowing voice modal orb
  private modalGlowAnim: Animated.Value = new Animated.Value(0.3);
  private modalGlowScaleAnim: Animated.Value = new Animated.Value(1);
  private loopModalGlowAnimation: Animated.CompositeAnimation | null = null;

  constructor(props: GeneralTodoViewProps) {
    super(props);
    this.state = {
      filterMode: 'active',
      showAddModal: false,
      showEditModal: false,
      showVoiceModal: false,
      searchQuery: '',

      isPressRecording: false,
      isProcessingSpeech: false,
      pressRecordingTranscript: '',
      toastBanner: null,

      voiceRawTranscript: '',
      isVoiceListening: false,
      voiceStatusMessage: '',
      parsedVoicePreview: VoiceCommandNLPService.parseVoiceCommand(''),

      editingTodoId: null,
      formTitle: '',
      formDetails: '',
      formDueDate: '',
      formReminderType: 'none',
      formReminderTime: '09:00',
      formReminderDayOfWeek: 1,
      formReminderDayOfMonth: 1,
      formReminderMonthAndDay: '01-01',
      formReminderCustomDateTime: '',
      formStyleBold: false,
      formStyleItalic: false,
      formStyleColor: '',
    };
  }

  public override componentWillUnmount(): void {
    this.clearVoiceSessionTimers();
    this.stopPulseAnimation();
    this.stopSpinAnimation();
    this.stopModalGlowAnimation();
    VoiceCommandService.stopListeningAndZeroize();
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
  }

  private clearVoiceSessionTimers = (): void => {
    if (this.silenceAutoStopTimeout) {
      clearTimeout(this.silenceAutoStopTimeout);
      this.silenceAutoStopTimeout = null;
    }
    if (this.maxTapSessionTimeout) {
      clearTimeout(this.maxTapSessionTimeout);
      this.maxTapSessionTimeout = null;
    }
  };

  // ----------------- HOLD-TO-RECORD & SPINNER ANIMATIONS -----------------

  private startPulseAnimation = (): void => {
    this.pulseScaleAnim.setValue(1);
    this.pulseOpacityAnim.setValue(0.85);

    const pulseLoop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(this.pulseScaleAnim, {
            toValue: 1.85,
            duration: 900,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(this.pulseScaleAnim, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(this.pulseOpacityAnim, {
            toValue: 0,
            duration: 900,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(this.pulseOpacityAnim, {
            toValue: 0.85,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    const waveLoop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(this.waveAnim1, { toValue: 18, duration: 250, useNativeDriver: false }),
          Animated.timing(this.waveAnim1, { toValue: 6, duration: 250, useNativeDriver: false }),
        ]),
        Animated.sequence([
          Animated.timing(this.waveAnim2, { toValue: 6, duration: 200, useNativeDriver: false }),
          Animated.timing(this.waveAnim2, { toValue: 20, duration: 280, useNativeDriver: false }),
        ]),
        Animated.sequence([
          Animated.timing(this.waveAnim3, { toValue: 22, duration: 270, useNativeDriver: false }),
          Animated.timing(this.waveAnim3, { toValue: 8, duration: 230, useNativeDriver: false }),
        ]),
        Animated.sequence([
          Animated.timing(this.waveAnim4, { toValue: 7, duration: 220, useNativeDriver: false }),
          Animated.timing(this.waveAnim4, { toValue: 19, duration: 260, useNativeDriver: false }),
        ]),
      ])
    );

    this.loopPulseAnimation = Animated.parallel([pulseLoop, waveLoop]);
    this.loopPulseAnimation.start();
  };

  private stopPulseAnimation = (): void => {
    if (this.loopPulseAnimation) {
      this.loopPulseAnimation.stop();
      this.loopPulseAnimation = null;
    }
    this.pulseScaleAnim.setValue(1);
    this.pulseOpacityAnim.setValue(0);
    this.waveAnim1.setValue(6);
    this.waveAnim2.setValue(12);
    this.waveAnim3.setValue(8);
    this.waveAnim4.setValue(14);
  };

  private startSpinAnimation = (): void => {
    this.spinAnim.setValue(0);
    this.loopSpinAnimation = Animated.loop(
      Animated.timing(this.spinAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    this.loopSpinAnimation.start();
  };

  private stopSpinAnimation = (): void => {
    if (this.loopSpinAnimation) {
      this.loopSpinAnimation.stop();
      this.loopSpinAnimation = null;
    }
    this.spinAnim.setValue(0);
  };

  private startModalGlowAnimation = (): void => {
    this.stopModalGlowAnimation();
    this.modalGlowAnim.setValue(0.3);
    this.modalGlowScaleAnim.setValue(1);

    const glowPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(this.modalGlowAnim, {
          toValue: 0.95,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(this.modalGlowAnim, {
          toValue: 0.3,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const ringExpand = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(this.modalGlowScaleAnim, {
            toValue: 1.45,
            duration: 1500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(this.modalGlowScaleAnim, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(this.pulseOpacityAnim, {
            toValue: 0,
            duration: 1500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(this.pulseOpacityAnim, {
            toValue: 0.75,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    const waveLoop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(this.waveAnim1, { toValue: 18, duration: 250, useNativeDriver: false }),
          Animated.timing(this.waveAnim1, { toValue: 6, duration: 250, useNativeDriver: false }),
        ]),
        Animated.sequence([
          Animated.timing(this.waveAnim2, { toValue: 6, duration: 200, useNativeDriver: false }),
          Animated.timing(this.waveAnim2, { toValue: 20, duration: 280, useNativeDriver: false }),
        ]),
        Animated.sequence([
          Animated.timing(this.waveAnim3, { toValue: 22, duration: 270, useNativeDriver: false }),
          Animated.timing(this.waveAnim3, { toValue: 8, duration: 230, useNativeDriver: false }),
        ]),
        Animated.sequence([
          Animated.timing(this.waveAnim4, { toValue: 7, duration: 220, useNativeDriver: false }),
          Animated.timing(this.waveAnim4, { toValue: 19, duration: 260, useNativeDriver: false }),
        ]),
      ])
    );

    this.loopModalGlowAnimation = Animated.parallel([glowPulse, ringExpand, waveLoop]);
    this.loopModalGlowAnimation.start();
  };

  private stopModalGlowAnimation = (): void => {
    if (this.loopModalGlowAnimation) {
      this.loopModalGlowAnimation.stop();
      this.loopModalGlowAnimation = null;
    }
    this.modalGlowAnim.setValue(0.3);
    this.modalGlowScaleAnim.setValue(1);
    this.waveAnim1.setValue(6);
    this.waveAnim2.setValue(12);
    this.waveAnim3.setValue(8);
    this.waveAnim4.setValue(14);
  };

  private showToast = (message: string, type: 'success' | 'info' | 'error' = 'info'): void => {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.setState({ toastBanner: { message, type } });
    this.toastTimeout = setTimeout(() => {
      this.setState({ toastBanner: null });
    }, 4500);
  };

  private scheduleSilenceAutoFinalize = (): void => {
    if (this.silenceAutoStopTimeout) {
      clearTimeout(this.silenceAutoStopTimeout);
    }
    this.silenceAutoStopTimeout = setTimeout(() => {
      if (this.isTapToSpeakMode && this.state.isPressRecording && !this.isFinalizingSpeech) {
        void this.completeVoiceRecordingAndAddTodo(Date.now() - this.pressStartTime);
      }
    }, 1800);
  };

  private handleVoicePressIn = (): void => {
    if (this.isFinalizingSpeech) {
      return;
    }

    // If already listening in Tap-to-Speak mode, a second tap stops and finalizes
    if (this.state.isPressRecording && this.isTapToSpeakMode) {
      this.shouldStopOnCurrentPressOut = true;
      return;
    }

    // If neither Web Speech API nor Native Android Speech Recognition is supported,
    // open the Studio modal for keyboard dictation
    if (
      !VoiceCommandService.isDirectWebSpeechSupported() &&
      !VoiceCommandService.isNativeAndroidSpeechSupported()
    ) {
      this.openVoiceCommandModal();
      return;
    }

    this.clearVoiceSessionTimers();
    this.pressStartTime = Date.now();
    this.liveTranscriptBuffer = '';
    this.lastVoiceSessionError = '';
    this.isTapToSpeakMode = false;
    this.shouldStopOnCurrentPressOut = false;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    this.startPulseAnimation();

    this.setState({
      isPressRecording: true,
      isProcessingSpeech: false,
      pressRecordingTranscript: '',
      toastBanner: null,
    });

    const callbacks = new VoiceRecognitionSessionCallbacks({
      onInterimTranscript: (transcript) => {
        const sanitized = InputSanitizer.sanitizeVoiceTranscript(transcript);
        if (sanitized) {
          this.liveTranscriptBuffer = sanitized;
          this.setState({ pressRecordingTranscript: sanitized });
          if (this.isTapToSpeakMode) {
            this.scheduleSilenceAutoFinalize();
          }
        }
      },
      onFinalTranscript: (transcript) => {
        const sanitized = InputSanitizer.sanitizeVoiceTranscript(transcript);
        if (sanitized) {
          this.liveTranscriptBuffer = sanitized;
          this.setState({ pressRecordingTranscript: sanitized });
          if (this.isTapToSpeakMode) {
            this.scheduleSilenceAutoFinalize();
          }
        }
      },
      onStateChange: () => {},
      onError: (errMsg) => {
        this.lastVoiceSessionError = errMsg;
        this.clearVoiceSessionTimers();
        this.stopPulseAnimation();
        this.stopSpinAnimation();
        this.isTapToSpeakMode = false;
        this.setState({ isPressRecording: false, isProcessingSpeech: false });
        this.showToast(errMsg, 'error');
      },
      onSessionEnd: (finalTranscript, errMsg) => {
        if (VoiceCommandService.isNativeAndroidSpeechSupported()) {
          this.handleAndroidVoiceSessionComplete(finalTranscript, errMsg);
        }
      },
    });

    VoiceCommandService.startListening(callbacks);
  };

  private handleAndroidVoiceSessionComplete = (finalTranscript: string, errorMsg: string): void => {
    this.stopPulseAnimation();
    this.setState({ isPressRecording: false });

    if (errorMsg) {
      this.showToast(errorMsg, 'error');
      return;
    }

    const spokenText = finalTranscript.trim();
    if (!spokenText) {
      return;
    }

    // Start Spinning Wheel Processing Animation while creating To-Do
    this.setState({ isProcessingSpeech: true });
    this.startSpinAnimation();

    setTimeout(async () => {
      this.stopSpinAnimation();
      this.setState({ isProcessingSpeech: false });

      const parsed = VoiceCommandNLPService.parseVoiceCommand(spokenText);
      const cleanTitle = InputSanitizer.sanitizeString(parsed.extractedTitle);

      if (!cleanTitle) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        this.showToast('Could not extract task title. Please try speaking again.', 'error');
        return;
      }

      const todoId = `todo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const reminder = new NotificationReminderConfig(parsed.reminderConfig);

      if (reminder.type !== 'none') {
        const scheduledId = await NotificationReminderService.scheduleReminder(
          todoId,
          cleanTitle,
          reminder
        );
        reminder.notificationId = scheduledId;
      }

      const newTodo = new GeneralTodoItem({
        id: todoId,
        title: cleanTitle,
        details: InputSanitizer.sanitizeString(parsed.extractedDetails),
        dueDate: InputSanitizer.sanitizeString(parsed.dueDate),
        completed: false,
        reminder,
        style: new BlockFormattingStyle({
          bold: false,
          italic: false,
          textColor: '',
        }),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const updated = [newTodo, ...this.props.todos];
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      this.props.onUpdateTodos(updated);

      const reminderLabel = NotificationReminderService.formatReminderLabel(reminder);
      this.showToast(`✓ Added: "${cleanTitle}" (${reminderLabel})`, 'success');
    }, 350);
  };

  private handleVoicePressOut = (): void => {
    if (VoiceCommandService.isNativeAndroidSpeechSupported()) {
      // Native Android Intent manages audio capture duration until user finishes speaking
      return;
    }

    if (!VoiceCommandService.isDirectWebSpeechSupported() || this.isFinalizingSpeech) {
      return;
    }

    if (this.lastVoiceSessionError) {
      this.clearVoiceSessionTimers();
      this.stopPulseAnimation();
      VoiceCommandService.stopListeningAndZeroize();
      this.setState({ isPressRecording: false, isProcessingSpeech: false });
      return;
    }

    const pressDuration = Date.now() - this.pressStartTime;

    // If user tapped quickly (< 450ms) or browser microphone permission dialog interrupted pointer capture
    // before speech arrived, stay open in Tap-to-Speak mode so the user can speak naturally
    if (!this.shouldStopOnCurrentPressOut && pressDuration < 450 && !this.liveTranscriptBuffer.trim()) {
      this.isTapToSpeakMode = true;
      if (this.maxTapSessionTimeout) {
        clearTimeout(this.maxTapSessionTimeout);
      }
      this.maxTapSessionTimeout = setTimeout(() => {
        if (this.state.isPressRecording && !this.isFinalizingSpeech) {
          void this.completeVoiceRecordingAndAddTodo(Date.now() - this.pressStartTime);
        }
      }, 9000);
      return;
    }

    void this.completeVoiceRecordingAndAddTodo(pressDuration);
  };

  private completeVoiceRecordingAndAddTodo = async (pressDuration: number): Promise<void> => {
    if (this.isFinalizingSpeech) {
      return;
    }
    this.isFinalizingSpeech = true;
    this.isTapToSpeakMode = false;
    this.shouldStopOnCurrentPressOut = false;
    this.clearVoiceSessionTimers();
    this.stopPulseAnimation();

    // Start Spinning Wheel Processing Animation while awaiting final recognition flush
    this.setState({ isPressRecording: false, isProcessingSpeech: true });
    this.startSpinAnimation();

    let flushedTranscript = '';
    try {
      flushedTranscript = await VoiceCommandService.stopListeningAndAwaitFinal(2200);
    } catch {
      flushedTranscript = VoiceCommandService.getSessionTranscript();
    }

    const spokenText = (
      flushedTranscript ||
      this.liveTranscriptBuffer ||
      this.state.pressRecordingTranscript
    ).trim();
    const sessionError = this.lastVoiceSessionError || VoiceCommandService.getLastSessionError();

    this.stopSpinAnimation();
    VoiceCommandService.stopListeningAndZeroize();
    this.liveTranscriptBuffer = '';
    this.isFinalizingSpeech = false;
    this.setState({ isProcessingSpeech: false, pressRecordingTranscript: '' });

    if (!spokenText) {
      if (sessionError) {
        this.showToast(sessionError, 'error');
        return;
      }

      if (pressDuration < 350) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        this.showToast(
          '💡 Hold or tap 🎙️ and speak your task (e.g. "Add a todo to send money to mom on every Monday")',
          'info'
        );
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      this.showToast(
        'No speech detected. Hold or tap 🎙️ while speaking clearly, or use Studio.',
        'error'
      );
      return;
    }

    // Parse the spoken voice command locally & safely
    const parsed = VoiceCommandNLPService.parseVoiceCommand(spokenText);
    const cleanTitle = InputSanitizer.sanitizeString(parsed.extractedTitle);

    if (!cleanTitle) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      this.showToast('Could not extract task title. Please try speaking again.', 'error');
      return;
    }

    // Auto-fill review/edit modal with voice data features (title, details, frequency, days, times)
    // so the user can verify, edit, and confirm before adding
    const r = parsed.reminderConfig;
    const initialDetails =
      parsed.extractedDetails && parsed.extractedDetails !== 'Created via On-Device Voice Command'
        ? parsed.extractedDetails
        : '';

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    this.setState({
      showAddModal: true,
      showEditModal: false,
      showVoiceModal: false,
      editingTodoId: null,
      formTitle: cleanTitle,
      formDetails: InputSanitizer.sanitizeString(initialDetails),
      formDueDate: InputSanitizer.sanitizeString(parsed.dueDate),
      formReminderType: r.type,
      formReminderTime: r.time || '09:00',
      formReminderDayOfWeek: typeof r.dayOfWeek === 'number' ? r.dayOfWeek : 1,
      formReminderDayOfMonth: r.dayOfMonth || 1,
      formReminderMonthAndDay: r.monthAndDay || '01-01',
      formReminderCustomDateTime:
        r.customDateTime || (parsed.dueDate ? `${parsed.dueDate}T${r.time || '09:00'}` : ''),
      formStyleBold: false,
      formStyleItalic: false,
      formStyleColor: '',
    });
  };

  // ----------------- TRADITIONAL MODAL WORKFLOWS -----------------

  private handleToggleTodo = (todo: GeneralTodoItem): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const nextCompleted = !todo.completed;

    if (nextCompleted) {
      // Cancel pending push reminder so completed items don't trigger alarms
      NotificationReminderService.cancelReminder(todo.id, todo.reminder?.notificationId);
    } else if (todo.reminder && todo.reminder.type !== 'none') {
      // Restore push reminder when reactivated
      NotificationReminderService.scheduleReminder(todo.id, todo.title, todo.reminder).then((newId) => {
        if (newId && todo.reminder) {
          todo.reminder.notificationId = newId;
        }
      });
    }

    const updated = this.props.todos.map((t) => {
      if (t.id === todo.id) {
        return new GeneralTodoItem({
          ...t,
          completed: nextCompleted,
          completedAt: nextCompleted ? Date.now() : undefined,
          updatedAt: Date.now(),
        });
      }
      return t;
    });
    this.props.onUpdateTodos(updated);
  };

  private openAddModal = (): void => {
    this.setState({
      editingTodoId: null,
      formTitle: '',
      formDetails: '',
      formDueDate: '',
      formReminderType: 'none',
      formReminderTime: '09:00',
      formReminderDayOfWeek: 1,
      formReminderDayOfMonth: 1,
      formReminderMonthAndDay: '01-01',
      formReminderCustomDateTime: '',
      formStyleBold: false,
      formStyleItalic: false,
      formStyleColor: '',
      showAddModal: true,
      showEditModal: false,
      showVoiceModal: false,
    });
  };

  private openVoiceCommandModal = (): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    this.setState(
      {
        showVoiceModal: true,
        showAddModal: false,
        showEditModal: false,
        voiceRawTranscript: '',
        voiceStatusMessage: 'Listening on-device... Speak your task.',
        parsedVoicePreview: VoiceCommandNLPService.parseVoiceCommand(''),
      },
      () => {
        this.startOnDeviceVoiceCapture();
      }
    );
  };

  private closeVoiceCommandModal = (): void => {
    this.stopModalGlowAnimation();
    VoiceCommandService.stopListeningAndZeroize();
    this.setState({
      showVoiceModal: false,
      isVoiceListening: false,
      voiceRawTranscript: '',
      voiceStatusMessage: '',
      parsedVoicePreview: VoiceCommandNLPService.parseVoiceCommand(''),
    });
  };

  private handleToggleModalVoiceRecording = (): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (this.state.isVoiceListening) {
      VoiceCommandService.stopListeningAndZeroize();
      this.stopModalGlowAnimation();
      this.setState({ isVoiceListening: false });
    } else {
      this.startOnDeviceVoiceCapture();
    }
  };

  private startOnDeviceVoiceCapture = (): void => {
    this.startModalGlowAnimation();
    const callbacks = new VoiceRecognitionSessionCallbacks({
      onInterimTranscript: (transcript) => {
        this.handleVoiceTranscriptChange(transcript);
      },
      onFinalTranscript: (transcript) => {
        this.handleVoiceTranscriptChange(transcript);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      onStateChange: (isListening) => {
        this.setState({ isVoiceListening: isListening });
        if (isListening) {
          this.startModalGlowAnimation();
        } else {
          this.stopModalGlowAnimation();
        }
      },
      onError: (msg) => {
        this.stopModalGlowAnimation();
        this.setState({ voiceStatusMessage: msg, isVoiceListening: false });
      },
    });

    VoiceCommandService.startListening(callbacks);
  };

  private handleVoiceTranscriptChange = (rawText: string): void => {
    const sanitized = InputSanitizer.sanitizeVoiceTranscript(rawText);
    const parsed = VoiceCommandNLPService.parseVoiceCommand(sanitized);
    this.setState({
      voiceRawTranscript: rawText.slice(0, InputSanitizer.MAX_VOICE_COMMAND_LENGTH),
      parsedVoicePreview: parsed,
    });
  };

  private handleCreateTodoFromVoice = (): void => {
    this.handleCustomizeVoiceInEditor();
  };

  private handleCustomizeVoiceInEditor = (): void => {
    const { parsedVoicePreview } = this.state;
    const cleanTitle = InputSanitizer.sanitizeString(parsedVoicePreview.extractedTitle);
    if (!cleanTitle) {
      Alert.alert(
        'Voice Command Empty',
        'Please speak a command first (for example: "Add a todo to send money to mom on every Monday").'
      );
      return;
    }
    const r = parsedVoicePreview.reminderConfig;
    VoiceCommandService.stopListeningAndZeroize();

    const initialDetails =
      parsedVoicePreview.extractedDetails &&
      parsedVoicePreview.extractedDetails !== 'Created via On-Device Voice Command'
        ? parsedVoicePreview.extractedDetails
        : '';

    this.setState({
      showVoiceModal: false,
      isVoiceListening: false,
      voiceRawTranscript: '',
      editingTodoId: null,
      formTitle: cleanTitle,
      formDetails: InputSanitizer.sanitizeString(initialDetails),
      formDueDate: InputSanitizer.sanitizeString(parsedVoicePreview.dueDate),
      formReminderType: r.type,
      formReminderTime: r.time || '09:00',
      formReminderDayOfWeek: typeof r.dayOfWeek === 'number' ? r.dayOfWeek : 1,
      formReminderDayOfMonth: r.dayOfMonth || 1,
      formReminderMonthAndDay: r.monthAndDay || '01-01',
      formReminderCustomDateTime:
        r.customDateTime || (parsedVoicePreview.dueDate ? `${parsedVoicePreview.dueDate}T${r.time || '09:00'}` : ''),
      formStyleBold: false,
      formStyleItalic: false,
      formStyleColor: '',
      showAddModal: true,
    });
  };

  private openEditModal = (todo: GeneralTodoItem): void => {
    const s = todo.style || new BlockFormattingStyle();
    const r = todo.reminder || new NotificationReminderConfig();

    this.setState({
      editingTodoId: todo.id,
      formTitle: todo.title,
      formDetails: todo.details || '',
      formDueDate: todo.dueDate || '',
      formReminderType: r.type,
      formReminderTime: r.time || '09:00',
      formReminderDayOfWeek: typeof r.dayOfWeek === 'number' ? r.dayOfWeek : 1,
      formReminderDayOfMonth: r.dayOfMonth || 1,
      formReminderMonthAndDay: r.monthAndDay || '01-01',
      formReminderCustomDateTime: r.customDateTime || '',
      formStyleBold: Boolean(s.bold),
      formStyleItalic: Boolean(s.italic),
      formStyleColor: s.textColor || '',
      showEditModal: true,
      showAddModal: false,
      showVoiceModal: false,
    });
  };

  private handleCreateTodo = async (): Promise<void> => {
    if (!this.state.formTitle.trim()) {
      Alert.alert('Required', 'Please enter a title for the to-do item.');
      return;
    }

    const todoId = `todo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const reminder = new NotificationReminderConfig({
      type: this.state.formReminderType,
      time: this.state.formReminderTime,
      dayOfWeek: this.state.formReminderDayOfWeek,
      dayOfMonth: this.state.formReminderDayOfMonth,
      monthAndDay: this.state.formReminderMonthAndDay,
      customDateTime: this.state.formReminderCustomDateTime,
    });

    if (reminder.type !== 'none') {
      const scheduledId = await NotificationReminderService.scheduleReminder(
        todoId,
        this.state.formTitle,
        reminder
      );
      reminder.notificationId = scheduledId;
    }

    const newTodo = new GeneralTodoItem({
      id: todoId,
      title: InputSanitizer.sanitizeString(this.state.formTitle),
      details: InputSanitizer.sanitizeString(this.state.formDetails),
      dueDate: InputSanitizer.sanitizeString(this.state.formDueDate),
      completed: false,
      reminder,
      style: new BlockFormattingStyle({
        bold: this.state.formStyleBold,
        italic: this.state.formStyleItalic,
        textColor: InputSanitizer.sanitizeColorHex(this.state.formStyleColor, ''),
      }),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const updated = [newTodo, ...this.props.todos];
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    this.props.onUpdateTodos(updated);
    this.setState({ showAddModal: false });
    const reminderLabel = NotificationReminderService.formatReminderLabel(reminder);
    this.showToast(`✓ Added: "${newTodo.title}" (${reminderLabel})`, 'success');
  };

  private handleUpdateTodo = async (): Promise<void> => {
    if (!this.state.editingTodoId || !this.state.formTitle.trim()) return;

    const todoId = this.state.editingTodoId;
    const reminder = new NotificationReminderConfig({
      type: this.state.formReminderType,
      time: this.state.formReminderTime,
      dayOfWeek: this.state.formReminderDayOfWeek,
      dayOfMonth: this.state.formReminderDayOfMonth,
      monthAndDay: this.state.formReminderMonthAndDay,
      customDateTime: this.state.formReminderCustomDateTime,
    });

    await NotificationReminderService.cancelReminder(todoId);
    if (reminder.type !== 'none') {
      const scheduledId = await NotificationReminderService.scheduleReminder(
        todoId,
        this.state.formTitle,
        reminder
      );
      reminder.notificationId = scheduledId;
    }

    const updated = this.props.todos.map((t) => {
      if (t.id === todoId) {
        return new GeneralTodoItem({
          ...t,
          title: InputSanitizer.sanitizeString(this.state.formTitle),
          details: InputSanitizer.sanitizeString(this.state.formDetails),
          dueDate: InputSanitizer.sanitizeString(this.state.formDueDate),
          reminder,
          style: new BlockFormattingStyle({
            bold: this.state.formStyleBold,
            italic: this.state.formStyleItalic,
            textColor: InputSanitizer.sanitizeColorHex(this.state.formStyleColor, ''),
          }),
          updatedAt: Date.now(),
        });
      }
      return t;
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    this.props.onUpdateTodos(updated);
    this.setState({ showEditModal: false, editingTodoId: null });
  };

  private handleDeleteTodo = (todoId: string, title: string): void => {
    Alert.alert(
      'Delete To-Do',
      `Delete "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await NotificationReminderService.cancelReminder(todoId);
            const updated = this.props.todos.filter((t) => t.id !== todoId);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
            this.props.onUpdateTodos(updated);
          },
        },
      ]
    );
  };

  public override render() {
    const { palette, metrics } = this.props;
    const {
      filterMode,
      searchQuery,
      showAddModal,
      showEditModal,
      showVoiceModal,
      isPressRecording,
      isProcessingSpeech,
      pressRecordingTranscript,
      toastBanner,
      voiceRawTranscript,
      isVoiceListening,
      voiceStatusMessage,
      parsedVoicePreview,
    } = this.state;
    const q = searchQuery.trim().toLowerCase();

    const filtered = this.props.todos.filter((t) => {
      // 1. Status Filter
      if (filterMode === 'active' && t.completed) return false;
      if (filterMode === 'finished' && !t.completed) return false;

      // 2. Search Query
      if (q) {
        const titleMatch = t.title.toLowerCase().includes(q);
        const detailsMatch = Boolean(t.details && t.details.toLowerCase().includes(q));
        const dueMatch = Boolean(t.dueDate && t.dueDate.toLowerCase().includes(q));
        return titleMatch || detailsMatch || dueMatch;
      }
      return true;
    });

    const activeCount = this.props.todos.filter((t) => !t.completed).length;
    const finishedCount = this.props.todos.filter((t) => t.completed).length;
    const parsedReminderLabel = NotificationReminderService.formatReminderLabel(
      parsedVoicePreview.reminderConfig
    );

    const spinRotation = this.spinAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <View
        style={[
          this.styles.container,
          {
            maxWidth: metrics.maxContainerWidth,
            alignSelf: 'center',
            width: '100%',
            paddingHorizontal: metrics.horizontalPadding,
          },
        ]}
      >
        {/* Toast Banner for Immediate Confirmation */}
        {toastBanner && (
          <View
            style={[
              this.styles.toastContainer,
              {
                backgroundColor:
                  toastBanner.type === 'success'
                    ? palette.accent
                    : toastBanner.type === 'error'
                    ? palette.danger
                    : palette.surface,
                borderColor: palette.glassBorder,
              },
            ]}
          >
            <Text
              style={[
                this.styles.toastText,
                { color: toastBanner.type === 'success' ? palette.accentContrast : palette.textPrimary },
              ]}
            >
              {toastBanner.message}
            </Text>
          </View>
        )}

        {/* Top Header & Voice Button with Recording & Spinning Wheel Animations */}
        <View style={this.styles.topRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={[this.styles.titleHeading, { color: palette.textPrimary }]}>
              General To-Dos
            </Text>
            <Text style={[this.styles.subHeading, { color: palette.textSecondary }]}>
              {activeCount} active • {finishedCount} completed
            </Text>
          </View>

          <View style={this.styles.headerButtonsRow}>
            {/* Manual New Task Button */}
            <TouchableOpacity
              onPress={this.openAddModal}
              style={[this.styles.addBtn, { backgroundColor: palette.accent }]}
            >
              <Text style={[this.styles.addBtnText, { color: palette.accentContrast }]}>+ New</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter Pills */}
        <View style={this.styles.filterPillsRow}>
          {(
            [
              { id: 'active', label: `Active (${activeCount})` },
              { id: 'finished', label: `Finished (${finishedCount})` },
              { id: 'all', label: `All (${this.props.todos.length})` },
            ] as const
          ).map((pill) => (
            <TouchableOpacity
              key={pill.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                this.setState({ filterMode: pill.id });
              }}
              style={[
                this.styles.filterPill,
                {
                  backgroundColor:
                    filterMode === pill.id ? palette.accent : palette.glassElevated,
                  borderColor: filterMode === pill.id ? palette.accent : palette.glassBorder,
                },
              ]}
            >
              <Text
                style={[
                  this.styles.filterPillText,
                  { color: filterMode === pill.id ? palette.accentContrast : palette.textSecondary },
                ]}
              >
                {pill.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search */}
        <TextInput
          style={[
            this.styles.searchInput,
            {
              backgroundColor: palette.cardBackground,
              borderColor: palette.cardBorder,
              color: palette.textPrimary,
            },
          ]}
          value={searchQuery}
          onChangeText={(txt) => this.setState({ searchQuery: txt })}
          placeholder="Filter to-dos or due dates..."
          placeholderTextColor={palette.textMuted}
        />

        {/* Tasks List */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          contentContainerStyle={{
            paddingBottom: (this.props.isKeyboardVisible ? (this.props.keyboardHeight || 300) + 120 : 120) + metrics.safeBottomInset,
          }}
        >
          {filtered.length === 0 ? (
            <View style={[this.styles.emptyStateCard, { backgroundColor: palette.cardBackground, borderColor: palette.cardBorder }]}>
              <Text style={this.styles.emptyStateIcon}>✨</Text>
              <Text style={[this.styles.emptyStateHeading, { color: palette.textPrimary }]}>
                {filterMode === 'active'
                  ? 'All Clear & Focused'
                  : filterMode === 'finished'
                  ? 'No Finished Tasks Yet'
                  : 'No To-Dos Found'}
              </Text>
              <Text style={[this.styles.emptyStateText, { color: palette.textSecondary }]}>
                {filterMode === 'active'
                  ? 'You have cleared all pending priorities. Take a moment to reflect or capture a new task.'
                  : filterMode === 'finished'
                  ? 'Completed tasks will be archived here with strikethrough.'
                  : 'Try adjusting your search query or add a new to-do.'}
              </Text>
              {filterMode === 'active' && (
                <TouchableOpacity
                  onPress={this.openAddModal}
                  hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                  style={[this.styles.emptyStateActionBtn, { backgroundColor: palette.accent }]}
                >
                  <Text style={[this.styles.emptyStateActionText, { color: palette.accentContrast }]}>+ Create Priority</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filtered.map((todo) => {
              const reminderLabel = NotificationReminderService.formatReminderLabel(todo.reminder);
              const customStyle = todo.style || new BlockFormattingStyle();
              const isOverdue =
                !todo.completed &&
                !!todo.dueDate &&
                todo.dueDate < DailyDiaryService.getTodayDateKey();

              return (
                <View
                  key={todo.id}
                  style={[
                    this.styles.todoCard,
                    {
                      backgroundColor: palette.cardBackground,
                      borderColor: isOverdue ? palette.danger + '55' : palette.cardBorder,
                      opacity: todo.completed ? 0.72 : 1.0,
                    },
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => this.handleToggleTodo(todo)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: todo.completed }}
                    accessibilityLabel={`Mark "${todo.title}" as ${todo.completed ? 'active' : 'completed'}`}
                    style={[
                      this.styles.checkbox,
                      {
                        borderColor: todo.completed ? palette.accent : isOverdue ? palette.danger : palette.border,
                        backgroundColor: todo.completed ? palette.accent : 'transparent',
                      },
                    ]}
                  >
                    {todo.completed && <Text style={[this.styles.checkmark, { color: palette.accentContrast }]}>✓</Text>}
                  </TouchableOpacity>

                  <View style={this.styles.todoDetails}>
                    <Text
                      style={[
                        this.styles.todoTitle,
                        {
                          color: todo.completed
                            ? palette.textMuted
                            : customStyle.textColor || palette.textPrimary,
                          textDecorationLine: todo.completed ? 'line-through' : 'none',
                          fontWeight: customStyle.bold ? '700' : '500',
                          fontStyle: customStyle.italic ? 'italic' : 'normal',
                        },
                      ]}
                    >
                      {todo.title}
                    </Text>

                    {Boolean(todo.details) && (
                      <Text
                        style={[
                          this.styles.todoDesc,
                          {
                            color: palette.textSecondary,
                            textDecorationLine: todo.completed ? 'line-through' : 'none',
                          },
                        ]}
                      >
                        {todo.details}
                      </Text>
                    )}

                    <View style={this.styles.metaRow}>
                      {Boolean(todo.dueDate) && (
                        <View
                          style={[
                            this.styles.dueDatePill,
                            {
                              backgroundColor: isOverdue ? 'rgba(248, 113, 113, 0.15)' : palette.glassElevated,
                              borderColor: isOverdue ? palette.danger : 'transparent',
                              borderWidth: isOverdue ? 1 : 0,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              this.styles.dueDateText,
                              {
                                color: isOverdue ? palette.danger : palette.accent,
                                fontWeight: isOverdue ? '700' : '500',
                              },
                            ]}
                          >
                            {isOverdue ? '⚠️ Overdue: ' : '⏳ Due: '}
                            {todo.dueDate}
                          </Text>
                        </View>
                      )}

                      {todo.reminder && todo.reminder.type !== 'none' && (
                        <View
                          style={[this.styles.reminderPill, { backgroundColor: palette.calloutBg }]}
                        >
                          <Text style={[this.styles.reminderText, { color: palette.accent }]}>
                            🔔 {reminderLabel}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Actions: Edit & Delete */}
                  <View style={this.styles.actionsColumn}>
                    <TouchableOpacity
                      onPress={() => this.openEditModal(todo)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Edit task"
                      style={this.styles.actionIconBtn}
                    >
                      <Text style={[this.styles.actionIconText, { color: palette.textSecondary }]}>
                        ✎
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => this.handleDeleteTodo(todo.id, todo.title)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Delete task"
                      style={this.styles.actionIconBtn}
                    >
                      <Text style={[this.styles.actionIconText, { color: palette.danger }]}>
                        🗑
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Floating Tactile Voice Command Button Anchored Above Bottom Navigation Bar */}
        <View
          style={[
            this.styles.floatingVoiceContainer,
            {
              bottom: metrics.safeBottomInset + 76,
              right: metrics.horizontalPadding + 8,
            },
          ]}
        >
          {/* Concentric Radar Pulse Ring Animation (While Pressing & Listening) */}
          {isPressRecording && (
            <Animated.View
              pointerEvents="none"
              style={[
                this.styles.pulseRing,
                {
                  borderColor: palette.accent,
                  transform: [{ scale: this.pulseScaleAnim }],
                  opacity: this.pulseOpacityAnim,
                },
              ]}
            />
          )}

          {/* Glowing Spinning Wheel Animation Ring (While Processing Speech) */}
          {isProcessingSpeech && (
            <Animated.View
              pointerEvents="none"
              style={[
                this.styles.spinningRing,
                {
                  borderColor: palette.accent,
                  borderTopColor: 'transparent',
                  transform: [{ rotate: spinRotation }],
                },
              ]}
            />
          )}

          {/* Floating Live Recording HUD Pill (While Pressing & Listening) */}
          {isPressRecording && (
            <View
              style={[
                this.styles.recordingFloatingHud,
                {
                  backgroundColor: palette.cardBackground,
                  borderColor: palette.accent,
                },
              ]}
            >
              <View style={this.styles.hudWavesRow}>
                <Animated.View
                  style={[
                    this.styles.hudWaveBar,
                    { height: this.waveAnim1, backgroundColor: palette.accent },
                  ]}
                />
                <Animated.View
                  style={[
                    this.styles.hudWaveBar,
                    { height: this.waveAnim2, backgroundColor: palette.accent },
                  ]}
                />
                <Animated.View
                  style={[
                    this.styles.hudWaveBar,
                    { height: this.waveAnim3, backgroundColor: palette.accent },
                  ]}
                />
                <Animated.View
                  style={[
                    this.styles.hudWaveBar,
                    { height: this.waveAnim4, backgroundColor: palette.accent },
                  ]}
                />
              </View>

              <View style={{ flexShrink: 1 }}>
                <Text style={[this.styles.hudTitleText, { color: palette.accent }]}>
                  🎙️ LISTENING... (RELEASE OR TAP TO ADD)
                </Text>
                <Text
                  numberOfLines={2}
                  style={[this.styles.hudTranscriptText, { color: palette.textPrimary }]}
                >
                  {pressRecordingTranscript || 'Speak your task (e.g. "Send money to mom on every Monday")'}
                </Text>
              </View>
            </View>
          )}

          {/* Floating Processing Speech HUD Pill with Mini Spinner (While Processing) */}
          {isProcessingSpeech && (
            <View
              style={[
                this.styles.recordingFloatingHud,
                {
                  backgroundColor: palette.cardBackground,
                  borderColor: palette.accent,
                },
              ]}
            >
              <Animated.View
                style={[
                  this.styles.spinnerWheelMini,
                  {
                    borderColor: palette.accent,
                    borderTopColor: 'transparent',
                    transform: [{ rotate: spinRotation }],
                  },
                ]}
              />
              <View style={{ flexShrink: 1, marginLeft: 10 }}>
                <Text style={[this.styles.hudTitleText, { color: palette.accent }]}>
                  ⏳ PROCESSING SPEECH...
                </Text>
                <Text
                  numberOfLines={2}
                  style={[this.styles.hudTranscriptText, { color: palette.textPrimary }]}
                >
                  {this.liveTranscriptBuffer || pressRecordingTranscript || 'Adding to-do item...'}
                </Text>
              </View>
            </View>
          )}

          {/* The Tactile Voice Icon Button */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPressIn={this.handleVoicePressIn}
            onPressOut={this.handleVoicePressOut}
            onLongPress={() => {}}
            style={[
              this.styles.voiceIconButton,
              {
                backgroundColor: isPressRecording || isProcessingSpeech ? palette.accent : palette.glassElevated,
                borderColor: palette.accent,
              },
            ]}
          >
            <Text
              style={[
                this.styles.voiceIconEmoji,
                { color: isPressRecording || isProcessingSpeech ? palette.accentContrast : palette.accent },
              ]}
            >
              {isProcessingSpeech ? '⏳' : '🎙️'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ----------------- COMPACT GLOWING CIRCLE VOICE COMMAND MODAL ----------------- */}
        <Modal visible={showVoiceModal} transparent animationType="fade">
          <View style={this.styles.voiceModalBackdrop}>
            {/* Backdrop touch area to cancel */}
            <TouchableOpacity
              activeOpacity={1}
              onPress={this.closeVoiceCommandModal}
              style={StyleSheet.absoluteFill}
            />

            <View
              style={[
                this.styles.voiceModalPod,
                {
                  backgroundColor: palette.cardBackground,
                  borderColor: isVoiceListening ? palette.accent : palette.border,
                  shadowColor: palette.accent,
                },
              ]}
            >
              {/* Close Button */}
              <TouchableOpacity
                onPress={this.closeVoiceCommandModal}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={[this.styles.voicePodCloseBtn, { backgroundColor: palette.glassElevated }]}
                accessibilityRole="button"
                accessibilityLabel="Close voice modal"
              >
                <Text style={[this.styles.voicePodCloseText, { color: palette.textSecondary }]}>✕</Text>
              </TouchableOpacity>

              {/* Status Header */}
              <View style={this.styles.voicePodStatusRow}>
                <View
                  style={[
                    this.styles.voicePodStatusDot,
                    { backgroundColor: isVoiceListening ? palette.accent : palette.textMuted },
                  ]}
                />
                <Text
                  style={[
                    this.styles.voicePodStatusText,
                    { color: isVoiceListening ? palette.accent : palette.textSecondary },
                  ]}
                >
                  {isVoiceListening ? 'Listening...' : 'Tap Mic to Speak'}
                </Text>
              </View>

              {/* Glowing Mic Orb Container */}
              <View style={this.styles.voiceOrbWrapper}>
                {/* Outermost Expanding Glowing Pulse Ring */}
                {isVoiceListening && (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      this.styles.voiceModalPulseRing,
                      {
                        borderColor: palette.accent,
                        transform: [{ scale: this.modalGlowScaleAnim }],
                        opacity: this.pulseOpacityAnim,
                      },
                    ]}
                  />
                )}

                {/* Concentric Breathing Glow Halo */}
                {isVoiceListening && (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      this.styles.voiceModalOuterHalo,
                      {
                        backgroundColor: palette.accent,
                        opacity: this.modalGlowAnim,
                        transform: [{ scale: 1.18 }],
                      },
                    ]}
                  />
                )}

                {/* The Central Circular Tactile Mic Orb */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={this.handleToggleModalVoiceRecording}
                  style={[
                    this.styles.voiceRecordOrb,
                    {
                      backgroundColor: isVoiceListening ? palette.accent : palette.surface,
                      borderColor: palette.accent,
                      shadowColor: palette.accent,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Toggle voice recording"
                >
                  <Text style={this.styles.voiceOrbEmoji}>
                    {isVoiceListening ? '🎙️' : '🎤'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Live Soundwave Bars while Recording */}
              {isVoiceListening && (
                <View style={this.styles.hudWavesRow}>
                  <Animated.View
                    style={[
                      this.styles.hudWaveBar,
                      { height: this.waveAnim1, backgroundColor: palette.accent },
                    ]}
                  />
                  <Animated.View
                    style={[
                      this.styles.hudWaveBar,
                      { height: this.waveAnim2, backgroundColor: palette.accent },
                    ]}
                  />
                  <Animated.View
                    style={[
                      this.styles.hudWaveBar,
                      { height: this.waveAnim3, backgroundColor: palette.accent },
                    ]}
                  />
                  <Animated.View
                    style={[
                      this.styles.hudWaveBar,
                      { height: this.waveAnim4, backgroundColor: palette.accent },
                    ]}
                  />
                </View>
              )}

              {/* Live Spoken Transcript Preview */}
              <View
                style={[
                  this.styles.voicePodTranscriptBox,
                  {
                    backgroundColor: palette.surface,
                    borderColor: voiceRawTranscript ? palette.accent : palette.border,
                  },
                ]}
              >
                <Text
                  numberOfLines={2}
                  style={[
                    this.styles.voicePodTranscriptText,
                    { color: voiceRawTranscript ? palette.textPrimary : palette.textMuted },
                  ]}
                >
                  {voiceRawTranscript || 'Speak your task (e.g. "Send money to mom every Monday")'}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={this.styles.voicePodActionsRow}>
                {Boolean(parsedVoicePreview.extractedTitle) ? (
                  <>
                    <TouchableOpacity
                      onPress={this.handleCustomizeVoiceInEditor}
                      style={[
                        this.styles.voicePodCancelBtn,
                        { borderColor: palette.border, backgroundColor: palette.glassElevated },
                      ]}
                    >
                      <Text style={[this.styles.voicePodCancelBtnText, { color: palette.textSecondary }]}>
                        Edit
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={this.handleCreateTodoFromVoice}
                      style={[this.styles.voicePodAddBtn, { backgroundColor: palette.accent }]}
                    >
                      <Text style={[this.styles.voicePodAddBtnText, { color: palette.accentContrast }]}>✓ Add To-Do</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    onPress={this.closeVoiceCommandModal}
                    style={[
                      this.styles.voicePodCancelBtn,
                      { borderColor: palette.border, backgroundColor: palette.glassElevated },
                    ]}
                  >
                    <Text style={[this.styles.voicePodCancelBtnText, { color: palette.textMuted }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>

        {/* ----------------- MODAL: CREATE / EDIT TO-DO ----------------- */}
        <Modal visible={showAddModal || showEditModal} transparent animationType="slide">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={this.styles.modalBackdrop}
          >
            <View
              style={[
                this.styles.modalSheet,
                { backgroundColor: palette.surface, borderColor: palette.border },
              ]}
            >
              {/* Header Bar */}
              <View style={this.styles.modalHeaderRow}>
                <Text style={[this.styles.modalTitleText, { color: palette.textPrimary }]}>
                  {showEditModal ? 'Edit To-Do' : 'To-Do Details'}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    this.setState({
                      showAddModal: false,
                      showEditModal: false,
                      editingTodoId: null,
                    })
                  }
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={[this.styles.modalCloseBtn, { backgroundColor: palette.glassElevated }]}
                >
                  <Text style={[this.styles.modalCloseBtnText, { color: palette.textSecondary }]}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 16 }}
              >
                <TextInput
                style={[
                  this.styles.modalInput,
                  {
                    backgroundColor: palette.cardBackground,
                    color: palette.textPrimary,
                    borderColor: palette.cardBorder,
                    fontWeight: '600',
                  },
                ]}
                value={this.state.formTitle}
                onChangeText={(txt) => this.setState({ formTitle: txt })}
                placeholder="Task title..."
                placeholderTextColor={palette.textMuted}
              />

              <TextInput
                multiline
                numberOfLines={2}
                style={[
                  this.styles.modalInput,
                  {
                    backgroundColor: palette.cardBackground,
                    color: palette.textPrimary,
                    borderColor: palette.cardBorder,
                    minHeight: 52,
                  },
                ]}
                value={this.state.formDetails}
                onChangeText={(txt) => this.setState({ formDetails: txt })}
                placeholder="Optional notes or details..."
                placeholderTextColor={palette.textMuted}
              />

              <TextInput
                style={[
                  this.styles.modalInput,
                  {
                    backgroundColor: palette.cardBackground,
                    color: palette.textPrimary,
                    borderColor: palette.cardBorder,
                  },
                ]}
                value={this.state.formDueDate}
                onChangeText={(txt) => this.setState({ formDueDate: txt })}
                placeholder="Done before date (optional YYYY-MM-DD)..."
                placeholderTextColor={palette.textMuted}
              />

              {/* Text Styling Options */}
              <View style={this.styles.styleButtonsRow}>
                <TouchableOpacity
                  onPress={() => this.setState({ formStyleBold: !this.state.formStyleBold })}
                  style={[
                    this.styles.stylePill,
                    {
                      backgroundColor: this.state.formStyleBold
                        ? palette.accent
                        : palette.glassElevated,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: this.state.formStyleBold ? palette.accentContrast : palette.textPrimary,
                      fontWeight: '700',
                    }}
                  >
                    Bold
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => this.setState({ formStyleItalic: !this.state.formStyleItalic })}
                  style={[
                    this.styles.stylePill,
                    {
                      backgroundColor: this.state.formStyleItalic
                        ? palette.accent
                        : palette.glassElevated,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: this.state.formStyleItalic ? palette.accentContrast : palette.textPrimary,
                      fontStyle: 'italic',
                    }}
                  >
                    Italic
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Streamlined Recurrence / Frequency Selector (No Clutter Headings) */}
              <View style={this.styles.recurrenceRow}>
                {[
                  { id: 'none', label: 'None' },
                  { id: 'daily', label: 'Daily' },
                  { id: 'weekly', label: 'Weekly' },
                  { id: 'monthly', label: 'Monthly' },
                  { id: 'custom', label: 'Specific Date' },
                  { id: 'annually', label: 'Annually' },
                ].map((item) => {
                  const selected = this.state.formReminderType === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => this.setState({ formReminderType: item.id as any })}
                      style={[
                        this.styles.recurrencePill,
                        {
                          backgroundColor: selected ? palette.accent : palette.glassElevated,
                          borderColor: selected ? palette.accent : palette.glassBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          this.styles.recurrencePillText,
                          {
                            color: selected ? palette.accentContrast : palette.textPrimary,
                          },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Reminder Details inputs */}
              {this.state.formReminderType !== 'none' && (
                <View style={this.styles.reminderInputsArea}>
                  {this.state.formReminderType === 'daily' && (
                    <TextInput
                      style={[
                        this.styles.modalInput,
                        {
                          backgroundColor: palette.cardBackground,
                          color: palette.textPrimary,
                          borderColor: palette.cardBorder,
                        },
                      ]}
                      value={this.state.formReminderTime}
                      onChangeText={(txt) => this.setState({ formReminderTime: txt })}
                      placeholder="Time (HH:mm, e.g. 09:30)..."
                      placeholderTextColor={palette.textMuted}
                    />
                  )}

                  {this.state.formReminderType === 'weekly' && (
                    <View>
                      <View style={this.styles.weekdayPickerRow}>
                        {GeneralTodoView.SHORT_WEEKDAYS.map((day) => {
                          const selected = this.state.formReminderDayOfWeek === day.value;
                          return (
                            <TouchableOpacity
                              key={day.value}
                              onPress={() => this.setState({ formReminderDayOfWeek: day.value })}
                              style={[
                                this.styles.weekdayChip,
                                {
                                  backgroundColor: selected
                                    ? palette.accent
                                    : palette.glassElevated,
                                  borderColor: selected ? palette.accent : palette.glassBorder,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  this.styles.weekdayChipText,
                                  { color: selected ? palette.accentContrast : palette.textPrimary },
                                ]}
                              >
                                {day.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <TextInput
                        style={[
                          this.styles.modalInput,
                          {
                            backgroundColor: palette.cardBackground,
                            color: palette.textPrimary,
                            borderColor: palette.cardBorder,
                          },
                        ]}
                        value={this.state.formReminderTime}
                        onChangeText={(txt) => this.setState({ formReminderTime: txt })}
                        placeholder="Time (HH:mm, e.g. 09:00)..."
                        placeholderTextColor={palette.textMuted}
                      />
                    </View>
                  )}

                  {this.state.formReminderType === 'monthly' && (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TextInput
                        style={[
                          this.styles.modalInput,
                          {
                            flex: 1,
                            backgroundColor: palette.cardBackground,
                            color: palette.textPrimary,
                            borderColor: palette.cardBorder,
                          },
                        ]}
                        value={String(this.state.formReminderDayOfMonth)}
                        onChangeText={(txt) =>
                          this.setState({ formReminderDayOfMonth: parseInt(txt, 10) || 1 })
                        }
                        placeholder="Day of Month (1-31)..."
                        keyboardType="numeric"
                        placeholderTextColor={palette.textMuted}
                      />
                      <TextInput
                        style={[
                          this.styles.modalInput,
                          {
                            flex: 1,
                            backgroundColor: palette.cardBackground,
                            color: palette.textPrimary,
                            borderColor: palette.cardBorder,
                          },
                        ]}
                        value={this.state.formReminderTime}
                        onChangeText={(txt) => this.setState({ formReminderTime: txt })}
                        placeholder="Time (HH:mm)..."
                        placeholderTextColor={palette.textMuted}
                      />
                    </View>
                  )}

                  {this.state.formReminderType === 'annually' && (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TextInput
                        style={[
                          this.styles.modalInput,
                          {
                            flex: 1,
                            backgroundColor: palette.cardBackground,
                            color: palette.textPrimary,
                            borderColor: palette.cardBorder,
                          },
                        ]}
                        value={this.state.formReminderMonthAndDay}
                        onChangeText={(txt) => this.setState({ formReminderMonthAndDay: txt })}
                        placeholder="MM-DD (e.g. 10-25)..."
                        placeholderTextColor={palette.textMuted}
                      />
                      <TextInput
                        style={[
                          this.styles.modalInput,
                          {
                            flex: 1,
                            backgroundColor: palette.cardBackground,
                            color: palette.textPrimary,
                            borderColor: palette.cardBorder,
                          },
                        ]}
                        value={this.state.formReminderTime}
                        onChangeText={(txt) => this.setState({ formReminderTime: txt })}
                        placeholder="Time (HH:mm)..."
                        placeholderTextColor={palette.textMuted}
                      />
                    </View>
                  )}

                  {this.state.formReminderType === 'custom' && (
                    <TextInput
                      style={[
                        this.styles.modalInput,
                        {
                          backgroundColor: palette.cardBackground,
                          color: palette.textPrimary,
                          borderColor: palette.cardBorder,
                        },
                      ]}
                      value={this.state.formReminderCustomDateTime}
                      onChangeText={(txt) => this.setState({ formReminderCustomDateTime: txt })}
                      placeholder="Custom Date/Time (YYYY-MM-DDTHH:mm)..."
                      placeholderTextColor={palette.textMuted}
                    />
                  )}
                </View>
              )}

              <View style={this.styles.modalActions}>
                <TouchableOpacity
                  onPress={() =>
                    this.setState({
                      showAddModal: false,
                      showEditModal: false,
                      editingTodoId: null,
                    })
                  }
                  style={this.styles.cancelBtn}
                >
                  <Text style={[this.styles.cancelBtnText, { color: palette.textMuted }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={showEditModal ? this.handleUpdateTodo : this.handleCreateTodo}
                  style={[this.styles.submitBtn, { backgroundColor: palette.accent }]}
                >
                  <Text style={[this.styles.submitBtnText, { color: palette.accentContrast }]}>
                    {showEditModal ? 'Save Changes' : '✓ Confirm & Add'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      </View>
    );
  }
}

export class GeneralTodoViewStyles {
  public static readonly styles = StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: 6,
    } as ViewStyle,
    hudWavesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginRight: 10,
      height: 24,
    } as ViewStyle,
    toastContainer: {
      position: 'absolute',
      top: 0,
      left: 16,
      right: 16,
      zIndex: 9999,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderWidth: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    } as ViewStyle,
    toastText: {
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center',
    } as TextStyle,
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    } as ViewStyle,
    headerButtonsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    } as ViewStyle,
    titleHeading: {
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.4,
    } as TextStyle,
    subHeading: {
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    } as TextStyle,
    floatingVoiceContainer: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 90,
    } as ViewStyle,
    voiceIconAnchor: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    voiceIconButton: {
      width: 50,
      height: 50,
      borderRadius: 25,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
      elevation: 6,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
    } as ViewStyle,
    voiceIconEmoji: {
      fontSize: 22,
    } as TextStyle,
    pulseRing: {
      position: 'absolute',
      width: 68,
      height: 68,
      borderRadius: 34,
      borderWidth: 2,
      zIndex: 5,
    } as ViewStyle,
    spinningRing: {
      position: 'absolute',
      width: 60,
      height: 60,
      borderRadius: 30,
      borderWidth: 2.5,
      zIndex: 6,
    } as ViewStyle,
    spinnerWheelMini: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
    } as ViewStyle,
    recordingFloatingHud: {
      position: 'absolute',
      bottom: 60,
      right: 0,
      width: 260,
      borderRadius: 18,
      padding: 10,
      borderWidth: 1.5,
      flexDirection: 'row',
      alignItems: 'center',
      zIndex: 999,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 10,
    } as ViewStyle,
    hudWaveBar: {
      width: 3.5,
      borderRadius: 2,
    } as ViewStyle,
    hudTitleText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.7,
      marginBottom: 3,
    } as TextStyle,
    hudTranscriptText: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600',
    } as TextStyle,
    voiceStudioBtn: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 8,
    } as ViewStyle,
    voiceStudioBtnText: {
      fontSize: 12,
      fontWeight: '700',
    } as TextStyle,
    addBtn: {
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 9,
    } as ViewStyle,
    addBtnText: {
      color: '#0B0B0E',
      fontSize: 13,
      fontWeight: '700',
    } as TextStyle,
    filterPillsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
    } as ViewStyle,
    filterPill: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 6,
    } as ViewStyle,
    filterPillText: {
      fontSize: 12,
      fontWeight: '700',
    } as TextStyle,
    searchInput: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 18,
      paddingVertical: 12,
      fontSize: 14,
      marginBottom: 14,
    } as TextStyle,
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    } as ViewStyle,
    emptyStateCard: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 44,
      paddingHorizontal: 24,
      borderRadius: 24,
      borderWidth: 1,
      marginTop: 20,
    } as ViewStyle,
    emptyStateIcon: {
      fontSize: 48,
      marginBottom: 12,
    } as TextStyle,
    emptyStateHeading: {
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 8,
      textAlign: 'center',
    } as TextStyle,
    emptyStateText: {
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: 16,
      marginBottom: 20,
    } as TextStyle,
    emptyStateActionBtn: {
      borderRadius: 999,
      paddingHorizontal: 20,
      paddingVertical: 10,
    } as ViewStyle,
    emptyStateActionText: {
      color: '#0B0B0E',
      fontSize: 13,
      fontWeight: '700',
    } as TextStyle,
    todoCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      borderWidth: 1,
      borderRadius: 20,
      padding: 14,
      marginBottom: 10,
    } as ViewStyle,
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 1.5,
      marginRight: 12,
      marginTop: 2,
      justifyContent: 'center',
      alignItems: 'center',
    } as ViewStyle,
    checkmark: {
      color: '#0B0B0E',
      fontSize: 14,
      fontWeight: '800',
    } as TextStyle,
    todoDetails: {
      flex: 1,
    } as ViewStyle,
    todoTitle: {
      fontSize: 16,
      lineHeight: 22,
    } as TextStyle,
    todoDesc: {
      fontSize: 13,
      lineHeight: 18,
      marginTop: 4,
    } as TextStyle,
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
    } as ViewStyle,
    dueDatePill: {
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
    } as ViewStyle,
    dueDateText: {
      fontSize: 11,
      fontWeight: '700',
    } as TextStyle,
    reminderPill: {
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
    } as ViewStyle,
    reminderText: {
      fontSize: 11,
      fontWeight: '700',
    } as TextStyle,
    actionsColumn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginLeft: 8,
      marginTop: 2,
    } as ViewStyle,
    actionIconBtn: {
      paddingHorizontal: 6,
      paddingVertical: 4,
      borderRadius: 6,
    } as ViewStyle,
    actionIconText: {
      fontSize: 15,
      fontWeight: '700',
    } as TextStyle,
    voiceModalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.72)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    } as ViewStyle,
    voiceModalPod: {
      width: '100%',
      maxWidth: 300,
      borderRadius: 28,
      borderWidth: 1.5,
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 20,
      alignItems: 'center',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 22,
      elevation: 16,
    } as ViewStyle,
    voicePodCloseBtn: {
      position: 'absolute',
      top: 14,
      right: 14,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 20,
    } as ViewStyle,
    voicePodCloseText: {
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 15,
    } as TextStyle,
    voicePodStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    } as ViewStyle,
    voicePodStatusDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
    } as ViewStyle,
    voicePodStatusText: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    } as TextStyle,
    voiceOrbWrapper: {
      width: 140,
      height: 140,
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 10,
    } as ViewStyle,
    voiceRecordOrb: {
      width: 86,
      height: 86,
      borderRadius: 43,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.9,
      shadowRadius: 18,
      elevation: 12,
    } as ViewStyle,
    voiceOrbEmoji: {
      fontSize: 34,
    } as TextStyle,
    voiceModalPulseRing: {
      position: 'absolute',
      width: 130,
      height: 130,
      borderRadius: 65,
      borderWidth: 2,
      zIndex: 4,
    } as ViewStyle,
    voiceModalOuterHalo: {
      position: 'absolute',
      width: 110,
      height: 110,
      borderRadius: 55,
      zIndex: 2,
    } as ViewStyle,
    voicePodTranscriptBox: {
      width: '100%',
      borderRadius: 14,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 50,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 10,
      marginBottom: 14,
    } as ViewStyle,
    voicePodTranscriptText: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
      textAlign: 'center',
    } as TextStyle,
    voicePodActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      justifyContent: 'center',
    } as ViewStyle,
    voicePodAddBtn: {
      borderRadius: 999,
      paddingHorizontal: 20,
      paddingVertical: 9,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    voicePodAddBtnText: {
      color: '#0B0B0E',
      fontSize: 13,
      fontWeight: '800',
    } as TextStyle,
    voicePodCancelBtn: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    voicePodCancelBtnText: {
      fontSize: 13,
      fontWeight: '600',
    } as TextStyle,
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      padding: 20,
    } as ViewStyle,
    modalSheet: {
      borderWidth: 1,
      borderRadius: 24,
      padding: 20,
      maxHeight: '88%',
    } as ViewStyle,
    modalHeading: {
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 14,
    } as TextStyle,
    modalHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    } as ViewStyle,
    modalTitleText: {
      fontSize: 18,
      fontWeight: '700',
    } as TextStyle,
    modalCloseBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    modalCloseBtnText: {
      fontSize: 13,
      fontWeight: '700',
    } as TextStyle,
    voiceHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    } as ViewStyle,
    privacyBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      marginTop: 2,
    } as TextStyle,
    micPulseBadge: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
    } as ViewStyle,
    voiceHintText: {
      fontSize: 12,
      lineHeight: 17,
      marginBottom: 10,
    } as TextStyle,
    voiceTranscriptInput: {
      borderWidth: 1.5,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      minHeight: 74,
      marginBottom: 10,
      textAlignVertical: 'top',
    } as TextStyle,
    sampleVoiceChip: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 7,
      marginRight: 8,
    } as ViewStyle,
    sampleVoiceChipText: {
      fontSize: 12,
      fontWeight: '600',
    } as TextStyle,
    nlpPreviewCard: {
      borderWidth: 1,
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
    } as ViewStyle,
    nlpPreviewHeader: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8,
      marginBottom: 8,
    } as TextStyle,
    nlpPreviewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 5,
    } as ViewStyle,
    nlpFieldLabel: {
      fontSize: 12,
      fontWeight: '700',
      width: 105,
    } as TextStyle,
    nlpFieldValue: {
      flex: 1,
      fontSize: 13,
      fontWeight: '700',
    } as TextStyle,
    modalInput: {
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 14,
      marginBottom: 10,
    } as TextStyle,
    styleButtonsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12,
    } as ViewStyle,
    stylePill: {
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 6,
    } as ViewStyle,
    reminderPickerLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
      marginBottom: 8,
      marginTop: 4,
    } as TextStyle,
    recurrenceRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 12,
    } as ViewStyle,
    recurrencePill: {
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
    } as ViewStyle,
    recurrencePillText: {
      fontSize: 11,
      fontWeight: '700',
    } as TextStyle,
    weekdayPickerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 10,
      gap: 4,
    } as ViewStyle,
    weekdayChip: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 7,
      borderRadius: 8,
    } as ViewStyle,
    weekdayChipText: {
      fontSize: 11,
      fontWeight: '800',
    } as TextStyle,
    reminderInputsArea: {
      marginBottom: 10,
    } as ViewStyle,
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 10,
      marginTop: 8,
    } as ViewStyle,
    cancelBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
    } as ViewStyle,
    cancelBtnText: {
      fontSize: 14,
      fontWeight: '600',
    } as TextStyle,
    secondaryEditBtn: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 9,
    } as ViewStyle,
    secondaryEditBtnText: {
      fontSize: 13,
      fontWeight: '700',
    } as TextStyle,
    submitBtn: {
      borderRadius: 999,
      paddingHorizontal: 18,
      paddingVertical: 10,
    } as ViewStyle,
    submitBtnText: {
      color: '#0B0B0E',
      fontSize: 14,
      fontWeight: '700',
    } as TextStyle,
  });
}
