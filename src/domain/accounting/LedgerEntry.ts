/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Money } from '../money/Money';

export type AccountType = 
  | 'ASSET_CASH'
  | 'ASSET_BANK'
  | 'ASSET_RECEIVABLE'
  | 'ASSET_INVENTORY'
  | 'LIABILITY_PAYABLE'
  | 'EQUITY_CAPITAL'
  | 'REVENUE_SALES'
  | 'EXPENSE_COST_OF_GOODS'
  | 'EXPENSE_OPERATING';

export interface LedgerEntryProps {
  id: string;
  workspaceId: string;
  transactionDate: string;
  debitAccount: AccountType;
  creditAccount: AccountType;
  amountScaled: bigint;
  currencyCode: string;
  partyId?: string;
  documentId?: string;
  documentType?: string;
  narration: string;
  createdAt: string;
}

export class LedgerEntry {
  private _props: LedgerEntryProps;

  constructor(props: LedgerEntryProps) {
    this._props = { ...props };
  }

  public get id(): string {
    return this._props.id;
  }

  public get workspaceId(): string {
    return this._props.workspaceId;
  }

  public get amount(): Money {
    return Money.fromScaled(this._props.amountScaled, this._props.currencyCode);
  }

  public get debitAccount(): AccountType {
    return this._props.debitAccount;
  }

  public get creditAccount(): AccountType {
    return this._props.creditAccount;
  }

  public get partyId(): string | undefined {
    return this._props.partyId;
  }

  public get documentId(): string | undefined {
    return this._props.documentId;
  }

  public get narration(): string {
    return this._props.narration;
  }

  public get props(): Readonly<LedgerEntryProps> {
    return Object.freeze({ ...this._props });
  }

  /**
   * Factory: creates a balanced ledger entry for a sales invoice (Receivable Dr, Sales Revenue Cr)
   */
  public static forCreditSale(
    id: string,
    workspaceId: string,
    partyId: string,
    documentId: string,
    amount: Money,
    narration: string
  ): LedgerEntry {
    return new LedgerEntry({
      id,
      workspaceId,
      transactionDate: new Date().toISOString(),
      debitAccount: 'ASSET_RECEIVABLE',
      creditAccount: 'REVENUE_SALES',
      amountScaled: amount.scaledUnits,
      currencyCode: amount.currency.code,
      partyId,
      documentId,
      documentType: 'sales_invoice',
      narration,
      createdAt: new Date().toISOString()
    });
  }

  /**
   * Factory: creates a balanced ledger entry for a credit purchase (Inventory Dr, Payable Cr)
   */
  public static forCreditPurchase(
    id: string,
    workspaceId: string,
    partyId: string,
    documentId: string,
    amount: Money,
    narration: string
  ): LedgerEntry {
    return new LedgerEntry({
      id,
      workspaceId,
      transactionDate: new Date().toISOString(),
      debitAccount: 'ASSET_INVENTORY',
      creditAccount: 'LIABILITY_PAYABLE',
      amountScaled: amount.scaledUnits,
      currencyCode: amount.currency.code,
      partyId,
      documentId,
      documentType: 'purchase_bill',
      narration,
      createdAt: new Date().toISOString()
    });
  }

  /**
   * Factory: creates a balanced entry for a customer cash receipt (Cash Dr, Receivable Cr)
   */
  public static forCustomerPayment(
    id: string,
    workspaceId: string,
    partyId: string,
    amount: Money,
    isBankTransfer: boolean,
    narration: string
  ): LedgerEntry {
    return new LedgerEntry({
      id,
      workspaceId,
      transactionDate: new Date().toISOString(),
      debitAccount: isBankTransfer ? 'ASSET_BANK' : 'ASSET_CASH',
      creditAccount: 'ASSET_RECEIVABLE',
      amountScaled: amount.scaledUnits,
      currencyCode: amount.currency.code,
      partyId,
      narration,
      createdAt: new Date().toISOString()
    });
  }
}
