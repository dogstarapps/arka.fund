import type { LeaderboardDataSourceSnapshot } from "@/lib/catalog/types";

export type OracleCutoverGateStatus =
  | "ready"
  | "blocked"
  | "not_required"
  | "unknown";

export type OracleCutoverGateCode =
  | "ready"
  | "manifest_missing"
  | "network_mismatch"
  | "oracle_unverified"
  | "contracts_incomplete"
  | "provider_unverified"
  | "thresholds_unconfigured"
  | "not_required"
  | "snapshot_missing";

export interface OracleCutoverGateSnapshot {
  status: OracleCutoverGateStatus;
  code: OracleCutoverGateCode;
  targetNetwork: "testnet" | "mainnet";
  ready: boolean;
  detail: string;
  checks: {
    manifestFound: boolean;
    networkMismatch: boolean;
    oracleMode: "oracle_guard" | "unverified";
    hasOracleGuard: boolean;
    hasPrimaryOracle: boolean;
    hasSecondaryOracle: boolean;
    providersVerified: boolean;
    thresholdsConfigured: boolean;
    noTestnetProviderFallback: boolean;
  };
}

const MAINNET_REFLECTOR_CONTRACT_IDS = new Set([
  "CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M",
  "CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN",
  "CBKGPWGKSKZF52CFHMTRR23TBWTPMRDIYZ4O2P5VS65BMHYH4DXMCJZC",
]);

const TESTNET_REFLECTOR_CONTRACT_IDS = new Set([
  "CAVLP5DH2GQ3T5DTCQEMYYT2CEBSXTV6THKFYGY6FJI7TGZCQHLESOAR",
  "CCYOZJCOP3FJ3A7OHFH5T3J2XXUVGL2S3NLXGZVXQ53OE2ZGRJRV3DVP",
  "CCSSOCTLOCBXYTDOCCFCYBKISAYXELBIQ5P36YDK6FQ5W3EN3RWLUNM2",
]);

function hasReflectorProviderName(value: string | null | undefined): boolean {
  return typeof value === "string" && value.toLowerCase().includes("reflector");
}

function isPositiveFiniteNumber(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function deriveOracleCutoverGate(
  snapshot: LeaderboardDataSourceSnapshot | null | undefined,
  options?: { enforceMainnetOnly?: boolean },
): OracleCutoverGateSnapshot {
  const enforceMainnetOnly = options?.enforceMainnetOnly ?? false;
  if (!snapshot) {
    return {
      status: "unknown",
      code: "snapshot_missing",
      targetNetwork: "testnet",
      ready: false,
      detail:
        "Runtime oracle snapshot is unavailable; keep publication blocked until health is restored.",
      checks: {
        manifestFound: false,
        networkMismatch: false,
        oracleMode: "unverified",
        hasOracleGuard: false,
        hasPrimaryOracle: false,
        hasSecondaryOracle: false,
        providersVerified: false,
        thresholdsConfigured: false,
        noTestnetProviderFallback: false,
      },
    };
  }

  const targetNetwork = snapshot.deployment.targetNetwork;
  const checks = {
    manifestFound: snapshot.deployment.fileFound,
    networkMismatch: snapshot.deployment.networkMismatch,
    oracleMode: snapshot.oracle.mode,
    hasOracleGuard: Boolean(snapshot.oracle.oracleGuard),
    hasPrimaryOracle: Boolean(snapshot.oracle.primaryOracle),
    hasSecondaryOracle: Boolean(snapshot.oracle.secondaryOracle),
    providersVerified:
      hasReflectorProviderName(snapshot.oracle.primaryProvider) &&
      hasReflectorProviderName(snapshot.oracle.secondaryProvider) &&
      Boolean(
        snapshot.oracle.primaryOracle &&
          snapshot.oracle.secondaryOracle &&
          MAINNET_REFLECTOR_CONTRACT_IDS.has(snapshot.oracle.primaryOracle) &&
          MAINNET_REFLECTOR_CONTRACT_IDS.has(snapshot.oracle.secondaryOracle),
      ),
    thresholdsConfigured:
      isPositiveFiniteNumber(snapshot.oracle.maxOracleAgeSeconds) &&
      isPositiveFiniteNumber(snapshot.oracle.maxDivergenceBps) &&
      isPositiveFiniteNumber(snapshot.oracle.minProviderCount) &&
      (snapshot.oracle.minProviderCount ?? 0) >= 2,
    noTestnetProviderFallback: ![
      snapshot.oracle.primaryOracle,
      snapshot.oracle.secondaryOracle,
      snapshot.oracle.validationAsset,
    ].some(
      (contractId) =>
        typeof contractId === "string" &&
        TESTNET_REFLECTOR_CONTRACT_IDS.has(contractId),
    ),
  };

  if (enforceMainnetOnly && targetNetwork !== "mainnet") {
    return {
      status: "not_required",
      code: "not_required",
      targetNetwork,
      ready: true,
      detail:
        "Runtime target is testnet, so the mainnet publication gate is not enforced in this lane.",
      checks,
    };
  }

  if (!checks.manifestFound) {
    const location = snapshot.deployment.deploymentsPath ?? "unresolved path";
    const readError = snapshot.deployment.readError
      ? ` (${snapshot.deployment.readError})`
      : "";
    return {
      status: "blocked",
      code: "manifest_missing",
      targetNetwork,
      ready: false,
      detail: `Mainnet target is active but deployments manifest is missing at ${location}${readError}.`,
      checks,
    };
  }

  if (checks.networkMismatch) {
    return {
      status: "blocked",
      code: "network_mismatch",
      targetNetwork,
      ready: false,
      detail: `Mainnet target is active, but oracle validation network ${snapshot.oracle.network ?? "unknown"} is mismatched.`,
      checks,
    };
  }

  if (checks.oracleMode !== "oracle_guard") {
    return {
      status: "blocked",
      code: "oracle_unverified",
      targetNetwork,
      ready: false,
      detail:
        "Mainnet target is active, but oracle guard validation is unverified for this runtime snapshot.",
      checks,
    };
  }

  if (!checks.hasOracleGuard || !checks.hasPrimaryOracle || !checks.hasSecondaryOracle) {
    return {
      status: "blocked",
      code: "contracts_incomplete",
      targetNetwork,
      ready: false,
      detail:
        "Mainnet target is active, but oracle contracts are incomplete (oracle guard / primary / secondary).",
      checks,
    };
  }

  if (!checks.providersVerified || !checks.noTestnetProviderFallback) {
    return {
      status: "blocked",
      code: "provider_unverified",
      targetNetwork,
      ready: false,
      detail:
        "Mainnet target is active, but Reflector mainnet provider IDs are not verified or a testnet oracle ID is still present.",
      checks,
    };
  }

  if (!checks.thresholdsConfigured) {
    return {
      status: "blocked",
      code: "thresholds_unconfigured",
      targetNetwork,
      ready: false,
      detail:
        "Mainnet target is active, but oracle age, divergence and minimum-provider thresholds are not fully configured.",
      checks,
    };
  }

  return {
    status: "ready",
    code: "ready",
    targetNetwork,
    ready: true,
    detail:
      "Mainnet target is active and oracle guard with primary/secondary feeds is verified.",
    checks,
  };
}
