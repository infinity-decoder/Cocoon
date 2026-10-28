#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  '.gradle',
  'release-output'
]);

const IGNORED_FILES = new Set([
  'package-lock.json',
  'bun.lock',
  '.gitignore',
  'scripts/scan-secrets.mjs'
]);

// Secret regex patterns to identify accidental credential commitments
const SECRET_PATTERNS = [
  {
    name: 'Private Cryptographic Key',
    regex: /-----BEGIN\s+(RSA|OPENSSH|DSA|EC|PGP)?\s*PRIVATE KEY-----/i
  },
  {
    name: 'AWS Access Key ID',
    regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/
  },
  {
    name: 'GitHub Personal Access Token',
    regex: /gh[pousr]_[A-Za-z0-9_]{36,255}/
  },
  {
    name: 'Google API Key',
    regex: /AIzaSy[A-Za-z0-9\\-_]{33}/
  },
  {
    name: 'Stripe Live Secret Key',
    regex: /sk_live_[0-9a-zA-Z]{24}/
  },
  {
    name: 'Slack Token',
    regex: /xox[baprs]-[0-9a-zA-Z]{10,48}/
  },
  {
    name: 'Database URL with Password',
    regex: /(?:postgres|mysql|mongodb|redis):\/\/[a-zA-Z0-9_-]+:[^@\s]+@[a-zA-Z0-9.-]+/
  }
];

const DISALLOWED_EXTENSIONS = new Set([
  '.keystore',
  '.jks',
  '.p12',
  '.pfx'
]);

const findings = [];

function scanFile(filePath, relativePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (DISALLOWED_EXTENSIONS.has(ext)) {
    findings.push({
      file: relativePath,
      line: 1,
      rule: 'Committed Binary Keystore/Certificate File',
      preview: `Disallowed extension "${ext}" detected.`
    });
    return;
  }

  // Binary file check (quick check for null bytes)
  const buffer = fs.readFileSync(filePath);
  const isBinary = buffer.slice(0, 1024).includes(0);
  if (isBinary) return;

  const content = buffer.toString('utf-8');
  const lines = content.split('\n');

  for (let lineNum = 1; lineNum <= lines.length; lineNum++) {
    const line = lines[lineNum - 1];
    
    // Ignore obvious comments referencing test keys or placeholder docs
    if (line.includes('eslint-disable') || line.includes('NO_SECRET_CHECK')) {
      continue;
    }

    for (const pattern of SECRET_PATTERNS) {
      if (pattern.regex.test(line)) {
        findings.push({
          file: relativePath,
          line: lineNum,
          rule: pattern.name,
          preview: line.trim().slice(0, 80)
        });
      }
    }
  }
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

    if (IGNORED_FILES.has(relPath)) continue;

    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.isFile()) {
      scanFile(fullPath, relPath);
    }
  }
}

console.log('🔍 Running Secret & Credential Pre-flight Scan...');
walkDir(rootDir);

if (findings.length > 0) {
  console.error('\n❌ CRITICAL: Potential secret or credential exposure detected:');
  for (const f of findings) {
    console.error(`  - [${f.rule}] in ${f.file}:${f.line}`);
    console.error(`    Matched: ${f.preview}`);
  }
  console.error('\nPlease remove sensitive credentials before committing or releasing.\n');
  process.exit(1);
} else {
  console.log('✅ Clean: No committed keys, keystores, or unredacted secrets found.\n');
  process.exit(0);
}
