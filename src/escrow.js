// Thin wrappers around the native Escrow transactions. Every submit goes
// through submitAndWait so callers get the validated engine result and hash.

import { dropsToXrp } from 'xrpl';

export async function createEscrow(client, wallet, { destination, amount, condition, cancelAfter }) {
  const res = await client.submitAndWait(
    {
      TransactionType: 'EscrowCreate',
      Account: wallet.classicAddress,
      Destination: destination,
      Amount: amount,
      Condition: condition,
      CancelAfter: cancelAfter,
    },
    { wallet },
  );
  return {
    hash: res.result.hash,
    engineResult: res.result.meta.TransactionResult,
    offerSequence: res.result.tx_json.Sequence,
    feeDrops: res.result.tx_json.Fee,
  };
}

export async function finishEscrow(client, wallet, { owner, offerSequence, condition, fulfillment, memos }) {
  const tx = {
    TransactionType: 'EscrowFinish',
    Account: wallet.classicAddress,
    Owner: owner,
    OfferSequence: offerSequence,
    Condition: condition,
    Fulfillment: fulfillment,
  };
  if (memos) tx.Memos = memos;
  const res = await client.submitAndWait(tx, { wallet });
  return {
    hash: res.result.hash,
    engineResult: res.result.meta.TransactionResult,
    feeDrops: res.result.tx_json.Fee,
  };
}

export async function cancelEscrow(client, wallet, { owner, offerSequence }) {
  const res = await client.submitAndWait(
    {
      TransactionType: 'EscrowCancel',
      Account: wallet.classicAddress,
      Owner: owner,
      OfferSequence: offerSequence,
    },
    { wallet },
  );
  return {
    hash: res.result.hash,
    engineResult: res.result.meta.TransactionResult,
    feeDrops: res.result.tx_json.Fee,
  };
}

// A submit that is expected to fail (gate checks). The helpers above resolve
// with {hash, engineResult} even for tec* results, so a tesSUCCESS here means
// the gate did NOT hold.
export async function expectFailure(submitPromise) {
  try {
    return await submitPromise;
  } catch (err) {
    return { engineResult: err.data?.engine_result ?? err.message, hash: err.data?.tx_json?.hash ?? '-', feeDrops: '-' };
  }
}

export const formatDrops = (drops) => `${dropsToXrp(drops.toString())} XRP`;
