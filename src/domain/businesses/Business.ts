/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Money } from '../money/Money';

export type BusinessType = 'retail' | 'wholesale' | 'services' | 'general' | 'distributor';

export interface BusinessProfile {
  id: string;
  name: string;
  legalName?: string;
  businessType: BusinessType;
  currencyCode: string;
  currencySymbol: string;
  taxRegistrationNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  invoicePrefix: string;
  nextInvoiceSequence: number;
  logoPath?: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export class Business {
  private readonly _profile: BusinessProfile;

  constructor(profile: BusinessProfile) {
    this._profile = { ...profile };
  }

  public get id(): string {
    return this._profile.id;
  }

  public get name(): string {
    return this._profile.name;
  }

  public get profile(): Readonly<BusinessProfile> {
    return Object.freeze({ ...this._profile });
  }

  public get currencyCode(): string {
    return this._profile.currencyCode;
  }

  public get currencySymbol(): string {
    return this._profile.currencySymbol;
  }

  public getNextInvoiceNumber(): string {
    const seq = String(this._profile.nextInvoiceSequence).padStart(4, '0');
    return `${this._profile.invoicePrefix}-${seq}`;
  }

  public incrementInvoiceSequence(): Business {
    return new Business({
      ...this._profile,
      nextInvoiceSequence: this._profile.nextInvoiceSequence + 1,
      updatedAt: new Date().toISOString()
    });
  }
}
