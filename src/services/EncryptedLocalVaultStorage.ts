import * as FileSystem from 'expo-file-system/legacy';
import { NoctisVaultSnapshot, EncryptedEnvelope } from '../models/NoctisModels';
import { CryptoSecurityService } from '../security/CryptoSecurityService';
import { DeviceKeySecurityService } from '../security/DeviceKeySecurityService';
import { InputSanitizer } from '../security/InputSanitizer';

export class EncryptedLocalVaultStorage {
  private static readonly VAULT_DIR = `${FileSystem.documentDirectory}noctis_vault/`;

  public static async ensureVaultDirectory(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(this.VAULT_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.VAULT_DIR, { intermediates: true });
    }
  }

  public static async getVaultFilePath(ownerSub: string): Promise<string> {
    const subHash = await CryptoSecurityService.computeOpaqueSubHash(ownerSub);
    return `${this.VAULT_DIR}noctis_vault_${subHash}.enc`;
  }

  public static async vaultExists(ownerSub: string): Promise<boolean> {
    await this.ensureVaultDirectory();
    const filePath = await this.getVaultFilePath(ownerSub);
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    return fileInfo.exists;
  }

  public static async saveEncryptedVault(
    ownerSub: string,
    snapshot: NoctisVaultSnapshot,
    derivedMasterKey?: string
  ): Promise<void> {
    await this.ensureVaultDirectory();
    const filePath = await this.getVaultFilePath(ownerSub);
    const tempFilePath = `${filePath}.tmp`;

    // Ensure encryption key: use provided key or hardware-backed unique device master key
    const encryptionKey = derivedMasterKey && derivedMasterKey.length > 0
      ? derivedMasterKey
      : await DeviceKeySecurityService.deriveLocalMasterKey();

    // Serialize snapshot to JSON string
    const jsonString = JSON.stringify(snapshot);

    // Encrypt payload into authenticated AEAD envelope
    const envelope = await CryptoSecurityService.encryptPayload(jsonString, encryptionKey);
    const envelopeJson = JSON.stringify(envelope);

    // Atomic write pattern: write to .tmp then move to target to prevent corruption on crash
    await FileSystem.writeAsStringAsync(tempFilePath, envelopeJson, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await FileSystem.moveAsync({
      from: tempFilePath,
      to: filePath,
    });
  }

  public static async loadDecryptedVault(
    ownerSub: string,
    derivedMasterKey?: string
  ): Promise<NoctisVaultSnapshot | null> {
    await this.ensureVaultDirectory();
    const filePath = await this.getVaultFilePath(ownerSub);
    const fileInfo = await FileSystem.getInfoAsync(filePath);

    if (!fileInfo.exists) {
      return null;
    }

    const rawEnvelopeJson = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const envelope = InputSanitizer.sanitizeSafeJsonParse<EncryptedEnvelope>(rawEnvelopeJson);
    if (!envelope) {
      throw new Error('Corrupted vault envelope file.');
    }

    // Authenticated decryption using provided key or hardware-backed unique device master key
    const decryptionKey = derivedMasterKey && derivedMasterKey.length > 0
      ? derivedMasterKey
      : await DeviceKeySecurityService.deriveLocalMasterKey();

    const decryptedJson = await CryptoSecurityService.decryptPayload(envelope, decryptionKey);
    const parsedSnapshot = InputSanitizer.sanitizeSafeJsonParse<NoctisVaultSnapshot>(decryptedJson);

    if (!parsedSnapshot || !InputSanitizer.validateVaultSnapshot(parsedSnapshot)) {
      throw new Error('Vault snapshot validation failed or data integrity compromised.');
    }

    return new NoctisVaultSnapshot(parsedSnapshot);
  }

  public static async deleteLocalVault(ownerSub: string): Promise<void> {
    const filePath = await this.getVaultFilePath(ownerSub);
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
    }
  }
}
