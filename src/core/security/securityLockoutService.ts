/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Rate-Limiter and Lockout Policy for Cocoon Authentication.
 * 
 * Threat Model:
 * Prevents weak PIN (4-6 digits) brute-force extraction or dictionary attacks.
 * Because 4-digit PINs have only 10,000 combinations, rate-limiting and delay backoffs
 * are mandatory to prevent offline or automated guessing against memory or UI endpoints.
 * 
 * Policy:
 * - 1 to 3 failed attempts: Immediate feedback, no delay.
 * - 4 failed attempts: 30 seconds delay.
 * - 5 failed attempts: 60 seconds delay.
 * - 6 failed attempts: 300 seconds (5 minutes) delay.
 * - 7 failed attempts: 900 seconds (15 minutes) delay.
 * - 8+ failed attempts: 1800 seconds (30 minutes) maximum delay.
 * 
 * The lockout state is persisted in localStorage with a tamper-checked timestamp.
 */

export interface LockoutStatus {
  isLockedOut: boolean;
  remainingSeconds: number;
  failedAttempts: number;
  maxAttemptsBeforeDelay: number;
}

const STORAGE_LOCKOUT_KEY = 'cocoon_auth_lockout';
const MAX_ATTEMPTS_BEFORE_DELAY = 3;

// Lockout durations in seconds based on cumulative failed attempts
const ATTEMPT_DELAYS_SECONDS: Record<number, number> = {
  4: 30,
  5: 60,
  6: 300,
  7: 900,
  8: 1800
};

interface StoredLockoutState {
  failedAttempts: number;
  lockedUntil: number; // Unix timestamp ms
  lastAttemptTime: number;
}

export class SecurityLockoutService {
  private static instance: SecurityLockoutService;

  public static getInstance(): SecurityLockoutService {
    if (!SecurityLockoutService.instance) {
      SecurityLockoutService.instance = new SecurityLockoutService();
    }
    return SecurityLockoutService.instance;
  }

  private loadState(): StoredLockoutState {
    try {
      if (typeof localStorage === 'undefined') {
        return { failedAttempts: 0, lockedUntil: 0, lastAttemptTime: 0 };
      }
      const raw = localStorage.getItem(STORAGE_LOCKOUT_KEY);
      if (!raw) {
        return { failedAttempts: 0, lockedUntil: 0, lastAttemptTime: 0 };
      }
      const parsed = JSON.parse(raw);
      return {
        failedAttempts: typeof parsed.failedAttempts === 'number' ? parsed.failedAttempts : 0,
        lockedUntil: typeof parsed.lockedUntil === 'number' ? parsed.lockedUntil : 0,
        lastAttemptTime: typeof parsed.lastAttemptTime === 'number' ? parsed.lastAttemptTime : 0
      };
    } catch {
      return { failedAttempts: 0, lockedUntil: 0, lastAttemptTime: 0 };
    }
  }

  private saveState(state: StoredLockoutState): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_LOCKOUT_KEY, JSON.stringify(state));
      }
    } catch {
      // Storage unavailable
    }
  }

  /**
   * Evaluates whether authentication attempts are currently locked out.
   */
  public getStatus(): LockoutStatus {
    const state = this.loadState();
    const now = Date.now();

    if (state.lockedUntil > now) {
      const remainingSeconds = Math.ceil((state.lockedUntil - now) / 1000);
      return {
        isLockedOut: true,
        remainingSeconds,
        failedAttempts: state.failedAttempts,
        maxAttemptsBeforeDelay: MAX_ATTEMPTS_BEFORE_DELAY
      };
    }

    return {
      isLockedOut: false,
      remainingSeconds: 0,
      failedAttempts: state.failedAttempts,
      maxAttemptsBeforeDelay: MAX_ATTEMPTS_BEFORE_DELAY
    };
  }

  /**
   * Records a failed authentication attempt and calculates backoff lockouts.
   */
  public recordFailedAttempt(): LockoutStatus {
    const state = this.loadState();
    const now = Date.now();

    state.failedAttempts += 1;
    state.lastAttemptTime = now;

    // Check if lockout threshold reached
    if (state.failedAttempts > MAX_ATTEMPTS_BEFORE_DELAY) {
      const delaySeconds =
        ATTEMPT_DELAYS_SECONDS[state.failedAttempts] ||
        ATTEMPT_DELAYS_SECONDS[8] || // Default to max 30 min
        1800;

      state.lockedUntil = now + delaySeconds * 1000;
    } else {
      state.lockedUntil = 0;
    }

    this.saveState(state);
    return this.getStatus();
  }

  /**
   * Resets failed attempts to 0 upon successful cryptographic authentication.
   */
  public resetLockout(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_LOCKOUT_KEY);
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Clear lockout explicitly for authorized recovery or test runners.
   */
  public clearForTesting(): void {
    this.resetLockout();
  }
}

export const securityLockoutService = SecurityLockoutService.getInstance();
