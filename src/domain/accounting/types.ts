/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Workspace {
  id: string; // 'personal' or UUID for businesses
  name: string;
  type: 'personal' | 'business';
  currencyCode: string;
  currencySymbol: string;
  createdAt: string;
  isActive: boolean;
}

export interface BusinessProfile {
  workspaceId: string;
  businessType: 'retail' | 'wholesale' | 'services' | 'general';
  taxNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  logoPath?: string;
  invoicePrefix?: string;
  nextInvoiceNumber?: number;
}

export interface Party {
  id: string;
  workspaceId: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  partyType: 'customer' | 'supplier' | 'both';
  creditLimitScaled?: bigint;
  paymentTermsDays?: number;
  isArchived: boolean;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  workspaceId: string;
  name: string;
  sku?: string;
  barcode?: string;
  unit: string; // 'pcs', 'kg', 'ltr', 'meter', 'box'
  costPriceScaled: bigint;
  salePriceScaled: bigint;
  currentStockQuantity: number;
  minStockAlert?: number;
  isArchived: boolean;
}

export interface InvoiceLineItem {
  id: string;
  itemId?: string;
  description: string;
  quantity: number;
  unitPriceScaled: bigint;
  totalPriceScaled: bigint;
}

export interface Invoice {
  id: string;
  workspaceId: string;
  partyId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  subtotalScaled: bigint;
  discountScaled: bigint;
  taxScaled: bigint;
  totalScaled: bigint;
  status: 'draft' | 'unpaid' | 'partial' | 'paid' | 'cancelled';
  notes?: string;
  items: InvoiceLineItem[];
  createdAt: string;
}
