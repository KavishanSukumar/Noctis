import { OIDCTokenClaims, NoctisVaultSnapshot, BlockItem, BlockFormattingStyle } from '../models/NoctisModels';

export class InputSanitizer {
  public static readonly MAX_VOICE_COMMAND_LENGTH: number = 500;
  public static readonly MAX_BLOCK_CONTENT_LENGTH: number = 20000;
  public static readonly MAX_TITLE_LENGTH: number = 200;

  private static readonly DANGEROUS_PROTO_KEYS: readonly string[] = [
    '__proto__',
    'constructor',
    'prototype',
  ];

  public static sanitizeVoiceTranscript(input: unknown): string {
    if (typeof input !== 'string') {
      return '';
    }
    // Enforce hard length limit to prevent Regular Expression Denial of Service (ReDoS - OWASP M4)
    const bounded = input.slice(0, this.MAX_VOICE_COMMAND_LENGTH);
    // Strip zero-width spoofing characters and normalize whitespace
    const normalized = bounded
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\s+/g, ' ');
    return this.sanitizeString(normalized);
  }

  public static sanitizeString(input: unknown, maxLength: number = InputSanitizer.MAX_BLOCK_CONTENT_LENGTH): string {
    if (typeof input !== 'string') {
      return '';
    }
    // Enforce hard length cap BEFORE regex evaluation to prevent ReDoS / memory exhaustion (OWASP M4)
    const boundedLength = Math.max(0, Math.min(maxLength, InputSanitizer.MAX_BLOCK_CONTENT_LENGTH));
    const bounded = input.length > boundedLength ? input.slice(0, boundedLength) : input;

    // Remove null bytes, bidirectional spoofing overrides, and dangerous control characters
    let sanitized = bounded
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/[\u202A-\u202E\u2066-\u2069]/g, '');

    // Prevent script tags and dangerous HTML constructs
    sanitized = sanitized
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/data:text\/html/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/onload\s*=/gi, '')
      .replace(/onerror\s*=/gi, '');

    return sanitized.trim();
  }

  public static sanitizeInputContent(input: unknown, maxLength: number = InputSanitizer.MAX_BLOCK_CONTENT_LENGTH): string {
    if (typeof input !== 'string') {
      return '';
    }
    // Enforce hard length cap BEFORE regex evaluation to prevent ReDoS / memory exhaustion (OWASP M4)
    const boundedLength = Math.max(0, Math.min(maxLength, InputSanitizer.MAX_BLOCK_CONTENT_LENGTH));
    const bounded = input.length > boundedLength ? input.slice(0, boundedLength) : input;

    // Remove null bytes and dangerous control characters while preserving user newlines, tabs, and spaces
    let sanitized = bounded.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

    // Strip bidirectional-override / isolate characters used for text spoofing (Trojan Source style attacks)
    sanitized = sanitized.replace(/[\u202A-\u202E\u2066-\u2069]/g, '');

    // Prevent script tags and dangerous HTML constructs
    sanitized = sanitized
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/data:text\/html/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/onload\s*=/gi, '')
      .replace(/onerror\s*=/gi, '');

    return sanitized;
  }

  public static sanitizeSafeUrl(input: unknown): string {
    if (typeof input !== 'string') {
      return '';
    }
    const trimmed = input.trim();
    if (trimmed.length === 0 || trimmed.length > 2048) {
      return '';
    }
    // Reject control characters, whitespace, or embedded credentials (@) inside URLs
    if (/[\u0000-\u0020\u007F<>\\^`]/.test(trimmed)) {
      return '';
    }
    // Strictly whitelist http and https protocols to prevent XSS / local file leakage (OWASP M4 / A03:2021)
    const urlPattern = /^https?:\/\/[a-zA-Z0-9\-._]+(:[0-9]{1,5})?(\/[^\s]*)?$/i;
    if (urlPattern.test(trimmed)) {
      return trimmed;
    }
    return '';
  }

  public static sanitizeColorHex(input: unknown, fallback: string = ''): string {
    if (typeof input !== 'string') {
      return fallback;
    }
    const trimmed = input.trim();
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(trimmed)) {
      return trimmed;
    }
    return fallback;
  }

  public static sanitizeBlockItem(raw: unknown): BlockItem {
    if (!raw || typeof raw !== 'object') {
      return new BlockItem({ id: `blk_${Date.now()}`, content: '' });
    }
    const item = raw as Record<string, unknown>;
    const sanitizedId = this.sanitizeString(item.id) || `blk_${Date.now()}`;
    const sanitizedContent = this.sanitizeString(item.content);
    const validTypes: Array<BlockItem['type']> = [
      'heading1',
      'heading2',
      'text',
      'todo',
      'quote',
      'callout',
      'code',
      'divider',
      'bullet',
      'numbered',
    ];
    const rawType = typeof item.type === 'string' ? item.type : 'text';
    const type = validTypes.includes(rawType as BlockItem['type'])
      ? (rawType as BlockItem['type'])
      : 'text';

    const rawStyle = (item.style && typeof item.style === 'object') ? (item.style as Record<string, unknown>) : {};
    const style = new BlockFormattingStyle({
      bold: Boolean(rawStyle.bold),
      italic: Boolean(rawStyle.italic),
      underline: Boolean(rawStyle.underline),
      strikethrough: Boolean(rawStyle.strikethrough),
      textColor: this.sanitizeColorHex(rawStyle.textColor, ''),
      backgroundColor: this.sanitizeColorHex(rawStyle.backgroundColor, ''),
    });

    return new BlockItem({
      id: sanitizedId,
      type,
      content: sanitizedContent,
      checked: Boolean(item.checked),
      indentLevel: typeof item.indentLevel === 'number' ? Math.max(0, Math.min(5, item.indentLevel)) : 0,
      listNumber: typeof item.listNumber === 'number' ? item.listNumber : undefined,
      style,
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
      updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
    });
  }

  public static sanitizeSafeJsonParse<T>(rawJson: string): T | null {
    try {
      const parsed = JSON.parse(rawJson, (key, value) => {
        if (this.DANGEROUS_PROTO_KEYS.includes(key)) {
          return undefined; // Strip Prototype Pollution vectors (OWASP M4)
        }
        return value;
      });
      return parsed as T;
    } catch {
      return null;
    }
  }

  public static validateOidcClaims(
    claims: unknown,
    expectedClientId?: string,
    expectedNonce?: string
  ): claims is OIDCTokenClaims {
    if (!claims || typeof claims !== 'object') {
      return false;
    }
    const c = claims as Record<string, unknown>;
    if (typeof c.sub !== 'string' || c.sub.trim().length < 5 || c.sub.length > 255) {
      return false;
    }
    // Require exact Google OIDC issuer match to prevent substring spoofing (OWASP M3 / A07:2021)
    if (
      typeof c.iss !== 'string' ||
      (c.iss !== 'https://accounts.google.com' && c.iss !== 'accounts.google.com')
    ) {
      return false;
    }
    // Validate audience claim when expectedClientId is provided
    if (expectedClientId && (typeof c.aud !== 'string' || c.aud !== expectedClientId)) {
      return false;
    }
    const nowMs = Date.now();
    // Token must not be expired (allowing 60s clock skew)
    if (typeof c.exp !== 'number' || c.exp * 1000 < nowMs - 60000) {
      return false;
    }
    // Token must not be issued unreasonably far in the future (allowing 300s clock skew)
    if (typeof c.iat === 'number' && c.iat * 1000 > nowMs + 300000) {
      return false;
    }
    // Require exact cryptographic nonce match when expectedNonce is provided
    if (expectedNonce && (typeof c.nonce !== 'string' || c.nonce !== expectedNonce)) {
      return false;
    }
    return true;
  }

  public static validateVaultSnapshot(snapshot: unknown): snapshot is NoctisVaultSnapshot {
    if (!snapshot || typeof snapshot !== 'object') {
      return false;
    }
    const s = snapshot as Record<string, unknown>;
    if (!Array.isArray(s.diaryEntries) || !Array.isArray(s.secondBrainNotes)) {
      return false;
    }
    return true;
  }
}
