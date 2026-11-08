import { Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import { InputSanitizer } from '../security/InputSanitizer';

export class VoiceRecognitionSessionCallbacks {
  public onInterimTranscript: (transcript: string) => void = () => {};
  public onFinalTranscript: (transcript: string) => void = () => {};
  public onStateChange: (isListening: boolean) => void = () => {};
  public onError: (message: string) => void = () => {};
  public onSessionEnd: (finalTranscript: string, errorMessage: string) => void = () => {};

  constructor(init?: Partial<VoiceRecognitionSessionCallbacks>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class VoiceCommandService {
  private static activeWebRecognition: unknown = null;
  private static isCurrentlyListening: boolean = false;
  private static isStopRequested: boolean = false;
  private static sessionTranscriptBuffer: string = '';
  private static committedSegmentsBuffer: string = '';
  private static lastSessionError: string = '';
  private static pendingStopResolvers: Array<(finalTranscript: string) => void> = [];
  private static externalSpeechDialogOpen: boolean = false;
  private static externalSpeechDialogGraceTimer: ReturnType<typeof setTimeout> | null = null;

  public static isDirectWebSpeechSupported(): boolean {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return false;
    }
    const win = window as unknown as Record<string, unknown>;
    return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
  }

  public static isNativeAndroidSpeechSupported(): boolean {
    if (Platform.OS !== 'android') {
      return false;
    }
    return typeof IntentLauncher.startActivityAsync === 'function';
  }

  public static isExternalSpeechDialogActive(): boolean {
    return this.externalSpeechDialogOpen;
  }

  private static setExternalSpeechDialogGraceTimer(): void {
    if (this.externalSpeechDialogGraceTimer) {
      clearTimeout(this.externalSpeechDialogGraceTimer);
    }
    this.externalSpeechDialogGraceTimer = setTimeout(() => {
      this.externalSpeechDialogOpen = false;
      this.externalSpeechDialogGraceTimer = null;
    }, 2500);
  }

  public static async requestPermission(): Promise<{ granted: boolean; error?: string }> {
    return { granted: true };
  }

  public static startListening(callbacks: VoiceRecognitionSessionCallbacks): boolean {
    this.stopListeningAndZeroize();

    this.isStopRequested = false;
    this.sessionTranscriptBuffer = '';
    this.committedSegmentsBuffer = '';
    this.lastSessionError = '';

    // 1. Native Android Speech Recognition via ExpoIntentLauncher
    if (this.isNativeAndroidSpeechSupported()) {
      this.isCurrentlyListening = true;
      this.externalSpeechDialogOpen = true;
      if (this.externalSpeechDialogGraceTimer) {
        clearTimeout(this.externalSpeechDialogGraceTimer);
        this.externalSpeechDialogGraceTimer = null;
      }
      callbacks.onStateChange(true);

      IntentLauncher.startActivityAsync('android.speech.action.RECOGNIZE_SPEECH', {
        extra: {
          'android.speech.extra.LANGUAGE_MODEL': 'free_form',
          'android.speech.extra.PROMPT': 'Speak your task (e.g. "Send money to mom on every Monday")',
          'android.speech.extra.MAX_RESULTS': 3,
        },
      })
        .then((result) => {
          this.isCurrentlyListening = false;
          callbacks.onStateChange(false);
          this.setExternalSpeechDialogGraceTimer();

          // On Android, Activity.RESULT_OK is -1, Activity.RESULT_CANCELED is 0
          if (result && typeof result.resultCode === 'number' && result.resultCode !== -1) {
            callbacks.onSessionEnd('', '');
            this.resolvePendingStopPromises('');
            return;
          }

          const rawExtra = result?.extra as Record<string, unknown> | undefined;
          let capturedString = '';

          if (rawExtra && typeof rawExtra === 'object') {
            const possibleResults =
              rawExtra['android.speech.extra.RESULTS'] ||
              rawExtra['results'] ||
              rawExtra['android.speech.extra.RESULTS_ARRAY'];

            if (Array.isArray(possibleResults) && possibleResults.length > 0) {
              capturedString = String(possibleResults[0] || '');
            } else if (typeof possibleResults === 'string') {
              capturedString = possibleResults;
            } else if (possibleResults && typeof possibleResults === 'object') {
              const values = Object.values(possibleResults);
              if (values.length > 0 && typeof values[0] === 'string') {
                capturedString = String(values[0]);
              }
            }
          }

          const sanitized = InputSanitizer.sanitizeVoiceTranscript(capturedString);
          this.sessionTranscriptBuffer = sanitized;
          if (sanitized) {
            callbacks.onFinalTranscript(sanitized);
          }
          callbacks.onSessionEnd(sanitized, '');
          this.resolvePendingStopPromises(sanitized);
        })
        .catch((err: unknown) => {
          this.isCurrentlyListening = false;
          callbacks.onStateChange(false);
          this.setExternalSpeechDialogGraceTimer();

          const errObj = err as { message?: string };
          const errMsg = errObj?.message || 'Speech recognition unavailable on this device.';
          this.lastSessionError = errMsg;
          callbacks.onError(errMsg);
          callbacks.onSessionEnd('', errMsg);
          this.resolvePendingStopPromises('');
        });

      return true;
    }

    // 2. Direct Web Speech API (Chromium / Safari Web)
    if (this.isDirectWebSpeechSupported()) {
      try {
        const win = window as unknown as Record<string, new () => Record<string, unknown>>;
        const SpeechRecognitionConstructor = win.SpeechRecognition || win.webkitSpeechRecognition;
        if (!SpeechRecognitionConstructor) {
          const msg = 'Web Speech API constructor unavailable in this browser.';
          this.lastSessionError = msg;
          callbacks.onError(msg);
          return false;
        }

        const recognition = new SpeechRecognitionConstructor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang =
          typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          this.isCurrentlyListening = true;
          callbacks.onStateChange(true);
        };

        recognition.onresult = (event: unknown) => {
          const ev = event as {
            results?: ArrayLike<{ isFinal?: boolean; 0?: { transcript?: string } }>;
          };
          if (!ev.results) return;

          let currentInstanceFinal = '';
          let currentInstanceInterim = '';
          let hasNewFinal = false;

          for (let i = 0; i < ev.results.length; i++) {
            const res = ev.results[i];
            const piece =
              res && res[0] && typeof res[0].transcript === 'string' ? res[0].transcript : '';
            if (!piece) continue;

            if (res && res.isFinal) {
              currentInstanceFinal += piece + ' ';
              hasNewFinal = true;
            } else {
              currentInstanceInterim += piece + ' ';
            }
          }

          const combinedRaw = [
            this.committedSegmentsBuffer.trim(),
            currentInstanceFinal.trim(),
            currentInstanceInterim.trim(),
          ]
            .filter(Boolean)
            .join(' ');

          const sanitized = InputSanitizer.sanitizeVoiceTranscript(combinedRaw);
          if (sanitized) {
            this.sessionTranscriptBuffer = sanitized;
            if (hasNewFinal) {
              callbacks.onFinalTranscript(sanitized);
            } else {
              callbacks.onInterimTranscript(sanitized);
            }
          }
        };

        recognition.onerror = (event: unknown) => {
          const ev = event as { error?: string };
          const errCode = ev.error || 'unknown';

          if (errCode === 'no-speech' || errCode === 'aborted') {
            return;
          }

          let friendlyMessage = 'Microphone error occurred.';
          if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
            friendlyMessage =
              'Microphone access denied. Please allow microphone access in your browser address bar.';
          } else if (errCode === 'audio-capture') {
            friendlyMessage =
              'No microphone hardware detected. Please check your microphone connection and OS sound settings.';
          } else if (errCode === 'network') {
            friendlyMessage =
              'Browser speech recognition service unreachable. You can also type or dictate in Voice Studio.';
          }

          this.lastSessionError = friendlyMessage;
          this.isStopRequested = true;
          this.isCurrentlyListening = false;
          callbacks.onStateChange(false);
          callbacks.onError(friendlyMessage);
        };

        recognition.onend = () => {
          if (!this.isStopRequested && !this.lastSessionError && this.activeWebRecognition === recognition) {
            if (this.sessionTranscriptBuffer) {
              this.committedSegmentsBuffer = this.sessionTranscriptBuffer;
            }
            try {
              (recognition as { start: () => void }).start();
              return;
            } catch {
              // Fall through to normal completion if restart is rejected
            }
          }

          this.isCurrentlyListening = false;
          const finalCaptured = this.sessionTranscriptBuffer;
          const errCaptured = this.lastSessionError;

          callbacks.onStateChange(false);
          callbacks.onSessionEnd(finalCaptured, errCaptured);
          this.resolvePendingStopPromises(finalCaptured);
        };

        this.activeWebRecognition = recognition;
        this.isCurrentlyListening = true;
        callbacks.onStateChange(true);
        (recognition as { start: () => void }).start();
        return true;
      } catch (err: unknown) {
        this.isCurrentlyListening = false;
        callbacks.onStateChange(false);
        const e = err as { message?: string };
        const msg = e.message || 'Could not start speech recognition.';
        this.lastSessionError = msg;
        callbacks.onError(msg);
        return false;
      }
    }

    // Fallback: OS keyboard dictation
    this.isCurrentlyListening = true;
    callbacks.onStateChange(true);
    return true;
  }

  public static stopListening(): void {
    this.isStopRequested = true;
    this.isCurrentlyListening = false;
    if (this.activeWebRecognition) {
      try {
        const rec = this.activeWebRecognition as { stop?: () => void };
        if (typeof rec.stop === 'function') {
          rec.stop();
        }
      } catch {
        this.resolvePendingStopPromises(this.sessionTranscriptBuffer);
      }
    } else {
      this.resolvePendingStopPromises(this.sessionTranscriptBuffer);
    }
  }

  public static stopListeningAndAwaitFinal(timeoutMs: number = 2200): Promise<string> {
    this.isStopRequested = true;
    this.isCurrentlyListening = false;

    if (!this.activeWebRecognition) {
      return Promise.resolve(this.sessionTranscriptBuffer);
    }

    return new Promise<string>((resolve) => {
      let settled = false;
      const finish = (transcript: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(transcript || this.sessionTranscriptBuffer);
      };

      const timer = setTimeout(() => {
        finish(this.sessionTranscriptBuffer);
      }, timeoutMs);

      this.pendingStopResolvers.push(finish);

      try {
        const rec = this.activeWebRecognition as { stop?: () => void };
        if (typeof rec.stop === 'function') {
          rec.stop();
        } else {
          finish(this.sessionTranscriptBuffer);
        }
      } catch {
        finish(this.sessionTranscriptBuffer);
      }
    });
  }

  public static stopListeningAndZeroize(): void {
    this.isStopRequested = true;
    this.isCurrentlyListening = false;
    const finalSnapshot = this.sessionTranscriptBuffer;
    this.sessionTranscriptBuffer = '';
    this.committedSegmentsBuffer = '';
    this.lastSessionError = '';

    if (this.activeWebRecognition) {
      const rec = this.activeWebRecognition as { stop?: () => void; abort?: () => void };
      this.activeWebRecognition = null;
      try {
        if (typeof rec.abort === 'function') {
          rec.abort();
        } else if (typeof rec.stop === 'function') {
          rec.stop();
        }
      } catch {
        // Ignore cleanup errors
      }
    }

    this.resolvePendingStopPromises(finalSnapshot);
  }

  public static getSessionTranscript(): string {
    return this.sessionTranscriptBuffer;
  }

  public static getLastSessionError(): string {
    return this.lastSessionError;
  }

  public static getIsListening(): boolean {
    return this.isCurrentlyListening;
  }

  private static resolvePendingStopPromises(transcript: string): void {
    if (this.pendingStopResolvers.length === 0) return;
    const resolvers = [...this.pendingStopResolvers];
    this.pendingStopResolvers = [];
    for (const r of resolvers) {
      try {
        r(transcript);
      } catch {
        // Ignore resolver errors
      }
    }
  }
}
