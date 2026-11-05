# TradeFi × XRPL — document-gated escrow (testnet prototype)

A small prototype that runs TradeFi's payment rule on the XRP Ledger **testnet**:
the buyer's money is released to the seller only after the trade documents are approved,
and each release records the SHA-256 hashes of the documents it relied on.

TradeFi is a B2B marketplace for used-car exports from Japan, operated by TradeFi K.K.
and built by [Tempura technologies](https://tempuradao.xyz).

> Testnet only. All documents, parties and amounts are synthetic.
> The "RLUSD" token in the demo is a self-issued test IOU, not Ripple's RLUSD.

## What it shows
- **Native Escrow per milestone** — a deposit escrow and a balance escrow, each with a fixed
  destination (the seller), a PREIMAGE-SHA-256 condition and a `CancelAfter` deadline.
- **Off-chain approval, on-chain release** — the approver submits `EscrowFinish` with the
  fulfillment only after the document check passes. A fabricated fulfillment is rejected
  (`tecCRYPTOCONDITION_ERROR`); the approver cannot send the funds anywhere but the seller.
- **Evidence in Memos** — `EscrowFinish` carries the hashes of the B/L, export declaration
  and commercial invoice; the demo reads them back from the ledger and checks them.
- **Buyer protection** — after the deadline, `EscrowCancel` returns unreleased funds.
- **Token Escrow (XLS-85)** — the same gated release with a self-issued IOU
  (issuer needs `asfAllowTrustLineLocking`) and with an MPT (`tfMPTCanEscrow | tfMPTCanTransfer`).

What it does **not** do yet: authenticate documents, enforce who approves which document,
integrate with the TradeFi order screen, or run on mainnet.

## Run
```bash
npm install
npm test          # 14 offline unit tests (condition/fulfillment encoding, document hashing, memos)
npm run run_demo  # funds fresh testnet accounts from the faucet, runs all paths, writes DEMO_RESULT.md
```
Node 20+. Set `HTTPS_PROXY` only if your network needs a proxy.

The latest recorded run (transaction hashes and explorer links) is in [DEMO_RESULT.md](DEMO_RESULT.md).

## Layout
- `run_demo.js` — the demo: happy path, gate checks, cancel path, token variants
- `src/conditions.js` — PREIMAGE-SHA-256 condition / DER fulfillment
- `src/documents.js` — document hashing and evidence Memo encode/decode
- `src/escrow.js` — EscrowCreate / Finish / Cancel helpers
- `src/net.js` — testnet client and faucet
- `samples/` — synthetic B/L, export declaration, commercial invoice

## License
Apache-2.0
