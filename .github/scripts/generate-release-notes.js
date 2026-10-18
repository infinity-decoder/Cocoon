/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';

/**
 * Generates clear, non-technical, human-readable release notes
 * categorized by Features, Bug Fixes, and Improvements.
 */
function cleanCommitMessage(msg) {
  if (!msg) return '';
  let cleaned = msg.trim();

  // Strip conventional commit prefix like feat:, feat(scope):, fix:, etc.
  cleaned = cleaned.replace(/^(feat|fix|perf|refactor|style|test|docs|chore|build|ci)(\([a-zA-Z0-9_/-]+\))?:\s*/i, '');

  // Strip leading issue numbers or ticket tags like [#123] or (#123)
  cleaned = cleaned.replace(/^\[#?\d+\]\s*/, '').replace(/^\(#?\d+\)\s*/, '');

  // Capitalize first character
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // Remove trailing period if present for consistent bullet list styling
  cleaned = cleaned.replace(/\.$/, '');

  return cleaned.trim();
}

function isIgnoredCommit(msg) {
  const lower = msg.toLowerCase();
  // Filter out automated merge and tag commits
  if (lower.startsWith('merge branch') || lower.startsWith('merge pull request')) return true;
  if (/^v?\d+\.\d+\.\d+$/.test(lower)) return true;
  if (lower.startsWith('release:') || lower.startsWith('bump version')) return true;
  if (lower.includes('skip-changelog') || lower.includes('[skip ci]')) return true;
  return false;
}

function categorizeCommit(originalMsg) {
  const lower = originalMsg.toLowerCase();

  // Features
  if (
    lower.startsWith('feat') ||
    lower.startsWith('add') ||
    lower.startsWith('implement') ||
    lower.startsWith('support') ||
    lower.startsWith('create') ||
    lower.startsWith('introduce') ||
    lower.startsWith('enable')
  ) {
    return 'features';
  }

  // Fixes
  if (
    lower.startsWith('fix') ||
    lower.startsWith('bug') ||
    lower.startsWith('resolve') ||
    lower.startsWith('correct') ||
    lower.startsWith('prevent') ||
    lower.startsWith('patch')
  ) {
    return 'fixes';
  }

  // Maintenance & Improvements
  return 'improvements';
}

function getCommitList(prevTag) {
  try {
    let gitRange = 'HEAD';
    if (prevTag) {
      try {
        execSync(`git rev-parse --verify ${prevTag}`, { stdio: 'ignore' });
        gitRange = `${prevTag}..HEAD`;
      } catch {
        // Tag doesn't exist locally; fall back to last 20 commits
        gitRange = '-n 20 HEAD';
      }
    } else {
      gitRange = '-n 20 HEAD';
    }

    const output = execSync(`git log ${gitRange} --no-merges --pretty=format:"%s"`, {
      encoding: 'utf-8'
    });

    return output
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  } catch (err) {
    console.warn('Warning: Could not read git log:', err.message);
    return [];
  }
}

export function generateReleaseNotes(prevTag, outputFilePath) {
  const rawCommits = getCommitList(prevTag);

  const features = new Set();
  const fixes = new Set();
  const improvements = new Set();

  for (const raw of rawCommits) {
    if (isIgnoredCommit(raw)) continue;

    const cleaned = cleanCommitMessage(raw);
    if (!cleaned) continue;

    const category = categorizeCommit(raw);
    if (category === 'features') {
      features.add(cleaned);
    } else if (category === 'fixes') {
      fixes.add(cleaned);
    } else {
      improvements.add(cleaned);
    }
  }

  const sections = [];
  sections.push('### 📋 What\'s Changed in this Release');

  let hasItems = false;

  if (features.size > 0) {
    hasItems = true;
    sections.push('\n#### 🚀 Features & New Capabilities');
    for (const item of features) {
      sections.push(`- ${item}`);
    }
  }

  if (fixes.size > 0) {
    hasItems = true;
    sections.push('\n#### 🐛 Bug Fixes & Stability Improvements');
    for (const item of fixes) {
      sections.push(`- ${item}`);
    }
  }

  if (improvements.size > 0) {
    hasItems = true;
    sections.push('\n#### 🔄 Enhancements & Maintenance');
    for (const item of improvements) {
      sections.push(`- ${item}`);
    }
  }

  if (!hasItems) {
    sections.push('\n- General performance improvements, stability updates, and user experience enhancements.');
  }

  const finalMarkdown = sections.join('\n');

  if (outputFilePath) {
    fs.writeFileSync(outputFilePath, finalMarkdown, 'utf-8');
    console.log(`Generated release notes written to: ${outputFilePath}`);
  }

  // Also support writing directly to $GITHUB_OUTPUT if in GitHub Actions
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput && fs.existsSync(githubOutput)) {
    const delimiter = `CHANGELOG_DELIMITER_${Date.now()}`;
    const outputContent = `changelog<<${delimiter}\n${finalMarkdown}\n${delimiter}\n`;
    fs.appendFileSync(githubOutput, outputContent, 'utf-8');
  }

  return finalMarkdown;
}

// When executed directly from CLI
const isDirectRun = process.argv[1]?.endsWith('generate-release-notes.js');
if (isDirectRun) {
  const prevTag = process.env.PREVIOUS_TAG || process.argv[2] || '';
  const outputPath = process.env.OUTPUT_FILE || process.argv[3] || 'release-notes.md';
  const notes = generateReleaseNotes(prevTag, outputPath);
  console.log('--- Release Notes Preview ---');
  console.log(notes);
}
