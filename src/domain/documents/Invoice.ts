/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Money } from '../money/Money';

export type DocumentType = 'sales_invoice' | 'purchase_bill' | 'sales_return' | 'purchase_return' | 'receipt';
export type DocumentStatus = 'draft' | 'unpaid' | 'partial' | 'paid' | 'cancelled';

export interface DocumentLineItem {
  id: string;
  itemId?: string;
  productId?: string;
  packageUnit?: string;
  costPriceScaled?: bigint;
  returnedQuantity?: number;
  description: string;
  quantity: number;
  unitPriceScaled: bigint;
  discountScaled: bigint;
  taxRatePercent: number;
  taxScaled: bigint;
  totalScaled: bigint;
}

export interface InvoiceProps {
  id: string;
  workspaceId: string;
  documentType: DocumentType;
  invoiceNumber: string;
  partyId: string;
  partyName: string;
  issueDate: string;
  dueDate: string;
  currencyCode: string;
  items: DocumentLineItem[];
  subtotalScaled: bigint;
  discountScaled: bigint;
  taxScaled: bigint;
  totalScaled: bigint;
  paidAmountScaled: bigint;
  status: DocumentStatus;
  paymentMethod?: string;
  isPos?: boolean;
  cashierName?: string;
  notes?: string;
  attachmentRelativePath?: string; // Relative path in context.getFilesDir() e.g. "attachments/bills/inv_123.jpg"
  createdAt: string;
  updatedAt: string;
}

export class Invoice {
  private _props: InvoiceProps;

  constructor(props: InvoiceProps) {
    this._props = { ...props };
  }

  public get id(): string {
    return this._props.id;
  }

  public get workspaceId(): string {
    return this._props.workspaceId;
  }

  public get invoiceNumber(): string {
    return this._props.invoiceNumber;
  }

  public get documentType(): DocumentType {
    return this._props.documentType;
  }

  public get partyId(): string {
    return this._props.partyId;
  }

  public get total(): Money {
    return Money.fromScaled(this._props.totalScaled, this._props.currencyCode);
  }

  public get paidAmount(): Money {
    return Money.fromScaled(this._props.paidAmountScaled, this._props.currencyCode);
  }

  public get remainingBalance(): Money {
    const remaining = this._props.totalScaled - this._props.paidAmountScaled;
    return Money.fromScaled(remaining > 0n ? remaining : 0n, this._props.currencyCode);
  }

  public get attachmentRelativePath(): string | undefined {
    return this._props.attachmentRelativePath;
  }

  public get props(): Readonly<InvoiceProps> {
    return Object.freeze({ ...this._props });
  }

  /**
   * Records a payment against this invoice and adjusts document status.
   */
  public applyPayment(paymentAmount: Money): Invoice {
    const nextPaid = this._props.paidAmountScaled + paymentAmount.scaledUnits;
    let nextStatus: DocumentStatus = 'partial';
    if (nextPaid >= this._props.totalScaled) {
      nextStatus = 'paid';
    }

    return new Invoice({
      ...this._props,
      paidAmountScaled: nextPaid,
      status: nextStatus,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Attaches an invoice photo stored in the local private storage folder.
   */
  public withAttachment(relativePath: string): Invoice {
    return new Invoice({
      ...this._props,
      attachmentRelativePath: relativePath,
      updatedAt: new Date().toISOString()
    });
  }
}
