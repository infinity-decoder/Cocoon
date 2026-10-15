/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Transaction } from '../../core/types';
import { Money } from '../../domain/money/Money';

export interface RecordTransactionInput {
  id?: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  currency: string;
  date: string;
  category: string;
  subCategory?: string;
  walletId: string;
  toWalletId?: string;
  paymentMethod: string;
  note?: string;
  attachment?: string;
  isRecurring?: boolean;
  recurrence?: any;
}

export class RecordTransactionCommandHandler {
  public execute(input: RecordTransactionInput): Transaction {
    if (input.amount <= 0) {
      throw new Error('Transaction amount must be strictly positive.');
    }
    if (!input.walletId) {
      throw new Error('Valid wallet account is required.');
    }
    if (input.type === 'transfer' && !input.toWalletId) {
      throw new Error('Destination wallet is required for transfer transactions.');
    }

    const money = Money.fromDecimal(input.amount, input.currency);

    return {
      id: input.id || `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: input.type,
      amount: money.toDecimalNumber(),
      currency: input.currency,
      date: input.date || new Date().toISOString(),
      category: input.category,
      subCategory: input.subCategory,
      walletId: input.walletId,
      toWalletId: input.toWalletId,
      paymentMethod: input.paymentMethod || 'cash',
      note: input.note,
      attachment: input.attachment,
      isRecurring: input.isRecurring ?? false,
      recurrence: input.recurrence
    };
  }
}
