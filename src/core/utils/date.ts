/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Returns current month string in YYYY-MM format
 */
export function getCurrentMonthStr(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Returns today date string in YYYY-MM-DD format
 */
export function getTodayDateStr(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Steps the month string (YYYY-MM) forward or backward by delta
 */
export function offsetMonth(monthStr: string, delta: number): string {
  const [year, month] = monthStr.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return date.toISOString().slice(0, 7);
}
