# DEMO_RESULT — D001 document-gated escrow on XRPL testnet

Run: 2026-11-05T01:05:52.376Z — all documents and figures are synthetic ("仮想空間での検証").

## Accounts (testnet, generated fresh each run)
- buyer: `rDgvAXTmQubPXNhXGetA3dcrpTnu4NtVBj` — [explorer](https://testnet.xrpl.org/accounts/rDgvAXTmQubPXNhXGetA3dcrpTnu4NtVBj)
- seller: `rhpV63i9wonyTm1KFnYtq7hWDU1tDxD3Bn` — [explorer](https://testnet.xrpl.org/accounts/rhpV63i9wonyTm1KFnYtq7hWDU1tDxD3Bn)
- approver: `rJXiCVbhaN1wvPtwSnAtmpPn57iyuF9HaB` — [explorer](https://testnet.xrpl.org/accounts/rJXiCVbhaN1wvPtwSnAtmpPn57iyuF9HaB)
- issuer: `rsPvKgm7K2jXPwX5Ke8XsdYoQ6WHgLDeeq` — [explorer](https://testnet.xrpl.org/accounts/rsPvKgm7K2jXPwX5Ke8XsdYoQ6WHgLDeeq)

## Amendment flags reported by `feature` on this testnet
```json
{
  "Escrow": false,
  "CryptoConditions": false,
  "CryptoConditionsSuite": false,
  "TokenEscrow": true
}
```
`feature`/the Amendments object list `Escrow` and `CryptoConditions` as not enabled,
yet condition-gated EscrowCreate/EscrowFinish empirically succeed below.

## Transactions
| step | engine result | tx hash | fee (drops) |
|---|---|---|---|
| faucet:buyer | tesSUCCESS | [FB7290FACA5829B0…](https://testnet.xrpl.org/transactions/FB7290FACA5829B02189972886FEC80DAD3E72BE609C4A9D4B9A95593E926BA5) | 0 |
| faucet:seller | tesSUCCESS | [0B85E8537D9C5FE0…](https://testnet.xrpl.org/transactions/0B85E8537D9C5FE0F5E2C089219D940C4A2D0E69AE8CF798268C985EDE8A151C) | 0 |
| faucet:approver | tesSUCCESS | [E325193E3BC3A7F3…](https://testnet.xrpl.org/transactions/E325193E3BC3A7F36F534CC4B94A3D6E4929084658CB3983F391895F055E7F95) | 0 |
| faucet:issuer | tesSUCCESS | [B3E5E693D7829C3F…](https://testnet.xrpl.org/transactions/B3E5E693D7829C3F6E44D0004039E9B2C1366CA7113C041D1F76F87A167A176C) | 0 |
| EscrowCreate deposit 2 XRP | tesSUCCESS | [449E837E4F2C89D0…](https://testnet.xrpl.org/transactions/449E837E4F2C89D056CEA14822957189D3D40B2AE5D8EA69797EF82CB9CB6967) | 12 |
| EscrowCreate balance 8 XRP | tesSUCCESS | [F0A7CDE94529CE0E…](https://testnet.xrpl.org/transactions/F0A7CDE94529CE0EBA77D1327027EA321FBB53A15488B76B91F950A7BE0BCE40) | 12 |
| gate check: buyer EscrowFinish w/ fabricated fulfillment | tecCRYPTOCONDITION_ERROR | [28BD556BB3401767…](https://testnet.xrpl.org/transactions/28BD556BB34017670AD602AFA15E1E9AF7085D6925D9AE4A33BD05FA19E71939) | 423 |
| gate check: approver early EscrowCancel | tecNO_PERMISSION | [B3FAB0FC323C7071…](https://testnet.xrpl.org/transactions/B3FAB0FC323C7071E717848F6DC4280EA54FF5E834E63C6EFF082765B4D82FCB) | 12 |
| EscrowFinish deposit (by approver, +evidence memo) | tesSUCCESS | [28E5B1906ED7F407…](https://testnet.xrpl.org/transactions/28E5B1906ED7F407EF09A97A101E0CDCA4E64F53AEAECE9435AFDBAAC69969A0) | 423 |
| EscrowFinish balance (by approver, +evidence memo) | tesSUCCESS | [B7993E634BF3A8B7…](https://testnet.xrpl.org/transactions/B7993E634BF3A8B7305C148EFE06F7BB3F2B5E188BC5F4E2ED61309B5ED80624) | 423 |
| EscrowCreate returned-deposit 3 XRP | tesSUCCESS | [E196CE91BD827871…](https://testnet.xrpl.org/transactions/E196CE91BD827871CFB90ECF8C322F06FB1C4C8D627EBFF6AD9F9AB936828048) | 12 |
| EscrowCancel returned-deposit (by buyer) | tesSUCCESS | [60EFD27CE3A6D86F…](https://testnet.xrpl.org/transactions/60EFD27CE3A6D86F2D20513F73FE6E00C64392CBCBCCEFC7FCBFF942D679889B) | 12 |
| AccountSet issuer asfAllowTrustLineLocking | tesSUCCESS | [A5B80CDD34B83004…](https://testnet.xrpl.org/transactions/A5B80CDD34B830041FC554AC5461AF0DA47C2A961DA9B04467CF570C21571EE4) | 12 |
| TrustSet RLUSD (buyer) | tesSUCCESS | [E906E8254DFC148D…](https://testnet.xrpl.org/transactions/E906E8254DFC148D9FB5278CF5417E669B95D1B8D689CF57D73F8F33C8D8CDB9) | 12 |
| TrustSet RLUSD (seller) | tesSUCCESS | [D8B4F3B2150EAE6C…](https://testnet.xrpl.org/transactions/D8B4F3B2150EAE6C2A42C556B2828869C282F78B24EA461DD918CEDCDF62AD5B) | 12 |
| issuer -> buyer 11,000 test-RLUSD | tesSUCCESS | [A28F2F1490995977…](https://testnet.xrpl.org/transactions/A28F2F149099597752DE8B32E2101BFCAA18A864B1D8D14139D17C5C992D552D) | 12 |
| EscrowCreate 8,800 test-RLUSD (condition-gated) | tesSUCCESS | [3FF035EE4A1F3591…](https://testnet.xrpl.org/transactions/3FF035EE4A1F359109B34B7D3A59FCB8503791A91C0028EB078585E633ACA17C) | 12 |
| EscrowFinish test-RLUSD (by approver, +evidence memo) | tesSUCCESS | [117CB1285472B01F…](https://testnet.xrpl.org/transactions/117CB1285472B01F595FA182B84BA84A870724E859D600A15126DF2AEF8BED2A) | 423 |
| MPTokenIssuanceCreate (tfMPTCanEscrow|tfMPTCanTransfer) | tesSUCCESS | [2202DB938F02FA39…](https://testnet.xrpl.org/transactions/2202DB938F02FA397F97496FB97562FB6F489D24B96C79CF5CEDD0DCBA754F85) | 12 |
| MPTokenAuthorize (buyer) | tesSUCCESS | [A725E67597588358…](https://testnet.xrpl.org/transactions/A725E675975883585792DC03BB76C4A89C1031DFBE653FBF30E16338036D3B01) | 12 |
| MPTokenAuthorize (seller) | tesSUCCESS | [D3337757D74051A0…](https://testnet.xrpl.org/transactions/D3337757D74051A0B3E0E8D36F556418903D7B3ACE2325856186FD686F66FF99) | 12 |
| issuer -> buyer 11,000.00 test-MPT | tesSUCCESS | [4D5C5748F245EA79…](https://testnet.xrpl.org/transactions/4D5C5748F245EA79B9EF300843E11F91FC012644BABC0DC155C81DCAD4CBF165) | 12 |
| EscrowCreate 8,800.00 test-MPT (condition-gated) | tesSUCCESS | [8D5005821C2B08E6…](https://testnet.xrpl.org/transactions/8D5005821C2B08E647B986D542C8DE5BEBDD0945588CF201CF9F49ABB41C4716) | 12 |
| EscrowFinish test-MPT (by approver, +evidence memo) | tesSUCCESS | [7F11D70BDC8DA5B2…](https://testnet.xrpl.org/transactions/7F11D70BDC8DA5B24EC9F7F44472A88E1C04F872744E8AC1FE2B253BFB612D7B) | 423 |

## Gate / verification checks
| check | observed result |
|---|---|
| buyer EscrowFinish with fabricated fulfillment | tecCRYPTOCONDITION_ERROR |
| approver early EscrowCancel | tecNO_PERMISSION |
| approver signed EscrowFinish; funds went to fixed Destination, approver lost only fee | seller +2 XRP, approver -0.000423 XRP |
| on-ledger evidence memo (deposit) decodes to approved doc hashes | verified |
| on-ledger evidence memo (balance) decodes to approved doc hashes | verified |
| buyer recovered escrow after CancelAfter | buyer delta -0.000024 XRP incl. fees |

## Token escrow (XLS-85) variant
```json
{
  "iou": {
    "status": "success",
    "sellerBalance": "8800 test-RLUSD"
  },
  "mpt": {
    "status": "success",
    "mptIssuanceId": "0150D42C1A45E9F0BCC7787175F95B249C30A36C34342B91",
    "sellerBalance": "8800.00 test-MPT"
  }
}
```

## Notes
- Reproduce: `npm test` (offline unit tests) and `npm run run_demo` in `proto/`.
- EscrowCreate rejects a `CancelAfter` already past, and a past `FinishAfter` combined
  with `CancelAfter`, with `tecNO_PERMISSION` (observed while probing this testnet).
- PREIMAGE-SHA-256 fulfillment encoding: `A0 22 80 20 <32-byte preimage>`; the raw
  preimage alone is rejected with `tecCRYPTOCONDITION_ERROR`.
- Token escrow (XLS-85): IOU escrows need `asfAllowTrustLineLocking` on the issuer,
  MPT escrows need `tfMPTCanEscrow`+`tfMPTCanTransfer` at issuance; without them
  EscrowCreate fails `tecNO_PERMISSION`. `CancelAfter` is mandatory for token escrows.
