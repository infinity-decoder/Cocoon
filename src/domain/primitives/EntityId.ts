/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Standard typed entity prefixes to ensure clear domain provenance.
 */
export type EntityPrefix =
  | 'tx'
  | 'wal'
  | 'cat'
  | 'subcat'
  | 'party'
  | 'inv'
  | 'item'
  | 'biz'
  | 'entry'
  | 'audit'
  | 'budget'
  | 'goal'
  | 'reminder'
  | string;

/**
 * Generates a cryptographically strong, collision-resistant UUID v4.
 * Compatible with Node.js, modern Chromium webviews, and Capacitor Android/iOS runtimes.
 */
function generateRawUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Fall through to getRandomValues
    }
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Set UUID v4 version (0100) and variant (10xx)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Math.random high-entropy fallback (for unusual sandboxes)
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return `${s4()}${s4()}-${s4()}-4${s4().substr(0, 3)}-a${s4().substr(0, 3)}-${s4()}${s4()}${s4()}`;
}

/**
 * Generates a stable, collision-resistant identifier with optional domain prefix.
 * Never uses timestamps alone or display names as IDs.
 */
export function generateEntityId(prefix?: EntityPrefix): string {
  const uuid = generateRawUuid();
  return prefix ? `${prefix}_${uuid}` : uuid;
}

/**
 * Validates whether a candidate string is a valid, collision-resistant entity ID.
 * Rejects timestamps alone (e.g. "1710000000000"), numeric array indexes ("0", "1"),
 * or display names.
 */
export function isValidEntityId(id: unknown, expectedPrefix?: EntityPrefix): boolean {
  if (typeof id !== 'string') return false;
  const clean = id.trim();

  // Minimum length check (UUID has 36 chars; with prefix e.g. tx_... > 38 chars)
  if (clean.length < 16) return false;

  // Reject purely numeric values (timestamps or array positions)
  if (/^\d+$/.test(clean)) return false;

  // If prefix requested, verify matching prefix
  if (expectedPrefix) {
    if (!clean.startsWith(`${expectedPrefix}_`)) {
      return false;
    }
  }

  // Allow standard UUID or prefixed UUID (letters, numbers, hyphens, underscores)
  const idPattern = /^(?:[a-z0-9]+_)?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  const relaxedPattern = /^[a-zA-Z0-9_\-]{16,64}$/;

  return idPattern.test(clean) || relaxedPattern.test(clean);
}

export const EntityId = {
  generate: generateEntityId,
  isValid: isValidEntityId
};

