import fs from "fs";
import path from "path";
import { Client as ArkaClient, type CreditProtocol } from "../../services/catalog-api/src/generated/arka.ts";
import { getRequiredEnv, makeSignTransaction, signAndSendTx } from "./governorCommon.ts";

type SentTx = {
  hash?: string;
  status: string | null;
};

type SendInput = {
  adminSecret: string;
  networkPassphrase: string;
  rpcUrl: string;
  inclusionFee?: string;
};

type PositionValue = {
  asset: string;
  collateral_amount: bigint;
  debt_amount: bigint;
  health_factor: bigint;
};

const protocol: CreditProtocol = { tag: "Blend", values: undefined };

function requiredPositive(name: string): bigint {
  const value = BigInt(getRequiredEnv(name));
  if (value <= 0n) throw new Error(`${name} must be positive`);
  return value;
}

function requiredNonNegative(name: string): bigint {
  const value = BigInt(getRequiredEnv(name));
  if (value < 0n) throw new Error(`${name} must not be negative`);
  return value;
}

function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

async function readResult<T>(label: string, txFactory: () => Promise<{ result: T }>): Promise<T> {
  try {
    return (await txFactory()).result;
  } catch (error) {
    throw new Error(`${label} simulation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function send(
  label: string,
  assembled: { toXDR: () => string },
  input: SendInput,
): Promise<SentTx> {
  const sent = await signAndSendTx(assembled, input.adminSecret, input.networkPassphrase, input.rpcUrl, {
    inclusionFee: input.inclusionFee,
  });
  const status = (sent.getResponse as { result?: { status?: string } })?.result?.status ?? null;
  if (status !== "SUCCESS") {
    throw new Error(`${label} failed: ${JSON.stringify(sent, jsonReplacer)}`);
  }
  return { hash: sent.hash, status };
}

function positionForAsset(values: PositionValue[], asset: string): PositionValue | undefined {
  return values.find((value) => value.asset === asset);
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const contractId = getRequiredEnv("ARKA_CONTRACT_ID");
  const adminSecret = getRequiredEnv("ADMIN_SECRET");
  const caller = getRequiredEnv("CALLER_ADDRESS");
  const adapter = getRequiredEnv("ADAPTER_CONTRACT_ID");
  const supplyAsset = getRequiredEnv("SUPPLY_ASSET_ID");
  const borrowAsset = getRequiredEnv("BORROW_ASSET_ID");
  const poolFactory = getRequiredEnv("POOL_FACTORY");
  const rpcUrl = getRequiredEnv("RPC_URL");
  const networkPassphrase = getRequiredEnv("NETWORK_PASSPHRASE");
  const outJson = getRequiredEnv("OUT_JSON");
  const marketId = requiredNonNegative("MARKET_ID");
  const supplyAmount = requiredPositive("SUPPLY_AMOUNT");
  const borrowAmount = requiredPositive("BORROW_AMOUNT");
  const maxBorrowPerAction = requiredPositive("MAX_BORROW_PER_ACTION");
  const maxDebtForAsset = requiredPositive("MAX_DEBT_FOR_ASSET");
  const maxOracleAge = requiredPositive("MAX_ORACLE_AGE");
  const minHealthFactor = requiredNonNegative("MIN_HEALTH_FACTOR");
  const inclusionFee = getRequiredEnv("INCLUSION_FEE");
  const feeBumpEnabled = process.env.FEE_BUMP_ENABLED !== "false";

  assertCondition(maxBorrowPerAction <= maxDebtForAsset, "per-action borrow limit exceeds total debt limit");
  assertCondition(borrowAmount <= maxBorrowPerAction, "canary borrow amount exceeds its configured limit");

  const signTransaction = makeSignTransaction(adminSecret, networkPassphrase);
  const client = new ArkaClient({
    contractId,
    rpcUrl,
    networkPassphrase,
    publicKey: caller,
    signTransaction,
  });
  const sendInput = {
    adminSecret,
    networkPassphrase,
    rpcUrl,
    inclusionFee: feeBumpEnabled ? inclusionFee : undefined,
  };

  const configuration = {
    venueRegistry: await send(
      "set venue registry",
      await client.set_venue_registry({ caller, registry: getRequiredEnv("VENUE_REGISTRY") }, { simulate: true }),
      sendInput,
    ),
    market: await send(
      "configure credit market",
      await client.configure_credit_market(
        {
          caller,
          protocol,
          market_id: marketId,
          adapter,
          allow_supply: true,
          allow_borrow: true,
          allow_repay: true,
          allow_withdraw: true,
          enabled: true,
        },
        { simulate: true },
      ),
      sendInput,
    ),
    riskPolicy: await send(
      "set Blend risk policy",
      await client.set_blend_risk_policy(
        {
          caller,
          market_id: marketId,
          max_oracle_age: maxOracleAge,
          min_health_factor: minHealthFactor,
          fail_close_nav: true,
          fail_close_actions: true,
        },
        { simulate: true },
      ),
      sendInput,
    ),
    diagnostics: await send(
      "enable Blend diagnostics",
      await client.set_blend_external_diagnostics({ caller, market_id: marketId, enabled: true }, { simulate: true }),
      sendInput,
    ),
    riskSource: await send(
      "set verified Blend pool source",
      await client.set_blend_v2_risk_source({ caller, market_id: marketId, pool_factory: poolFactory }, { simulate: true }),
      sendInput,
    ),
    borrowPolicy: await send(
      "set bounded borrow policy",
      await client.set_credit_borrow_policy(
        {
          caller,
          protocol,
          market_id: marketId,
          asset: borrowAsset,
          max_borrow_per_action: maxBorrowPerAction,
          max_debt_for_asset: maxDebtForAsset,
          enabled: true,
        },
        { simulate: true },
      ),
      sendInput,
    ),
  };

  let supply: SentTx | undefined;
  let borrow: SentTx | undefined;
  let repay: SentTx | undefined;
  let withdraw: SentTx | undefined;
  let hasSupplied = false;
  let hasBorrowed = false;
  let hasRepaid = false;
  let hasWithdrawn = false;

  try {
    supply = await send(
      "Blend supply",
      await client.credit_supply(
        { manager: caller, protocol, market_id: marketId, asset: supplyAsset, amount: supplyAmount },
        { simulate: true },
      ),
      sendInput,
    );
    hasSupplied = true;

    borrow = await send(
      "Blend borrow",
      await client.credit_borrow(
        { manager: caller, protocol, market_id: marketId, asset: borrowAsset, amount: borrowAmount },
        { simulate: true },
      ),
      sendInput,
    );
    hasBorrowed = true;

    const afterBorrow = {
      positions: await readResult("positions after borrow", () =>
        client.credit_position_values({ protocol, market_id: marketId }, { simulate: true }),
      ),
      status: await readResult("market status after borrow", () =>
        client.credit_market_status({ protocol, market_id: marketId }, { simulate: true }),
      ),
    };
    const debtPosition = positionForAsset(afterBorrow.positions as PositionValue[], borrowAsset);
    assertCondition(debtPosition && debtPosition.debt_amount > 0n, "borrow did not create recorded debt");
    assertCondition(afterBorrow.status.debt_value > 0n, "market did not report debt after borrow");
    assertCondition(!afterBorrow.status.risky_actions_blocked, "market risk controls blocked the bounded borrow");
    assertCondition(afterBorrow.status.health_factor >= minHealthFactor, "borrowed position is below minimum health factor");

    repay = await send(
      "Blend repay",
      await client.credit_repay(
        { manager: caller, protocol, market_id: marketId, asset: borrowAsset, amount: borrowAmount },
        { simulate: true },
      ),
      sendInput,
    );
    hasRepaid = true;
    const afterRepay = {
      positions: await readResult("positions after repay", () =>
        client.credit_position_values({ protocol, market_id: marketId }, { simulate: true }),
      ),
      status: await readResult("market status after repay", () =>
        client.credit_market_status({ protocol, market_id: marketId }, { simulate: true }),
      ),
    };
    const repaidDebt = positionForAsset(afterRepay.positions as PositionValue[], borrowAsset);
    assertCondition(!repaidDebt || repaidDebt.debt_amount === 0n, "repay did not clear the recorded debt");
    assertCondition(afterRepay.status.debt_value === 0n, "market still reports debt after full repayment");

    withdraw = await send(
      "Blend withdraw",
      await client.credit_withdraw(
        { manager: caller, protocol, market_id: marketId, asset: supplyAsset, amount: supplyAmount },
        { simulate: true },
      ),
      sendInput,
    );
    hasWithdrawn = true;
    const afterWithdraw = {
      positions: await readResult("positions after withdraw", () =>
        client.credit_position_values({ protocol, market_id: marketId }, { simulate: true }),
      ),
      marketValue: await readResult("market value after withdraw", () =>
        client.credit_market_value({ protocol, market_id: marketId }, { simulate: true }),
      ),
    };
    assertCondition(afterWithdraw.positions.length === 0, "withdraw did not clear collateral positions");
    assertCondition(afterWithdraw.marketValue === null, "market value remains after full withdrawal");

    const evidence = {
      kind: "mainnet_blend_borrow_repay_canary",
      network: "mainnet",
      status: "passed",
      validatedAt: new Date().toISOString(),
      scope: {
        protocol: "Blend",
        marketId,
        supplyAsset,
        borrowAsset,
        supplyAmount,
        borrowAmount,
        maxBorrowPerAction,
        maxDebtForAsset,
      },
      arka: contractId,
      adapter,
      configuration,
      transactions: { supply, borrow, repay, withdraw },
      afterBorrow,
      afterRepay,
      afterWithdraw,
    };
    const rendered = JSON.stringify(evidence, jsonReplacer, 2);
    fs.mkdirSync(path.dirname(outJson), { recursive: true });
    fs.writeFileSync(outJson, `${rendered}\n`);
    process.stdout.write(`${rendered}\n`);
  } finally {
    // If a post-supply assertion or read fails, leave no canary capital or debt behind.
    if (hasBorrowed && !hasRepaid) {
      await send(
        "Blend emergency repay",
        await client.credit_repay(
          { manager: caller, protocol, market_id: marketId, asset: borrowAsset, amount: borrowAmount },
          { simulate: true },
        ),
        sendInput,
      );
      hasRepaid = true;
    }
    if (hasSupplied && !hasWithdrawn) {
      await send(
        "Blend emergency withdraw",
        await client.credit_withdraw(
          { manager: caller, protocol, market_id: marketId, asset: supplyAsset, amount: supplyAmount },
          { simulate: true },
        ),
        sendInput,
      );
      hasWithdrawn = true;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
