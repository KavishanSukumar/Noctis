import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

export class DeviceKeySecurityService {
  private static readonly SECURE_DEVICE_KEY_ALIAS = 'noctis_hardware_unique_master_key_v1';
  private static readonly DEVICE_SALT_ALIAS = 'noctis_hardware_unique_salt_v1';
  private static cachedDeviceKey: string | null = null;

  /**
   * Retrieves the existing device-unique key or generates a new 256-bit
   * cryptographically secure random key stored in hardware-backed Keystore/Keychain.
   */
  public static async getOrCreateDeviceUniqueKey(): Promise<string> {
    if (this.cachedDeviceKey) {
      return this.cachedDeviceKey;
    }

    try {
      const existingKey = await SecureStore.getItemAsync(this.SECURE_DEVICE_KEY_ALIAS, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });

      if (existingKey && existingKey.length >= 64) {
        this.cachedDeviceKey = existingKey;
        return existingKey;
      }

      // Generate a new 256-bit high-entropy cryptographic key
      const randomBytes = await Crypto.getRandomBytesAsync(32);
      let newKeyHex = '';
      for (let i = 0; i < randomBytes.length; i++) {
        newKeyHex += randomBytes[i].toString(16).padStart(2, '0');
      }

      // Generate unique device salt
      const saltBytes = await Crypto.getRandomBytesAsync(16);
      let saltHex = '';
      for (let i = 0; i < saltBytes.length; i++) {
        saltHex += saltBytes[i].toString(16).padStart(2, '0');
      }

      // Store in hardware-backed SecureStore (isolated to this app and this device only)
      await SecureStore.setItemAsync(this.SECURE_DEVICE_KEY_ALIAS, newKeyHex, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });

      await SecureStore.setItemAsync(this.DEVICE_SALT_ALIAS, saltHex, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });

      this.cachedDeviceKey = newKeyHex;
      return newKeyHex;
    } catch {
      // In web or restricted environments where SecureStore might fail, fallback securely to derived runtime entropy
      if (!this.cachedDeviceKey) {
        const fallbackBytes = await Crypto.getRandomBytesAsync(32);
        let fallbackHex = '';
        for (let i = 0; i < fallbackBytes.length; i++) {
          fallbackHex += fallbackBytes[i].toString(16).padStart(2, '0');
        }
        this.cachedDeviceKey = fallbackHex;
      }
      return this.cachedDeviceKey;
    }
  }

  /**
   * Derives a cryptographic master key for local vault encryption using
   * the hardware-bound device key and salt.
   */
  public static async deriveLocalMasterKey(): Promise<string> {
    const rawKey = await this.getOrCreateDeviceUniqueKey();
    let saltHex = await SecureStore.getItemAsync(this.DEVICE_SALT_ALIAS, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

    if (!saltHex) {
      saltHex = 'noctis_local_device_static_salt_anchor';
    }

    // Key stretching via SHA-256 HKDF-like construction
    let currentHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `NOCTIS_LOCAL_VAULT_HW_KEY:${rawKey}:${saltHex}`
    );

    for (let i = 0; i < 30; i++) {
      currentHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${currentHash}:${saltHex}:${i}`
      );
    }

    return currentHash;
  }

  /**
   * Clears in-memory sensitive key caches upon app backgrounding or lock.
   */
  public static zeroizeSensitiveMemory(): void {
    this.cachedDeviceKey = null;
  }
}
