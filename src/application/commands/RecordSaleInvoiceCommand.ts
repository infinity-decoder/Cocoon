/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Invoice, DocumentLineItem } from '../../domain/documents/Invoice';
import { Money } from '../../domain/money/Money';

export interface RecordSaleInvoiceInput {
  workspaceId: string;
  invoiceNumber: string;
  partyId: string;
  partyName: string;
  issueDate?: string;
  dueDate?: string;
  currencyCode: string;
  items: {
    itemId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRatePercent?: number;
  }[];
  notes?: string;
  attachmentRelativePath?: string;
}

export class RecordSaleInvoiceCommandHandler {
  public execute(input: RecordSaleInvoiceInput): Invoice {
    if (!input.items || input.items.length === 0) {
      throw new Error('Invoice must contain at least one line item.');
    }

    let subtotalScaled = 0n;
    let totalTaxScaled = 0n;

    const lineItems: DocumentLineItem[] = input.items.map((item, idx) => {
      const priceMoney = Money.fromDecimal(item.unitPrice, input.currencyCode);
      const qtyBig = BigInt(Math.max(1, Math.floor(item.quantity)));
      const lineTotalScaled = priceMoney.scaledUnits * qtyBig;
      
      const taxRate = item.taxRatePercent ?? 0;
      const taxScaled = (lineTotalScaled * BigInt(Math.floor(taxRate * 100))) / 10000n;

      subtotalScaled += lineTotalScaled;
      totalTaxScaled += taxScaled;

      return {
        id: `line_${idx + 1}`,
        itemId: item.itemId,
        description: item.description,
        quantity: item.quantity,
        unitPriceScaled: priceMoney.scaledUnits,
        discountScaled: 0n,
        taxRatePercent: taxRate,
        taxScaled,
        totalScaled: lineTotalScaled + taxScaled
      };
    });

    const totalScaled = subtotalScaled + totalTaxScaled;
    const now = new Date().toISOString();

    return new Invoice({
      id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      workspaceId: input.workspaceId,
      documentType: 'sales_invoice',
      invoiceNumber: input.invoiceNumber,
      partyId: input.partyId,
      partyName: input.partyName,
      issueDate: input.issueDate || now,
      dueDate: input.dueDate || now,
      currencyCode: input.currencyCode,
      items: lineItems,
      subtotalScaled,
      discountScaled: 0n,
      taxScaled: totalTaxScaled,
      totalScaled,
      paidAmountScaled: 0n,
      status: 'unpaid',
      notes: input.notes,
      attachmentRelativePath: input.attachmentRelativePath,
      createdAt: now,
      updatedAt: now
    });
  }
}
