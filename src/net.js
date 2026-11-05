// Testnet plumbing. The sandbox routes all traffic through an HTTP proxy
// (https_proxy / wss_proxy env vars), so the WebSocket and the faucet POST both
// go through an HttpsProxyAgent when a proxy is configured.

import https from 'node:https';
import { Client } from 'xrpl';
import { HttpsProxyAgent } from 'https-proxy-agent';

export const TESTNET_WS = 'wss://s.altnet.rippletest.net:51233';
export const TESTNET_FAUCET = 'https://faucet.altnet.rippletest.net/accounts';
export const RIPPLE_EPOCH_OFFSET = 946684800; // seconds between Unix and Ripple epochs

const proxyUrl =
  process.env.https_proxy ?? process.env.HTTPS_PROXY ?? process.env.wss_proxy ?? process.env.WSS_PROXY;
export const proxyAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

export async function connectTestnet() {
  const client = new Client(TESTNET_WS, proxyAgent ? { agent: proxyAgent } : {});
  await client.connect();
  return client;
}

// client.fundWallet() uses bare fetch(), which cannot reach the faucet through
// the proxy, so the faucet POST is done with https + the proxy agent instead.
export function requestFaucetFunds(address) {
  const body = JSON.stringify({ destination: address });
  return new Promise((resolve, reject) => {
    const req = https.request(
      TESTNET_FAUCET,
      {
        method: 'POST',
        agent: proxyAgent,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error(`faucet HTTP ${res.statusCode}: ${data}`));
          resolve(JSON.parse(data));
        });
      },
    );
    req.on('error', reject);
    req.end(body);
  });
}

export async function fundWallet(client, wallet, { attempts = 20, intervalMs = 3000 } = {}) {
  const response = await requestFaucetFunds(wallet.classicAddress);
  for (let i = 0; i < attempts; i += 1) {
    try {
      const info = await client.request({
        command: 'account_info',
        account: wallet.classicAddress,
        ledger_index: 'validated',
      });
      return { faucetTx: response.transactionHash, balanceDrops: info.result.account_data.Balance };
    } catch {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  throw new Error(`account ${wallet.classicAddress} not funded after ${attempts} polls`);
}

export async function getBalanceDrops(client, address) {
  const info = await client.request({
    command: 'account_info',
    account: address,
    ledger_index: 'validated',
  });
  return BigInt(info.result.account_data.Balance);
}

export function rippleNow() {
  return Math.floor(Date.now() / 1000) - RIPPLE_EPOCH_OFFSET;
}

// Validated-ledger close time in Ripple seconds (used to wait out CancelAfter).
export async function ledgerCloseTime(client) {
  const res = await client.request({ command: 'ledger', ledger_index: 'validated' });
  return res.result.ledger.close_time;
}

export async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

export const explorerTx = (hash) => `https://testnet.xrpl.org/transactions/${hash}`;
export const explorerAccount = (address) => `https://testnet.xrpl.org/accounts/${address}`;
