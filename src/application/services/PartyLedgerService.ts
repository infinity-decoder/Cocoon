/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Party } from '../../domain/parties/Party';
import { LedgerEntry } from '../../domain/accounting/LedgerEntry';
import { Money } from '../../domain/money/Money';

export interface PartyStatementSummary {
  partyId: string;
  partyName: string;
  totalDebits: Money;   // Billed to party
  totalCredits: Money;  // Paid by party
  closingBalance: Money;
  isReceivable: boolean;
  entries: LedgerEntry[];
}

export class PartyLedgerService {
  /**
   * Generates a formal party ledger statement with chronological running balance.
   */
  public generateStatement(
    party: Party,
    ledgerEntries: LedgerEntry[]
  ): PartyStatementSummary {
    const currencyCode = party.props.currencyCode;
    const relevantEntries = ledgerEntries
      .filter(e => e.partyId === party.id)
      .sort((a, b) => new Date(a.props.transactionDate).getTime() - new Date(b.props.transactionDate).getTime());

    let totalDebitsScaled = 0n;
    let totalCreditsScaled = 0n;

    for (const entry of relevantEntries) {
      if (entry.debitAccount === 'ASSET_RECEIVABLE' || entry.creditAccount === 'LIABILITY_PAYABLE') {
        totalDebitsScaled += entry.amount.scaledUnits;
      } else {
        totalCreditsScaled += entry.amount.scaledUnits;
      }
    }

    const closingBalanceScaled = party.props.currentBalanceScaled;
    const closingBalance = Money.fromScaled(closingBalanceScaled, currencyCode);

    return {
      partyId: party.id,
      partyName: party.name,
      totalDebits: Money.fromScaled(totalDebitsScaled, currencyCode),
      totalCredits: Money.fromScaled(totalCreditsScaled, currencyCode),
      closingBalance,
      isReceivable: closingBalanceScaled > 0n,
      entries: relevantEntries
    };
  }
}
