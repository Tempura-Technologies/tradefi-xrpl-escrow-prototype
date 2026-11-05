// Trade-document evidence helpers.
// The approver's document check stays off-chain; only the SHA-256 hashes of the
// approved documents are put on the ledger in the EscrowFinish Memos so anyone
// can verify afterwards which documents a release relied on.

import crypto from 'node:crypto';
import fs from 'node:fs';

export const EVIDENCE_MEMO_TYPE = 'tradefi/evidence/v1';

const hexEncode = (s) => Buffer.from(s, 'utf8').toString('hex').toUpperCase();
const hexDecode = (hex) => Buffer.from(hex, 'hex').toString('utf8');

export function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function sha256File(path) {
  return sha256Hex(fs.readFileSync(path));
}

// Simulated ops check: every required document must exist and hash cleanly.
// Returns { docLabel: 'sha256:<hex>' } labels -> "B/L", "E/D", "C/I".
export function approveDocuments(docPathsByLabel) {
  const docs = {};
  for (const [label, path] of Object.entries(docPathsByLabel)) {
    if (!fs.existsSync(path)) {
      throw new Error(`document check failed: missing ${label} (${path})`);
    }
    docs[label] = `sha256:${sha256File(path)}`;
  }
  return docs;
}

export function buildEvidenceMemo({ milestone, docs }) {
  const data = JSON.stringify({ milestone, docs });
  return { Memo: { MemoType: hexEncode(EVIDENCE_MEMO_TYPE), MemoData: hexEncode(data) } };
}

// Returns the decoded {milestone, docs} payload of the first evidence memo,
// or null when the transaction carries none.
export function decodeEvidenceMemo(memos = []) {
  for (const wrapper of memos) {
    const memo = wrapper.Memo ?? wrapper;
    if (memo.MemoType && hexDecode(memo.MemoType) === EVIDENCE_MEMO_TYPE) {
      return JSON.parse(hexDecode(memo.MemoData));
    }
  }
  return null;
}
