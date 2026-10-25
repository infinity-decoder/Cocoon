# Cocoon Finance — Android/Capacitor Security Architecture & Threat Model

This document specifies the security controls, cryptographic implementations, and threat model boundaries implemented in Cocoon on the Android/Capacitor runtime.

---

## 1. Threat Model & Mitigations

| Threat | Risk Level | Implemented Mitigation |
|---|---|---|
| **Lost or Stolen Device** | High | SQLite database encryption via SQLCipher (256-bit AES) on native Android. Data at rest is high-entropy ciphertext. Device file system extraction via recovery mode or storage chip inspection cannot read unencrypted SQLite pages. |
| **App Left Unlocked** | Medium | Session-scoped in-memory Key Encryption Key (KEK) and Database Encryption Key (DEK). When the user locks the application or triggers a reset, keys in volatile memory are immediately zeroized. |
| **Weak PIN Brute Force** | High | 1. Key derivation uses PBKDF2-HMAC-SHA256 with 100,000 rounds and a 16-byte cryptographically secure random salt.<br>2. Rate-limiting lockout policy enforces exponential backoff delays (30s after 4 failed attempts, 60s at 5, 5m at 6, 15m at 7, up to 30m).<br>3. Timing-safe constant-time comparison prevents side-channel timing attacks. |
| **Rooted Device / USB Debugging Extraction** | High | **Acknowledged limit**: If an attacker has established root access, custom kernel privileges, or memory dump tools (e.g. Frida, Xposed) attached to a running unlocked process, in-memory keys can be inspected. Android Keystore and SQLCipher protect data *at rest*; no user-space software can guarantee absolute safety against a compromised OS kernel while decrypted in RAM. USB backup is protected by restricting ADB backup access. |
| **Plaintext Database / Temp Files** | High | Neither the raw 256-bit DEK nor the user PIN is ever stored in plaintext in `localStorage`, SQLite `app_settings`, or preferences. The DEK is encrypted using AES-256-GCM envelope encryption. Exported files (statements, PDFs, backups) utilize scoped application documents and ephemeral native share sheets, avoiding public world-readable directories. |
| **Backup Tampering** | Medium | Cryptographic checksums verify backup archive integrity upon import. Malicious or mismatched JSON structures are rejected before parsing into database state. |
| **Corrupted Migration / Accidental Deletion** | High | Every migration and financial posting operates within strict ACID database transactions (`conn.executeTransaction`). Any mid-flight error triggers automatic transaction rollback. Zero partial state is committed. Migration snapshots and audit records ensure verified recovery. |
| **Malicious or Compromised Dependencies** | Medium | Offline-first architecture: no remote analytic scripts, third-party CDNs, tracking pixels, or dynamic remote evaluation (`eval`). WebCrypto uses standard browser/Android WebView native cryptographic engines. |
| **Sensitive Info in Logs & Crashes** | Medium | `AuditTrailService` automatically scans and sanitizes event metadata, explicitly redacting passwords, PINs, tokens, raw keys, and authorization secrets before recording events. |
| **Unauthorized Financial Edits / Staff Access** | Medium | Multi-actor Role-Based Access Control (RBAC) permissions table (`staff_permissions`) with defined roles (`owner`, `admin`, `cashier`). Cryptographically chained audit events (`audit_events`) verify whether any event in the history was tampered with or deleted. |

---

## 2. Database Encryption Layer

### 2.1 Android / Capacitor SQLCipher Integration
- On Android, `@capacitor-community/sqlite` utilizes SQLCipher (`net.zetetic:sqlcipher-android`) to encrypt the complete database file, Write-Ahead Logs (`.db-wal`), shared memory (`.db-shm`), and temporary spill files with 256-bit AES.
- The encryption key is supplied to SQLCipher via `setEncryptionSecret(dekHex)` and `createConnection(dbName, true, 'encryption', 1, false)`.

### 2.2 Envelope Key Protection Scheme
```
[User 4-Digit PIN] + [16-Byte Cryptographic Salt]
              │
              ▼  PBKDF2-HMAC-SHA256 (100,000 Iterations)
      [256-Bit Key Encryption Key (KEK)]
              │
              ▼  AES-256-GCM Unwrapping (12-Byte Unique IV)
 [Encrypted DEK Envelope in Local Storage] ──► [256-Bit Raw Master DEK]
                                                        │
                                                        ▼
                                            [SQLCipher Database Engine]
```

1. **Master Key (DEK)**: A cryptographically random 256-bit key generated using CSPRNG (`crypto.getRandomValues`).
2. **Key Envelope**: The Master DEK is encrypted with AES-256-GCM using the PIN-derived KEK.
3. **No Plaintext Persistence**: The raw PIN and raw DEK are never written to disk. Only the envelope (`saltHex`, `ivHex`, `encryptedDekHex`, `pinHashHex`) is stored.
4. **Verification**: When an attacker provides an incorrect PIN, AES-GCM fails authentication tag validation (`OperationError`), preventing the release of the DEK.

### 2.3 Explicit Consequence of Key Loss
> **CRITICAL RECOVERY NOTICE**: Cocoon is an offline-first, zero-knowledge financial application. There is no remote cloud server, administrative recovery backdoor, or master reset key. If a user loses or forgets their PIN and has no unencrypted or separate backup, **the encrypted database cannot be recovered by anyone**.

---

## 3. PIN Authentication & Rate Limiting

- **Separation of UI Lock from Decryption**: The UI lock screen prevents unauthenticated access, while the cryptographic envelope prevents data extraction from disk.
- **Lockout Schedule**:
  - Attempts 1–3: Standard invalid PIN notice.
  - Attempt 4: 30-second delay cooldown.
  - Attempt 5: 60-second delay cooldown.
  - Attempt 6: 300-second (5-minute) delay cooldown.
  - Attempt 7: 900-second (15-minute) delay cooldown.
  - Attempt 8+: 1,800-second (30-minute) maximum delay cooldown.
- **Persistent State**: The lockout counter and `lockedUntil` timestamp are persisted in storage, preventing attackers from bypassing delays by restarting the app.

---

## 4. Cryptographic Audit Trail & RBAC

- **Immutable Hash Chain**: Every recorded business event (`SALE_POSTED`, `SALES_RETURN_POSTED`, `STOCK_ADJUSTMENT`, `SECURITY_EVENT`) contains a SHA-256 hash calculated across:
  `prev_hash:id:workspace_id:event_type:actor_id:source_entity:source_id:action:details_json:timestamp`
- **Chain Verification**: `auditTrailService.verifyChain(conn, workspaceId)` iterates through the ledger from genesis to head. If any event has been altered, deleted, or inserted out-of-band in SQLite, the exact broken event ID is identified.
- **Actor Permissions (RBAC)**:
  - `owner`: Full access to configuration, financial posting, reversals, reports, and audit logs.
  - `admin`: Can post sales, view reports, adjust inventory, and process returns. Restricted from editing master system security settings.
  - `cashier`: Can post POS sales and view sales receipts/reports. Restricted from reversing documents, editing stock, or modifying settings.

---

## 5. Known Limits of Local-Device Security

1. **Rooted Devices**: An attacker with root access to the Android operating system can attach debuggers to the running process while it is unlocked in memory and extract the active DEK.
2. **Physical Hardware Extraction**: Cold-boot attacks or chip decapping while the device RAM is powered can theoretically extract volatile memory contents.
3. **OS-Level Keyloggers**: A compromised Android device with malicious accessibility services or malware keyboards can intercept touch events or PIN entry before it reaches the app.
