# ADR-006: Personal Finance Database & Service Architecture Migration

## Context
Cocoon initially serialized the entire application state tree into `localStorage` on every keystroke and render (`saveAppState(state)`). While functional for early prototyping, full-state serialization degrades exponentially as transaction history scales, risks JSON corruption during browser crashes or process termination, and performs repeated unbounded JavaScript array scans for filtering, pagination, and reporting.

## Decision
We migrated the personal finance domain to an authoritative, durable SQLite architecture driven by dedicated Application Services and Query Services:

1. **Dedicated Application Services & Targeted Writes (`PersonalFinanceService`)**:
   - Replaced monolithic full-state serialization with isolated, targeted SQL statements (`INSERT`, `UPDATE`, `DELETE`).
   - Every state-altering action (e.g. `addTransaction`, `editTransaction`, `deleteTransaction`, `transferToSavings`, `withdrawFromSavings`, `setBudget`, `updateSettings`) executes inside an atomic SQLite transaction.
   - Preserves referential integrity between `transactions`, `wallets`, `savings_goals`, and `budgets`.

2. **Decoupled SQL Query Services (`TransactionQueryService` & `SummaryQueryService`)**:
   - Large transaction histories are browsed using SQL `LIMIT` and `OFFSET` pagination (page size: 25) with stable secondary sorting (`ORDER BY date DESC, id DESC`).
   - Filtering by search term, category, type, date range, and amount is handled via parameterized SQL queries rather than in-memory JavaScript array scans.
   - Summary aggregations (`monthIncome`, `monthExpense`, `netLiquidBalance`, `categoryBreakdown`) execute targeted database queries combined with domain `Money` primitives.

3. **Optimistic Rollback & Error Barriers**:
   - The React UI only commits updates after the database transaction has successfully committed.
   - If an operation fails (e.g., negative amount, foreign key violation, insufficient funds), the database rolls back atomically, an error banner is displayed to the user, and the current UI state remains intact.

4. **Elimination of Routine Full-State LocalStorage Writes**:
   - The blanket `useEffect(() => saveAppState(state), [state])` has been completely eliminated.
   - LocalStorage is retained solely for non-sensitive presentation preferences (active theme ID, guide dismissal) and explicit backup exports.

5. **Data Preservation & Compatibility**:
   - All legacy categories, subcategories, budgets, savings goals, wallets, transaction notes, attachments, and settings are preserved without alteration.

## Consequences
- **Performance**: Sub-millisecond database updates; browsing thousands of transactions requires only bounded memory allocations.
- **Reliability**: ACID guarantees protect wallet balances during concurrent operations or device crashes.
- **Safety**: Unsaved form state in modals remains separate from persisted database state.
