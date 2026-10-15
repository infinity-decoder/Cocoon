# ADR-004: Foundational Domain Primitives — Money, Decimal Quantities, IDs, and Date Semantics

## Status
Accepted

## Context
Phase 2 establishes the core architectural primitives required across personal finance, retail inventory, double-entry accounting, invoicing, and reporting modules. 

Historically, single-currency applications rely on IEEE-754 binary floating-point numbers (`number`), arbitrary string timestamps, and volatile autoincrement integer or array-index identifiers. In a local-first multi-currency business ERP system, these shortcuts lead to:
1. **Floating-Point Imbalance:** Binary floating point drift (`0.1 + 0.2 = 0.30000000000000004`) causes ledger debit/credit mismatches and off-by-one paisa reconciliation errors.
2. **Multi-Currency Precision Gaps:** Different markets require varying precision:
   - Standard 2-decimal fiat currencies (PKR, USD, EUR, INR, GBP).
   - 3-decimal Middle-Eastern currencies (KWD, BHD, OMR, JOD, TND).
   - 0-decimal currencies (JPY, KRW, VND).
   - Sub-unit precision for wholesale quantity discounting and partial sales tax (GST/VAT).
3. **Measured Inventory Truncation:** Products sold by weight (kg, g), volume (litres, ml), or length (meters) require fractional decimal quantities. Assuming integer quantities truncates inventory asset valuations.
4. **ID Collision & Hijacking:** Using array positions, display names, or timestamps alone causes data collisions across devices or during concurrent migrations.
5. **Date Boundary Ambiguity:** Ambiguous timezones and inclusive/inclusive date boundaries lead to double-counting transactions at midnight in monthly reports.

---

## Decisions

### 1. Money Representation & Integer Scaled Strategy
- **Internal Storage:** All authoritative monetary amounts are represented as `bigint` scaled by `10^4` (`MONETARY_SCALE = 10000n`).
  - Standard 2-decimal currencies (e.g. PKR, USD): 1.00 PKR = `10000n` scaled units. 1 Paisa = `100n` scaled units.
  - 3-decimal currencies (e.g. KWD): 1.000 KWD = `10000n` scaled units. 1 Fils = `10n` scaled units.
  - 0-decimal currencies (e.g. JPY): 1 JPY = `10000n` scaled units.
  - Sub-cent precision down to 0.0001 (1/100th of a paisa) is natively preserved for wholesale unit rates and fractional tax without data loss.
- **Pakistani Rupee (PKR) Paisa:** Authoritative minor units are retrieved via `money.toPaisa()` or `money.toMinorUnits()`, which yields exact integer paisa without floating-point conversion.
- **Cross-Currency Arithmetic:** Direct arithmetic between mismatching currency codes is strictly prohibited and throws domain errors. Conversion requires the explicit `money.convert(targetCurrency, exchangeRate, roundingMode)` operator.
- **Remainder-Free Allocation:** Implements Martin Fowler's monetary allocation pattern (`money.allocate(ratios)`). Remainder paisa/cents are distributed 1 minor unit at a time to highest-weighted ratios, guaranteeing `sum(allocated) === originalAmount` with zero penny drift.

### 2. Rounding Modes & Rules
All fractional operations accept an explicit `RoundingMode`:
- `HALF_EVEN` (Default): Banker's rounding (IEEE-754 standard). When equidistant (0.5), rounds to the nearest even integer, eliminating statistical upward skew in financial ledgers.
- `HALF_UP`: Standard commercial rounding. Rounds away from zero at 0.5.
- `CEIL`: Rounds towards positive infinity.
- `FLOOR`: Rounds towards negative infinity.
- `TRUNC`: Rounds towards zero (truncation).

### 3. Decimal Quantities for Measured Inventory
- Inventories of measured goods (e.g. 2.750 kg rice, 1.500 litres oil, 12.25 meters fabric) are represented via `DecimalQuantity` scaled by `QUANTITY_SCALE = 10000n`.
- Valuation calculation: `Asset Value = unitCost.multiplyByQuantity(quantity)`. Integer flooring of quantities is strictly forbidden.

### 4. Taxation & Discounting Precision
- **Discounts:** Handled via `money.applyDiscount({ percent, amount })`, capped at 100% of the original amount.
- **Exclusive Tax:** `taxAmount = netAmount * (rate / 100)`, `grossAmount = netAmount + taxAmount`.
- **Inclusive Tax:** `grossAmount = original`, `netAmount = grossAmount / (1 + rate / 100)`, `taxAmount = grossAmount - netAmount`.

### 5. Stable Identifiers (EntityId)
- All records use collision-resistant UUID v4 strings (122 bits of cryptographic entropy), generated via `crypto.randomUUID()` with secure CSPRNG fallback.
- Standard domain prefixes are prepended: `tx_...`, `wal_...`, `cat_...`, `party_...`, `inv_...`, `biz_...`.
- Array indices, display names, and bare timestamps are rejected by `isValidEntityId()`.

### 6. Canonical Timestamps & Business-Local Date Semantics
- **Field Separation:**
  - `date`: The business-effective accounting date (`YYYY-MM-DD` or ISO string).
  - `createdAt`: Immutable UTC audit timestamp (`YYYY-MM-DDTHH:mm:ss.sssZ`).
  - `updatedAt`: Mutated UTC audit timestamp (`YYYY-MM-DDTHH:mm:ss.sssZ`).
- **DateRange Reporting:** Reports strictly use **inclusive start / exclusive end** intervals `[start, end)`.
  - October 2026: `[2026-10-01T00:00:00.000Z, 2026-11-01T00:00:00.000Z)`.
  - Prevents double-counting of midnight-timestamped transactions.
- **Deterministic Secondary Key Sorting:**
  `compareFinancialRecordsByDate` enforces:
  1. Primary: Effective Date (`date`)
  2. Secondary: Creation Timestamp (`createdAt`)
  3. Tertiary (Tie-breaker): Entity ID (`id` lexicographical)
  This guarantees 100% stable sorting across all platforms and render engines.

---

## Consequences
- **Positive:**
  - Complete elimination of IEEE-754 penny drift in all ledger balances.
  - Native support for international business expansion across Middle East (3 decimals) and Asia (0 and 2 decimals).
  - Fractional inventory stock valuations match physical warehouse quantities.
  - Reports across date boundaries are mathematically deterministic.
- **Tradeoffs:**
  - Code interacting with domain entities must utilize `Money` and `PersonalFinanceMoneyAdapter` rather than raw JavaScript number arithmetic.
