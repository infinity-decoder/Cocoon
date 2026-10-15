/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateEntityId, isValidEntityId } from './EntityId';

describe('Domain Primitives: EntityId', () => {
  it('generates collision-resistant stable identifiers with optional domain prefix', () => {
    const rawId = generateEntityId();
    assert.equal(typeof rawId, 'string');
    assert.equal(rawId.length >= 36, true);
    assert.equal(isValidEntityId(rawId), true);

    const txId = generateEntityId('tx');
    assert.equal(txId.startsWith('tx_'), true);
    assert.equal(isValidEntityId(txId, 'tx'), true);

    const walId = generateEntityId('wal');
    assert.equal(walId.startsWith('wal_'), true);
    assert.equal(isValidEntityId(walId, 'wal'), true);
  });

  it('generates unique IDs across successive iterations without collision', () => {
    const idSet = new Set<string>();
    const count = 1000;

    for (let i = 0; i < count; i++) {
      const id = generateEntityId('item');
      assert.equal(idSet.has(id), false, `Collision detected for ID: ${id}`);
      idSet.add(id);
    }

    assert.equal(idSet.size, count);
  });

  it('rejects unstable, non-collision-resistant identifiers (timestamps, array indices, short names)', () => {
    // Array positions
    assert.equal(isValidEntityId('0'), false);
    assert.equal(isValidEntityId('1'), false);
    assert.equal(isValidEntityId('42'), false);

    // Timestamps alone
    assert.equal(isValidEntityId('1710000000000'), false);
    assert.equal(isValidEntityId(`${Date.now()}`), false);

    // Short display names or strings
    assert.equal(isValidEntityId('cash'), false);
    assert.equal(isValidEntityId('Food & Dining'), false);
    assert.equal(isValidEntityId(''), false);
    assert.equal(isValidEntityId(null), false);
    assert.equal(isValidEntityId(undefined), false);

    // Mismatched prefix
    const txId = generateEntityId('tx');
    assert.equal(isValidEntityId(txId, 'party'), false);
  });
});
