// Offline tests for PREIMAGE-SHA-256 condition/fulfillment encoding.
// Run: npm test   (no network needed)

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  conditionFromPreimage,
  fulfillmentFromPreimage,
  preimageFromFulfillment,
  fulfillmentMatchesCondition,
  generateConditionPair,
} from '../src/conditions.js';

const ZERO32 = Buffer.alloc(32);
const SHA256_ZERO32 = crypto.createHash('sha256').update(ZERO32).digest('hex').toUpperCase();

test('condition encodes fingerprint and preimage-length cost in DER', () => {
  assert.equal(
    conditionFromPreimage(ZERO32),
    `A0258020${SHA256_ZERO32}810120`,
  );
});

test('fulfillment wraps the preimage in DER (A0 22 80 20 <preimage>)', () => {
  assert.equal(
    fulfillmentFromPreimage(ZERO32),
    `A0228020${'00'.repeat(32)}`,
  );
});

test('short preimages get the same DER layout with their own cost byte', () => {
  const one = Buffer.from([0xff]);
  const fp = crypto.createHash('sha256').update(one).digest('hex').toUpperCase();
  assert.equal(conditionFromPreimage(one), `A0258020${fp}810101`);
  assert.equal(fulfillmentFromPreimage(one), 'A0038001FF');
});

test('fulfillment decodes back to its preimage', () => {
  const preimage = crypto.randomBytes(32);
  assert.deepEqual(preimageFromFulfillment(fulfillmentFromPreimage(preimage)), preimage);
});

test('fulfillmentMatchesCondition is true only for the right preimage', () => {
  const { condition, fulfillment } = generateConditionPair();
  assert.equal(fulfillmentMatchesCondition(condition, fulfillment), true);
  const tampered = `A0228020${crypto.randomBytes(32).toString('hex').toUpperCase()}`;
  assert.equal(fulfillmentMatchesCondition(condition, tampered), false);
});

test('malformed fulfillments are rejected', () => {
  assert.throws(() => preimageFromFulfillment('AA'));
  assert.throws(() => preimageFromFulfillment('A0228020' + '00'.repeat(31))); // short body
});

test('preimages must be 1..127 bytes (DER short form only)', () => {
  assert.throws(() => conditionFromPreimage(Buffer.alloc(0)));
  assert.throws(() => conditionFromPreimage(Buffer.alloc(128)));
  assert.throws(() => fulfillmentFromPreimage('not a buffer'));
});
