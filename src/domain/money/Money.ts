/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { divideBigIntWithRounding, RoundingMode } from './rounding';
import { DecimalQuantity, QUANTITY_SCALE } from './DecimalQuantity';

/**
 * Standard monetary scale for the international Cocoon engine:
 * 1 standard unit = 10,000 minor units (4 decimal places factor: 10^4).
 * This natively accommodates:
 * - 0-decimal currencies (JPY, KRW, VND) -> 1 unit = 10,000 scaled units (factor: 10,000)
 * - 2-decimal fiat currencies (PKR, USD, EUR, INR, GBP) -> 1 cent/paisa = 100 scaled units (factor: 100)
 * - 3-decimal currencies (KWD, BHD, OMR, JOD, TND) -> 1 fils/millieme = 10 scaled units (factor: 10)
 * - Sub-cent sub-unit precision for wholesale quantity discounting, partial taxes, and inventory costing.
 */
export const MONETARY_SCALE = 10000n;

export interface CurrencyDefinition {
  code: string;
  symbol: string;
  name: string;
  decimals: number; // Native display decimals: 0, 2, or 3
  minorUnitName: string; // e.g. Paisa, Cent, Fils, Yen
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyDefinition> = {
  // 3-decimal currencies
  KWD: { code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar', decimals: 3, minorUnitName: 'Fils' },
  BHD: { code: 'BHD', symbol: 'BD', name: 'Bahraini Dinar', decimals: 3, minorUnitName: 'Fils' },
  OMR: { code: 'OMR', symbol: 'OMR', name: 'Omani Rial', decimals: 3, minorUnitName: 'Baisa' },
  JOD: { code: 'JOD', symbol: 'JD', name: 'Jordanian Dinar', decimals: 3, minorUnitName: 'Piastre' },
  TND: { code: 'TND', symbol: 'DT', name: 'Tunisian Dinar', decimals: 3, minorUnitName: 'Millime' },

  // 2-decimal fiat currencies
  PKR: { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', decimals: 2, minorUnitName: 'Paisa' },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', decimals: 2, minorUnitName: 'Cent' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', decimals: 2, minorUnitName: 'Cent' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', decimals: 2, minorUnitName: 'Penny' },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', decimals: 2, minorUnitName: 'Paisa' },
  AED: { code: 'AED', symbol: 'AED', name: 'UAE Dirham', decimals: 2, minorUnitName: 'Fils' },
  SAR: { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal', decimals: 2, minorUnitName: 'Halala' },
  CAD: { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', decimals: 2, minorUnitName: 'Cent' },
  AUD: { code: 'AUD', symbol: 'AU$', name: 'Australian Dollar', decimals: 2, minorUnitName: 'Cent' },

  // 0-decimal currencies
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', decimals: 0, minorUnitName: 'Yen' }
};

export interface TaxCalculationResult {
  netAmount: Money;
  taxAmount: Money;
  grossAmount: Money;
  taxRatePercent: number;
}

export interface DiscountCalculationResult {
  discountedAmount: Money;
  discountAmount: Money;
}

/**
 * Immutable Money Value Object representing financial amounts without floating-point drift.
 * Never stores binary floats; all internal arithmetic is executed on bigint scaled units.
 */
export class Money {
  private readonly _amountScaled: bigint;
  private readonly _currency: CurrencyDefinition;

  private constructor(amountScaled: bigint, currency: CurrencyDefinition) {
    this._amountScaled = amountScaled;
    this._currency = currency;
  }

  public get scaledUnits(): bigint {
    return this._amountScaled;
  }

  public get currency(): CurrencyDefinition {
    return this._currency;
  }

  public get currencyCode(): string {
    return this._currency.code;
  }

  /**
   * The multiplier converting native minor units (e.g. paisa/cents) into internal scaled units.
   */
  public get minorUnitFactor(): bigint {
    const shift = 4 - this._currency.decimals;
    return 10n ** BigInt(shift);
  }

  public static getCurrencyDefinition(currencyCode: string): CurrencyDefinition {
    const normalized = (currencyCode || '').trim().toUpperCase();
    return SUPPORTED_CURRENCIES[normalized] || {
      code: normalized || 'PKR',
      symbol: normalized || '₨',
      name: normalized || 'Pakistani Rupee',
      decimals: 2,
      minorUnitName: 'Minor Unit'
    };
  }

  public static fromScaled(amountScaled: bigint, currencyCode = 'PKR'): Money {
    const cur = Money.getCurrencyDefinition(currencyCode);
    return new Money(amountScaled, cur);
  }

  public static fromDecimal(amount: number | string | bigint, currencyCode = 'PKR'): Money {
    const cur = Money.getCurrencyDefinition(currencyCode);

    if (typeof amount === 'bigint') {
      return new Money(amount * MONETARY_SCALE, cur);
    }

    const cleanStr = typeof amount === 'number' ? amount.toString() : String(amount).trim();
    if (cleanStr === '' || isNaN(Number(cleanStr))) {
      throw new Error(`Invalid money decimal representation: "${cleanStr}"`);
    }

    const isNegative = cleanStr.startsWith('-');
    const absStr = isNegative ? cleanStr.slice(1) : cleanStr;
    const parts = absStr.split('.');
    const integerPart = BigInt(parts[0] || '0');
    let fractionalStr = parts[1] || '';

    if (fractionalStr.length > 4) {
      // Sub-cent precision rounding using HALF_EVEN
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
    const totalScaled = integerPart * MONETARY_SCALE + fractionalPart;
    const signedScaled = isNegative ? -totalScaled : totalScaled;

    return new Money(signedScaled, cur);
  }

  /**
   * Instantiates Money directly from minor units (e.g. Paisa in PKR, Cents in USD, Fils in KWD).
   */
  public static fromMinorUnits(minorUnits: bigint | number, currencyCode = 'PKR'): Money {
    const cur = Money.getCurrencyDefinition(currencyCode);
    const shift = 4 - cur.decimals;
    const factor = 10n ** BigInt(shift);
    const bUnits = typeof minorUnits === 'bigint' ? minorUnits : BigInt(Math.round(minorUnits));
    return new Money(bUnits * factor, cur);
  }

  /**
   * Convenience builder for Pakistani Rupee paisa (1 PKR = 100 paisa).
   */
  public static fromPaisa(paisa: bigint | number): Money {
    return Money.fromMinorUnits(paisa, 'PKR');
  }

  public static zero(currencyCode = 'PKR'): Money {
    return Money.fromScaled(0n, currencyCode);
  }

  /**
   * Converts the authoritative amount into integer minor units (e.g. paisa/cents).
   */
  public toMinorUnits(mode: RoundingMode = 'HALF_EVEN'): bigint {
    return divideBigIntWithRounding(this._amountScaled, this.minorUnitFactor, mode);
  }

  /**
   * Convenience accessor for Pakistani Rupee paisa.
   */
  public toPaisa(mode: RoundingMode = 'HALF_EVEN'): bigint {
    if (this._currency.code !== 'PKR') {
      throw new Error(`Cannot get Paisa for non-PKR currency: "${this._currency.code}"`);
    }
    return this.toMinorUnits(mode);
  }

  public add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._amountScaled + other._amountScaled, this._currency);
  }

  public subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._amountScaled - other._amountScaled, this._currency);
  }

  public compare(other: Money): number {
    this.assertSameCurrency(other);
    if (this._amountScaled < other._amountScaled) return -1;
    if (this._amountScaled > other._amountScaled) return 1;
    return 0;
  }

  public equals(other: Money): boolean {
    return this._currency.code === other._currency.code && this._amountScaled === other._amountScaled;
  }

  public greaterThan(other: Money): boolean {
    return this.compare(other) > 0;
  }

  public greaterThanOrEqual(other: Money): boolean {
    return this.compare(other) >= 0;
  }

  public lessThan(other: Money): boolean {
    return this.compare(other) < 0;
  }

  public lessThanOrEqual(other: Money): boolean {
    return this.compare(other) <= 0;
  }

  /**
   * Classic Fowler monetary allocation pattern.
   * Splits the amount across ratios without losing or creating a single minor unit (paisa/cent).
   * Any remainder is distributed 1 minor unit at a time to the highest weighted shares.
   */
  public allocate(ratios: (number | bigint)[]): Money[] {
    if (!ratios || ratios.length === 0) {
      return [];
    }

    const bigRatios = ratios.map(r => (typeof r === 'bigint' ? r : BigInt(Math.max(0, Math.round(r)))));
    const totalRatio = bigRatios.reduce((acc, curr) => acc + curr, 0n);

    if (totalRatio === 0n) {
      throw new Error('Total allocation ratio cannot be zero.');
    }

    // Allocate in minor units to guarantee zero fractional loss
    const totalMinorUnits = this.toMinorUnits('TRUNC');
    let remainder = totalMinorUnits;
    const resultsMinor: bigint[] = [];

    for (let i = 0; i < bigRatios.length; i++) {
      const share = (totalMinorUnits * bigRatios[i]) / totalRatio;
      resultsMinor.push(share);
      remainder -= share;
    }

    // Distribute remainder 1 minor unit at a time
    let idx = 0;
    while (remainder > 0n) {
      resultsMinor[idx % bigRatios.length] += 1n;
      remainder -= 1n;
      idx++;
    }
    while (remainder < 0n) {
      resultsMinor[idx % bigRatios.length] -= 1n;
      remainder += 1n;
      idx++;
    }

    return resultsMinor.map(m => Money.fromMinorUnits(m, this._currency.code));
  }

  /**
   * Multiplies money by quantity (which can be a DecimalQuantity for kg, litres, or pcs).
   */
  public multiplyByQuantity(
    quantity: DecimalQuantity | number | string | bigint,
    mode: RoundingMode = 'HALF_EVEN'
  ): Money {
    const qty =
      quantity instanceof DecimalQuantity
        ? quantity
        : DecimalQuantity.fromDecimal(quantity, 'pcs');

    // (this._amountScaled * qty.scaledUnits) / QUANTITY_SCALE
    const totalScaled = divideBigIntWithRounding(
      this._amountScaled * qty.scaledUnits,
      QUANTITY_SCALE,
      mode
    );

    return new Money(totalScaled, this._currency);
  }

  public multiply(factor: number, mode: RoundingMode = 'HALF_EVEN'): Money {
    const factorScaled = BigInt(Math.round(factor * 10000));
    const resultScaled = divideBigIntWithRounding(this._amountScaled * factorScaled, 10000n, mode);
    return new Money(resultScaled, this._currency);
  }

  /**
   * Applies an explicit discount (percentage or fixed Money).
   */
  public applyDiscount(
    discount: { percent?: number; amount?: Money },
    mode: RoundingMode = 'HALF_EVEN'
  ): DiscountCalculationResult {
    let discountAmount: Money;

    if (discount.amount) {
      this.assertSameCurrency(discount.amount);
      discountAmount = discount.amount;
    } else if (discount.percent !== undefined) {
      if (discount.percent < 0 || discount.percent > 100) {
        throw new Error(`Discount percent must be between 0 and 100, got: ${discount.percent}`);
      }
      const percentScaled = BigInt(Math.round(discount.percent * 10000));
      // amount * (percent / 100)
      const discScaled = divideBigIntWithRounding(
        this._amountScaled * percentScaled,
        1000000n, // 10,000 * 100
        mode
      );
      discountAmount = new Money(discScaled, this._currency);
    } else {
      discountAmount = Money.zero(this._currency.code);
    }

    // Discount cannot exceed original amount
    if (discountAmount.greaterThan(this)) {
      discountAmount = this;
    }

    const discountedAmount = this.subtract(discountAmount);
    return { discountedAmount, discountAmount };
  }

  /**
   * Applies tax calculation for tax-inclusive or tax-exclusive pricing.
   */
  public applyTax(
    taxRatePercent: number,
    options?: { isInclusive?: boolean; roundingMode?: RoundingMode }
  ): TaxCalculationResult {
    if (taxRatePercent < 0) {
      throw new Error(`Tax rate cannot be negative, got: ${taxRatePercent}`);
    }

    const isInclusive = options?.isInclusive ?? false;
    const mode = options?.roundingMode ?? 'HALF_EVEN';
    const rateScaled = BigInt(Math.round(taxRatePercent * 10000)); // Rate with 4 decimals (e.g. 17.5% -> 175000)

    if (isInclusive) {
      // Gross amount = this
      // Net amount = Gross / (1 + Rate / 100) = (Gross * 1,000,000) / (1,000,000 + rateScaled)
      const denominator = 1000000n + rateScaled;
      const netScaled = divideBigIntWithRounding(this._amountScaled * 1000000n, denominator, mode);
      const netAmount = new Money(netScaled, this._currency);
      const taxAmount = this.subtract(netAmount);

      return {
        netAmount,
        taxAmount,
        grossAmount: this,
        taxRatePercent
      };
    } else {
      // Exclusive tax: Net = this
      // Tax = Net * (Rate / 100)
      const taxScaled = divideBigIntWithRounding(this._amountScaled * rateScaled, 1000000n, mode);
      const taxAmount = new Money(taxScaled, this._currency);
      const grossAmount = this.add(taxAmount);

      return {
        netAmount: this,
        taxAmount,
        grossAmount,
        taxRatePercent
      };
    }
  }

  /**
   * Explicit currency conversion requiring target code and exchange rate.
   * Prevents invalid cross-currency arithmetic without explicit conversion.
   */
  public convert(
    targetCurrencyCode: string,
    exchangeRate: number | string,
    mode: RoundingMode = 'HALF_EVEN'
  ): Money {
    const targetCur = Money.getCurrencyDefinition(targetCurrencyCode);
    const rateNumber = typeof exchangeRate === 'string' ? Number(exchangeRate) : exchangeRate;

    if (isNaN(rateNumber) || rateNumber <= 0) {
      throw new Error(`Invalid exchange rate: "${exchangeRate}". Expected positive number.`);
    }

    const rateScaled = BigInt(Math.round(rateNumber * 10000));
    const convertedScaled = divideBigIntWithRounding(this._amountScaled * rateScaled, 10000n, mode);

    return new Money(convertedScaled, targetCur);
  }

  public abs(): Money {
    return this._amountScaled < 0n
      ? new Money(-this._amountScaled, this._currency)
      : this;
  }

  public negate(): Money {
    return new Money(-this._amountScaled, this._currency);
  }

  public sign(): number {
    if (this._amountScaled > 0n) return 1;
    if (this._amountScaled < 0n) return -1;
    return 0;
  }

  public isZero(): boolean {
    return this._amountScaled === 0n;
  }

  public isPositive(): boolean {
    return this._amountScaled > 0n;
  }

  public isNegative(): boolean {
    return this._amountScaled < 0n;
  }

  public toDecimal(): number {
    const isNeg = this._amountScaled < 0n;
    const absVal = isNeg ? -this._amountScaled : this._amountScaled;
    const intPart = absVal / MONETARY_SCALE;
    const fracPart = absVal % MONETARY_SCALE;
    const num = Number(intPart) + Number(fracPart) / 10000;
    return isNeg ? -num : num;
  }

  public toDecimalNumber(): number {
    return this.toDecimal();
  }

  public format(includeSymbol = true): string {
    const dec = this._currency.decimals;
    const isNeg = this._amountScaled < 0n;
    const absVal = isNeg ? -this._amountScaled : this._amountScaled;

    const intPart = absVal / MONETARY_SCALE;
    const fracPart = absVal % MONETARY_SCALE;
    const fracStr = fracPart.toString().padStart(4, '0').slice(0, dec);

    const formattedNumber = dec > 0 ? `${intPart.toLocaleString()}.${fracStr}` : intPart.toLocaleString();
    const withSign = isNeg ? `-${formattedNumber}` : formattedNumber;
    return includeSymbol ? `${this._currency.symbol} ${withSign}` : withSign;
  }

  private assertSameCurrency(other: Money): void {
    if (this._currency.code !== other._currency.code) {
      throw new Error(`Cannot operate on mismatching currencies: "${this._currency.code}" and "${other._currency.code}"`);
    }
  }
}

/**
 * Adapter ensuring 100% backwards-compatibility between legacy floating-point
 * personal finance representations and the robust domain Money primitive.
 */
export class PersonalFinanceMoneyAdapter {
  public static toMoney(amount: number | string | undefined | null, currencyCode = 'PKR'): Money {
    if (amount === undefined || amount === null || amount === '') {
      return Money.zero(currencyCode);
    }
    return Money.fromDecimal(amount, currencyCode);
  }

  public static fromMoney(money: Money): number {
    return money.toDecimal();
  }

  public static toPaisa(amount: number | string, currencyCode = 'PKR'): bigint {
    return Money.fromDecimal(amount, currencyCode).toMinorUnits();
  }
}
