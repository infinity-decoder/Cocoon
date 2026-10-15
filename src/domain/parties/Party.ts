/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Money } from '../money/Money';

export type PartyType = 'customer' | 'supplier' | 'distributor' | 'both';

export interface PartyProps {
  id: string;
  workspaceId: string;
  name: string;
  partyType: PartyType;
  phone?: string;
  email?: string;
  address?: string;
  taxNumber?: string;
  creditLimitScaled: bigint;
  paymentTermsDays: number;
  currentBalanceScaled: bigint; // Positive = Debit (they owe user / receivable), Negative = Credit (we owe them / payable)
  currencyCode: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export class Party {
  private _props: PartyProps;

  constructor(props: PartyProps) {
    this._props = { ...props };
  }

  public get id(): string {
    return this._props.id;
  }

  public get workspaceId(): string {
    return this._props.workspaceId;
  }

  public get name(): string {
    return this._props.name;
  }

  public get partyType(): PartyType {
    return this._props.partyType;
  }

  public get isCustomer(): boolean {
    return this._props.partyType === 'customer' || this._props.partyType === 'both';
  }

  public get isSupplier(): boolean {
    return this._props.partyType === 'supplier' || this._props.partyType === 'distributor' || this._props.partyType === 'both';
  }

  public get creditLimit(): Money {
    return Money.fromScaled(this._props.creditLimitScaled, this._props.currencyCode);
  }

  public get currentBalance(): Money {
    return Money.fromScaled(this._props.currentBalanceScaled, this._props.currencyCode);
  }

  public get props(): Readonly<PartyProps> {
    return Object.freeze({ ...this._props });
  }

  /**
   * Evaluates if extending additional credit will exceed party's allowed limit.
   */
  public canExtendCredit(amount: Money): boolean {
    if (this._props.creditLimitScaled <= 0n) {
      return true; // No credit limit enforced
    }
    const projectedBalance = this._props.currentBalanceScaled + amount.scaledUnits;
    return projectedBalance <= this._props.creditLimitScaled;
  }

  /**
   * Applies a debit (increases receivable - e.g. credit sale made to customer)
   */
  public applyDebit(amount: Money): Party {
    return new Party({
      ...this._props,
      currentBalanceScaled: this._props.currentBalanceScaled + amount.scaledUnits,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Applies a credit (decreases receivable or increases payable - e.g. payment received from customer or purchase from supplier)
   */
  public applyCredit(amount: Money): Party {
    return new Party({
      ...this._props,
      currentBalanceScaled: this._props.currentBalanceScaled - amount.scaledUnits,
      updatedAt: new Date().toISOString()
    });
  }
}
