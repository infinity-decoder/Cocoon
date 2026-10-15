/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidCalendarDate,
  toCanonicalDateStr,
  toCanonicalTimestampStr,
  createDayRange,
  createMonthRange,
  createYearRange,
  createCustomDateRange,
  isDateInRange,
  compareFinancialRecordsByDate
} from './CanonicalDate';

describe('Domain Primitives: CanonicalDate & DateRange', () => {
  it('validates calendar dates strictly against month boundaries', () => {
    assert.equal(isValidCalendarDate('2026-10-14'), true);
    assert.equal(isValidCalendarDate('2024-02-29'), true); // Leap year 2024
    assert.equal(isValidCalendarDate('2026-02-29'), false); // Non-leap year 2026
    assert.equal(isValidCalendarDate('2026-04-31'), false); // April has 30 days
    assert.equal(isValidCalendarDate('2026-13-01'), false); // Month 13
    assert.equal(isValidCalendarDate('not-a-date'), false);
    assert.equal(isValidCalendarDate(123), false);
  });

  it('converts timestamps and dates into canonical ISO formats', () => {
    const fixed = new Date(Date.UTC(2026, 9, 14, 15, 30, 0, 0));
    assert.equal(toCanonicalDateStr(fixed), '2026-10-14');
    assert.equal(toCanonicalTimestampStr(fixed), '2026-10-14T15:30:00.000Z');
  });

  it('creates inclusive-start, exclusive-end [start, end) ranges for day, month, and year', () => {
    // Day range for 2026-10-14
    const dayRange = createDayRange('2026-10-14');
    assert.equal(dayRange.start, '2026-10-14T00:00:00.000Z');
    assert.equal(dayRange.end, '2026-10-15T00:00:00.000Z');

    // Month range for October 2026
    const monthRange = createMonthRange('2026-10');
    assert.equal(monthRange.start, '2026-10-01T00:00:00.000Z');
    assert.equal(monthRange.end, '2026-11-01T00:00:00.000Z');

    // Year range for 2026
    const yearRange = createYearRange(2026);
    assert.equal(yearRange.start, '2026-01-01T00:00:00.000Z');
    assert.equal(yearRange.end, '2027-01-01T00:00:00.000Z');

    // Custom range from 2026-10-05 to 2026-10-10 inclusive
    const customRange = createCustomDateRange('2026-10-05', '2026-10-10');
    assert.equal(customRange.start, '2026-10-05T00:00:00.000Z');
    assert.equal(customRange.end, '2026-10-11T00:00:00.000Z'); // Exclusive end of the 10th
  });

  it('correctly evaluates boundary conditions for isDateInRange ([start, end))', () => {
    const range = createMonthRange('2026-10');

    // Exact start millisecond: INCLUDED
    assert.equal(isDateInRange('2026-10-01T00:00:00.000Z', range), true);

    // Mid-month: INCLUDED
    assert.equal(isDateInRange('2026-10-14T12:00:00.000Z', range), true);

    // Last second of October: INCLUDED
    assert.equal(isDateInRange('2026-10-31T23:59:59.999Z', range), true);

    // Exact start of November (range.end): EXCLUDED
    assert.equal(isDateInRange('2026-11-01T00:00:00.000Z', range), false);

    // Prior month: EXCLUDED
    assert.equal(isDateInRange('2026-09-30T23:59:59.999Z', range), false);
  });

  it('guarantees 100% deterministic sorting with secondary and tertiary tie-breakers', () => {
    const records = [
      { id: 'tx-3', date: '2026-10-14', createdAt: '2026-10-14T10:00:00Z' },
      { id: 'tx-1', date: '2026-10-14', createdAt: '2026-10-14T12:00:00Z' },
      { id: 'tx-2', date: '2026-10-14', createdAt: '2026-10-14T10:00:00Z' }, // Identical date and createdAt, tie-broken by ID
      { id: 'tx-0', date: '2026-10-15', createdAt: '2026-10-15T08:00:00Z' },
      { id: 'tx-4', date: '2026-10-12', createdAt: '2026-10-12T09:00:00Z' }
    ];

    const sortedDesc = [...records].sort((a, b) => compareFinancialRecordsByDate(a, b, 'desc'));

    // Expected order desc:
    // 1. tx-0 (2026-10-15)
    // 2. tx-1 (2026-10-14, 12:00)
    // 3. tx-3 (2026-10-14, 10:00, id 'tx-3' > 'tx-2')
    // 4. tx-2 (2026-10-14, 10:00, id 'tx-2')
    // 5. tx-4 (2026-10-12)
    assert.deepEqual(
      sortedDesc.map(r => r.id),
      ['tx-0', 'tx-1', 'tx-3', 'tx-2', 'tx-4']
    );

    const sortedAsc = [...records].sort((a, b) => compareFinancialRecordsByDate(a, b, 'asc'));
    assert.deepEqual(
      sortedAsc.map(r => r.id),
      ['tx-4', 'tx-2', 'tx-3', 'tx-1', 'tx-0']
    );
  });
});
