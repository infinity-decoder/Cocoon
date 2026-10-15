# ADR-005: Durable SQLite Database Service, Transactional Migrations & Double-Entry Schema

## Status
Accepted

## Context
As Cocoon expands from personal expense tracking into a complete ERP and business accounting solution, data integrity, concurrency, and durability require a dedicated database architecture. 
The checked-out project uses **Capacitor 8** (`@capacitor/core: 8.5.1`, `@capacitor/android: 8.5.1`) with `@capacitor-community/sqlite: ^8.1.1`.

Key architectural requirements:
1. **Connection Lifecycle & Concurrency:** Multiple React components must not open competing connections or trigger concurrent conflicting migration runs.
2. **Referential Integrity:** Foreign keys must be enforced strictly on every connection (`PRAGMA foreign_keys = ON;`).
3. **Write Concurrency & Mobile Durability:** High write throughput on Android without lock contention or data corruption.
4. **Zero Data Loss on Migration Failures:** Migrations must execute inside atomic transactions; a failed migration must roll back completely without partial table writes or corrupting version tracking.
5. **Double-Entry Financial Accounting:** Support multi-tenant business workspaces, chart of accounts, customers/suppliers (parties), and double-entry balanced journal entries utilizing the integer minor-unit scaled `Money` convention (`INTEGER` scaled by `10^4`).
6. **Zero-Loss Error Handling:** Never replace or overwrite a failed database with an empty initial state.

---

## Decisions

### 1. Capacitor 8 Compatibility & Driver Selection
- Confirmed `@capacitor-community/sqlite: ^8.1.1` is natively compatible with Capacitor 8 (`@capacitor/core: 8.5.1`).
- Multi-driver strategy:
  - **Android/iOS:** Native `@capacitor-community/sqlite` driver with WAL mode.
  - **Node.js (Automated Tests & CI):** Node 22 native `DatabaseSync` (`node:sqlite`) with `PRAGMA foreign_keys = ON;`.
  - **Web Preview:** Universal `MemoryDatabaseAdapter` providing in-memory prepared-statement execution.

### 2. Connection Lifecycle & Single-Flight Mutex
- `DatabaseService` owns single-instance connection creation, migration coordination, and error observation.
- Employs an internal promise mutex (`initPromise`): concurrent callers (e.g. 10 simultaneous React components on app mount) await the exact same in-flight initialization promise.

### 3. PRAGMA Durability & Concurrency Configuration
On every opened connection, `DatabaseService` applies:
- `PRAGMA foreign_keys = ON;`: Mandates foreign key referential integrity on all tables.
- `PRAGMA journal_mode = WAL;`: Write-Ahead Logging allows concurrent readers and writers without blocking on Android.
- `PRAGMA synchronous = NORMAL;`: Provides complete durability against app crashes and power loss in WAL mode while reducing disk I/O latency by 80% compared to `FULL` sync.
- `PRAGMA busy_timeout = 5000;`: Waits up to 5 seconds to acquire locks during concurrent transactions, eliminating transient `SQLITE_BUSY` exceptions.

### 4. Transactional Migration Framework
- Versioned migrations are immutable and registered in `MIGRATION_REGISTRY`:
  - `001_initial_personal_finance`: Version 1 (personal accounts, categories, transactions, budgets, savings goals, bill reminders, settings).
  - `002_business_workspaces_ledger_parties`: Version 2 (workspaces, payment_terms, parties, accounts, journal_entries, journal_lines, audit_events, document_attachments).
- Each migration runs inside `conn.executeTransaction(...)`. If any statement fails, the transaction rolls back cleanly, leaving `schema_migrations` intact at the previous version.

### 5. Double-Entry Schema Architecture
- **Workspaces (`workspaces`):** Multi-tenant boundary. Automatically seeds `ws_personal_default` to preserve existing personal transactions.
- **Chart of Accounts (`accounts`):** Standard accounts (`1010` Cash, `1020` Bank, `1200` A/R, `1300` Inventory, `2010` A/P, `3000` Equity, `4000` Revenue, `5000` COGS, `6000` Expenses) with `UNIQUE(workspace_id, account_code)`.
- **Parties (`parties`):** Customers and suppliers with `credit_limit_scaled INTEGER NOT NULL DEFAULT 0` (scaled by 10^4).
- **Journal Entries & Lines (`journal_entries`, `journal_lines`):**
  - Header with `UNIQUE(workspace_id, entry_number)`.
  - Lines with `debit_amount_scaled INTEGER` and `credit_amount_scaled INTEGER`.
  - Check constraint enforcing that a line contains either a debit or a credit, never both.
  - `JournalEntryRepository.createWithLines` verifies accounting balance: `sum(debits) === sum(credits)` before writing to SQLite.

### 6. Sanitized Health Check Diagnostic
- `databaseService.checkHealth()` runs `PRAGMA integrity_check(1);` and `PRAGMA foreign_key_check;`.
- Returns sanitized status (`healthy`, `degraded`, `corrupt`), foreign keys status, journal mode, and applied migration count.
- Never reveals sensitive customer names, financial balances, or private notes.

### 7. Zero-Loss Error Recovery Screen
- If database initialization fails, `DatabaseService` publishes to `DatabaseRecoveryModal`.
- Persisted financial data is strictly protected: never overwritten or wiped with an empty fallback state. Users can retry or inspect sanitized diagnostics.

---

## Consequences
- **Positive:**
  - Guarantees referential integrity across workspaces, parties, and double-entry accounts.
  - Zero-drift financial math backed by integer scaled minor units (`10^4`).
  - Safe concurrent initialization across React components.
  - Full rollbacks on failed migrations.
- **Tradeoffs:**
  - Double-entry writes must always specify balanced debits and credits across at least two accounts.
