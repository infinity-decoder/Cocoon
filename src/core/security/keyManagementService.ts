/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  generateRandomBytes,
  bytesToHex,
  hexToBytes,
  deriveKeyFromPin,
  encryptDataAesGcm,
  decryptDataAesGcm,
  hashPinPbkdf2,
  verifyPinHash
} from './cryptoUtils';
import { securityLockoutService } from './securityLockoutService';

/**
 * Envelope Key Container:
 * Stores the encrypted Master Database Encryption Key (DEK) wrapped by
 * the PIN-derived Key Encryption Key (KEK).
 * 
 * Never stores the plaintext DEK or the plaintext PIN.
 */
export interface KeyEnvelope {
  version: number;
  saltHex: string; // 16-byte random salt for PBKDF2
  ivHex: string; // 12-byte random IV for AES-GCM
  encryptedDekHex: string; // AES-256-GCM ciphertext of DEK
  pinHashHex: string; // PBKDF2 verification hash
  createdAt: string;
}

const ENVELOPE_STORAGE_KEY = 'cocoon_key_envelope';
const ACTIVE_SESSION_DEK_KEY = 'cocoon_session_dek_active';

export class KeyManagementService {
  private static instance: KeyManagementService;
  private activeDecryptedKey: string | null = null;

  public static getInstance(): KeyManagementService {
    if (!KeyManagementService.instance) {
      KeyManagementService.instance = new KeyManagementService();
    }
    return KeyManagementService.instance;
  }

  /**
   * Checks whether an encrypted key envelope is configured on this device.
   */
  public hasKeyEnvelope(): boolean {
    try {
      if (typeof localStorage === 'undefined') return false;
      return !!localStorage.getItem(ENVELOPE_STORAGE_KEY);
    } catch {
      return false;
    }
  }

  /**
   * Retrieves the raw key envelope from local storage.
   */
  public getKeyEnvelope(): KeyEnvelope | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(ENVELOPE_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as KeyEnvelope;
    } catch {
      return null;
    }
  }

  /**
   * Initializes or re-keys the Database Encryption Key (DEK) envelope.
   * 1. Generates a cryptographically random 256-bit DEK using CSPRNG.
   * 2. Derives a KEK from the PIN using PBKDF2 (100,000 rounds) and fresh 16-byte salt.
   * 3. Encrypts the DEK using AES-256-GCM with fresh 12-byte IV.
   * 4. Stores the envelope and pin verification hash.
   * 
   * The raw PIN and raw DEK are NEVER persisted in unencrypted storage.
   */
  public async setupPinAndEnvelope(pin: string): Promise<{ dekHex: string }> {
    if (!pin || pin.length < 4) {
      throw new Error('PIN must be at least 4 digits');
    }

    // 1. Generate 256-bit random DEK for SQLCipher / Database encryption
    const rawDekBytes = generateRandomBytes(32);
    const dekHex = bytesToHex(rawDekBytes);

    // 2. Generate 16-byte random salt for PBKDF2
    const saltBytes = generateRandomBytes(16);
    const saltHex = bytesToHex(saltBytes);

    // 3. Derive KEK (Key Encryption Key)
    const kek = await deriveKeyFromPin(pin, saltBytes);

    // 4. Encrypt DEK with KEK using AES-256-GCM
    const { ciphertextHex, ivHex } = await encryptDataAesGcm(rawDekBytes, kek);

    // 5. Generate PBKDF2 PIN hash for fast pre-validation
    const pinHashHex = await hashPinPbkdf2(pin, saltBytes);

    const envelope: KeyEnvelope = {
      version: 1,
      saltHex,
      ivHex,
      encryptedDekHex: ciphertextHex,
      pinHashHex,
      createdAt: new Date().toISOString()
    };

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ENVELOPE_STORAGE_KEY, JSON.stringify(envelope));
    }

    // Cache decrypted key in volatile memory for the active app session
    this.activeDecryptedKey = dekHex;
    securityLockoutService.resetLockout();

    return { dekHex };
  }

  /**
   * Authenticates entered PIN against the envelope:
   * 1. Checks lockout rate-limit status.
   * 2. Verifies PIN hash with PBKDF2.
   * 3. Derives KEK and unwraps the encrypted DEK using AES-256-GCM.
   * 4. Resets lockout on success, or increments failed attempts on error.
   */
  public async unlockWithPin(pin: string): Promise<{
    success: boolean;
    dekHex?: string;
    isLockedOut?: boolean;
    remainingSeconds?: number;
    error?: string;
  }> {
    // 1. Rate-limit check
    const lockout = securityLockoutService.getStatus();
    if (lockout.isLockedOut) {
      return {
        success: false,
        isLockedOut: true,
        remainingSeconds: lockout.remainingSeconds,
        error: `Too many failed attempts. Device locked for ${lockout.remainingSeconds} seconds.`
      };
    }

    const envelope = this.getKeyEnvelope();
    if (!envelope) {
      return { success: false, error: 'No security key envelope found on device.' };
    }

    try {
      // 2. Verify PIN hash first
      const isPinMatch = await verifyPinHash(pin, envelope.saltHex, envelope.pinHashHex);
      if (!isPinMatch) {
        const updatedLockout = securityLockoutService.recordFailedAttempt();
        return {
          success: false,
          isLockedOut: updatedLockout.isLockedOut,
          remainingSeconds: updatedLockout.remainingSeconds,
          error: 'Incorrect PIN code.'
        };
      }

      // 3. Unwrap DEK using AES-256-GCM
      const saltBytes = hexToBytes(envelope.saltHex);
      const kek = await deriveKeyFromPin(pin, saltBytes);
      const decryptedDekBytes = await decryptDataAesGcm(
        envelope.encryptedDekHex,
        envelope.ivHex,
        kek
      );

      const dekHex = bytesToHex(decryptedDekBytes);
      this.activeDecryptedKey = dekHex;
      securityLockoutService.resetLockout();

      return {
        success: true,
        dekHex
      };
    } catch (err: any) {
      const updatedLockout = securityLockoutService.recordFailedAttempt();
      return {
        success: false,
        isLockedOut: updatedLockout.isLockedOut,
        remainingSeconds: updatedLockout.remainingSeconds,
        error: 'Cryptographic authentication failed. Key could not be unwrapped.'
      };
    }
  }

  /**
   * Reauthentication for critical actions (Export backup, Factory reset, Change PIN).
   */
  public async reauthenticateSensitiveOperation(pin: string): Promise<boolean> {
    const result = await this.unlockWithPin(pin);
    return result.success;
  }

  /**
   * Locks the active session and clears the in-memory decrypted DEK.
   */
  public lockSession(): void {
    this.activeDecryptedKey = null;
  }

  /**
   * Returns whether an active unlocked session exists with decrypted key in memory.
   */
  public isSessionUnlocked(): boolean {
    return this.activeDecryptedKey !== null;
  }

  /**
   * Returns the active in-memory decrypted DEK for SQLCipher operations.
   */
  public getActiveDecryptedKey(): string | null {
    return this.activeDecryptedKey;
  }

  /**
   * Removes all key envelopes (e.g. factory reset).
   */
  public wipeKeys(): void {
    this.activeDecryptedKey = null;
    securityLockoutService.resetLockout();
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(ENVELOPE_STORAGE_KEY);
      }
    } catch {
      // Ignore
    }
  }
}

export const keyManagementService = KeyManagementService.getInstance();
