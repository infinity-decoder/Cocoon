/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Standard Web Cryptography & Key Derivation Utilities.
 * Uses Web Crypto API (supported across modern Android WebView, browsers, and Node 20+).
 * 
 * Complies strictly with:
 * - PBKDF2 with SHA-256 and minimum 100,000 iterations for PIN/passphrase key derivation.
 * - AES-GCM (256-bit) with unique 12-byte initialization vectors (IV).
 * - Cryptographically secure pseudo-random number generators (CSPRNG).
 */

const PBKDF2_DEFAULT_ITERATIONS = 100000;
const PBKDF2_KEY_LENGTH = 256; // 32 bytes

/**
 * Generates cryptographically secure random bytes using CSPRNG.
 */
export function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback for Node environments without global crypto
    const nodeCrypto = require('crypto');
    nodeCrypto.randomFillSync(bytes);
  }
  return bytes;
}

/**
 * Converts a Uint8Array to a hex string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Converts a hex string back into a Uint8Array.
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.trim().toLowerCase();
  if (cleaned.length % 2 !== 0) {
    throw new Error('Invalid hex string length');
  }
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes[i / 2] = parseInt(cleaned.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Hashes a PIN or password using PBKDF2-HMAC-SHA256 with 100,000 rounds.
 * Returns the derived key hash as a hex string.
 * The original PIN is never persisted anywhere.
 */
export async function hashPinPbkdf2(
  pin: string,
  saltBytes: Uint8Array,
  iterations: number = PBKDF2_DEFAULT_ITERATIONS
): Promise<string> {
  const encoder = new TextEncoder();
  const pinData = encoder.encode(pin);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    pinData,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    PBKDF2_KEY_LENGTH
  );

  return bytesToHex(new Uint8Array(derivedBits));
}

/**
 * Constant-time byte comparison to protect against timing-attack side channels.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Verifies an entered PIN against a stored salt and expected PBKDF2 hash.
 */
export async function verifyPinHash(
  pin: string,
  saltHex: string,
  expectedHashHex: string,
  iterations: number = PBKDF2_DEFAULT_ITERATIONS
): Promise<boolean> {
  try {
    const saltBytes = hexToBytes(saltHex);
    const calculatedHashHex = await hashPinPbkdf2(pin, saltBytes, iterations);
    return timingSafeEqual(calculatedHashHex, expectedHashHex);
  } catch {
    return false;
  }
}

/**
 * Derives a 256-bit AES-GCM Key Encryption Key (KEK) from a PIN using PBKDF2.
 */
export async function deriveKeyFromPin(
  pin: string,
  saltBytes: Uint8Array,
  iterations: number = PBKDF2_DEFAULT_ITERATIONS
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const pinData = encoder.encode(pin);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    pinData,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts arbitrary binary data using AES-256-GCM with a fresh random 12-byte IV.
 */
export async function encryptDataAesGcm(
  data: Uint8Array,
  key: CryptoKey
): Promise<{ ciphertextHex: string; ivHex: string }> {
  const iv = generateRandomBytes(12); // Standard 96-bit IV for AES-GCM

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    data
  );

  return {
    ciphertextHex: bytesToHex(new Uint8Array(encryptedBuffer)),
    ivHex: bytesToHex(iv)
  };
}

/**
 * Decrypts AES-256-GCM ciphertext. Throws an error if tag authentication fails (wrong key or tampering).
 */
export async function decryptDataAesGcm(
  ciphertextHex: string,
  ivHex: string,
  key: CryptoKey
): Promise<Uint8Array> {
  const ciphertextBytes = hexToBytes(ciphertextHex);
  const ivBytes = hexToBytes(ivHex);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes
    },
    key,
    ciphertextBytes
  );

  return new Uint8Array(decryptedBuffer);
}

/**
 * Computes a SHA-256 digest of input string for audit trail hash chaining.
 */
export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(hashBuffer));
}
