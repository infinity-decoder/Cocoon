/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Supported rounding modes for financial operations.
 * - HALF_EVEN: Banker's rounding (IEEE-754 standard). Rounds to the nearest even neighbor when equidistant.
 * - HALF_UP: Standard arithmetic rounding. Rounds away from zero at 0.5.
 * - CEIL: Rounds towards positive infinity.
 * - FLOOR: Rounds towards negative infinity.
 * - TRUNC: Rounds towards zero (truncation).
 */
export type RoundingMode = 'HALF_EVEN' | 'HALF_UP' | 'CEIL' | 'FLOOR' | 'TRUNC';

/**
 * Divides numerator by denominator with explicit integer rounding mode.
 * Operates purely on bigints to prevent IEEE-754 floating point drift.
 */
export function divideBigIntWithRounding(
  numerator: bigint,
  denominator: bigint,
  mode: RoundingMode = 'HALF_EVEN'
): bigint {
  if (denominator === 0n) {
    throw new Error('Division by zero in monetary arithmetic.');
  }

  const isNegResult = (numerator < 0n) !== (denominator < 0n);
  const absNum = numerator < 0n ? -numerator : numerator;
  const absDen = denominator < 0n ? -denominator : denominator;

  const quotient = absNum / absDen;
  const remainder = absNum % absDen;

  if (remainder === 0n) {
    return isNegResult ? -quotient : quotient;
  }

  let roundUp = false;
  const doubleRemainder = remainder * 2n;

  switch (mode) {
    case 'TRUNC':
      roundUp = false;
      break;

    case 'CEIL':
      // Round towards +infinity: if positive result, add 1
      roundUp = !isNegResult;
      break;

    case 'FLOOR':
      // Round towards -infinity: if negative result, add 1 to absolute quotient (more negative)
      roundUp = isNegResult;
      break;

    case 'HALF_UP':
      // 0.5 or greater rounds up
      roundUp = doubleRemainder >= absDen;
      break;

    case 'HALF_EVEN':
    default:
      if (doubleRemainder > absDen) {
        roundUp = true;
      } else if (doubleRemainder < absDen) {
        roundUp = false;
      } else {
        // Exactly halfway (0.5): round to nearest even quotient
        roundUp = quotient % 2n !== 0n;
      }
      break;
  }

  const finalAbs = roundUp ? quotient + 1n : quotient;
  return isNegResult ? -finalAbs : finalAbs;
}
