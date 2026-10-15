/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppError } from '../../core/errors/AppError';
import { SUPPORTED_CURRENCIES } from '../../domain/money/Money';
import { isValidEntityId } from '../../domain/primitives/EntityId';
import { isValidCalendarDate, isValidIsoTimestamp } from '../../domain/primitives/CanonicalDate';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function successValidation(): ValidationResult {
  return { isValid: true, errors: [] };
}

export function failValidation(...errors: string[]): ValidationResult {
  return { isValid: false, errors };
}

export function combineValidationResults(...results: ValidationResult[]): ValidationResult {
  const errors: string[] = [];
  for (const res of results) {
    if (!res.isValid) {
      errors.push(...res.errors);
    }
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function assertValid(result: ValidationResult, context?: Record<string, unknown>): void {
  if (!result.isValid) {
    throw AppError.validation(result.errors.join('; '), { context });
  }
}

/**
 * Validates required non-empty string with optional min and max length bounds.
 */
export function validateRequiredString(
  value: unknown,
  fieldName: string,
  minLength = 1,
  maxLength = 255
): ValidationResult {
  if (typeof value !== 'string') {
    return failValidation(`${fieldName} must be a valid string.`);
  }

  const clean = value.trim();
  if (clean.length < minLength) {
    return failValidation(`${fieldName} is required (minimum ${minLength} character${minLength > 1 ? 's' : ''}).`);
  }

  if (clean.length > maxLength) {
    return failValidation(`${fieldName} exceeds maximum length of ${maxLength} characters.`);
  }

  return successValidation();
}

/**
 * Validates collision-resistant Entity IDs.
 */
export function validateEntityId(
  id: unknown,
  fieldName = 'ID',
  expectedPrefix?: string
): ValidationResult {
  if (!isValidEntityId(id, expectedPrefix)) {
    return failValidation(
      expectedPrefix
        ? `${fieldName} must be a valid collision-resistant identifier with prefix "${expectedPrefix}_".`
        : `${fieldName} must be a valid collision-resistant identifier.`
    );
  }
  return successValidation();
}

/**
 * Validates positive monetary amount (or zero if allowed).
 */
export function validatePositiveAmount(
  amount: unknown,
  fieldName = 'Amount',
  allowZero = false
): ValidationResult {
  if (amount === undefined || amount === null || amount === '') {
    return failValidation(`${fieldName} is required.`);
  }

  const num = typeof amount === 'number' ? amount : Number(amount);
  if (isNaN(num)) {
    return failValidation(`${fieldName} must be a valid numeric amount.`);
  }

  if (allowZero ? num < 0 : num <= 0) {
    return failValidation(
      allowZero
        ? `${fieldName} cannot be negative.`
        : `${fieldName} must be greater than zero.`
    );
  }

  return successValidation();
}

/**
 * Validates inventory or measured item quantity.
 */
export function validateQuantity(
  quantity: unknown,
  fieldName = 'Quantity',
  allowZero = false
): ValidationResult {
  if (quantity === undefined || quantity === null || quantity === '') {
    return failValidation(`${fieldName} is required.`);
  }

  const num = typeof quantity === 'number' ? quantity : Number(quantity);
  if (isNaN(num)) {
    return failValidation(`${fieldName} must be a valid number.`);
  }

  if (allowZero ? num < 0 : num <= 0) {
    return failValidation(
      allowZero
        ? `${fieldName} cannot be negative.`
        : `${fieldName} must be greater than zero.`
    );
  }

  return successValidation();
}

/**
 * Validates date strings (supports YYYY-MM-DD calendar dates and ISO-8601 timestamps).
 */
export function validateCanonicalDate(dateStr: unknown, fieldName = 'Date'): ValidationResult {
  if (typeof dateStr !== 'string' || !dateStr.trim()) {
    return failValidation(`${fieldName} is required.`);
  }

  const clean = dateStr.trim();
  const datePortion = clean.slice(0, 10);
  const isValidDatePortion = isValidCalendarDate(datePortion);

  if (!isValidDatePortion) {
    return failValidation(`${fieldName} must be a valid calendar date (YYYY-MM-DD) or ISO timestamp.`);
  }

  // If time portion is present, verify full ISO timestamp validity
  if (clean.length > 10) {
    if (!isValidIsoTimestamp(clean)) {
      return failValidation(`${fieldName} must be a valid calendar date (YYYY-MM-DD) or ISO timestamp.`);
    }
  }

  return successValidation();
}

/**
 * Validates currency code against standard 3-letter ISO definitions.
 */
export function validateCurrency(code: unknown, fieldName = 'Currency'): ValidationResult {
  if (typeof code !== 'string' || !code.trim()) {
    return failValidation(`${fieldName} code is required.`);
  }

  const normalized = code.trim().toUpperCase();
  if (normalized.length !== 3) {
    return failValidation(`${fieldName} must be a 3-letter ISO code.`);
  }

  if (!SUPPORTED_CURRENCIES[normalized]) {
    return failValidation(`Unsupported currency code "${normalized}".`);
  }

  return successValidation();
}

/**
 * Validates phone numbers.
 * Supports Pakistani domestic numbers (03001234567, 0321-1234567),
 * international format (+923001234567), and generic E.164.
 */
export function validatePhoneNumber(phone: unknown, fieldName = 'Phone number'): ValidationResult {
  if (phone === undefined || phone === null || phone === '') {
    return successValidation(); // Optional phone number
  }

  if (typeof phone !== 'string') {
    return failValidation(`${fieldName} must be a string.`);
  }

  const sanitized = phone.replace(/[\s\-\(\)]/g, '');
  // Pakistani domestic 03xx or international +923xx or standard international +1..+999
  const pkPattern = /^(?:\+92|0092|0)(3\d{9})$/;
  const internationalPattern = /^\+?[1-9]\d{6,14}$/;

  if (!pkPattern.test(sanitized) && !internationalPattern.test(sanitized)) {
    return failValidation(
      `${fieldName} "${phone}" is not a valid phone number. Expected local format (e.g. 03001234567) or international format (e.g. +923001234567).`
    );
  }

  return successValidation();
}

/**
 * Validates tax rate percentage (0% to 100%).
 */
export function validateTaxRate(rate: unknown, fieldName = 'Tax rate'): ValidationResult {
  if (rate === undefined || rate === null || rate === '') {
    return successValidation();
  }

  const num = typeof rate === 'number' ? rate : Number(rate);
  if (isNaN(num)) {
    return failValidation(`${fieldName} must be a valid percentage.`);
  }

  if (num < 0 || num > 100) {
    return failValidation(`${fieldName} must be between 0% and 100%.`);
  }

  return successValidation();
}

/**
 * Validates percentage discounts or margins (0% to 100%).
 */
export function validateDiscount(discount: unknown, fieldName = 'Discount'): ValidationResult {
  return validateTaxRate(discount, fieldName);
}

/**
 * Validates alphanumeric barcodes.
 */
export function validateBarcode(barcode: unknown, fieldName = 'Barcode'): ValidationResult {
  if (barcode === undefined || barcode === null || barcode === '') {
    return successValidation(); // Barcodes are optional for some items
  }

  if (typeof barcode !== 'string') {
    return failValidation(`${fieldName} must be a string.`);
  }

  const clean = barcode.trim();
  if (!/^[A-Za-z0-9\-_]{3,48}$/.test(clean)) {
    return failValidation(`${fieldName} must be 3 to 48 alphanumeric characters.`);
  }

  return successValidation();
}

/**
 * Validates party credit limits.
 */
export function validatePartyCreditLimit(limit: number): ValidationResult {
  const errors: string[] = [];
  if (limit < 0) {
    errors.push('Credit limit cannot be negative.');
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}

export const validateCurrencyCode = validateCurrency;

