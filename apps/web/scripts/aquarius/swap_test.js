/* eslint-disable @typescript-eslint/no-require-imports */
/*
 Quick Aquarius swap test (no dApp)
 - Discovers pool_index for ROUTING_ASSET_A/ROUTING_ASSET_B (sorted)
 - Prints reserves and estimate_swap
 - Approves router for token_in
 - Swaps with min_out derived from estimate and slippage buffer

 Env precedence:
 - Reads from process.env first
 - Falls back to parsing .env.local in project root
 Required:
 - NEXT_SK (secret key of executor account)
 Optional:
 - NEXT_PUBLIC_ROUTING_ASSET_A, NEXT_PUBLIC_ROUTING_ASSET_B, NEXT_PUBLIC_SOROBAN_RPC_URL, NEXT_PUBLIC_STELLAR_NETWORK
*/

const fs = require('fs');
const path = require('path');
const sdk = require('@stellar/stellar-sdk');
const { rpc, xdr, Contract, Address, TransactionBuilder, Keypair } = sdk;

function loadEnvLocal() {
  const p = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(p)) return;
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function toHex(u8) {
  return Array.from(u8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function waitFor(server, hash, timeoutMs = 45000) {
  const start = Date.now();
  for (;;) {
    const res = await fetch(server.serverURL.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: { hash } }),
    });
    const json = await res.json();
    const s = json?.result?.status;
    if (s === 'SUCCESS') return;
    if (s === 'FAILED' || s === 'ERROR') throw new Error(`Tx failed: ${hash}`);
    if (Date.now() - start > timeoutMs) throw new Error(`Tx timeout: ${hash}`);
    await new Promise((r) => setTimeout(r, 1200));
  }
}

async function main() {
  loadEnvLocal();
  const RPC = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
  const PASS = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'Test SDF Network ; September 2015';
  const SK = process.env.NEXT_SK;
  const ROUTING_ASSET_A = process.env.NEXT_PUBLIC_ROUTING_ASSET_A || 'CDJ7G22ETJ6PRUM5GDPUXYEY3JL6MDY35WMJYWSGX7U6DV5VMQEKH3PG';
  const ROUTING_ASSET_B = process.env.NEXT_PUBLIC_ROUTING_ASSET_B || 'CCCLTACEMF33GJRJ2JXRQYXDBRLRZNK5GVPA2FVHLOE5TPP6NM7UIYV7';
  const AQUARIUS_ROUTER = process.env.NEXT_PUBLIC_AQUARIUS_ROUTER || 'CBCFTQSPDBAIZ6R6PJQKSQWKNKWH2QIV3I4J72SHWBIK3ADRRAM5A6GD';

  if (!SK) throw new Error('Missing NEXT_SK in env or .env.local');
  const kp = Keypair.fromSecret(SK.trim());
  const pubKey = kp.publicKey();

  const amountIn = Number(process.argv[2] || '100000'); // base units
  const slip = Number(process.argv[3] || '2'); // %

  const server = new rpc.Server(RPC, { allowHttp: true });
  const source = await server.getAccount(pubKey);
  const router = new Contract(AQUARIUS_ROUTER);

  const [t1, t2] = ROUTING_ASSET_A < ROUTING_ASSET_B ? [ROUTING_ASSET_A, ROUTING_ASSET_B] : [ROUTING_ASSET_B, ROUTING_ASSET_A];
  const tokensVec = xdr.ScVal.scvVec([
    xdr.ScVal.scvAddress(Address.fromString(t1).toScAddress()),
    xdr.ScVal.scvAddress(Address.fromString(t2).toScAddress()),
  ]);

  const buildTx = (acc, op, fee = '10000') => new TransactionBuilder(acc, { fee, networkPassphrase: PASS }).addOperation(op).setTimeout(60).build();
  const simAssemble = async (tx) => {
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) throw new Error('Simulation failed');
    return rpc.assembleTransaction(tx, sim);
  };
  const toB64 = (prepared, signer) => {
    try {
      if (!prepared) throw new Error('no prepared');
      if (prepared.signTransaction && signer) {
        const signed = prepared.signTransaction(signer);
        if (typeof signed === 'string') return signed;
        if (signed && signed.toXDR) return signed.toXDR();
      }
      if (typeof prepared === 'string') return prepared;
      if (prepared.toXDR) return prepared.toXDR();
      if (prepared.build && prepared.build().toXDR) return prepared.build().toXDR();
    } catch {}
    throw new Error('Unexpected prepared transaction type');
  };

  // get_pools -> pool_index
  const txPools = buildTx(source, router.call('get_pools', tokensVec), '1000');
  const simPools = await server.simulateTransaction(txPools);
  if (rpc.Api.isSimulationError(simPools)) throw new Error('get_pools simulation failed');
  const res0 = simPools.results?.[0]?.xdr;
  const sc = res0 ? xdr.ScVal.fromXDR(res0, 'base64') : simPools.result?.retval;
  const map = sc?.map?.();
  if (!map || map.length === 0) throw new Error('No pools');
  const entry = map[0];
  const key = entry.key ? entry.key() : entry._attributes?.key;
  let bytes = null;
  try { bytes = key?.bytesN?.() || key?.bytes?.(); } catch {}
  if (!bytes && key?._value) {
    try { bytes = key._value.bytes ? key._value.bytes() : null; } catch {}
  }
  if (!bytes || bytes.length !== 32) throw new Error('Failed to decode pool_index');
  const poolIndexHex = toHex(bytes);
  console.log('pool_index_hex', poolIndexHex);
  const poolIndex = xdr.ScVal.scvBytes ? xdr.ScVal.scvBytes(Buffer.from(poolIndexHex, 'hex')) : (xdr.ScVal.scvBytesN ? xdr.ScVal.scvBytesN(Buffer.from(poolIndexHex, 'hex')) : null);

  // get_reserves
  const txRes = buildTx(source, router.call('get_reserves', tokensVec, poolIndex), '1000');
  const simRes = await server.simulateTransaction(txRes);
  if (!rpc.Api.isSimulationError(simRes)) {
    const r0 = simRes.results?.[0]?.xdr;
    const scv = r0 ? xdr.ScVal.fromXDR(r0, 'base64') : simRes.result?.retval;
    const vec = scv?.vec?.();
    if (vec && vec.length === 2) {
      const toNum = (u) => { const u128 = u?.u128?.(); const lo = u128?.lo?.(); return lo ? lo.toString() : '0'; };
      console.log('reserves', toNum(vec[0]), toNum(vec[1]));
    }
  }

  // estimate_swap for ROUTING_ASSET_A -> ROUTING_ASSET_B with amountIn
  const txEst = buildTx(
    source,
    router.call(
      'estimate_swap',
      tokensVec,
      xdr.ScVal.scvAddress(Address.fromString(ROUTING_ASSET_A).toScAddress()),
      xdr.ScVal.scvAddress(Address.fromString(ROUTING_ASSET_B).toScAddress()),
      poolIndex,
      sdk.nativeToScVal(amountIn, { type: 'u128' }),
    ),
    '1000',
  );
  const simEst = await server.simulateTransaction(txEst);
  let quote = 0;
  if (!rpc.Api.isSimulationError(simEst)) {
    const e0 = simEst.results?.[0]?.xdr;
    const scv = e0 ? xdr.ScVal.fromXDR(e0, 'base64') : simEst.result?.retval;
    const u128 = scv?.u128?.();
    const lo = u128?.lo?.();
    quote = lo ? Number(lo.toString()) : 0;
    console.log('estimate_out', quote);
  }
  const buffer = Math.min(100, slip + 2);
  const minOut = quote > 0 ? Math.floor(quote * (1 - buffer / 100)) : Math.floor(amountIn * (1 - buffer / 100));
  console.log('min_out', minOut);

  // Approve token_in to router
  const tokenIn = new Contract(ROUTING_ASSET_A);
  const txApprove = buildTx(
    await server.getAccount(pubKey),
    tokenIn.call(
      'approve',
      xdr.ScVal.scvAddress(Address.fromString(pubKey).toScAddress()),
      xdr.ScVal.scvAddress(Address.fromString(AQUARIUS_ROUTER).toScAddress()),
      sdk.nativeToScVal(amountIn, { type: 'i128' }),
      sdk.nativeToScVal(3000000, { type: 'u32' }),
    ),
  );
  const assembledApprove = await simAssemble(txApprove);
  const approveB64 = toB64(assembledApprove, kp);
  const approveSend = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'sendTransaction', params: { transaction: approveB64 } }) });
  const approveJson = await approveSend.json();
  const approveHash = approveJson?.result?.hash;
  console.log('approve_hash', approveHash || approveJson);
  if (approveHash) await waitFor(server, approveHash, 120000);

  // Swap
  const txSwap = buildTx(
    await server.getAccount(pubKey),
    router.call(
      'swap',
      xdr.ScVal.scvAddress(Address.fromString(pubKey).toScAddress()),
      tokensVec,
      xdr.ScVal.scvAddress(Address.fromString(ROUTING_ASSET_A).toScAddress()),
      xdr.ScVal.scvAddress(Address.fromString(ROUTING_ASSET_B).toScAddress()),
      poolIndex,
      sdk.nativeToScVal(amountIn, { type: 'u128' }),
      sdk.nativeToScVal(minOut, { type: 'u128' }),
    ),
  );
  const assembledSwap = await simAssemble(txSwap);
  const swapB64 = toB64(assembledSwap, kp);
  const swapSend = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'sendTransaction', params: { transaction: swapB64 } }) });
  const swapJson = await swapSend.json();
  const swapHash = swapJson?.result?.hash;
  console.log('swap_hash', swapHash || swapJson);
  if (swapHash) await waitFor(server, swapHash, 120000);
}

main().catch((e) => { console.error('FATAL', e?.response?.data || e); process.exit(1); });

