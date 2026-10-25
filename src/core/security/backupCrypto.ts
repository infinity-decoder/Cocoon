/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  generateRandomBytes,
  bytesToHex,
  hexToBytes,
  deriveKeyFromPin,
  sha256Hex
} from './cryptoUtils';

export interface UnencryptedBackupHeader {
  magic: string;
  formatVersion: string;
  appName: string;
  appVersion: string;
  schemaVersion: number;
  backupId: string;
  createdAt: string;
  isEncrypted: boolean;
  currencyCode: string;
  currencyScale: number;
  recordCounts?: {
    workspaces: number;
    transactions: number;
    accounts: number;
    journals: number;
    parties: number;
    products: number;
    attachments: number;
  };
}

export interface EncryptedBackupContainer {
  magic: 'COCOON_SECURE_BACKUP';
  formatVersion: '3.0.0';
  kdf: 'PBKDF2-HMAC-SHA256';
  iterations: number;
  saltHex: string;
  ivHex: string;
  ciphertextHex: string;
  backupId: string;
  createdAt: string;
  header: UnencryptedBackupHeader;
}

export const BACKUP_CONTAINER_MAGIC = 'COCOON_SECURE_BACKUP';
export const CURRENT_BACKUP_FORMAT_VERSION = '3.0.0';
export const CURRENT_DATABASE_SCHEMA_VERSION = 9;
export const PBKDF2_BACKUP_ITERATIONS = 100000;

/**
 * Checks whether an incoming backup string is an encrypted Cocoon backup container.
 */
export function isEncryptedBackup(rawString: string): boolean {
  try {
    const trimmed = rawString.trim();
    if (!trimmed.startsWith('{')) return false;
    const parsed = JSON.parse(trimmed);
    return Boolean(
      parsed &&
      typeof parsed === 'object' &&
      parsed.magic === BACKUP_CONTAINER_MAGIC &&
      parsed.ciphertextHex &&
      parsed.saltHex &&
      parsed.ivHex
    );
  } catch {
    return false;
  }
}

/**
 * Reads unencrypted header metadata without needing to decrypt the payload.
 */
export function peekBackupHeader(rawString: string): UnencryptedBackupHeader | null {
  try {
    const parsed = JSON.parse(rawString);
    if (parsed.magic === BACKUP_CONTAINER_MAGIC && parsed.header) {
      return parsed.header as UnencryptedBackupHeader;
    }
    // Check format v2.0.0
    if (parsed.manifest && parsed.manifest.archiveFormatVersion) {
      return {
        magic: 'COCOON_ARCHIVE',
        formatVersion: parsed.manifest.archiveFormatVersion,
        appName: parsed.manifest.appName || 'Cocoon',
        appVersion: '0.0.1',
        schemaVersion: parsed.manifest.schemaVersion || 1,
        backupId: parsed.manifest.backupId || 'legacy_v2',
        createdAt: parsed.manifest.exportedAt || new Date().toISOString(),
        isEncrypted: false,
        currencyCode: 'PKR',
        currencyScale: 100,
        recordCounts: {
          workspaces: 1,
          transactions: parsed.state?.transactions?.length || 0,
          accounts: parsed.state?.wallets?.length || 0,
          journals: 0,
          parties: 0,
          products: 0,
          attachments: parsed.manifest.attachmentCount || 0
        }
      };
    }
    // Check format v1.0.0
    if (parsed.version === '1.0.0') {
      return {
        magic: 'COCOON_LEGACY',
        formatVersion: '1.0.0',
        appName: parsed.appName || 'Cocoon',
        appVersion: '0.0.1',
        schemaVersion: 1,
        backupId: 'legacy_v1',
        createdAt: parsed.exportedAt || new Date().toISOString(),
        isEncrypted: false,
        currencyCode: 'PKR',
        currencyScale: 100,
        recordCounts: {
          workspaces: 1,
          transactions: parsed.data?.transactions?.length || 0,
          accounts: parsed.data?.wallets?.length || 0,
          journals: 0,
          parties: 0,
          products: 0,
          attachments: 0
        }
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Encrypts a serialized backup JSON payload with AES-256-GCM using PBKDF2 key derivation.
 */
export async function encryptBackupPackage(
  plaintextJson: string,
  passphrase: string,
  headerInfo: Partial<UnencryptedBackupHeader>
): Promise<string> {
  if (!passphrase || passphrase.length < 4) {
    throw new Error('Backup passphrase must be at least 4 characters long.');
  }

  // 1. Generate fresh 16-byte random salt and 12-byte IV
  const saltBytes = generateRandomBytes(16);
  const ivBytes = generateRandomBytes(12);

  // 2. Derive 256-bit AES key using PBKDF2 with 100,000 iterations
  const kek = await deriveKeyFromPin(passphrase, saltBytes, PBKDF2_BACKUP_ITERATIONS);

  // 3. Encrypt data with AES-256-GCM (appends 16-byte authentication tag automatically)
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintextJson);

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes
    },
    kek,
    plaintextBytes
  );

  const ciphertextHex = bytesToHex(new Uint8Array(encryptedBuffer));
  const backupId = headerInfo.backupId || `bkp_${Date.now()}`;
  const createdAt = headerInfo.createdAt || new Date().toISOString();

  const fullHeader: UnencryptedBackupHeader = {
    magic: BACKUP_CONTAINER_MAGIC,
    formatVersion: CURRENT_BACKUP_FORMAT_VERSION,
    appName: headerInfo.appName || 'Cocoon',
    appVersion: headerInfo.appVersion || '0.0.1',
    schemaVersion: headerInfo.schemaVersion || CURRENT_DATABASE_SCHEMA_VERSION,
    backupId,
    createdAt,
    isEncrypted: true,
    currencyCode: headerInfo.currencyCode || 'PKR',
    currencyScale: headerInfo.currencyScale || 100,
    recordCounts: headerInfo.recordCounts
  };

  const container: EncryptedBackupContainer = {
    magic: BACKUP_CONTAINER_MAGIC,
    formatVersion: CURRENT_BACKUP_FORMAT_VERSION,
    kdf: 'PBKDF2-HMAC-SHA256',
    iterations: PBKDF2_BACKUP_ITERATIONS,
    saltHex: bytesToHex(saltBytes),
    ivHex: bytesToHex(ivBytes),
    ciphertextHex,
    backupId,
    createdAt,
    header: fullHeader
  };

  return JSON.stringify(container, null, 2);
}

/**
 * Decrypts and authenticates an encrypted backup container.
 * Throws an explicit error if the passphrase is wrong or if the ciphertext has been tampered with.
 */
export async function decryptBackupPackage(
  containerInput: string | EncryptedBackupContainer,
  passphrase: string
): Promise<string> {
  let container: EncryptedBackupContainer;
  if (typeof containerInput === 'string') {
    try {
      container = JSON.parse(containerInput);
    } catch {
      throw new Error('Malformed backup package. Content is not valid JSON.');
    }
  } else {
    container = containerInput;
  }

  if (container.magic !== BACKUP_CONTAINER_MAGIC) {
    throw new Error('Invalid backup container magic. Not a Cocoon encrypted backup.');
  }

  if (!container.saltHex || !container.ivHex || !container.ciphertextHex) {
    throw new Error('Corrupted backup container: missing cryptographic envelope parameters.');
  }

  const saltBytes = hexToBytes(container.saltHex);
  const ivBytes = hexToBytes(container.ivHex);
  const ciphertextBytes = hexToBytes(container.ciphertextHex);

  if (ciphertextBytes.length < 16) {
    throw new Error('Truncated backup package. Ciphertext does not contain authentication tag.');
  }

  // Derive key using same KDF parameters
  const kek = await deriveKeyFromPin(passphrase, saltBytes, container.iterations || PBKDF2_BACKUP_ITERATIONS);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes
      },
      kek,
      ciphertextBytes
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (err: any) {
    throw new Error('Authentication failed: incorrect passphrase or tampered backup payload.');
  }
}
