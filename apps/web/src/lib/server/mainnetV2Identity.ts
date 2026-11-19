import { Contract, Networks, StrKey, rpc } from "@stellar/stellar-sdk";
import deployment from "../../../config/deployments.mainnet.json";

// Executables of the V2 funds registered on mainnet, including Noah's Ark.
const V2_WASM_HASHES = new Set([
  "410ad8c14619be291738d2146469f835e9b058b81b4359007f9eb3cbe45a0cda",
  "3cbd888c32f0d411b867143c4c78ac30e2f84a3a3b9c1948d869e6ac0bcdfd07",
]);

export async function readMainnetV2Identity(id: string) {
  if (!StrKey.isValidContract(id)) return null;
  const server = new rpc.Server(process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? deployment.rpcUrl);
  const [network, ledger] = await Promise.all([
    server.getNetwork(),
    server.getLedgerEntries(new Contract(id).getFootprint()),
  ]);
  if (network.passphrase !== Networks.PUBLIC || ledger.entries.length !== 1) return null;
  const executable = ledger.entries[0].val.contractData().val().instance().executable();
  if (executable.switch().name !== "contractExecutableWasm") return null;
  const codeHash = executable.wasmHash().toString("hex");
  if (!V2_WASM_HASHES.has(codeHash)) return null;
  return { id, version: 2, codeHash, ledger: ledger.latestLedger };
}
