/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { divideBigIntWithRounding, RoundingMode } from './rounding';

/**
 * Standard quantity scale: 4 decimal places (1 unit = 10,000 scaled units).
 * Accommodates measured inventory: e.g. 1.2500 kg, 0.7500 litres, 2.5000 meters.
 */
export const QUANTITY_SCALE = 10000n;

export type StandardQuantityUnit =
  | 'pcs'
  | 'kg'
  | 'g'
  | 'ltr'
  | 'ml'
  | 'meter'
  | 'cm'
  | 'box'
  | 'pack'
  | 'dozen'
  | string;

/**
 * Immutable DecimalQuantity Value Object for measured goods and inventory stock.
 * Stored internally as scaled bigint to eliminate JavaScript floating-point errors.
 */
export class DecimalQuantity {
  private readonly _scaledUnits: bigint;
  private readonly _unit: StandardQuantityUnit;

  private constructor(scaledUnits: bigint, unit: StandardQuantityUnit = 'pcs') {
    this._scaledUnits = scaledUnits;
    this._unit = unit;
  }

  public get scaledUnits(): bigint {
    return this._scaledUnits;
  }

  public get unit(): StandardQuantityUnit {
    return this._unit;
  }

  public static fromScaled(scaledUnits: bigint, unit: StandardQuantityUnit = 'pcs'): DecimalQuantity {
    return new DecimalQuantity(scaledUnits, unit);
  }

  public static fromDecimal(
    quantity: number | string | bigint,
    unit: StandardQuantityUnit = 'pcs'
  ): DecimalQuantity {
    if (typeof quantity === 'bigint') {
      return new DecimalQuantity(quantity * QUANTITY_SCALE, unit);
    }

    const cleanStr = typeof quantity === 'number' ? quantity.toString() : String(quantity).trim();
    if (cleanStr === '' || isNaN(Number(cleanStr))) {
      throw new Error(`Invalid decimal quantity representation: "${cleanStr}"`);
    }

    const isNegative = cleanStr.startsWith('-');
    const absStr = isNegative ? cleanStr.slice(1) : cleanStr;
    const parts = absStr.split('.');
    const integerPart = BigInt(parts[0] || '0');
    let fractionalStr = parts[1] || '';

    if (fractionalStr.length > 4) {
      // Round 5th+ decimals using HALF_EVEN
      const baseFour = BigInt(fractionalStr.slice(0, 4));
      const nextDigit = Number(fractionalStr[4]);
      let adjusted = baseFour;
      if (nextDigit > 5 || (nextDigit === 5 && fractionalStr.slice(5).split('').some(c => c !== '0'))) {
        adjusted += 1n;
      } else if (nextDigit === 5) {
        adjusted += baseFour % 2n !== 0n ? 1n : 0n;
      }
      fractionalStr = adjusted.toString().padStart(4, '0');
    } else {
      fractionalStr = fractionalStr.padEnd(4, '0');
    }

    const fractionalPart = BigInt(fractionalStr);
    const totalScaled = integerPart * QUANTITY_SCALE + fractionalPart;
    const signedScaled = isNegative ? -totalScaled : totalScaled;

    return new DecimalQuantity(signedScaled, unit);
  }

  public static zero(unit: StandardQuantityUnit = 'pcs'): DecimalQuantity {
    return new DecimalQuantity(0n, unit);
  }

  public add(other: DecimalQuantity): DecimalQuantity {
    this.assertSameUnit(other);
    return new DecimalQuantity(this._scaledUnits + other._scaledUnits, this._unit);
  }

  public subtract(other: DecimalQuantity): DecimalQuantity {
    this.assertSameUnit(other);
    return new DecimalQuantity(this._scaledUnits - other._scaledUnits, this._unit);
  }

  public multiply(factor: number | bigint, mode: RoundingMode = 'HALF_EVEN'): DecimalQuantity {
    if (typeof factor === 'bigint') {
      return new DecimalQuantity(this._scaledUnits * factor, this._unit);
    }
    const factorScaled = BigInt(Math.round(factor * 10000));
    const resultScaled = divideBigIntWithRounding(this._scaledUnits * factorScaled, 10000n, mode);
    return new DecimalQuantity(resultScaled, this._unit);
  }

  public divide(divisor: number | bigint, mode: RoundingMode = 'HALF_EVEN'): DecimalQuantity {
    if (typeof divisor === 'bigint') {
      return new DecimalQuantity(divideBigIntWithRounding(this._scaledUnits, divisor, mode), this._unit);
    }
    const divisorScaled = BigInt(Math.round(divisor * 10000));
    const resultScaled = divideBigIntWithRounding(this._scaledUnits * 10000n, divisorScaled, mode);
    return new DecimalQuantity(resultScaled, this._unit);
  }

  public compare(other: DecimalQuantity): number {
    this.assertSameUnit(other);
    if (this._scaledUnits < other._scaledUnits) return -1;
    if (this._scaledUnits > other._scaledUnits) return 1;
    return 0;
  }

  public isZero(): boolean {
    return this._scaledUnits === 0n;
  }

  public isPositive(): boolean {
    return this._scaledUnits > 0n;
  }

  public isNegative(): boolean {
    return this._scaledUnits < 0n;
  }

  public toDecimal(): number {
    const isNeg = this._scaledUnits < 0n;
    const absVal = isNeg ? -this._scaledUnits : this._scaledUnits;
    const intPart = absVal / QUANTITY_SCALE;
    const fracPart = absVal % QUANTITY_SCALE;
    const num = Number(intPart) + Number(fracPart) / 10000;
    return isNeg ? -num : num;
  }

  public toString(decimalPlaces?: number): string {
    const dec = decimalPlaces !== undefined ? Math.min(4, Math.max(0, decimalPlaces)) : 4;
    const isNeg = this._scaledUnits < 0n;
    const absVal = isNeg ? -this._scaledUnits : this._scaledUnits;
    const intPart = absVal / QUANTITY_SCALE;
    const fracPart = absVal % QUANTITY_SCALE;

    let fracStr = fracPart.toString().padStart(4, '0');
    if (decimalPlaces !== undefined) {
      fracStr = fracStr.slice(0, dec);
    } else {
      // Trim trailing zeros by default
      fracStr = fracStr.replace(/0+$/, '');
    }

    const numStr = fracStr.length > 0 ? `${intPart}.${fracStr}` : `${intPart}`;
    return isNeg ? `-${numStr}` : numStr;
  }

  public format(includeUnit = true): string {
    const numStr = this.toString();
    return includeUnit ? `${numStr} ${this._unit}` : numStr;
  }

  private assertSameUnit(other: DecimalQuantity): void {
    if (this._unit !== other._unit) {
      throw new Error(`Cannot perform arithmetic on differing units: "${this._unit}" and "${other._unit}"`);
    }
  }
}
