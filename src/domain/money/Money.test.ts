/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  Money,
  MONETARY_SCALE,
  PersonalFinanceMoneyAdapter,
  DecimalQuantity,
  divideBigIntWithRounding
} from './index';

describe('Domain: Money Value Object & Primitives', () => {
  it('correctly scales and creates Money for 2-decimal fiat currencies (PKR, USD)', () => {
    const m = Money.fromDecimal('150.25', 'USD');
    assert.equal(m.scaledUnits, 1502500n);
    assert.equal(m.toDecimal(), 150.25);
    assert.equal(m.format(), '$ 150.25');
  });

  it('correctly handles Pakistani Rupee (PKR) paisa representations', () => {
    // 1 PKR = 100 paisa. At scale 10,000, 1 paisa = 100 scaled units.
    const pkr = Money.fromDecimal('500.50', 'PKR');
    assert.equal(pkr.toPaisa(), 50050n); // 50,050 paisa
    assert.equal(pkr.format(), '₨ 500.50');

    // From paisa
    const fromP = Money.fromPaisa(7525); // 75.25 PKR
    assert.equal(fromP.toDecimal(), 75.25);
    assert.equal(fromP.format(), '₨ 75.25');
  });

  it('correctly handles 3-decimal currencies (KWD, BHD) without precision loss', () => {
    const kwd = Money.fromDecimal('45.375', 'KWD');
    // 45.375 * 10,000 = 453,750
    assert.equal(kwd.scaledUnits, 453750n);
    assert.equal(kwd.toDecimal(), 45.375);
    assert.equal(kwd.format(), 'KD 45.375');
    assert.equal(kwd.toMinorUnits(), 45375n); // 45,375 fils
  });

  it('correctly handles 0-decimal currencies (JPY) without fractional cents', () => {
    const jpy = Money.fromDecimal('1500', 'JPY');
    assert.equal(jpy.scaledUnits, 15000000n);
    assert.equal(jpy.toDecimal(), 1500);
    assert.equal(jpy.format(), '¥ 1,500');
    assert.equal(jpy.toMinorUnits(), 1500n);
  });

  it('performs exact addition and subtraction without floating-point IEEE-754 drift', () => {
    // In IEEE 754: 0.1 + 0.2 = 0.30000000000000004
    const a = Money.fromDecimal('0.10', 'USD');
    const b = Money.fromDecimal('0.20', 'USD');
    const sum = a.add(b);

    assert.equal(sum.scaledUnits, 3000n);
    assert.equal(sum.toDecimal(), 0.3);
    assert.equal(sum.format(), '$ 0.30');

    const diff = sum.subtract(a);
    assert.equal(diff.toDecimal(), 0.2);
  });

  it('handles negative values and signs correctly', () => {
    const neg = Money.fromDecimal('-25.50', 'PKR');
    assert.equal(neg.isNegative(), true);
    assert.equal(neg.isPositive(), false);
    assert.equal(neg.sign(), -1);
    assert.equal(neg.scaledUnits, -255000n);
    assert.equal(neg.format(), '₨ -25.50');
    assert.equal(neg.abs().toDecimal(), 25.5);
    assert.equal(neg.negate().toDecimal(), 25.5);
  });

  it('handles zero monetary values correctly', () => {
    const zero = Money.zero('PKR');
    assert.equal(zero.isZero(), true);
    assert.equal(zero.isPositive(), false);
    assert.equal(zero.isNegative(), false);
    assert.equal(zero.toDecimal(), 0);
    assert.equal(zero.format(), '₨ 0.00');
  });

  it('handles astronomical amounts (trillions) without 64-bit integer overflow', () => {
    // 5 trillion PKR = 5,000,000,000,000.00 PKR = 5 * 10^16 scaled units
    const massive = Money.fromDecimal('5000000000000.00', 'PKR');
    const addition = Money.fromDecimal('2500000000000.00', 'PKR');
    const total = massive.add(addition);
    assert.equal(total.toDecimal(), 7500000000000);
  });

  it('throws error when operating on mismatched currency codes', () => {
    const pkr = Money.fromDecimal('100.00', 'PKR');
    const usd = Money.fromDecimal('100.00', 'USD');

    assert.throws(() => {
      pkr.add(usd);
    }, /Cannot operate on mismatching currencies/);

    assert.throws(() => {
      pkr.subtract(usd);
    }, /Cannot operate on mismatching currencies/);

    assert.throws(() => {
      pkr.compare(usd);
    }, /Cannot operate on mismatching currencies/);
  });

  it('performs comparisons accurately (greaterThan, lessThan, equals)', () => {
    const m1 = Money.fromDecimal('50.00', 'PKR');
    const m2 = Money.fromDecimal('50.00', 'PKR');
    const m3 = Money.fromDecimal('100.00', 'PKR');

    assert.equal(m1.equals(m2), true);
    assert.equal(m1.equals(m3), false);
    assert.equal(m3.greaterThan(m1), true);
    assert.equal(m1.lessThan(m3), true);
    assert.equal(m1.lessThanOrEqual(m2), true);
    assert.equal(m1.greaterThanOrEqual(m2), true);
  });

  it('implements Fowler monetary allocation across ratios with zero penny/paisa loss', () => {
    // 100.00 PKR split into 3 equal shares [1, 1, 1]
    // 100 / 3 = 33.3333... -> Must result in 33.34, 33.33, 33.33 (Sum = exactly 100.00)
    const hundred = Money.fromDecimal('100.00', 'PKR');
    const parts = hundred.allocate([1, 1, 1]);

    assert.equal(parts.length, 3);
    assert.equal(parts[0].toDecimal(), 33.34);
    assert.equal(parts[1].toDecimal(), 33.33);
    assert.equal(parts[2].toDecimal(), 33.33);

    const sumAllocated = parts[0].add(parts[1]).add(parts[2]);
    assert.equal(sumAllocated.equals(hundred), true);
    assert.equal(sumAllocated.toDecimal(), 100.00);

    // 0.05 PKR split across 2 ratios [1, 1] -> 0.03 and 0.02 PKR (sum = 0.05 PKR)
    const fivePaisa = Money.fromDecimal('0.05', 'PKR');
    const splitFive = fivePaisa.allocate([1, 1]);
    assert.equal(splitFive[0].toDecimal(), 0.03);
    assert.equal(splitFive[1].toDecimal(), 0.02);
    assert.equal(splitFive[0].add(splitFive[1]).equals(fivePaisa), true);
  });

  it('calculates exact quantity x unit cost with fractional measured goods (kg, litres)', () => {
    // 2.750 kg @ 450.00 PKR / kg = 1,237.50 PKR
    const pricePerKg = Money.fromDecimal('450.00', 'PKR');
    const qty = DecimalQuantity.fromDecimal('2.75', 'kg');

    const total = pricePerKg.multiplyByQuantity(qty);
    assert.equal(total.toDecimal(), 1237.50);
    assert.equal(total.format(), '₨ 1,237.50');

    // 0.333 kg @ 300.00 PKR / kg = 99.90 PKR
    const fineQty = DecimalQuantity.fromDecimal('0.333', 'kg');
    const cost = pricePerKg.multiplyByQuantity(fineQty);
    assert.equal(cost.toDecimal(), 149.85);
  });

  it('applies percentage and fixed discounts accurately', () => {
    const itemTotal = Money.fromDecimal('2500.00', 'PKR');

    // 15% discount on 2,500.00 PKR = 375.00 PKR discount -> 2,125.00 PKR final
    const pctDisc = itemTotal.applyDiscount({ percent: 15 });
    assert.equal(pctDisc.discountAmount.toDecimal(), 375.00);
    assert.equal(pctDisc.discountedAmount.toDecimal(), 2125.00);

    // Fixed amount discount: 500.00 PKR discount
    const fixedDisc = itemTotal.applyDiscount({ amount: Money.fromDecimal('500.00', 'PKR') });
    assert.equal(fixedDisc.discountAmount.toDecimal(), 500.00);
    assert.equal(fixedDisc.discountedAmount.toDecimal(), 2000.00);

    // Discount clamped to max 100%
    const cappedDisc = itemTotal.applyDiscount({ amount: Money.fromDecimal('3000.00', 'PKR') });
    assert.equal(cappedDisc.discountAmount.toDecimal(), 2500.00);
    assert.equal(cappedDisc.discountedAmount.toDecimal(), 0.00);
  });

  it('calculates tax-exclusive and tax-inclusive operations accurately', () => {
    // Tax Exclusive: 1,000.00 PKR @ 18% GST -> Tax: 180.00 PKR, Gross: 1,180.00 PKR
    const net = Money.fromDecimal('1000.00', 'PKR');
    const exclusive = net.applyTax(18, { isInclusive: false });
    assert.equal(exclusive.netAmount.toDecimal(), 1000.00);
    assert.equal(exclusive.taxAmount.toDecimal(), 180.00);
    assert.equal(exclusive.grossAmount.toDecimal(), 1180.00);

    // Tax Inclusive: 1,180.00 PKR gross @ 18% GST -> Net: 1,000.00 PKR, Tax: 180.00 PKR
    const gross = Money.fromDecimal('1180.00', 'PKR');
    const inclusive = gross.applyTax(18, { isInclusive: true });
    assert.equal(inclusive.netAmount.toDecimal(), 1000.00);
    assert.equal(inclusive.taxAmount.toDecimal(), 180.00);
    assert.equal(inclusive.grossAmount.toDecimal(), 1180.00);
  });

  it('converts currencies explicitly using verified exchange rate operation', () => {
    // 100 USD @ 278.50 PKR / USD = 27,850.00 PKR
    const usd = Money.fromDecimal('100.00', 'USD');
    const pkr = usd.convert('PKR', 278.5);
    assert.equal(pkr.currencyCode, 'PKR');
    assert.equal(pkr.toDecimal(), 27850.00);
    assert.equal(pkr.format(), '₨ 27,850.00');

    assert.throws(() => {
      usd.convert('PKR', -5);
    }, /Invalid exchange rate/);
  });

  it('verifies explicit rounding modes in divideBigIntWithRounding', () => {
    // Half even (Banker's rounding) test on 2.5 vs 3.5
    // 25 / 10 = 2.5 -> even quotient 2
    assert.equal(divideBigIntWithRounding(25n, 10n, 'HALF_EVEN'), 2n);
    // 35 / 10 = 3.5 -> even quotient 4
    assert.equal(divideBigIntWithRounding(35n, 10n, 'HALF_EVEN'), 4n);

    // Half up: 25 / 10 = 3, 35 / 10 = 4
    assert.equal(divideBigIntWithRounding(25n, 10n, 'HALF_UP'), 3n);
    assert.equal(divideBigIntWithRounding(35n, 10n, 'HALF_UP'), 4n);

    // Ceil & Floor
    assert.equal(divideBigIntWithRounding(21n, 10n, 'CEIL'), 3n);
    assert.equal(divideBigIntWithRounding(29n, 10n, 'FLOOR'), 2n);
    assert.equal(divideBigIntWithRounding(-21n, 10n, 'FLOOR'), -3n);

    // Truncate
    assert.equal(divideBigIntWithRounding(29n, 10n, 'TRUNC'), 2n);
    assert.equal(divideBigIntWithRounding(-29n, 10n, 'TRUNC'), -2n);
  });

  it('verifies PersonalFinanceMoneyAdapter converts legacy records without silent changes', () => {
    const legacyNumber = 4599.95;
    const moneyObj = PersonalFinanceMoneyAdapter.toMoney(legacyNumber, 'PKR');

    assert.equal(moneyObj.toDecimal(), 4599.95);
    assert.equal(PersonalFinanceMoneyAdapter.fromMoney(moneyObj), 4599.95);
    assert.equal(PersonalFinanceMoneyAdapter.toPaisa(legacyNumber, 'PKR'), 459995n);

    // Null and empty safety
    const zeroMoney = PersonalFinanceMoneyAdapter.toMoney(null, 'PKR');
    assert.equal(zeroMoney.isZero(), true);
  });
});
