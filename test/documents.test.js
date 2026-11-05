// Offline tests for document hashing and evidence-memo encode/decode.

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import url from 'node:url';
import {
  sha256Hex,
  sha256File,
  approveDocuments,
  buildEvidenceMemo,
  decodeEvidenceMemo,
  EVIDENCE_MEMO_TYPE,
} from '../src/documents.js';

const SAMPLES = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..', 'samples');

test('sha256Hex matches the published vector for "abc"', () => {
  assert.equal(
    sha256Hex(Buffer.from('abc')),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});

test('sha256File hashes the synthetic B/L sample deterministically', () => {
  const h1 = sha256File(path.join(SAMPLES, 'BL-M3L-000901.txt'));
  assert.match(h1, /^[0-9a-f]{64}$/);
  assert.equal(h1, sha256File(path.join(SAMPLES, 'BL-M3L-000901.txt')));
});

test('approveDocuments labels each approved doc with its sha256', () => {
  const docs = approveDocuments({
    'B/L': path.join(SAMPLES, 'BL-M3L-000901.txt'),
    'C/I': path.join(SAMPLES, 'CI-8842.txt'),
  });
  assert.equal(docs['B/L'], `sha256:${sha256File(path.join(SAMPLES, 'BL-M3L-000901.txt'))}`);
  assert.equal(docs['C/I'], `sha256:${sha256File(path.join(SAMPLES, 'CI-8842.txt'))}`);
});

test('approveDocuments fails the check when a required doc is missing', () => {
  assert.throws(() => approveDocuments({ 'B/L': path.join(SAMPLES, 'does-not-exist.txt') }));
});

test('evidence memo round-trips through hex Memo fields', () => {
  const docs = { 'B/L': 'sha256:'.concat('ab'.repeat(32)) };
  const memo = buildEvidenceMemo({ milestone: 'balance', docs });
  const decoded = decodeEvidenceMemo([memo]);
  assert.equal(decoded.milestone, 'balance');
  assert.deepEqual(decoded.docs, docs);
});

test('decodeEvidenceMemo ignores memos of other types', () => {
  const other = { Memo: { MemoType: Buffer.from('other/type').toString('hex').toUpperCase(), MemoData: 'ABCD' } };
  assert.equal(decodeEvidenceMemo([other]), null);
  assert.equal(decodeEvidenceMemo(undefined), null);
});

test('memo type tag is stable', () => {
  assert.equal(EVIDENCE_MEMO_TYPE, 'tradefi/evidence/v1');
});
