import { Keypair, Transaction } from '@stellar/stellar-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client as GovernorClient } from './generated/governor/dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const deploymentsPath = path.resolve(__dirname, '..', '..', 'deployments.testnet.json');
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));

  const GOV_ID = deployments.contracts.governor;
  const rpcUrl = deployments.rpcUrl || 'https://soroban-testnet.stellar.org';
  const network = deployments.network || 'testnet';
  const networkPassphrase = network === 'testnet' ? 'Test SDF Network ; September 2015' : (deployments.networkPassphrase || '');

  const ADMIN_SECRET = process.env.ADMIN_SECRET;
  const envCreator = process.env.CREATOR_ADDRESS;
  if (!ADMIN_SECRET) {
    console.error('Missing ADMIN_SECRET env var');
    process.exit(1);
  }

  const adminKeypair = Keypair.fromSecret(ADMIN_SECRET);
  const CREATOR = envCreator && envCreator.length > 0 ? envCreator : adminKeypair.publicKey();
  if (CREATOR !== adminKeypair.publicKey()) {
    console.warn('CREATOR_ADDRESS differs from signer; using signer public key to satisfy require_auth');
  }

  const client = new GovernorClient({
    contractId: GOV_ID,
    networkPassphrase,
    rpcUrl,
    publicKey: adminKeypair.publicKey(),
    signTransaction: async (txB64) => {
      const tx = new Transaction(txB64, networkPassphrase);
      tx.sign(adminKeypair);
      return { signedTxXdr: tx.toEnvelope().toXDR('base64') };
    },
  });

  const assembled = await client.propose({
    creator: CREATOR,
    title: 'Snapshot Test',
    description: 'No-op snapshot',
    action: { tag: 'Snapshot', values: undefined },
  }, { simulate: true });

  if (assembled.result === undefined || assembled.result === null) {
    console.error('Simulation did not return a result');
    process.exit(1);
  }
  console.log('Simulated proposal_id:', assembled.result);

  // Sign envelope and submit via Soroban JSON-RPC to avoid SDK parsing issues
  const { signedTxXdr } = await client.options.signTransaction(assembled.toXDR(), {
    networkPassphrase,
    address: adminKeypair.publicKey(),
  });
  const sendReq = {
    jsonrpc: '2.0',
    id: 1,
    method: 'sendTransaction',
    params: { transaction: signedTxXdr },
  };
  const sendResp = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sendReq),
  }).then(r => r.json());
  console.log('sendTransaction:', sendResp);
  const txHash = sendResp?.result?.hash || sendResp?.result || sendResp?.hash;
  if (!txHash) {
    console.error('No tx hash returned');
    process.exit(1);
  }
  let getResp;
  for (let i = 0; i < 60; i++) {
    const getReq = { jsonrpc: '2.0', id: 1, method: 'getTransaction', params: { hash: txHash } };
    getResp = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(getReq),
    }).then(r => r.json());
    const status = getResp?.result?.status || getResp?.status;
    if (status && status !== 'NOT_FOUND') break;
    await new Promise(res => setTimeout(res, 1000));
  }
  console.log('getTransaction:', getResp);
  console.log('Proposal created, id (simulated):', assembled.result);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


