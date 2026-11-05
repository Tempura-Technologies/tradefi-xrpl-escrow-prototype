// PREIMAGE-SHA-256 crypto-condition helpers (draft-thomas-crypto-conditions-04).
// An escrow created with `Condition` can be finished only by presenting a
// `Fulfillment` whose embedded preimage hashes to the condition fingerprint.
// Only DER short-form lengths are supported, so preimages must be < 128 bytes.

import crypto from 'node:crypto';

const DEFAULT_PREIMAGE_BYTES = 32;

const hexToBuffer = (hex) => Buffer.from(hex, 'hex');
const toUpperHex = (buf) => buf.toString('hex').toUpperCase();

function assertPreimage(preimage) {
  if (!Buffer.isBuffer(preimage) || preimage.length === 0 || preimage.length >= 128) {
    throw new Error('preimage must be a Buffer of 1..127 bytes');
  }
  return preimage;
}

export function generatePreimage(bytes = DEFAULT_PREIMAGE_BYTES) {
  return crypto.randomBytes(bytes);
}

// Condition ::= A0 len ( 80 20 <sha256(preimage)> 81 len <preimage length> )
export function conditionFromPreimage(preimage) {
  assertPreimage(preimage);
  const fingerprint = crypto.createHash('sha256').update(preimage).digest();
  const inner = Buffer.concat([
    Buffer.from([0x80, 0x20]),
    fingerprint,
    Buffer.from([0x81, 0x01, preimage.length]),
  ]);
  return toUpperHex(Buffer.concat([Buffer.from([0xa0, inner.length]), inner]));
}

// Fulfillment ::= A0 len ( 80 len <preimage> )
export function fulfillmentFromPreimage(preimage) {
  assertPreimage(preimage);
  const inner = Buffer.concat([Buffer.from([0x80, preimage.length]), preimage]);
  return toUpperHex(Buffer.concat([Buffer.from([0xa0, inner.length]), inner]));
}

// Extract the preimage embedded in a PREIMAGE-SHA-256 fulfillment.
export function preimageFromFulfillment(fulfillmentHex) {
  const buf = hexToBuffer(fulfillmentHex);
  if (buf.length < 4 || buf[0] !== 0xa0 || buf[2] !== 0x80) {
    throw new Error('not a PREIMAGE-SHA-256 fulfillment');
  }
  const innerLen = buf[1];
  const preimageLen = buf[3];
  if (buf.length !== 2 + innerLen || innerLen !== 2 + preimageLen) {
    throw new Error('malformed fulfillment length');
  }
  return buf.subarray(4);
}

export function fulfillmentMatchesCondition(conditionHex, fulfillmentHex) {
  const preimage = preimageFromFulfillment(fulfillmentHex);
  return conditionFromPreimage(preimage) === conditionHex.toUpperCase();
}

export function generateConditionPair() {
  const preimage = generatePreimage();
  return {
    preimageHex: toUpperHex(preimage),
    condition: conditionFromPreimage(preimage),
    fulfillment: fulfillmentFromPreimage(preimage),
  };
}
