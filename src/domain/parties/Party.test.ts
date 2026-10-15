/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Party } from './Party';
import { Money } from '../money/Money';

describe('Domain: Party Entity', () => {
  it('correctly manages customer credit limits and allows credit sales within limit', () => {
    const customer = new Party({
      id: 'cust-1',
      workspaceId: 'biz-1',
      name: 'Ahmed Trading',
      partyType: 'customer',
      creditLimitScaled: 500000000n, // 50,000.00 PKR limit
      paymentTermsDays: 30,
      currentBalanceScaled: 200000000n, // 20,000.00 PKR already owed
      currencyCode: 'PKR',
      isArchived: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    });

    assert.equal(customer.isCustomer, true);
    assert.equal(customer.isSupplier, false);
    assert.equal(customer.creditLimit.toDecimalNumber(), 50000);
    assert.equal(customer.currentBalance.toDecimalNumber(), 20000);

    // Can extend 25,000 PKR credit (total 45,000 <= 50,000)
    const saleAmount = Money.fromDecimal(25000, 'PKR');
    assert.equal(customer.canExtendCredit(saleAmount), true);

    // Cannot extend 35,000 PKR credit (total 55,000 > 50,000)
    const excessSale = Money.fromDecimal(35000, 'PKR');
    assert.equal(customer.canExtendCredit(excessSale), false);

    // After applying debit, balance updates accurately
    const updatedCustomer = customer.applyDebit(saleAmount);
    assert.equal(updatedCustomer.currentBalance.toDecimalNumber(), 45000);
  });

  it('correctly tracks supplier payables and credit payments', () => {
    const supplier = new Party({
      id: 'supp-1',
      workspaceId: 'biz-1',
      name: 'Metro Wholesale',
      partyType: 'supplier',
      creditLimitScaled: 0n,
      paymentTermsDays: 15,
      currentBalanceScaled: -150000000n, // We owe them 15,000.00 PKR (payable)
      currencyCode: 'PKR',
      isArchived: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    });

    assert.equal(supplier.isSupplier, true);
    assert.equal(supplier.isCustomer, false);
    assert.equal(supplier.currentBalance.toDecimalNumber(), -15000);

    // When we pay 10,000 PKR, we apply debit to reduce our liability
    const payment = Money.fromDecimal(10000, 'PKR');
    const updatedSupplier = supplier.applyDebit(payment);
    assert.equal(updatedSupplier.currentBalance.toDecimalNumber(), -5000);
  });
});
