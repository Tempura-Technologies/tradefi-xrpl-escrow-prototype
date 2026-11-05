// run_demo — D001 document-gated escrow prototype on XRPL testnet.
//
// Flow (all synthetic, testnet only):
//   order TF-TEST-0001  deposit escrow + balance escrow in XRP, each gated by a
//                       PREIMAGE-SHA-256 condition held by the approver. The
//                       balance is finished only after ops "approves" the B/L
//                       and E/D and the seller confirms the C/I; the doc hashes
//                       ride in the EscrowFinish memos.
//   order TF-TEST-0002  an escrow whose documents never arrive: CancelAfter
//                       lapses and the buyer recovers the funds.
//   token variant       same gated release with an RLUSD-coded IOU (XLS-85
//                       TokenEscrow), if the testnet amendment accepts it.
//
// Output: console log + proto/DEMO_RESULT.md. Usage: npm run run_demo

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import crypto from 'node:crypto';
import { Wallet, xrpToDrops, dropsToXrp, AccountSetAsfFlags } from 'xrpl';
import { generateConditionPair } from './src/conditions.js';
import { approveDocuments, buildEvidenceMemo, decodeEvidenceMemo } from './src/documents.js';
import {
  connectTestnet,
  fundWallet,
  getBalanceDrops,
  rippleNow,
  ledgerCloseTime,
  sleep,
  explorerTx,
  explorerAccount,
} from './src/net.js';
import { createEscrow, finishEscrow, cancelEscrow, expectFailure, formatDrops } from './src/escrow.js';

const SAMPLES = path.join(path.dirname(url.fileURLToPath(import.meta.url)), 'samples');
const DOCS = {
  'B/L': path.join(SAMPLES, 'BL-M3L-000901.txt'),
  'E/D': path.join(SAMPLES, 'ED-2026-1105-0042.txt'),
  'C/I': path.join(SAMPLES, 'CI-8842.txt'),
};
// "RLUSD" as a non-standard 160-bit currency code (ascii, left-aligned, zero padded).
const RLUSD_HEX = Buffer.from('RLUSD').toString('hex').toUpperCase().padEnd(40, '0');
const DAY_SECONDS = 86400;
const CANCEL_PATH_DELAY_SECONDS = 80;

const report = { transactions: [], checks: [] };
const log = (msg) => { console.log(msg); };

function recordTx(label, r) {
  report.transactions.push({ label, hash: r.hash, result: r.engineResult, feeDrops: r.feeDrops });
  log(`  ${label}: ${r.engineResult}  ${r.hash}`);
}

async function getTokenBalance(client, address, currencyHex, issuer) {
  const res = await client.request({ command: 'account_lines', account: address, ledger_index: 'validated' });
  const line = res.result.lines.find((l) => l.account === issuer && l.currency === currencyHex);
  return line ? line.balance : '0';
}

async function main() {
  const client = await connectTestnet();
  log('connected to XRPL testnet');

  // --- amendments observed on this testnet (empirical, not just `feature`) ---
  const feat = await client.request({ command: 'feature' });
  const featByName = {};
  for (const f of Object.values(feat.result.features)) featByName[f.name] = f.enabled;
  report.amendments = {
    Escrow: featByName.Escrow,
    CryptoConditions: featByName.CryptoConditions,
    CryptoConditionsSuite: featByName.CryptoConditionsSuite,
    TokenEscrow: featByName.TokenEscrow,
  };
  log(`feature flags: ${JSON.stringify(report.amendments)}`);

  // --- roles: separate keys for buyer / seller / approver (+ token issuer) ---
  const buyer = Wallet.generate();
  const seller = Wallet.generate();
  const approver = Wallet.generate();
  const issuer = Wallet.generate();
  report.accounts = {
    buyer: buyer.classicAddress,
    seller: seller.classicAddress,
    approver: approver.classicAddress,
    issuer: issuer.classicAddress,
  };
  for (const [name, w] of [['buyer', buyer], ['seller', seller], ['approver', approver], ['issuer', issuer]]) {
    const { faucetTx, balanceDrops } = await fundWallet(client, w);
    log(`funded ${name} ${w.classicAddress} (${formatDrops(balanceDrops)}) via ${faucetTx}`);
    report.transactions.push({ label: `faucet:${name}`, hash: faucetTx, result: 'tesSUCCESS', feeDrops: '0' });
  }

  // Approver generates one condition pair per milestone and keeps the
  // fulfillments off-chain until the document check passes.
  const dep = generateConditionPair();
  const bal = generateConditionPair();
  const ret = generateConditionPair();
  const tok = generateConditionPair();
  const fakeFulfillment = `A0228020${crypto.randomBytes(32).toString('hex').toUpperCase()}`;

  // ================= order TF-TEST-0001 — XRP deposit + balance =============
  log('\n== order TF-TEST-0001: deposit + balance escrows (XRP) ==');
  const cancelAfter = rippleNow() + DAY_SECONDS;
  const depEscrow = await createEscrow(client, buyer, {
    destination: seller.classicAddress, amount: xrpToDrops('2'),
    condition: dep.condition, cancelAfter,
  });
  recordTx('EscrowCreate deposit 2 XRP', depEscrow);
  const balEscrow = await createEscrow(client, buyer, {
    destination: seller.classicAddress, amount: xrpToDrops('8'),
    condition: bal.condition, cancelAfter,
  });
  recordTx('EscrowCreate balance 8 XRP', balEscrow);

  // Gate 1: the buyer cannot release its own escrow without the fulfillment.
  const buyerSelfRelease = await expectFailure(finishEscrow(client, buyer, {
    owner: buyer.classicAddress, offerSequence: balEscrow.offerSequence,
    condition: bal.condition, fulfillment: fakeFulfillment,
  }));
  recordTx('gate check: buyer EscrowFinish w/ fabricated fulfillment', buyerSelfRelease);
  report.checks.push({ check: 'buyer EscrowFinish with fabricated fulfillment', result: buyerSelfRelease.engineResult });
  log(`  gate: buyer self-release -> ${buyerSelfRelease.engineResult}`);

  // Gate 2: the approver cannot pull the money back before CancelAfter.
  const approverEarlyCancel = await expectFailure(cancelEscrow(client, approver, {
    owner: buyer.classicAddress, offerSequence: balEscrow.offerSequence,
  }));
  recordTx('gate check: approver early EscrowCancel', approverEarlyCancel);
  report.checks.push({ check: 'approver early EscrowCancel', result: approverEarlyCancel.engineResult });
  log(`  gate: approver early cancel -> ${approverEarlyCancel.engineResult}`);

  // Milestone A: ops approves the deposit release (invoice evidence).
  const depDocs = approveDocuments({ 'C/I': DOCS['C/I'] });
  const approverBefore = await getBalanceDrops(client, approver.classicAddress);
  const sellerBefore = await getBalanceDrops(client, seller.classicAddress);
  const depFinish = await finishEscrow(client, approver, {
    owner: buyer.classicAddress, offerSequence: depEscrow.offerSequence,
    condition: dep.condition, fulfillment: dep.fulfillment,
    memos: [buildEvidenceMemo({ milestone: 'deposit', docs: depDocs })],
  });
  recordTx('EscrowFinish deposit (by approver, +evidence memo)', depFinish);
  const approverAfter = await getBalanceDrops(client, approver.classicAddress);
  const sellerAfter = await getBalanceDrops(client, seller.classicAddress);
  report.checks.push({
    check: 'approver signed EscrowFinish; funds went to fixed Destination, approver lost only fee',
    result: `seller +${dropsToXrp((sellerAfter - sellerBefore).toString())} XRP, approver ${dropsToXrp((approverAfter - approverBefore).toString())} XRP`,
  });
  log(`  deposit released: seller +${dropsToXrp((sellerAfter - sellerBefore).toString())} XRP, approver delta ${dropsToXrp((approverAfter - approverBefore).toString())} XRP (fee only)`);

  // Milestone B: ops approves B/L + E/D, seller confirms C/I -> balance release.
  const balDocs = approveDocuments({ 'B/L': DOCS['B/L'], 'E/D': DOCS['E/D'], 'C/I': DOCS['C/I'] });
  const balFinish = await finishEscrow(client, approver, {
    owner: buyer.classicAddress, offerSequence: balEscrow.offerSequence,
    condition: bal.condition, fulfillment: bal.fulfillment,
    memos: [buildEvidenceMemo({ milestone: 'balance', docs: balDocs })],
  });
  recordTx('EscrowFinish balance (by approver, +evidence memo)', balFinish);

  // Verify the evidence memos back from the validated ledger.
  for (const [label, finish, expectedDocs] of [['deposit', depFinish, depDocs], ['balance', balFinish, balDocs]]) {
    const txRes = await client.request({ command: 'tx', transaction: finish.hash });
    const decoded = decodeEvidenceMemo(txRes.result.tx_json?.Memos ?? txRes.result.Memos);
    const matches = decoded && Object.entries(expectedDocs).every(([k, v]) => decoded.docs?.[k] === v);
    report.checks.push({ check: `on-ledger evidence memo (${label}) decodes to approved doc hashes`, result: matches ? 'verified' : `MISMATCH ${JSON.stringify(decoded)}` });
    log(`  evidence memo verified on ledger (${label}): ${matches}`);
  }

  // ================= order TF-TEST-0002 — cancel path =======================
  log(`\n== order TF-TEST-0002: documents never arrive -> EscrowCancel after ${CANCEL_PATH_DELAY_SECONDS}s ==`);
  const buyerBeforeCancel = await getBalanceDrops(client, buyer.classicAddress);
  const retCancelAfter = rippleNow() + CANCEL_PATH_DELAY_SECONDS;
  const retEscrow = await createEscrow(client, buyer, {
    destination: seller.classicAddress, amount: xrpToDrops('3'),
    condition: ret.condition, cancelAfter: retCancelAfter,
  });
  recordTx('EscrowCreate returned-deposit 3 XRP', retEscrow);
  // The approver never releases the fulfillment; wait out CancelAfter.
  for (;;) {
    const close = await ledgerCloseTime(client);
    if (close > retCancelAfter) break;
    process.stdout.write(`  waiting for CancelAfter (ledger close ${close} <= ${retCancelAfter})\r`);
    await sleep(4000);
  }
  const retCancel = await cancelEscrow(client, buyer, {
    owner: buyer.classicAddress, offerSequence: retEscrow.offerSequence,
  });
  recordTx('EscrowCancel returned-deposit (by buyer)', retCancel);
  const buyerAfterCancel = await getBalanceDrops(client, buyer.classicAddress);
  report.checks.push({ check: 'buyer recovered escrow after CancelAfter', result: `buyer delta ${dropsToXrp((buyerAfterCancel - buyerBeforeCancel).toString())} XRP incl. fees` });
  log(`  cancel done: buyer delta ${dropsToXrp((buyerAfterCancel - buyerBeforeCancel).toString())} XRP incl. fees`);

  // ================= token escrow variants (XLS-85) =========================
  // XLS-85 requires issuer opt-in: IOUs need asfAllowTrustLineLocking on the
  // issuing account, MPTs need tfMPTCanEscrow + tfMPTCanTransfer at issuance.
  // CancelAfter is mandatory for token escrows.
  log('\n== token escrow variant: RLUSD-coded IOU ==');
  report.tokenEscrow = {};
  try {
    if (!report.amendments.TokenEscrow) throw new Error('TokenEscrow amendment not enabled on testnet');
    const lockFlag = await client.submitAndWait(
      {
        TransactionType: 'AccountSet', Account: issuer.classicAddress,
        SetFlag: AccountSetAsfFlags.asfAllowTrustLineLocking,
      },
      { wallet: issuer },
    );
    recordTx('AccountSet issuer asfAllowTrustLineLocking', { hash: lockFlag.result.hash, engineResult: lockFlag.result.meta.TransactionResult, feeDrops: lockFlag.result.tx_json.Fee });
    for (const w of [buyer, seller]) {
      const r = await client.submitAndWait(
        {
          TransactionType: 'TrustSet', Account: w.classicAddress,
          LimitAmount: { currency: RLUSD_HEX, issuer: issuer.classicAddress, value: '100000' },
        },
        { wallet: w },
      );
      recordTx(`TrustSet RLUSD (${w === buyer ? 'buyer' : 'seller'})`, { hash: r.result.hash, engineResult: r.result.meta.TransactionResult, feeDrops: r.result.tx_json.Fee });
    }
    const pay = await client.submitAndWait(
      {
        TransactionType: 'Payment', Account: issuer.classicAddress, Destination: buyer.classicAddress,
        Amount: { currency: RLUSD_HEX, issuer: issuer.classicAddress, value: '11000' },
      },
      { wallet: issuer },
    );
    recordTx('issuer -> buyer 11,000 test-RLUSD', { hash: pay.result.hash, engineResult: pay.result.meta.TransactionResult, feeDrops: pay.result.tx_json.Fee });

    const tokEscrow = await createEscrow(client, buyer, {
      destination: seller.classicAddress,
      amount: { currency: RLUSD_HEX, issuer: issuer.classicAddress, value: '8800' },
      condition: tok.condition, cancelAfter: rippleNow() + DAY_SECONDS,
    });
    recordTx('EscrowCreate 8,800 test-RLUSD (condition-gated)', tokEscrow);

    const tokFinish = await finishEscrow(client, approver, {
      owner: buyer.classicAddress, offerSequence: tokEscrow.offerSequence,
      condition: tok.condition, fulfillment: tok.fulfillment,
      memos: [buildEvidenceMemo({ milestone: 'balance', docs: balDocs })],
    });
    recordTx('EscrowFinish test-RLUSD (by approver, +evidence memo)', tokFinish);
    const sellerTok = await getTokenBalance(client, seller.classicAddress, RLUSD_HEX, issuer.classicAddress);
    report.tokenEscrow.iou = { status: 'success', sellerBalance: `${sellerTok} test-RLUSD` };
    log(`  seller now holds ${sellerTok} test-RLUSD`);
  } catch (err) {
    report.tokenEscrow.iou = { status: 'failed', reason: err.data?.engine_result ?? err.message };
    log(`  IOU token escrow variant failed: ${report.tokenEscrow.iou.reason}`);
  }

  log('\n== token escrow variant: MPT ==');
  try {
    const mptCreate = await client.submitAndWait(
      {
        TransactionType: 'MPTokenIssuanceCreate', Account: issuer.classicAddress,
        AssetScale: 2, MaximumAmount: '100000000', TransferFee: 0,
        Flags: 8 | 32, // tfMPTCanEscrow | tfMPTCanTransfer — required for escrow
      },
      { wallet: issuer },
    );
    recordTx('MPTokenIssuanceCreate (tfMPTCanEscrow|tfMPTCanTransfer)', { hash: mptCreate.result.hash, engineResult: mptCreate.result.meta.TransactionResult, feeDrops: mptCreate.result.tx_json.Fee });
    const issuance = await client.request({ command: 'account_objects', account: issuer.classicAddress, ledger_index: 'validated', type: 'mpt_issuance' });
    const mptId = issuance.result.account_objects[0].mpt_issuance_id;
    for (const w of [buyer, seller]) {
      const r = await client.submitAndWait(
        { TransactionType: 'MPTokenAuthorize', Account: w.classicAddress, MPTokenIssuanceID: mptId },
        { wallet: w },
      );
      recordTx(`MPTokenAuthorize (${w === buyer ? 'buyer' : 'seller'})`, { hash: r.result.hash, engineResult: r.result.meta.TransactionResult, feeDrops: r.result.tx_json.Fee });
    }
    const mptPay = await client.submitAndWait(
      {
        TransactionType: 'Payment', Account: issuer.classicAddress, Destination: buyer.classicAddress,
        Amount: { mpt_issuance_id: mptId, value: '1100000' }, // 11,000.00 at AssetScale 2
      },
      { wallet: issuer },
    );
    recordTx('issuer -> buyer 11,000.00 test-MPT', { hash: mptPay.result.hash, engineResult: mptPay.result.meta.TransactionResult, feeDrops: mptPay.result.tx_json.Fee });

    const mpt = generateConditionPair();
    const mptEscrow = await createEscrow(client, buyer, {
      destination: seller.classicAddress,
      amount: { mpt_issuance_id: mptId, value: '880000' }, // 8,800.00 at AssetScale 2
      condition: mpt.condition, cancelAfter: rippleNow() + DAY_SECONDS,
    });
    recordTx('EscrowCreate 8,800.00 test-MPT (condition-gated)', mptEscrow);
    const mptFinish = await finishEscrow(client, approver, {
      owner: buyer.classicAddress, offerSequence: mptEscrow.offerSequence,
      condition: mpt.condition, fulfillment: mpt.fulfillment,
      memos: [buildEvidenceMemo({ milestone: 'balance', docs: balDocs })],
    });
    recordTx('EscrowFinish test-MPT (by approver, +evidence memo)', mptFinish);
    const sellerObjs = await client.request({ command: 'account_objects', account: seller.classicAddress, ledger_index: 'validated' });
    const sellerMpt = sellerObjs.result.account_objects.find((o) => o.LedgerEntryType === 'MPToken' && o.MPTokenIssuanceID === mptId);
    report.tokenEscrow.mpt = { status: sellerMpt ? 'success' : 'no tokens received', mptIssuanceId: mptId, sellerBalance: `${(Number(sellerMpt?.MPTAmount ?? 0) / 100).toFixed(2)} test-MPT` };
    log(`  seller now holds ${report.tokenEscrow.mpt.sellerBalance} (issuance ${mptId})`);
  } catch (err) {
    report.tokenEscrow.mpt = { status: 'failed', reason: err.data?.engine_result ?? err.message };
    log(`  MPT token escrow variant failed: ${report.tokenEscrow.mpt.reason}`);
  }

  await client.disconnect();
  writeReport();
  log('\nwrote proto/DEMO_RESULT.md');
}

function writeReport() {
  const lines = [];
  lines.push('# DEMO_RESULT — D001 document-gated escrow on XRPL testnet');
  lines.push('');
  lines.push(`Run: ${new Date().toISOString()} — all documents and figures are synthetic ("仮想空間での検証").`);
  lines.push('');
  lines.push('## Accounts (testnet, generated fresh each run)');
  for (const [role, addr] of Object.entries(report.accounts ?? {})) {
    lines.push(`- ${role}: \`${addr}\` — [explorer](${explorerAccount(addr)})`);
  }
  lines.push('');
  lines.push('## Amendment flags reported by `feature` on this testnet');
  lines.push('```json');
  lines.push(JSON.stringify(report.amendments, null, 2));
  lines.push('```');
  lines.push('`feature`/the Amendments object list `Escrow` and `CryptoConditions` as not enabled,');
  lines.push('yet condition-gated EscrowCreate/EscrowFinish empirically succeed below.');
  lines.push('');
  lines.push('## Transactions');
  lines.push('| step | engine result | tx hash | fee (drops) |');
  lines.push('|---|---|---|---|');
  for (const t of report.transactions) {
    const hashCell = t.hash && t.hash !== '-' ? `[${t.hash.slice(0, 16)}…](${explorerTx(t.hash)})` : '-';
    lines.push(`| ${t.label} | ${t.result} | ${hashCell} | ${t.feeDrops} |`);
  }
  lines.push('');
  lines.push('## Gate / verification checks');
  lines.push('| check | observed result |');
  lines.push('|---|---|');
  for (const c of report.checks) lines.push(`| ${c.check} | ${c.result} |`);
  lines.push('');
  lines.push('## Token escrow (XLS-85) variant');
  lines.push('```json');
  lines.push(JSON.stringify(report.tokenEscrow, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('## Notes');
  lines.push('- Reproduce: `npm test` (offline unit tests) and `npm run run_demo` in `proto/`.');
  lines.push('- EscrowCreate rejects a `CancelAfter` already past, and a past `FinishAfter` combined');
  lines.push('  with `CancelAfter`, with `tecNO_PERMISSION` (observed while probing this testnet).');
  lines.push('- PREIMAGE-SHA-256 fulfillment encoding: `A0 22 80 20 <32-byte preimage>`; the raw');
  lines.push('  preimage alone is rejected with `tecCRYPTOCONDITION_ERROR`.');
  lines.push('- Token escrow (XLS-85): IOU escrows need `asfAllowTrustLineLocking` on the issuer,');
  lines.push('  MPT escrows need `tfMPTCanEscrow`+`tfMPTCanTransfer` at issuance; without them');
  lines.push('  EscrowCreate fails `tecNO_PERMISSION`. `CancelAfter` is mandatory for token escrows.');
  fs.writeFileSync(path.join(path.dirname(url.fileURLToPath(import.meta.url)), 'DEMO_RESULT.md'), lines.join('\n') + '\n');
}

main().catch((err) => {
  console.error('demo failed:', err.data?.engine_result ?? err);
  process.exit(1);
});
