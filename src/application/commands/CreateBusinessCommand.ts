/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Business, BusinessType } from '../../domain/businesses/Business';

export interface CreateBusinessInput {
  name: string;
  legalName?: string;
  businessType: BusinessType;
  currencyCode: string;
  currencySymbol: string;
  taxRegistrationNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  invoicePrefix?: string;
}

export class CreateBusinessCommandHandler {
  public execute(input: CreateBusinessInput): Business {
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('Business name is required.');
    }

    const now = new Date().toISOString();
    const id = `biz_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const prefix = input.invoicePrefix || input.name.slice(0, 3).toUpperCase();

    return new Business({
      id,
      name: input.name.trim(),
      legalName: input.legalName?.trim(),
      businessType: input.businessType || 'retail',
      currencyCode: input.currencyCode || 'PKR',
      currencySymbol: input.currencySymbol || '₨',
      taxRegistrationNumber: input.taxRegistrationNumber?.trim(),
      phone: input.phone?.trim(),
      email: input.email?.trim(),
      address: input.address?.trim(),
      invoicePrefix: prefix,
      nextInvoiceSequence: 1,
      createdAt: now,
      updatedAt: now,
      isActive: true
    });
  }
}
