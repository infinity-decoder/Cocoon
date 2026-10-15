/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateRequiredString,
  validateEntityId,
  validatePositiveAmount,
  validateQuantity,
  validateCanonicalDate,
  validateCurrency,
  validatePhoneNumber,
  validateTaxRate,
  validateDiscount,
  validateBarcode,
  combineValidationResults,
  assertValid
} from './index';
import { generateEntityId } from '../../domain/primitives/EntityId';

describe('Application Validation: domainValidation', () => {
  it('validates required strings with length constraints', () => {
    assert.equal(validateRequiredString('Store Name', 'Name', 2, 50).isValid, true);
    assert.equal(validateRequiredString('A', 'Name', 2, 50).isValid, false);
    assert.equal(validateRequiredString('', 'Name').isValid, false);
    assert.equal(validateRequiredString(null, 'Name').isValid, false);
  });

  it('validates collision-resistant entity IDs with domain prefixes', () => {
    const validTxId = generateEntityId('tx');
    assert.equal(validateEntityId(validTxId, 'Transaction ID', 'tx').isValid, true);
    assert.equal(validateEntityId(validTxId, 'Transaction ID', 'wal').isValid, false);
    assert.equal(validateEntityId('12345', 'Transaction ID').isValid, false);
  });

  it('validates monetary amounts and enforces positivity / zero rules', () => {
    assert.equal(validatePositiveAmount(100.5, 'Amount').isValid, true);
    assert.equal(validatePositiveAmount(0, 'Amount', false).isValid, false);
    assert.equal(validatePositiveAmount(0, 'Amount', true).isValid, true);
    assert.equal(validatePositiveAmount(-50, 'Amount', true).isValid, false);
    assert.equal(validatePositiveAmount('invalid', 'Amount').isValid, false);
  });

  it('validates inventory quantities supporting fractional measured quantities', () => {
    assert.equal(validateQuantity(2.75, 'Quantity').isValid, true);
    assert.equal(validateQuantity('0.5', 'Quantity').isValid, true);
    assert.equal(validateQuantity(0, 'Quantity', false).isValid, false);
    assert.equal(validateQuantity(0, 'Quantity', true).isValid, true);
    assert.equal(validateQuantity(-1, 'Quantity').isValid, false);
  });

  it('validates canonical calendar dates and timestamps', () => {
    assert.equal(validateCanonicalDate('2026-10-14', 'Transaction Date').isValid, true);
    assert.equal(validateCanonicalDate('2026-10-14T10:30:00.000Z', 'Created At').isValid, true);
    assert.equal(validateCanonicalDate('2026-02-30', 'Date').isValid, false);
    assert.equal(validateCanonicalDate('invalid-date', 'Date').isValid, false);
  });

  it('validates supported 3-letter ISO currency codes', () => {
    assert.equal(validateCurrency('PKR').isValid, true);
    assert.equal(validateCurrency('USD').isValid, true);
    assert.equal(validateCurrency('KWD').isValid, true);
    assert.equal(validateCurrency('XYZ').isValid, false);
    assert.equal(validateCurrency('US').isValid, false);
  });

  it('validates domestic and international phone numbers', () => {
    // Pakistani local format (03xx)
    assert.equal(validatePhoneNumber('03001234567').isValid, true);
    assert.equal(validatePhoneNumber('0321-7654321').isValid, true);

    // Pakistani international format (+923xx)
    assert.equal(validatePhoneNumber('+923001234567').isValid, true);

    // International E.164 formats
    assert.equal(validatePhoneNumber('+14155552671').isValid, true);
    assert.equal(validatePhoneNumber('+447911123456').isValid, true);

    // Optional phone (empty or undefined is valid)
    assert.equal(validatePhoneNumber('').isValid, true);
    assert.equal(validatePhoneNumber(undefined).isValid, true);

    // Invalid phone numbers
    assert.equal(validatePhoneNumber('12345').isValid, false);
    assert.equal(validatePhoneNumber('abcd-phone').isValid, false);
  });

  it('validates tax rates and discounts between 0% and 100%', () => {
    assert.equal(validateTaxRate(18).isValid, true);
    assert.equal(validateTaxRate(0).isValid, true);
    assert.equal(validateTaxRate(100).isValid, true);
    assert.equal(validateTaxRate(-5).isValid, false);
    assert.equal(validateTaxRate(105).isValid, false);

    assert.equal(validateDiscount(25).isValid, true);
    assert.equal(validateDiscount(-1).isValid, false);
  });

  it('validates barcodes', () => {
    assert.equal(validateBarcode('8901234567890').isValid, true);
    assert.equal(validateBarcode('SKU_ABC-123').isValid, true);
    assert.equal(validateBarcode('').isValid, true); // Optional
    assert.equal(validateBarcode('$$$').isValid, false);
  });

  it('combines multiple validation results and throws AppError on failure', () => {
    const r1 = validateRequiredString('Valid Name', 'Name');
    const r2 = validatePositiveAmount(500, 'Price');
    const combinedValid = combineValidationResults(r1, r2);
    assert.equal(combinedValid.isValid, true);
    assert.doesNotThrow(() => assertValid(combinedValid));

    const r3 = validateRequiredString('', 'Name');
    const r4 = validatePositiveAmount(-10, 'Price');
    const combinedInvalid = combineValidationResults(r3, r4);
    assert.equal(combinedInvalid.isValid, false);
    assert.equal(combinedInvalid.errors.length, 2);

    assert.throws(
      () => assertValid(combinedInvalid),
      (err: any) => err.code === 'VALIDATION_FAILED' && err.message.includes('Name is required')
    );
  });
});
