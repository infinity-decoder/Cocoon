/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Formats a monetary amount into a clean, localized string.
 */
export function formatCurrency(
  amount: number,
  currencySymbol = '₨',
  decimalPlaces = 0
): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString(undefined, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces
  });

  return `${isNegative ? '-' : ''}${currencySymbol} ${formatted}`;
}
