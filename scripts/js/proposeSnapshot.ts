import { Keypair } from '@stellar/stellar-sdk';
import fs from 'fs';
import path from 'path';
import { Client as GovernorClient } from './generated/governor/src/index.ts';

async function main() {
  const deploymentsPath = path.resolve(__dirname, '..', '..', 'deployments.testnet.json');
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));

  const GOV_ID: string = deployments.contracts.governor;
  const rpcUrl: string = deployments.rpcUrl || 'https://soroban-testnet.stellar.org';
  const networkPassphrase: string = deployments.network === 'testnet' ? 'Test SDF Network ; September 2015' : (deployments.networkPassphrase || '');

  const ADMIN_SECRET = process.env.ADMIN_SECRET;
  const CREATOR = process.env.CREATOR_ADDRESS;
  if (!ADMIN_SECRET || !CREATOR) {
    console.error('Missing ADMIN_SECRET or CREATOR_ADDRESS env vars');
    process.exit(1);
  }

  const adminKeypair = Keypair.fromSecret(ADMIN_SECRET);

  const client = new GovernorClient({
    contractId: GOV_ID,
    networkPassphrase,
    rpcUrl,
  });

  // Use helper that avoids enum marshalling from CLI
  const assembled = await client.propose_snapshot({
    creator: CREATOR,
    title: 'Snapshot Test',
    description: 'No-op snapshot',
  }, { simulate: true });

  if (assembled.result === undefined || assembled.result === null) {
    console.error('Simulation did not return a result');
    process.exit(1);
  }

  const simId = assembled.result;
  console.log('Simulated proposal_id:', simId);

  const sent = await assembled.signAndSend(adminKeypair);
  console.log('Submitted. Result:', sent);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


