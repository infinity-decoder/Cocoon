# Cocoon Finance — Staged Release, Signing & Rollback Guide

This guide establishes the operational protocol for verifying, signing, deploying, and rolling back production releases of the Cocoon Android application.

---

## 1. Pre-Flight Verification Checklist

Before triggering a release build, the CI pipeline enforces the following automated gates:

```
[Clean Checkout] ──► [Lockfile Check] ──► [Secret Scanner] ──► [TypeScript Lint]
                                                                        │
┌───────────────────────────────────────────────────────────────────────┘
│
▼
[Domain Unit Tests] ──► [Migrations 001-010] ──► [Accounting Invariants]
                                                                        │
┌───────────────────────────────────────────────────────────────────────┘
│
▼
[Encrypted Backup & Restore] ──► [Benchmarks (100k scale)] ──► [Release Build]
```

To run the complete pre-flight verification locally:
```bash
npm run verify:pipeline
```

### Verification Gates Detail:
1. **Dependency & Lockfile Integrity**:
   - `npm ci --ignore-scripts` ensures deterministic builds identical to CI.
2. **Secret & Credential Scan**:
   - `npm run verify:secrets` scans all tracked files for high-entropy tokens, AWS/Google API keys, and binary keystore files (`.keystore`, `.jks`, `.p12`).
3. **Double-Entry Accounting Invariants**:
   - `npm run test:accounting` verifies mathematical balance: `Debits == Credits` for all posted journals, Khata payments, and sales invoices.
4. **SQLite Migrations & Rollback Testing**:
   - `npm run test:migrations` validates sequential upgrade across all registered migrations (001 through 010) and verifies transactional rollback on simulated failure.
5. **Authenticated Backup & Restore**:
   - `npm run test:backups` tests AES-256-GCM encryption, decryption, checksum validation, and pre-restore sandbox verification.
6. **High-Volume Performance SLAs**:
   - `npm run test:benchmarks` asserts that p95 barcode lookups stay under 150 ms and ledger page queries stay under 200 ms under synthetic load.

---

## 2. Signing Architecture & Secret Protection

### 2.1 Separation of Debug & Release Keys
- **Debug Builds**: Signed with Android's default ephemeral debug certificate (`~/.android/debug.keystore`). Never deployed to production.
- **Production Builds**: Signed with a dedicated 2048-bit RSA key using APK Signature Scheme v2 and v3.

### 2.2 Protected Secret Storage
- Keystore binaries, passwords, and aliases must **NEVER** be committed to Git.
- In GitHub Actions, production release secrets are stored in repository secrets:
  - `ANDROID_RELEASE_KEYSTORE_BASE64`: Base64-encoded release `.keystore` file.
  - `ANDROID_RELEASE_KEYSTORE_PASSWORD`: Keystore master password.
  - `ANDROID_RELEASE_KEY_ALIAS`: Private key alias (e.g., `cocoon_release_key`).
  - `ANDROID_RELEASE_KEY_PASSWORD`: Private key password.

### 2.3 Ephemeral Runner Fallback
If repository secrets are not configured (e.g., for automated branch PR validation), the pipeline generates an ephemeral, high-entropy keystore inside `$RUNNER_TEMP`, signs and verifies the APK, and securely deletes the keystore upon completion.

### 2.4 Signature Scheme Requirements
Android 11+ (API 30+) requires APK Signature Scheme v2 or v3. The pipeline verifies this via:
```bash
apksigner verify --verbose release-output/Cocoon-v*.apk
```

---

## 3. Staged Release Protocol

To prevent widespread operational disruption, production releases must follow a 4-phase staged rollout:

| Phase | Distribution | Duration | Gate Condition |
|---|---|---|---|
| **Phase 1: Dogfood / Canary** | Internal Team (5–10 devices) | 24 Hours | 0 migration failures, 0 database initialization errors |
| **Phase 2: Early Adopter** | 5% User Base | 48 Hours | Crash-free sessions > 99.5%, backup success rate = 100% |
| **Phase 3: Broad Rollout** | 25% → 50% User Base | 48 Hours | Latency under p95 thresholds, 0 integrity anomalies |
| **Phase 4: Full Release** | 100% General Availability | Continuous | Monitor privacy-conscious telemetry |

---

## 4. Privacy-Conscious Operational Telemetry

Cocoon strictly enforces zero transmission of financial descriptions, customer names, phone numbers, invoice contents, or balances. Operational diagnostics track only:
- `MIGRATION_EXECUTION`: Migration version and error codes (`OK` or `ERR_SQLITE_*`).
- `DATABASE_INIT`: SQLite connection pool status and duration.
- `BACKUP_OPERATION`: Action type (`export`/`restore`), format version (`3.0.0`), and archive size in KB.
- `SLOW_OPERATION`: Operation tag and duration if exceeding 150 ms.
- `APP_CRASH`: Sanitized exception name and scrubbed stack traces.

Users must provide explicit consent before exporting or sharing diagnostics.

---

## 5. Rollback Procedures

If a critical flaw is detected post-release, follow the corresponding rollback path:

### 5.1 Scenario A: Web-Asset or UI Regression (No Schema Change)
1. Revert the problematic Git commit on `main`.
2. The pipeline will automatically rebuild, test, and release `vX.Y.(Z+1)`.
3. Users receive the updated APK or service worker refresh without database modification.

### 5.2 Scenario B: Database Migration Regression
1. **Additive Schema Rule**: Cocoon migrations are strictly additive (e.g., new tables, non-null columns with defaults, or new indexes). Dropping existing columns in migrations is prohibited.
2. If an index or migration causes unexpected locking:
   - Create a forward-fix migration (e.g. `011_fix_index_performance.ts`) that corrects the schema cleanly.
   - Do **NOT** edit or remove historical migrations (`001` through `010`).
3. For individual device recovery:
   - Cocoon automatically takes an emergency pre-restore snapshot prior to executing any restore or critical migration.
   - The user can restore from their latest authenticated `.cocoonbackup` file via **Settings → Backup & Restore**.

### 5.3 Scenario C: Native Android Crash (App Fails to Launch)
1. Halt staged rollout in the Google Play Console / deployment channel immediately.
2. Identify root cause from the `PrivacyDiagnosticsService` sanitized crash report.
3. Deploy a hotfix release with an incremented `versionCode`.
4. Note: Android Package Manager strictly forbids downgrading an installed APK to an older `versionCode` without clearing application data. Therefore, rollbacks on native mobile are executed as **forward hotfixes** (incremented version code containing the reverted code).

---

## 6. Artifact Provenance & Verification

Every APK generated by the pipeline is accompanied by:
- `SHA256SUMS`: Cryptographic SHA-256 fingerprint of the release binary.
- `SHA512SUMS`: Cryptographic SHA-512 fingerprint.
- `build-metadata.json`: Machine-readable provenance mapping the APK directly to the source Git commit SHA, build runner environment, and timestamp.

To verify binary integrity before distribution:
```bash
sha256sum -c SHA256SUMS
```
