import { EncryptedEnvelope, SyncManifest } from '../models/NoctisModels';
import { InputSanitizer } from '../security/InputSanitizer';

export class GoogleDriveStealthSyncService {
  private static readonly DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
  private static readonly DRIVE_UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files';

  // Opaque binary filenames stored in Drive hidden appDataFolder (OWASP M6)
  public static readonly CORE_VAULT_FILENAME = 'vlt_core.bin';
  public static readonly SYSTEM_INDEX_FILENAME = 'sys_idx.bin';

  public static async listStealthFiles(accessToken: string): Promise<Array<{ id: string; name: string }>> {
    const query = encodeURIComponent("trashed = false and 'appDataFolder' in parents");
    const url = `${this.DRIVE_FILES_ENDPOINT}?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime)`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to list stealth Drive files: ${res.status}`);
    }

    const json = await res.json();
    return json.files || [];
  }

  public static async uploadStealthFile(
    accessToken: string,
    filename: string,
    contentString: string
  ): Promise<string> {
    const existingFiles = await this.listStealthFiles(accessToken);
    const existing = existingFiles.find((f) => f.name === filename);

    if (existing) {
      // In-place update to prevent duplicate files
      const updateUrl = `${this.DRIVE_UPLOAD_ENDPOINT}/${existing.id}?uploadType=media`;
      const updateRes = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
        },
        body: contentString,
      });

      if (!updateRes.ok) {
        throw new Error(`Failed to update ${filename} in appDataFolder: ${updateRes.status}`);
      }

      return existing.id;
    }

    // Multipart create file inside 'appDataFolder'
    const metadata = {
      name: filename,
      parents: ['appDataFolder'],
      mimeType: 'application/octet-stream',
    };

    const boundary = '-------NoctisBoundaryStealth' + Date.now();
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/octet-stream\r\n\r\n' +
      contentString +
      closeDelimiter;

    const createUrl = `${this.DRIVE_UPLOAD_ENDPOINT}?uploadType=multipart`;
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!createRes.ok) {
      throw new Error(`Failed to create ${filename} in appDataFolder: ${createRes.status}`);
    }

    const createdJson = await createRes.json();
    return createdJson.id;
  }

  public static async downloadStealthFile(accessToken: string, filename: string): Promise<string | null> {
    const files = await this.listStealthFiles(accessToken);
    const targetFile = files.find((f) => f.name === filename);

    if (!targetFile) {
      return null;
    }

    const downloadUrl = `${this.DRIVE_FILES_ENDPOINT}/${targetFile.id}?alt=media`;
    const res = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to download ${filename}: ${res.status}`);
    }

    return await res.text();
  }

  public static async backupVaultToCloud(
    accessToken: string,
    encryptedEnvelope: EncryptedEnvelope,
    manifest: SyncManifest
  ): Promise<void> {
    // 1. Upload manifest index
    await this.uploadStealthFile(
      accessToken,
      this.SYSTEM_INDEX_FILENAME,
      JSON.stringify(manifest)
    );

    // 2. Upload encrypted core vault binary payload
    await this.uploadStealthFile(
      accessToken,
      this.CORE_VAULT_FILENAME,
      JSON.stringify(encryptedEnvelope)
    );
  }

  public static async restoreVaultFromCloud(
    accessToken: string
  ): Promise<{ envelope: EncryptedEnvelope | null; manifest: SyncManifest | null }> {
    const indexContent = await this.downloadStealthFile(accessToken, this.SYSTEM_INDEX_FILENAME);
    const coreContent = await this.downloadStealthFile(accessToken, this.CORE_VAULT_FILENAME);

    const manifest = indexContent
      ? InputSanitizer.sanitizeSafeJsonParse<SyncManifest>(indexContent)
      : null;
    const envelope = coreContent
      ? InputSanitizer.sanitizeSafeJsonParse<EncryptedEnvelope>(coreContent)
      : null;

    return { envelope, manifest };
  }
}
