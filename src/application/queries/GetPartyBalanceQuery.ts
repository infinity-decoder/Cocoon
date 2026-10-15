/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Party } from '../../domain/parties/Party';
import { Money } from '../../domain/money/Money';

export interface PartyBalanceSummary {
  partyId: string;
  partyName: string;
  partyType: string;
  balance: Money;
  isReceivable: boolean; // Customer owes user
  isPayable: boolean;    // User owes supplier
}

export class GetPartyBalanceQueryHandler {
  public execute(party: Party): PartyBalanceSummary {
    const bal = party.currentBalance;
    const isReceivable = bal.scaledUnits > 0n;
    const isPayable = bal.scaledUnits < 0n;

    return {
      partyId: party.id,
      partyName: party.name,
      partyType: party.partyType,
      balance: bal,
      isReceivable,
      isPayable
    };
  }
}
