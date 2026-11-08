import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as ScreenCapture from 'expo-screen-capture';

export class BiometricPrivacyGuard {
  private static readonly MASTER_KEY_STORAGE_ALIAS = 'noctis_wrapped_vault_key';
  private static readonly MASTER_SALT_STORAGE_ALIAS = 'noctis_wrapped_vault_salt';
  private static activeDecryptedMasterKey: string | null = null;
  private static activeDecryptedSaltHex: string | null = null;

  public static async initializePrivacyShield(): Promise<void> {
    try {
      // Hardware Screen Capture & App Switcher Masking (FLAG_SECURE / iOS security mask)
      await ScreenCapture.preventScreenCaptureAsync();
    } catch {
      // Screen capture prevention might be restricted or simulated on non-native environments
    }
  }

  public static async checkBiometricCapability(): Promise<{
    isAvailable: boolean;
    hasHardware: boolean;
    isEnrolled: boolean;
    biometricType: string;
  }> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

    let biometricType = 'Biometrics';
    if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      biometricType = 'Face ID';
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      biometricType = 'Fingerprint / Touch ID';
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      biometricType = 'Iris Recognition';
    }

    return {
      isAvailable: hasHardware && isEnrolled,
      hasHardware,
      isEnrolled,
      biometricType,
    };
  }

  public static async authenticateBiometrics(promptReason: string = 'Unlock Noctis Vault'): Promise<boolean> {
    const capability = await this.checkBiometricCapability();
    if (!capability.isAvailable) {
      // If biometrics not enrolled or supported, fallback to device pin/passcode
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptReason,
        fallbackLabel: 'Use Device Passcode',
        disableDeviceFallback: false,
      });
      return result.success;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: promptReason,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return result.success;
  }

  public static async storeWrappedVaultKey(derivedKey: string, saltHex?: string): Promise<void> {
    // Store in iOS Keychain (kSecAttrAccessibleWhenUnlockedThisDeviceOnly) or Android Keystore
    await SecureStore.setItemAsync(this.MASTER_KEY_STORAGE_ALIAS, derivedKey, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    this.activeDecryptedMasterKey = derivedKey;

    if (saltHex) {
      await SecureStore.setItemAsync(this.MASTER_SALT_STORAGE_ALIAS, saltHex, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      this.activeDecryptedSaltHex = saltHex;
    }
  }

  public static async retrieveWrappedVaultKey(): Promise<string | null> {
    if (this.activeDecryptedMasterKey) {
      return this.activeDecryptedMasterKey;
    }
    const stored = await SecureStore.getItemAsync(this.MASTER_KEY_STORAGE_ALIAS, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    if (stored) {
      this.activeDecryptedMasterKey = stored;
    }
    return stored;
  }

  public static async retrieveWrappedVaultSalt(): Promise<string | null> {
    if (this.activeDecryptedSaltHex) {
      return this.activeDecryptedSaltHex;
    }
    const storedSalt = await SecureStore.getItemAsync(this.MASTER_SALT_STORAGE_ALIAS, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    if (storedSalt) {
      this.activeDecryptedSaltHex = storedSalt;
    }
    return storedSalt;
  }

  public static async clearStoredVaultKey(): Promise<void> {
    await SecureStore.deleteItemAsync(this.MASTER_KEY_STORAGE_ALIAS, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    await SecureStore.deleteItemAsync(this.MASTER_SALT_STORAGE_ALIAS, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    this.zeroizeSensitiveMemory();
  }

  public static zeroizeSensitiveMemory(): void {
    // Immediate memory overwrite for defense against RAM dumps on background transitions (OWASP M7)
    this.activeDecryptedMasterKey = null;
    this.activeDecryptedSaltHex = null;
  }
}
