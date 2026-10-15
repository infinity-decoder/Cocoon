/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DateRange {
  /**
   * Inclusive start boundary (ISO-8601 UTC string: YYYY-MM-DDTHH:mm:ss.sssZ)
   */
  start: string;
  /**
   * Exclusive end boundary (ISO-8601 UTC string: YYYY-MM-DDTHH:mm:ss.sssZ)
   */
  end: string;
}

/**
 * Validates whether a candidate string is a valid ISO calendar date (YYYY-MM-DD).
 * Checks actual month day bounds (e.g. rejects 2026-02-30).
 */
export function isValidCalendarDate(dateStr: unknown): boolean {
  if (typeof dateStr !== 'string') return false;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Validates whether a candidate string is an ISO-8601 timestamp or date string.
 */
export function isValidIsoTimestamp(timestampStr: unknown): boolean {
  if (typeof timestampStr !== 'string') return false;
  const timestamp = Date.parse(timestampStr);
  return !isNaN(timestamp);
}

/**
 * Formats a Date or timestamp into a canonical UTC ISO-8601 string.
 */
export function toCanonicalTimestampStr(date: Date | string | number = new Date()): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date value: ${date}`);
  }
  return d.toISOString();
}

/**
 * Formats a Date or timestamp into a canonical YYYY-MM-DD calendar date string.
 */
export function toCanonicalDateStr(date: Date | string | number = new Date()): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date value: ${date}`);
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Creates an inclusive-start, exclusive-end [start, end) DateRange for a single calendar day.
 */
export function createDayRange(dateStr: string): DateRange {
  const cleanDate = dateStr.slice(0, 10);
  if (!isValidCalendarDate(cleanDate)) {
    throw new Error(`Invalid day format for DateRange: "${dateStr}". Expected YYYY-MM-DD.`);
  }

  const [y, m, d] = cleanDate.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)).toISOString();
  const end = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0)).toISOString();

  return { start, end };
}

/**
 * Creates an inclusive-start, exclusive-end [start, end) DateRange for a calendar month.
 * e.g. "2026-10" -> [2026-10-01T00:00:00.000Z, 2026-11-01T00:00:00.000Z)
 */
export function createMonthRange(yearMonthStr: string): DateRange {
  const clean = yearMonthStr.trim().slice(0, 7);
  const match = clean.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid month format for DateRange: "${yearMonthStr}". Expected YYYY-MM.`);
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);

  if (month < 1 || month > 12) {
    throw new Error(`Invalid month value: ${month}`);
  }

  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)).toISOString();
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)).toISOString();

  return { start, end };
}

/**
 * Creates an inclusive-start, exclusive-end [start, end) DateRange for a calendar year.
 */
export function createYearRange(year: number): DateRange {
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)).toISOString();
  const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0)).toISOString();
  return { start, end };
}

/**
 * Creates an inclusive-start, exclusive-end [start, end) DateRange from two user-provided dates.
 * The end date is treated as inclusive in user terms and converted to exclusive end of the day.
 */
export function createCustomDateRange(startDateStr: string, inclusiveEndDateStr: string): DateRange {
  const startClean = startDateStr.slice(0, 10);
  const endClean = inclusiveEndDateStr.slice(0, 10);

  if (!isValidCalendarDate(startClean)) {
    throw new Error(`Invalid start date: "${startDateStr}". Expected YYYY-MM-DD.`);
  }
  if (!isValidCalendarDate(endClean)) {
    throw new Error(`Invalid end date: "${inclusiveEndDateStr}". Expected YYYY-MM-DD.`);
  }

  const [sy, sm, sd] = startClean.split('-').map(Number);
  const [ey, em, ed] = endClean.split('-').map(Number);

  const start = new Date(Date.UTC(sy, sm - 1, sd, 0, 0, 0, 0)).toISOString();
  // Exclusive end is the start of the day after inclusive end
  const end = new Date(Date.UTC(ey, em - 1, ed + 1, 0, 0, 0, 0)).toISOString();

  if (start > end) {
    throw new Error(`Start date "${startClean}" cannot be after end date "${endClean}".`);
  }

  return { start, end };
}

/**
 * Tests whether a given date falls within the inclusive start and exclusive end of a DateRange.
 * [start, end): date >= range.start && date < range.end
 */
export function isDateInRange(date: Date | string, range: DateRange): boolean {
  const isoStr = date instanceof Date ? date.toISOString() : new Date(date).toISOString();
  return isoStr >= range.start && isoStr < range.end;
}

/**
 * Stable, deterministic comparator for financial records.
 * Solves unstable UI flipping when multiple transactions share identical dates.
 *
 * Sorting order:
 * 1. Primary: Transaction Date / business-effective date
 * 2. Secondary: Creation Timestamp (createdAt)
 * 3. Tertiary (Tie-breaker): Entity ID (lexicographical)
 */
export function compareFinancialRecordsByDate<
  T extends { date: string; createdAt?: string; id?: string }
>(a: T, b: T, direction: 'asc' | 'desc' = 'desc'): number {
  const sign = direction === 'asc' ? 1 : -1;

  // 1. Primary: Effective Date
  const dateDiff = a.date.localeCompare(b.date);
  if (dateDiff !== 0) {
    return sign * dateDiff;
  }

  // 2. Secondary: Created At
  const createdA = a.createdAt || a.date;
  const createdB = b.createdAt || b.date;
  const createdDiff = createdA.localeCompare(createdB);
  if (createdDiff !== 0) {
    return sign * createdDiff;
  }

  // 3. Tertiary: Entity ID tie-breaker
  const idA = a.id || '';
  const idB = b.id || '';
  return sign * idA.localeCompare(idB);
}
