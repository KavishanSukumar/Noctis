import * as Crypto from 'expo-crypto';
import { EncryptedEnvelope } from '../models/NoctisModels';

export class CryptoSecurityService {
  private static readonly PBKDF2_ROUNDS = 10000;
  private static readonly LEGACY_ROUNDS_HEADER = 600000;
  private static readonly SALT_BYTES = 16;
  private static readonly IV_BYTES = 16;
  private static readonly TAG_BYTES = 32;
  private static readonly LEGACY_TAG_BYTES = 16;

  private static readonly SHA256_K: readonly number[] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  public static async generateRandomBytesHex(byteCount: number): Promise<string> {
    const bytes = await Crypto.getRandomBytesAsync(byteCount);
    return this.bytesToHex(bytes);
  }

  public static async generatePkcePair(): Promise<{ verifier: string; challenge: string }> {
    // 32 random bytes (64 hex chars) for high-entropy PKCE verifier
    const rawVerifier = await this.generateRandomBytesHex(32);
    const verifier = this.base64UrlEncode(rawVerifier);
    const challengeHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      verifier,
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );
    const challenge = challengeHash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return { verifier, challenge };
  }

  public static async generateOidcStateAndNonce(): Promise<{ state: string; nonce: string }> {
    const state = await this.generateRandomBytesHex(16);
    const nonce = await this.generateRandomBytesHex(16);
    return { state, nonce };
  }

  public static async deriveMasterKey(
    passphrase: string,
    saltHex: string,
    formatVersion: string = '2.0'
  ): Promise<string> {
    if (formatVersion === '1.0') {
      let currentHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${passphrase}:${saltHex}:${this.LEGACY_ROUNDS_HEADER}`
      );
      for (let i = 0; i < 50; i++) {
        currentHash = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          `${currentHash}:${saltHex}:${i}`
        );
      }
      return currentHash;
    }

    // Standard RFC 2898 / RFC 8018 PBKDF2-HMAC-SHA256 key stretching (10,000 iterations)
    const passwordBytes = new TextEncoder().encode(`NOCTIS_KDF_V2:${passphrase}`);
    const saltBytes = new TextEncoder().encode(`NOCTIS_SALT_V2:${saltHex}`);
    const derivedBytes = this.pbkdf2HmacSha256SingleBlock(passwordBytes, saltBytes, this.PBKDF2_ROUNDS);
    return this.bytesToHex(derivedBytes);
  }

  public static async encryptPayload(
    plaintext: string,
    derivedKey: string,
    explicitSaltHex?: string
  ): Promise<EncryptedEnvelope> {
    const saltHex = explicitSaltHex || (await this.generateRandomBytesHex(this.SALT_BYTES));
    const ivHex = await this.generateRandomBytesHex(this.IV_BYTES);

    const masterKeyBytes = new TextEncoder().encode(derivedKey);
    const contextBytes = new TextEncoder().encode(`${saltHex}:${ivHex}`);

    // Domain-separated subkey derivation using RFC 2104 HMAC-SHA256 (HKDF-Expand style)
    const encKeyBytes = this.hmacSha256(
      masterKeyBytes,
      new TextEncoder().encode(`NOCTIS_ENC_V2:${saltHex}:${ivHex}`)
    );
    const macKeyBytes = this.hmacSha256(
      masterKeyBytes,
      new TextEncoder().encode(`NOCTIS_MAC_V2:${saltHex}:${ivHex}`)
    );

    // Counter-Mode (CTR) non-repeating HMAC-SHA256 keystream cipher over UTF-8 bytes
    const textBytes = new TextEncoder().encode(plaintext);
    const cipherBytes = this.applyCtrKeystream(textBytes, encKeyBytes, contextBytes);
    const ciphertextBase64 = this.bytesToBase64(cipherBytes);

    // Encrypt-then-MAC: RFC 2104 HMAC-SHA256 over formatVersion, saltHex, ivHex, and ciphertextBase64
    const authenticatedData = new TextEncoder().encode(
      `2.0:${saltHex}:${ivHex}:${ciphertextBase64}`
    );
    const tagBytes = this.hmacSha256(macKeyBytes, authenticatedData);
    const tagHex = this.bytesToHex(tagBytes).substring(0, this.TAG_BYTES * 2);

    return new EncryptedEnvelope({
      formatVersion: '2.0',
      saltHex,
      ivHex,
      ciphertextBase64,
      tagHex,
      timestamp: Date.now(),
      keyHash: '', // Key oracle removed in v2.0 (OWASP M10 / A02:2021)
    });
  }

  public static async decryptPayload(envelope: EncryptedEnvelope, derivedKey: string): Promise<string> {
    const { formatVersion, saltHex, ivHex, ciphertextBase64, tagHex } = envelope;

    if (!saltHex || !ivHex || typeof ciphertextBase64 !== 'string' || !tagHex) {
      throw new Error('Malformed encrypted envelope: missing required cryptographic fields.');
    }

    // Backward-compatible decryption for existing v1.0 local vaults (migrated to v2.0 on next write)
    if (formatVersion === '1.0') {
      return this.decryptLegacyV1Payload(envelope, derivedKey);
    }

    const masterKeyBytes = new TextEncoder().encode(derivedKey);
    const contextBytes = new TextEncoder().encode(`${saltHex}:${ivHex}`);

    const macKeyBytes = this.hmacSha256(
      masterKeyBytes,
      new TextEncoder().encode(`NOCTIS_MAC_V2:${saltHex}:${ivHex}`)
    );

    const authenticatedData = new TextEncoder().encode(
      `${formatVersion || '2.0'}:${saltHex}:${ivHex}:${ciphertextBase64}`
    );
    const computedTagBytes = this.hmacSha256(macKeyBytes, authenticatedData);
    const expectedTagHex = this.bytesToHex(computedTagBytes).substring(0, this.TAG_BYTES * 2);

    if (!this.constantTimeHexEquals(expectedTagHex, tagHex)) {
      throw new Error('Authentication tag mismatch: Ciphertext tampered or invalid encryption key.');
    }

    const encKeyBytes = this.hmacSha256(
      masterKeyBytes,
      new TextEncoder().encode(`NOCTIS_ENC_V2:${saltHex}:${ivHex}`)
    );

    const cipherBytes = this.base64ToBytes(ciphertextBase64);
    const plainBytes = this.applyCtrKeystream(cipherBytes, encKeyBytes, contextBytes);

    return new TextDecoder().decode(plainBytes);
  }

  private static async decryptLegacyV1Payload(
    envelope: EncryptedEnvelope,
    derivedKey: string
  ): Promise<string> {
    const { saltHex, ivHex, ciphertextBase64, tagHex } = envelope;

    const macKey = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `MAC:${derivedKey}:${saltHex}:${ivHex}`
    );

    const computedTagDigest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${macKey}:${ivHex}:${ciphertextBase64}`
    );
    const expectedTagHex = computedTagDigest.substring(0, this.LEGACY_TAG_BYTES * 2);

    if (!this.constantTimeHexEquals(expectedTagHex, tagHex)) {
      throw new Error('Authentication tag mismatch: Ciphertext tampered or invalid encryption key.');
    }

    const encKey = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `ENC:${derivedKey}:${saltHex}:${ivHex}`
    );

    const cipherBytes = this.base64ToBytes(ciphertextBase64);
    const keyBytes = this.hexToBytes(encKey);
    const plainBytes = new Uint8Array(cipherBytes.length);

    for (let i = 0; i < cipherBytes.length; i++) {
      plainBytes[i] = cipherBytes[i] ^ keyBytes[i % keyBytes.length];
    }

    return new TextDecoder().decode(plainBytes);
  }

  public static async computeOpaqueSubHash(sub: string): Promise<string> {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `NOCTIS_SUB_SALT:${sub}`
    );
    return hash.substring(0, 24);
  }

  /**
   * Constant-time hexadecimal string comparison to prevent timing side-channel attacks (OWASP M10).
   */
  public static constantTimeHexEquals(a: string, b: string): boolean {
    if (typeof a !== 'string' || typeof b !== 'string') {
      return false;
    }
    const normA = a.toLowerCase();
    const normB = b.toLowerCase();
    if (normA.length !== normB.length || normA.length === 0) {
      return false;
    }
    let diff = 0;
    for (let i = 0; i < normA.length; i++) {
      diff |= normA.charCodeAt(i) ^ normB.charCodeAt(i);
    }
    return diff === 0;
  }

  /**
   * Counter-Mode (CTR) keystream generator using HMAC-SHA256 per 32-byte block:
   * Keystream_i = HMAC-SHA256(encKeyBytes, contextBytes || uint32BE(blockIndex))
   */
  private static applyCtrKeystream(
    inputBytes: Uint8Array,
    encKeyBytes: Uint8Array,
    contextBytes: Uint8Array
  ): Uint8Array {
    const output = new Uint8Array(inputBytes.length);
    const totalBlocks = Math.ceil(inputBytes.length / 32);
    const counterInput = new Uint8Array(contextBytes.length + 4);
    counterInput.set(contextBytes, 0);

    for (let blockIdx = 0; blockIdx < totalBlocks; blockIdx++) {
      const offset = contextBytes.length;
      counterInput[offset] = (blockIdx >>> 24) & 0xff;
      counterInput[offset + 1] = (blockIdx >>> 16) & 0xff;
      counterInput[offset + 2] = (blockIdx >>> 8) & 0xff;
      counterInput[offset + 3] = blockIdx & 0xff;

      const keystreamBlock = this.hmacSha256(encKeyBytes, counterInput);
      const byteOffset = blockIdx * 32;
      const remaining = Math.min(32, inputBytes.length - byteOffset);

      for (let j = 0; j < remaining; j++) {
        output[byteOffset + j] = inputBytes[byteOffset + j] ^ keystreamBlock[j];
      }
    }

    return output;
  }

  /**
   * RFC 2898 / RFC 8018 PBKDF2-HMAC-SHA256 (32-byte derived key block).
   */
  private static pbkdf2HmacSha256SingleBlock(
    passwordBytes: Uint8Array,
    saltBytes: Uint8Array,
    iterations: number
  ): Uint8Array {
    const saltWithBlockIndex = new Uint8Array(saltBytes.length + 4);
    saltWithBlockIndex.set(saltBytes, 0);
    saltWithBlockIndex[saltBytes.length] = 0;
    saltWithBlockIndex[saltBytes.length + 1] = 0;
    saltWithBlockIndex[saltBytes.length + 2] = 0;
    saltWithBlockIndex[saltBytes.length + 3] = 1;

    let u = this.hmacSha256(passwordBytes, saltWithBlockIndex);
    const result = new Uint8Array(u);

    for (let i = 1; i < iterations; i++) {
      u = this.hmacSha256(passwordBytes, u);
      for (let j = 0; j < 32; j++) {
        result[j] ^= u[j];
      }
    }

    return result;
  }

  /**
   * RFC 2104 HMAC-SHA256 implementation.
   */
  private static hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
    const blockSize = 64;
    let normalizedKey = key;
    if (normalizedKey.length > blockSize) {
      normalizedKey = this.sha256Bytes(normalizedKey);
    }

    const paddedKey = new Uint8Array(blockSize);
    paddedKey.set(normalizedKey, 0);

    const oKeyPad = new Uint8Array(blockSize);
    const iKeyPad = new Uint8Array(blockSize);
    for (let i = 0; i < blockSize; i++) {
      oKeyPad[i] = paddedKey[i] ^ 0x5c;
      iKeyPad[i] = paddedKey[i] ^ 0x36;
    }

    const innerInput = new Uint8Array(blockSize + message.length);
    innerInput.set(iKeyPad, 0);
    innerInput.set(message, blockSize);
    const innerHash = this.sha256Bytes(innerInput);

    const outerInput = new Uint8Array(blockSize + innerHash.length);
    outerInput.set(oKeyPad, 0);
    outerInput.set(innerHash, blockSize);
    return this.sha256Bytes(outerInput);
  }

  /**
   * FIPS 180-4 / RFC 6234 SHA-256 implementation over Uint8Array.
   */
  private static sha256Bytes(data: Uint8Array): Uint8Array {
    let h0 = 0x6a09e667;
    let h1 = 0xbb67ae85;
    let h2 = 0x3c6ef372;
    let h3 = 0xa54ff53a;
    let h4 = 0x510e527f;
    let h5 = 0x9b05688c;
    let h6 = 0x1f83d9ab;
    let h7 = 0x5be0cd19;

    const bitLength = data.length * 8;
    const paddedLength = Math.ceil((data.length + 9) / 64) * 64;
    const padded = new Uint8Array(paddedLength);
    padded.set(data, 0);
    padded[data.length] = 0x80;

    const highBits = Math.floor(bitLength / 0x100000000);
    const lowBits = bitLength >>> 0;
    padded[paddedLength - 8] = (highBits >>> 24) & 0xff;
    padded[paddedLength - 7] = (highBits >>> 16) & 0xff;
    padded[paddedLength - 6] = (highBits >>> 8) & 0xff;
    padded[paddedLength - 5] = highBits & 0xff;
    padded[paddedLength - 4] = (lowBits >>> 24) & 0xff;
    padded[paddedLength - 3] = (lowBits >>> 16) & 0xff;
    padded[paddedLength - 2] = (lowBits >>> 8) & 0xff;
    padded[paddedLength - 1] = lowBits & 0xff;

    const w = new Int32Array(64);
    const k = this.SHA256_K;

    for (let chunkOffset = 0; chunkOffset < paddedLength; chunkOffset += 64) {
      for (let i = 0; i < 16; i++) {
        const idx = chunkOffset + i * 4;
        w[i] =
          (padded[idx] << 24) |
          (padded[idx + 1] << 16) |
          (padded[idx + 2] << 8) |
          padded[idx + 3];
      }

      for (let i = 16; i < 64; i++) {
        const w15 = w[i - 15];
        const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
        const w2 = w[i - 2];
        const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }

      let a = h0;
      let b = h1;
      let c = h2;
      let d = h3;
      let e = h4;
      let f = h5;
      let g = h6;
      let h = h7;

      for (let i = 0; i < 64; i++) {
        const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + s1 + ch + k[i] + w[i]) | 0;
        const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (s0 + maj) | 0;

        h = g;
        g = f;
        f = e;
        e = (d + temp1) | 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) | 0;
      }

      h0 = (h0 + a) | 0;
      h1 = (h1 + b) | 0;
      h2 = (h2 + c) | 0;
      h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0;
      h5 = (h5 + f) | 0;
      h6 = (h6 + g) | 0;
      h7 = (h7 + h) | 0;
    }

    const digest = new Uint8Array(32);
    const words = [h0, h1, h2, h3, h4, h5, h6, h7];
    for (let i = 0; i < 8; i++) {
      const word = words[i];
      digest[i * 4] = (word >>> 24) & 0xff;
      digest[i * 4 + 1] = (word >>> 16) & 0xff;
      digest[i * 4 + 2] = (word >>> 8) & 0xff;
      digest[i * 4 + 3] = word & 0xff;
    }
    return digest;
  }

  private static bytesToHex(bytes: Uint8Array): string {
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  }

  private static base64UrlEncode(str: string): string {
    const base64 = btoa(str);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private static hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  private static bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private static base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}
