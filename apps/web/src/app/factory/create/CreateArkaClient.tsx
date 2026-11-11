"use client";
import { StrKey } from "@stellar/stellar-sdk";
import { GENERAL_MAINNET, generalRead } from "@/lib/generalMainnet";
import { MAINNET_NETWORK } from "@/lib/mainnetWalletConnector";
import "./creation-header.css";

import Link from "next/link";
import V3DefaultCreationReview from "@/components/product/V3DefaultCreationReview";
import {ManagedContextHelp} from "@/components/product/ManagedContextHelp";
import { useRouter } from "next/navigation";
import type { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActionField,
  AssetMark,
  StatusPill,
  TransactionConfirmDialog,
  TransactionFeedbackRail,
  TransactionReviewCard,
  TransactionSuccessDialog,
} from "@/components/product/surfacePrimitives";
import { resolveAssetDisplayLabel } from "@/lib/catalog/assetPresentation";
import {
  loadAssetsPage,
  loadCoreStellarAssetRegistry,
  saveArkaIdentity,
  saveManagerIdentity,
} from "@/lib/catalog/api";
import { indexCoreAssetMetadata, lookupCoreAssetMetadata } from "@/lib/catalog/coreStellarAssetRegistry";
import { formatContractLabel } from "@/lib/catalog/format";
import {
  buildIdentityPayload,
  buildIdentityUpdateMessage,
  IDENTITY_FIELD_LIMITS,
  type EditableIdentityDraft,
} from "@/lib/catalog/identity";
import type { IdentityUpdateRequest } from "@/lib/catalog/types";
import type { CoreStellarAssetMetadata, RankedAssetCatalogEntry } from "@/lib/catalog/types";
import { ARKA_FACTORY, ARKA_ROUTER, DENOMINATION, SIM_ACCOUNT } from "@/lib/config";
import { assertFinancialActionsEnabled, UX_REVIEW_PREVIEW } from "@/lib/previewSafety";
import {
  resolveRpcUrl,
  buildTokenApprove,
  readFactoryCreationFeeAmount,
  readFactoryCreationFeeToken,
  readTokenAllowance,
  readTokenBalance,
} from "@/lib/soroban";
import { signXdr } from "@/lib/tx";
import {
  deriveCreateSummary,
  type SetupIntent,
} from "@/lib/workflows/productFlows";
import {
  buildCreateStepperRows,
  buildCreateWizardVisualStages,
  deriveCreateStepReadiness,
  getCreateStepNavigation,
  getCreateWizardStep,
  formatCreationFeeDisplay,
  normalizeCreateWizardUrlState,
  summarizeCreateWizardProgress,
  validateCreateFeeProfile,
  writeCreateWizardUrlState,
  type CreateWizardStepId,
  type CreateWizardUrlState,
} from "@/lib/workflows/createWizardState";
import { resolveCreateArkaPrefill } from "@/lib/workflows/createArkaPrefill";
import {
  normalizeWalletPubkey,
  resolveWalletChangedPubkey,
  shouldPauseWalletAutoHydration,
} from "@/lib/workflows/walletIdentity";
import {
  connectWallet,
  getWalletsKit,
  signMessageWithWallet,
} from "@/lib/walletKit";

const MANAGED_CREATION = process.env.NEXT_PUBLIC_V3_DEFAULT_CREATION === "1";

type CreationTemplate = {
  denomination: string;
  assets: string[];
  router: string;
};

async function readCreationTemplate(signal: AbortSignal): Promise<CreationTemplate> {
  const { profile, defaultDraft } = await generalRead("profile", {}, signal);
  const assets = defaultDraft?.whitelistContracts;
  const denomination = defaultDraft?.denominationContract;
  const router = defaultDraft?.routerId;
  if (
    profile?.network !== MAINNET_NETWORK ||
    !/^[a-f0-9]{64}$/.test(profile?.templateHash ?? "") ||
    profile.templateHash !== defaultDraft?.templateHash ||
    !StrKey.isValidContract(profile.factory) ||
    profile.factory !== defaultDraft.factoryId ||
    !StrKey.isValidContract(router ?? "") ||
    router !== profile.router ||
    !Array.isArray(assets) ||
    !assets.every(asset => typeof asset === "string" && StrKey.isValidContract(asset)) ||
    !assets.includes(denomination)
  ) {
    throw new Error("Creation template unavailable.");
  }
  return { denomination, assets, router };
}

async function readCreationCatalog(signal: AbortSignal): Promise<RankedAssetCatalogEntry[]> {
  const assets: RankedAssetCatalogEntry[] = [];
  let total: number;
  do {
    const page = await loadAssetsPage({ offset: assets.length }, signal);
    total = page.total;
    if (
      page.offset !== assets.length ||
      !Number.isSafeInteger(total) ||
      total < assets.length + page.items.length ||
      (page.items.length === 0 && assets.length < total)
    ) {
      throw new Error("Asset catalog is incomplete.");
    }
    assets.push(...page.items);
  } while (assets.length < total);
  if (new Set(assets.map(asset => asset.assetContract)).size !== assets.length) {
    throw new Error("Asset catalog changed while loading.");
  }
  return assets;
}

function readStoredWalletPubkey(): string {
  if (typeof window === "undefined") return "";
  try {
    return normalizeWalletPubkey(window.localStorage.getItem("wallet:pubkey"));
  } catch {
    return "";
  }
}

type CreateArkaClientProps = {
  initialUrlState?: CreateWizardUrlState;
};

export default function CreateArkaClient({ initialUrlState }: CreateArkaClientProps = {}) {
  const router = useRouter();
  const [initialWizardState] = useState(() =>
    initialUrlState ??
    (typeof window === "undefined"
      ? normalizeCreateWizardUrlState({})
      : normalizeCreateWizardUrlState(new URLSearchParams(window.location.search))),
  );
  const [activeCreateStep, setActiveCreateStep] =
    useState<CreateWizardStepId>(initialWizardState.step);
  const [setupIntent, setSetupIntent] =
    useState<SetupIntent>(initialWizardState.setupIntent);
  const [pubKey, setPubKey] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [kit, setKit] = useState<StellarWalletsKit | null>(null);
  const [walletConnectBusy, setWalletConnectBusy] = useState(false);
  const [wizardInteractive, setWizardInteractive] = useState(false);
  const walletAutoHydrationPausedRef = useRef(false);

  useEffect(() => {
    setKit(getWalletsKit(["FREIGHTER", "ALBEDO", "XBULL"]));
    setWizardInteractive(true);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (!pubKey && kit && !walletAutoHydrationPausedRef.current) {
          try {
            const { address } = await kit.getAddress();
            if (address && !walletAutoHydrationPausedRef.current) {
              setPubKey(address);
              return;
            }
          } catch {}
        }
      } catch {}
    })();
  }, [kit, pubKey]);

  useEffect(() => {
    const hydrateFromStorage = () => {
      if (walletAutoHydrationPausedRef.current) return;
      const saved = readStoredWalletPubkey();
      if (saved && saved !== pubKey) setPubKey(saved);
    };
    const syncWallet = (nextPubkey: string) => {
      const normalized = normalizeWalletPubkey(nextPubkey);
      walletAutoHydrationPausedRef.current = shouldPauseWalletAutoHydration(normalized);
      setPubKey(normalized);
    };
    const onWalletChanged = (event: Event) => {
      const detail = (event as CustomEvent<string | null | undefined>).detail;
      syncWallet(resolveWalletChangedPubkey(detail, readStoredWalletPubkey()));
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "wallet:pubkey") return;
      syncWallet(event.newValue ?? "");
    };
    hydrateFromStorage();
    window.addEventListener("wallet:pubkey-changed", onWalletChanged as EventListener);
    window.addEventListener("storage", onStorage);
    const intervalId = window.setInterval(hydrateFromStorage, 500);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("wallet:pubkey-changed", onWalletChanged as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, [pubKey]);

  const [assetSearch, setAssetSearch] = useState("");
  const [prefillNotice, setPrefillNotice] = useState("");
  const prefillAppliedRef = useRef(false);
  const assetSearchTouchedRef = useRef(false);
  const assetSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedDenomination, setSelectedDenomination] = useState("");
  const [selectedWhitelist, setSelectedWhitelist] = useState<string[]>([]);
  const [catalogAssets, setCatalogAssets] = useState<RankedAssetCatalogEntry[]>([]);
  const [creationTemplate, setCreationTemplate] = useState<CreationTemplate | null>(null);
  const [assetMetadataLookup, setAssetMetadataLookup] = useState<Record<string, CoreStellarAssetMetadata>>({});
  const [assetCatalogState, setAssetCatalogState] = useState<"loading" | "ready" | "error">("loading");
  const [assetCatalogAttempt, setAssetCatalogAttempt] = useState(0);
  const routerId = MANAGED_CREATION ? creationTemplate?.router ?? "" : ARKA_ROUTER;
  const [feesPct, setFeesPct] = useState({ mgmt: "0", perf: "0", dep: "0", red: "0" });
  const [feeToken, setFeeToken] = useState("");
  const [feeAmount, setFeeAmount] = useState(0);
  const [creationFeeState, setCreationFeeState] = useState<"loading" | "ready" | "error">("loading");
  const [creationFeeReadVersion, setCreationFeeReadVersion] = useState(0);
  const [createdArkaId, setCreatedArkaId] = useState("");
  const [createdArkaTxHash, setCreatedArkaTxHash] = useState("");
  const [identityDraft, setIdentityDraft] = useState<EditableIdentityDraft>({
    displayName: "",
    description: "",
    strategy: "",
    riskDisclosure: "",
    targetReturn: "",
    websiteUrl: "",
    socialUrl: "",
  });
  const [managerIdentityName, setManagerIdentityName] = useState("");
  const [managerIdentityDescription, setManagerIdentityDescription] = useState("");
  const [identitySaveStatus, setIdentitySaveStatus] = useState("");
  const [identitySaveError, setIdentitySaveError] = useState("");
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [confirmCreate, setConfirmCreate] = useState(false);

  useEffect(() => {
    writeCreateWizardUrlState({
      step: activeCreateStep,
      setupIntent,
    });
  }, [activeCreateStep, setupIntent]);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setAssetCatalogState("loading");
      try {
        if (MANAGED_CREATION) {
          const template = await readCreationTemplate(controller.signal);
          if (controller.signal.aborted) return;
          setCreationTemplate(template);
        } else {
          const assets = await readCreationCatalog(controller.signal);
          if (controller.signal.aborted) return;
          setCatalogAssets(assets);
        }
        setAssetCatalogState("ready");
      } catch {
        if (controller.signal.aborted) return;
        setCatalogAssets([]);
        setCreationTemplate(null);
        setAssetCatalogState("error");
      }
    };
    void run();
    return () => controller.abort();
  }, [assetCatalogAttempt]);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      try {
        const registry = await loadCoreStellarAssetRegistry(controller.signal);
        if (!controller.signal.aborted) setAssetMetadataLookup(indexCoreAssetMetadata(registry.items));
      } catch {
        if (!controller.signal.aborted) setAssetMetadataLookup({});
      }
    };
    void run();
    return () => controller.abort();
  }, []);

  const assetOptions = useMemo(() => {
    if (assetCatalogState !== "ready") return [];
    const assets = creationTemplate
      ? creationTemplate.assets.map(assetContract => ({ assetContract, arkaCount: null }))
      : catalogAssets;
    return assets.map(({ assetContract, arkaCount }) => {
      const metadata = lookupCoreAssetMetadata(assetMetadataLookup, assetContract);
      return {
        key: assetContract,
        contract: assetContract,
        label: metadata?.symbol ?? resolveAssetDisplayLabel(assetContract),
        registryId: metadata?.id ?? null,
        selectable: true,
        arkaCount,
        iconUrl: metadata?.iconUrl ?? null,
        fallbackIconUrl: metadata?.fallbackIconUrl ?? null,
        iconSource: metadata?.iconSource ?? null,
        tomlState: metadata?.tomlState ?? null,
        iconProvenanceLabel: metadata?.iconProvenanceLabel ?? null,
      };
    }).sort((left, right) => left.label.localeCompare(right.label));
  }, [assetCatalogState, assetMetadataLookup, catalogAssets, creationTemplate]);

  useEffect(() => {
    if (prefillAppliedRef.current || assetCatalogState !== "ready" || MANAGED_CREATION) {
      return;
    }
    if (typeof window === "undefined" || !window.location.search) {
      return;
    }

    const prefill = resolveCreateArkaPrefill(
      new URLSearchParams(window.location.search),
      assetOptions,
    );
    if (!prefill.applied) {
      return;
    }

    prefillAppliedRef.current = true;
    if (prefill.denomination) {
      setSelectedDenomination(prefill.denomination.contract);
      setSelectedWhitelist(prefill.whitelist.map((selection) => selection.contract));
    } else if (prefill.whitelist.length > 0) {
      setSelectedWhitelist((current) =>
        Array.from(
          new Set([
            ...current,
            ...prefill.whitelist.map((selection) => selection.contract),
          ]),
        ),
      );
    }
    const assetSearchInput =
      typeof document !== "undefined"
        ? (document.getElementById("create-arka-asset-search") as HTMLInputElement | null)
        : null;
    const assetSearchFocused = Boolean(assetSearchInput && document.activeElement === assetSearchInput);
    const assetSearchDomValue = assetSearchInput?.value ?? "";
    const assetSearchEditedInDom = Boolean(
      assetSearchDomValue && assetSearchDomValue !== prefill.search,
    );
    const userEditedAssetSearch =
      assetSearchTouchedRef.current || assetSearchFocused || assetSearchEditedInDom;

    if (prefill.search && !userEditedAssetSearch) {
      setAssetSearch(prefill.search);
    }

    const noticeParts = [
      prefill.denomination ? `denomination ${prefill.denomination.label}` : "",
      prefill.whitelist.length
        ? `allowed ${prefill.whitelist.map((selection) => selection.label).join(", ")}`
        : "",
      prefill.unresolved.length ? `unresolved ${prefill.unresolved.join(", ")}` : "",
    ].filter(Boolean);
    setPrefillNotice(`Route prefill applied: ${noticeParts.join(" · ")}`);
  }, [assetCatalogState, assetOptions]);

  const filteredAssets = useMemo(() => {
    const query = assetSearch.trim().toLowerCase();
    if (!query) return assetOptions;
    return assetOptions.filter((asset) => {
      const haystack = `${asset.label} ${asset.contract ?? ""} ${asset.registryId ?? ""} ${asset.iconProvenanceLabel ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [assetOptions, assetSearch]);

  useEffect(() => {
    const input = assetSearchInputRef.current;
    if (!input) return;

    if (document.activeElement === input) {
      if (input.value !== assetSearch) {
        assetSearchTouchedRef.current = true;
        setAssetSearch(input.value);
      }
      return;
    }

    if (input.value !== assetSearch) {
      input.value = assetSearch;
    }
  }, [assetOptions.length, assetSearch]);

  const availableAssets = useMemo(() => new Set(assetOptions.map(asset => asset.contract)), [assetOptions]);
  const assetLabelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const asset of assetOptions) counts.set(asset.label, (counts.get(asset.label) ?? 0) + 1);
    return counts;
  }, [assetOptions]);
  const denominationCandidate = creationTemplate?.denomination ?? (selectedDenomination || DENOMINATION);
  const denominationContract = availableAssets.has(denominationCandidate) ? denominationCandidate : "";
  const whitelist = useMemo(() => {
    const selected = creationTemplate?.assets ?? [denominationContract, ...selectedWhitelist];
    return [...new Set(selected.filter(asset => availableAssets.has(asset)))];
  }, [availableAssets, creationTemplate, denominationContract, selectedWhitelist]);
  const selectedDenominationLabel = assetOptions.find(asset => asset.contract === denominationContract)?.label ?? "";
  const selectedWhitelistLabel = useMemo(() => {
    if (whitelist.length === 0) return "No additional assets selected";
    const labels = whitelist.slice(0, 3).map((contract) => resolveAssetDisplayLabel(contract));
    return whitelist.length > 3 ? `${labels.join(", ")} +${whitelist.length - 3}` : labels.join(", ");
  }, [whitelist]);
  const feeTokenLabel = useMemo(
    () => (feeToken ? resolveAssetDisplayLabel(feeToken) : ""),
    [feeToken],
  );
  const creationFeeDisplay = useMemo(
    () =>
      creationFeeState !== "ready" ? (creationFeeState === "loading" ? "Checking…" : "Unavailable — recheck before signing") : feeToken && feeAmount > 0
        ? formatCreationFeeDisplay(feeAmount, feeTokenLabel)
        : "none configured",
    [creationFeeState, feeAmount, feeToken, feeTokenLabel],
  );
  const createSummary = useMemo(
    () =>
      deriveCreateSummary({
        pubKey,
        routerId,
        denominationInput: denominationContract,
        defaultDenomination: "",
        feeToken,
        feeAmount,
        whitelist,
        setupIntent,
        createdArkaId,
      }),
    [
      createdArkaId,
      denominationContract,
      feeAmount,
      feeToken,
      pubKey,
      routerId,
      setupIntent,
      whitelist,
    ],
  );
  const createReviewBullets = useMemo(
    () => [
      `Wallet: ${pubKey || "offline"}`,
      `Denomination: ${selectedDenominationLabel || "not set"}`,
      `Allowed assets: ${selectedWhitelistLabel}`,
      `Creation fee: ${creationFeeDisplay}`,
      `Management ${feesPct.mgmt || "0"}% · Performance ${feesPct.perf || "0"}% · Deposit ${feesPct.dep || "0"}% · Withdrawal ${feesPct.red || "0"}%`,
      "Network fees are additional. Creating an Arka does not deposit or invest any funds.",
      `Open after creation: ${setupIntent === "BLEND" ? "Blend" : "Swaps"}`,
    ],
    [creationFeeDisplay, feesPct, pubKey, selectedDenominationLabel, selectedWhitelistLabel, setupIntent],
  );
  const feeValidation = useMemo(
    () => validateCreateFeeProfile(feesPct),
    [feesPct],
  );
  const toggleWhitelistAsset = (contract: string) => {
    if (contract === denominationContract) return;
    setSelectedWhitelist((current) =>
      current.includes(contract)
        ? current.filter((item) => item !== contract)
        : [...current, contract],
    );
  };

  const updateAssetSearch = (value: string, syncInput = false) => {
    assetSearchTouchedRef.current = true;
    if (syncInput && assetSearchInputRef.current?.value !== value) {
      assetSearchInputRef.current!.value = value;
    }
    setAssetSearch(value);
  };

  const submitSigned = async (signedXdr: string): Promise<string> => {
    type RpcSendTx = {
      jsonrpc: "2.0";
      id: number;
      result?: { hash: string };
      error?: { code: number; message: string };
    };
    const res = await fetch(resolveRpcUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sendTransaction",
        params: { transaction: signedXdr },
      }),
    });
    const json = (await res.json()) as RpcSendTx;
    if (!json.result?.hash) throw new Error(json.error?.message || "sendTransaction failed");
    return json.result.hash;
  };

  const waitForSorobanTx = async (hash: string, timeoutMs = 30000): Promise<void> => {
    const started = Date.now();
    for (;;) {
      const res = await fetch(resolveRpcUrl(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTransaction",
          params: { hash },
        }),
      });
      const json = (await res.json()) as { result?: { status?: string } };
      const txStatus = json.result?.status;
      if (txStatus === "SUCCESS") return;
      if (txStatus === "FAILED" || txStatus === "ERROR") throw new Error(`Tx failed: ${hash}`);
      if (Date.now() - started > timeoutMs) throw new Error(`Tx timeout: ${hash}`);
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  };

  const refreshCreationFeeRequirement = async (
    currentPub: string,
  ): Promise<{ requiredFeeToken: string; requiredFeeAmount: number }> => {
    let requiredFeeToken = feeToken;
    let requiredFeeAmount = feeAmount;
    if (ARKA_FACTORY) {
      setStatus("Checking creation fee...");
      const [nextFeeToken, nextFeeAmount] = await Promise.all([
        readFactoryCreationFeeToken(ARKA_FACTORY, currentPub),
        readFactoryCreationFeeAmount(ARKA_FACTORY, currentPub),
      ]);
      const feeChanged = creationFeeState === "ready" && ((nextFeeToken || "") !== requiredFeeToken || nextFeeAmount !== requiredFeeAmount);
      requiredFeeToken = nextFeeToken || "";
      requiredFeeAmount = nextFeeAmount;
      if (!Number.isSafeInteger(requiredFeeAmount) || requiredFeeAmount < 0 || (requiredFeeAmount > 0 && !requiredFeeToken)) throw new Error("Creation fee is unavailable. Please recheck before signing.");
      setFeeToken(requiredFeeToken);
      setFeeAmount(requiredFeeAmount);
      setCreationFeeState("ready");
      if (feeChanged) throw new Error("The creation fee changed. Review the updated fee and confirm again before signing.");
    }
    return { requiredFeeToken, requiredFeeAmount };
  };

  const waitForCreationFeeAllowance = async (
    currentPub: string,
    requiredFeeToken: string,
    requiredFeeAmount: number,
  ): Promise<void> => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const allowance = await readTokenAllowance(
        requiredFeeToken,
        currentPub,
        ARKA_FACTORY,
        currentPub,
      );
      if (allowance >= requiredFeeAmount) return;
      await new Promise((resolve) => setTimeout(resolve, 1200 + attempt * 600));
    }
    throw new Error(
      "Creation fee approval is not confirmed yet. Wait a few seconds and try again.",
    );
  };

  const buildCreateAndInitTx = async (
    currentPub: string,
    saltHex: string,
    denomCid: string,
    fees: { mgmt_bps: number; perf_bps: number; deposit_bps: number; redeem_bps: number },
    whitelistContracts: string[],
  ): Promise<{ xdrB64: string; predictedAddress?: string }> => {
    const res = await fetch("/api/factory/create/build", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        factoryId: ARKA_FACTORY,
        creatorPubKey: currentPub,
        saltHex,
        denominationContract: denomCid,
        fees,
        whitelistContracts,
        routerId,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "server_build_failed");
    }
    const json = (await res.json()) as { xdrB64?: string; predictedAddress?: string };
    if (!json.xdrB64) throw new Error("server_build_missing_xdr");
    return { xdrB64: json.xdrB64, predictedAddress: json.predictedAddress };
  };

  const buildSignedIdentityRequest = async (
    scope: "arka" | "manager",
    target: string,
    signer: string,
    draft: EditableIdentityDraft,
  ): Promise<IdentityUpdateRequest> => {
    if (!kit) throw new Error("Wallet kit not initialized");
    const payload = buildIdentityPayload(draft);
    const message = buildIdentityUpdateMessage({ scope, target, signer, payload });
    const signature = await signMessageWithWallet(kit, message, signer);
    return { signer, message, signature, payload };
  };

  const saveCreatedIdentity = async (arkaId: string, signer: string): Promise<void> => {
    const hasArkaIdentity = Boolean(
      identityDraft.displayName.trim() ||
      identityDraft.description.trim() ||
      identityDraft.strategy.trim() ||
      identityDraft.riskDisclosure.trim() ||
      identityDraft.targetReturn.trim() ||
      identityDraft.websiteUrl?.trim() ||
      identityDraft.socialUrl?.trim(),
    );
    const hasManagerIdentity = Boolean(
      managerIdentityName.trim() || managerIdentityDescription.trim(),
    );

    if (!hasArkaIdentity && !hasManagerIdentity) {
      setIdentitySaveStatus("Profile names can be edited from the detail pages.");
      setIdentitySaveError("");
      return;
    }

    setIdentitySaveStatus("Saving public profile names...");
    setIdentitySaveError("");

    try {
      if (hasArkaIdentity) {
        const arkaRequest = await buildSignedIdentityRequest(
          "arka",
          arkaId,
          signer,
          identityDraft,
        );
        await saveArkaIdentity(arkaId, arkaRequest);
      }
      if (hasManagerIdentity) {
        const managerRequest = await buildSignedIdentityRequest(
          "manager",
          signer,
          signer,
          {
            displayName: managerIdentityName,
            description: managerIdentityDescription,
            strategy: "",
            riskDisclosure: "",
            targetReturn: "",
            websiteUrl: "",
            socialUrl: "",
          },
        );
        await saveManagerIdentity(signer, managerRequest);
      }
      setIdentitySaveStatus("Public profile saved.");
      setIdentitySaveError("");
    } catch (metadataError) {
      setIdentitySaveStatus("Arka created. Public profile name still needs saving.");
      setIdentitySaveError(
        metadataError instanceof Error
          ? metadataError.message
          : "Profile metadata could not be saved.",
      );
    }
  };

  useEffect(() => {
    let cancelled = false;
    setCreationFeeState("loading");
    (async () => {
      try {
        if (ARKA_FACTORY) {
          const [t, a] = await Promise.all([
            readFactoryCreationFeeToken(ARKA_FACTORY, (GENERAL_MAINNET ? pubKey : pubKey || SIM_ACCOUNT)),
            readFactoryCreationFeeAmount(ARKA_FACTORY, (GENERAL_MAINNET ? pubKey : pubKey || SIM_ACCOUNT)),
          ]);
          if (cancelled) return;
          if (!Number.isSafeInteger(a) || a < 0 || (a > 0 && !t)) throw new Error("Fee unavailable");
          setFeeToken(t || "");
          setFeeAmount(a);
          setCreationFeeState("ready");
        } else if (!cancelled) setCreationFeeState("error");
      } catch { if (!cancelled) setCreationFeeState("error"); }
    })();
    return () => { cancelled = true; };
  }, [pubKey, creationFeeReadVersion]);

  const submitCreateArka = async (): Promise<void> => {
    try {
      assertFinancialActionsEnabled();
      if (assetCatalogState !== "ready" || !denominationContract) throw new Error("Choose a verified denomination asset.");
      if (!ARKA_FACTORY) throw new Error("NEXT_PUBLIC_ARKA_FACTORY not set");
      setCreatedArkaId("");
      setCreatedArkaTxHash("");
      setSuccessDialogOpen(false);
      setIdentitySaveStatus("");
      setIdentitySaveError("");
      setError("");
      let currentPub = pubKey;
      if (!currentPub) {
        try {
          const addressResult = kit ? await kit.getAddress() : undefined;
          const address = addressResult?.address;
          if (address) currentPub = address;
        } catch {}
        if (!currentPub) {
          try {
            const saved = localStorage.getItem("wallet:pubkey");
            if (saved) currentPub = saved;
          } catch {}
        }
      }
      if (!currentPub) throw new Error("Connect wallet");
      if (!routerId) throw new Error("NEXT_PUBLIC_ARKA_ROUTER not set");
      if (!kit) throw new Error("Wallet kit not initialized");
      setStatus("Preparing create & init...");
      const { requiredFeeToken, requiredFeeAmount } =
        await refreshCreationFeeRequirement(currentPub);
      if (requiredFeeToken && requiredFeeAmount > 0) {
        const requiredFeeTokenLabel = resolveAssetDisplayLabel(requiredFeeToken);
        const requiredFeeDisplay = formatCreationFeeDisplay(
          requiredFeeAmount,
          requiredFeeTokenLabel,
        );
        setStatus(`Checking ${requiredFeeDisplay} creation fee...`);
        const feeBalance = await readTokenBalance(requiredFeeToken, currentPub, currentPub);
        if (feeBalance < requiredFeeAmount) {
          const balanceDisplay = formatCreationFeeDisplay(
            feeBalance,
            requiredFeeTokenLabel,
          );
          throw new Error(
            `Creation fee requires ${requiredFeeDisplay}. Your wallet has ${balanceDisplay}. XLM only covers network fees and account reserves.`,
          );
        }
        const currentAllowance = await readTokenAllowance(
          requiredFeeToken,
          currentPub,
          ARKA_FACTORY,
          currentPub,
        );
        if (currentAllowance < requiredFeeAmount) {
          setStatus(`Approving ${requiredFeeDisplay} creation fee...`);
          const approveXdr = await buildTokenApprove(
            currentPub,
            requiredFeeToken,
            ARKA_FACTORY,
            requiredFeeAmount,
          );
          const approveSignedXdr = await signXdr(kit, approveXdr);
          const approveHash = await submitSigned(approveSignedXdr);
          await waitForSorobanTx(approveHash);
        }
        setStatus(`Confirming ${requiredFeeDisplay} creation fee approval...`);
        await waitForCreationFeeAllowance(
          currentPub,
          requiredFeeToken,
          requiredFeeAmount,
        );
      }
      const saltHex = crypto
        .getRandomValues(new Uint8Array(32))
        .reduce((seed, byte) => seed + byte.toString(16).padStart(2, "0"), "");
      const denomCid = denominationContract;
      if (!feeValidation.valid) {
        setActiveCreateStep("fees");
        throw new Error(feeValidation.firstError ?? "Invalid fee profile");
      }
      setStatus("Building create transaction...");
      const feeBps = feeValidation.bps;
      const { xdrB64, predictedAddress } = await buildCreateAndInitTx(
        currentPub,
        saltHex,
        denomCid,
        feeBps,
        whitelist,
      );
      setStatus(`Signing create transaction...${predictedAddress ? ` - Arka: ${predictedAddress}` : ""}`);
      const signedXdr = await signXdr(kit, xdrB64);
      setStatus(`Submitting create transaction...${predictedAddress ? ` - Arka: ${predictedAddress}` : ""}`);
      const hash = await submitSigned(signedXdr);
      setCreatedArkaTxHash(hash);
      setStatus(`Create & init submitted: ${hash}${predictedAddress ? ` - Arka: ${predictedAddress}` : ""}`);
      if (predictedAddress) setCreatedArkaId(predictedAddress);
      else await waitForSorobanTx(hash, 90000);
      setStatus(
        `Create & init confirmed: ${hash}${predictedAddress ? ` - Arka: ${predictedAddress}` : ""} - ${createSummary.nextStep}`,
      );
      if (predictedAddress) {
        await saveCreatedIdentity(predictedAddress, currentPub);
        setSuccessDialogOpen(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
      setStatus("");
    }
  };

  const activeStep = getCreateWizardStep(activeCreateStep);
  const { previousStep, nextStep } = getCreateStepNavigation(activeCreateStep);
  const goToStep = (stepId: CreateWizardStepId) => setActiveCreateStep(stepId);
  const goBack = () => {
    if (previousStep) setActiveCreateStep(previousStep.id);
  };
  const goNext = () => {
    if (nextStep) setActiveCreateStep(nextStep.id);
  };
  const stepReadiness = deriveCreateStepReadiness({
    hasWallet: createSummary.hasWallet,
    hasDenomination: createSummary.hasDenomination,
    whitelistCount: whitelist.length,
    hasRouter: createSummary.hasRouter,
    feesValid: feeValidation.valid,
    feeError: feeValidation.firstError,
    createdArkaId: createSummary.createdArkaId,
  });
  const stepperRows = buildCreateStepperRows({
    activeStep: activeCreateStep,
    readiness: stepReadiness,
    createdArkaId: createSummary.createdArkaId,
  });
  const progressSummary = summarizeCreateWizardProgress(stepReadiness);
  const activeStepReadiness = stepReadiness[activeCreateStep];
  const canSubmitCreate = !MANAGED_CREATION && assetCatalogState === "ready" && !UX_REVIEW_PREVIEW && createSummary.isReady && feeValidation.valid && creationFeeState === "ready";
  const visualStages = buildCreateWizardVisualStages(stepperRows);
  const connectCreateWallet = async () => {
    setError("");
    setWalletConnectBusy(true);
    try {
      const activeKit = kit ?? getWalletsKit(["FREIGHTER", "ALBEDO", "XBULL"]);
      if (!kit) {
        setKit(activeKit);
      }
      const connectedPubkey = await connectWallet(activeKit);
      const normalized = normalizeWalletPubkey(connectedPubkey);
      if (!normalized) {
        throw new Error("Cannot retrieve wallet public key");
      }
      walletAutoHydrationPausedRef.current = false;
      setPubKey(normalized);
      try {
        window.localStorage.setItem("wallet:pubkey", normalized);
        window.dispatchEvent(
          new CustomEvent("wallet:pubkey-changed", { detail: normalized }),
        );
      } catch {}
    } catch (event) {
      setError(event instanceof Error ? event.message : "Wallet connection failed");
    } finally {
      setWalletConnectBusy(false);
    }
  };

  const renderWalletStartStep = (): ReactNode => (
    <section className="create-step-surface create-start-grid" data-testid="create-start-panel">
      <article className="create-start-card create-start-card-primary">
        <div>
          <div className="surface-entry-title">Prepare your Arka</div>
          <p className="surface-note">
            You can prepare a draft without connecting. Your wallet is needed to sign creation. Drafting does not move any funds.
          </p>
        </div>
        <div className="create-wallet-card-grid" aria-label="Supported wallet options">
          {[
            { label: "Freighter", detail: "Primary Stellar wallet" },
            { label: "Albedo", detail: "Alternative Stellar wallet" },
            { label: "xBull", detail: "Stellar wallet support" },
          ].map((wallet) => (
            <div
              className="create-wallet-choice-card"
              data-testid={`create-wallet-choice-${wallet.label.toLowerCase()}`}
              key={wallet.label}
            >
              <span className="create-wallet-choice-icon" aria-hidden="true" />
              <strong>{wallet.label}</strong>
              <span>{wallet.detail}</span>
            </div>
          ))}
        </div>
        <div className="ops-action-row create-wallet-start-actions">
          <button
            type="button"
            className="surface-button surface-button-primary"
            data-testid="create-wallet-connect-button"
            onClick={connectCreateWallet}
            disabled={walletConnectBusy || UX_REVIEW_PREVIEW}
          >
            {walletConnectBusy ? "Connecting wallet" : pubKey ? "Reconnect wallet" : "Connect wallet"}
          </button>
          <button
            type="button"
            className="surface-button surface-button-secondary"
            data-testid="create-wallet-continue-button"
            onClick={() => goToStep("basics")}
          >
            Continue to basics
          </button>
        </div>
      </article>
      <article className="create-start-card">
        <div className="surface-table-hint">Wallet</div>
        <div className="surface-entry-title" data-testid="create-arka-wallet">
          {pubKey || "Offline"}
        </div>
        <p className="surface-note">
          {pubKey
            ? "This wallet will manage and sign the new Arka."
            : "Connect a wallet before signing the final review transaction."}
        </p>
        <div className="surface-chip-wrap">
          <StatusPill
            label={pubKey ? "Connected" : "Wallet required"}
            tone={pubKey ? "positive" : "warning"}
          />
        </div>
      </article>
    </section>
  );

  const assetLoadStatus = assetCatalogState === "error" ? (
    <div className="create-asset-status">
      <p role="alert">{MANAGED_CREATION ? "Creation template unavailable." : "Asset catalog unavailable."}</p>
      <button type="button" className="surface-button surface-button-secondary" onClick={() => {
        setAssetCatalogState("loading");
        setAssetCatalogAttempt(attempt => attempt + 1);
      }}>Retry</button>
    </div>
  ) : assetCatalogState === "loading" ? <p role="status">Checking available assets…</p>
    : assetOptions.length === 0 ? <p role="status">No assets are listed for creation.</p> : null;

  const renderBasicsStep = (): ReactNode => (
    <section className="create-step-surface" data-testid="create-profile-panel">
      <div className="create-stage-banner create-stage-banner-soft" data-testid="create-basics-payload-banner">
        <span className="create-stage-banner-icon" aria-hidden="true">
          ◆
        </span>
        <div>
          Choose how deposits are valued and which assets this Arka may hold.
        </div>
      </div>
      <ActionField
        label="Arka public name"
        htmlFor="create-arka-display-name"
        hint="Shown in Discover, the Arka profile and manager pages."
        span
      >
        <input
          id="create-arka-display-name"
          data-testid="create-arka-display-name"
          className="ops-input"
          value={identityDraft.displayName}
          onChange={(event) =>
            setIdentityDraft({ ...identityDraft, displayName: event.target.value })
          }
          placeholder="e.g. Stellar Growth Arka"
          maxLength={IDENTITY_FIELD_LIMITS.displayName}
        />
        <span className="surface-table-subtle create-character-counter">
          {identityDraft.displayName.length}/{IDENTITY_FIELD_LIMITS.displayName}
        </span>
      </ActionField>
      <ActionField
        label="Short summary"
        htmlFor="create-arka-description"
        hint="Shown on the Arka profile so investors understand the mandate before depositing."
        span
      >
        <textarea
          id="create-arka-description"
          data-testid="create-arka-description"
          className="ops-textarea"
          value={identityDraft.description}
          onChange={(event) =>
            setIdentityDraft({ ...identityDraft, description: event.target.value })
          }
          placeholder="A concise introduction shown in listings and profile headers."
          maxLength={IDENTITY_FIELD_LIMITS.description}
          rows={2}
        />
        <span className="surface-table-subtle create-character-counter">
          {identityDraft.description.length}/{IDENTITY_FIELD_LIMITS.description}
        </span>
      </ActionField>
      <details className="ux-create-profile-details" data-testid="create-optional-profile">
      <summary>Strategy, risks & manager profile <span>(optional — editable later)</span></summary>
      <p className="surface-note">Publish these details before inviting depositors. A target return is not a guarantee.</p>
      <ActionField
        label="Strategy"
        htmlFor="create-arka-strategy"
        hint="Explain how the portfolio will be managed and where it may allocate capital."
        span
      >
        <textarea
          id="create-arka-strategy"
          data-testid="create-arka-strategy"
          className="ops-textarea"
          value={identityDraft.strategy}
          onChange={(event) =>
            setIdentityDraft({ ...identityDraft, strategy: event.target.value })
          }
          maxLength={IDENTITY_FIELD_LIMITS.strategy}
          rows={5}
        />
        <span className="surface-table-subtle create-character-counter">
          {identityDraft.strategy.length}/{IDENTITY_FIELD_LIMITS.strategy}
        </span>
      </ActionField>
      <ActionField
        label="Risk disclosure"
        htmlFor="create-arka-risk"
        hint="Explain the main risks investors should consider before depositing."
        span
      >
        <textarea
          id="create-arka-risk"
          data-testid="create-arka-risk"
          className="ops-textarea"
          value={identityDraft.riskDisclosure}
          onChange={(event) =>
            setIdentityDraft({ ...identityDraft, riskDisclosure: event.target.value })
          }
          maxLength={IDENTITY_FIELD_LIMITS.riskDisclosure}
          rows={4}
        />
        <span className="surface-table-subtle create-character-counter">
          {identityDraft.riskDisclosure.length}/{IDENTITY_FIELD_LIMITS.riskDisclosure}
        </span>
      </ActionField>
      <ActionField
        label="Target return"
        htmlFor="create-arka-target-return"
        hint="Optional target and the conditions that may affect it."
        span
      >
        <textarea
          id="create-arka-target-return"
          data-testid="create-arka-target-return"
          className="ops-textarea"
          value={identityDraft.targetReturn}
          onChange={(event) =>
            setIdentityDraft({ ...identityDraft, targetReturn: event.target.value })
          }
          maxLength={IDENTITY_FIELD_LIMITS.targetReturn}
          rows={2}
        />
        <span className="surface-table-subtle create-character-counter">
          {identityDraft.targetReturn.length}/{IDENTITY_FIELD_LIMITS.targetReturn}
        </span>
      </ActionField>
      <ActionField
        label="Manager public name"
        htmlFor="create-manager-display-name"
        hint="Shown instead of the wallet address when this manager appears publicly."
        span
      >
        <input
          id="create-manager-display-name"
          data-testid="create-manager-display-name"
          className="ops-input"
          value={managerIdentityName}
          onChange={(event) => setManagerIdentityName(event.target.value)}
          placeholder="e.g. Jordi Viladiu"
          maxLength={IDENTITY_FIELD_LIMITS.displayName}
        />
        <span className="surface-table-subtle create-character-counter">
          {managerIdentityName.length}/{IDENTITY_FIELD_LIMITS.displayName}
        </span>
      </ActionField>
      <ActionField
        label="Manager profile"
        htmlFor="create-manager-description"
        hint="Optional public note about the manager's operating style, process and expected return language."
        span
      >
        <textarea
          id="create-manager-description"
          data-testid="create-manager-description"
          className="ops-textarea"
          value={managerIdentityDescription}
          onChange={(event) => setManagerIdentityDescription(event.target.value)}
          placeholder="Describe the manager profile, process, risk discipline and return target language."
          maxLength={IDENTITY_FIELD_LIMITS.description}
          rows={3}
        />
        <span className="surface-table-subtle create-character-counter">
          {managerIdentityDescription.length}/{IDENTITY_FIELD_LIMITS.description}
        </span>
      </ActionField>
      </details>
      {prefillNotice ? (
        <div className="create-prefill-notice" data-testid="create-arka-prefill-notice">
          <StatusPill label="Prefilled" tone="positive" />
          <span>{prefillNotice}</span>
        </div>
      ) : null}
      {assetLoadStatus}
      {assetOptions.length > 0 ? <div className="create-asset-selection-grid">
        <section
          id="create-denomination-panel"
          className="create-asset-panel"
          data-testid="create-arka-denomination-panel"
        >
          <div className="create-asset-panel-head">
            <div>
              <div className="surface-entry-title">Denomination asset</div>
              <p className="surface-note">
                Choose the asset used to value the fund and pay withdrawals.
              </p>
            </div>
          </div>
          <label className="ops-field create-denomination-select-field">
            <span className="ops-field-label">Denomination</span>
            <select
              className="ops-select"
              data-testid="create-arka-denomination-select"
              value={denominationContract}
              disabled={MANAGED_CREATION}
              onChange={(event) => setSelectedDenomination(event.target.value)}
            >
              {!denominationContract ? <option value="">Select a denomination</option> : null}
              {assetOptions.filter(asset => !MANAGED_CREATION || asset.contract === denominationContract).map((asset) => (
                  <option key={asset.contract} value={asset.contract}>
                    {assetLabelCounts.get(asset.label) === 1 ? asset.label : `${asset.label} · ${formatContractLabel(asset.contract, 5, 4)}`}
                  </option>
                ))}
            </select>
          </label>
          <div className="surface-note" data-testid="create-arka-denom-summary">
            {denominationContract ? `Portfolio value and withdrawals use ${selectedDenominationLabel}.` : "Select the asset used for valuation and withdrawals."}
          </div>
        </section>

        <section
          id="create-whitelist-panel"
          className="create-asset-panel"
          data-testid="create-arka-whitelist-panel"
        >
          <div className="create-asset-panel-head">
            <div>
              <div className="surface-entry-title">Allowed assets</div>
              <p className="surface-note">
                Choose the supported assets this Arka may hold. Inclusion does not guarantee a deposit or swap is available.
              </p>
            </div>
            <StatusPill label={`${whitelist.length} selected`} tone="neutral" />
          </div>
          <ActionField
            label="Search allowed assets"
            htmlFor="create-arka-asset-search"
            hint="Filter the supported assets below."
            span
          >
            <div className="create-asset-search-row">
              <input
                ref={assetSearchInputRef}
                id="create-arka-asset-search"
                data-testid="create-arka-asset-search"
                className="ops-input"
                defaultValue={assetSearch}
                onChange={(event) => updateAssetSearch(event.target.value)}
                onInput={(event) => updateAssetSearch(event.currentTarget.value)}
                placeholder="Search asset name or symbol"
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
              />
              {assetSearch ? (
                <button
                  type="button"
                  className="surface-button surface-button-secondary"
                  data-testid="create-arka-clear-asset-search"
                  onClick={() => updateAssetSearch("", true)}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </ActionField>
          <div className="create-asset-option-grid">
            {filteredAssets.map((asset) => {
              const selected = asset.contract ? whitelist.includes(asset.contract) : false;
              const lockedBaseSleeve = asset.contract === denominationContract;
              const exposureLabel = asset.arkaCount !== null && asset.arkaCount > 0
                ? `${asset.arkaCount} ${asset.arkaCount === 1 ? "Arka" : "Arkas"}`
                : null;
              return (
                <button
                  key={`whitelist-${asset.key}`}
                  disabled={MANAGED_CREATION || lockedBaseSleeve}
                  type="button"
                  data-testid={`create-arka-whitelist-option-${asset.contract ?? asset.registryId ?? asset.key}`}
                  data-core-asset-id={asset.registryId ?? undefined}
                  data-icon-source={asset.iconSource ?? undefined}
                  data-toml-state={asset.tomlState ?? undefined}
                  className={`create-asset-option-card ${selected ? "create-asset-option-card-active" : ""}`}
                  onClick={() => {
                    if (!asset.contract) return;
                    toggleWhitelistAsset(asset.contract);
                  }}
                >
                  <div className="create-asset-option-main">
                    <AssetMark
                      contract={asset.contract}
                      label={asset.label}
                      size="md"
                      iconUrl={asset.iconUrl}
                      fallbackIconUrl={asset.fallbackIconUrl}
                    />
                    <div className="create-asset-option-copy">
                      <strong>{asset.label}</strong>
                      <span className="surface-table-subtle">
                        {formatContractLabel(asset.contract, 8, 6)}
                      </span>
                    </div>
                  </div>
                  <div className="create-asset-option-meta">
                    <span>
                      {lockedBaseSleeve
                        ? "Denomination"
                        : selected ? "Included" : "Optional"}
                    </span>
                    {exposureLabel ? <span>{exposureLabel}</span> : null}
                  </div>
                </button>
              );
            })}
          </div>
          {filteredAssets.length === 0 ? (
            <div className="surface-note" data-testid="create-arka-whitelist-empty">
              No assets match the current search.
            </div>
          ) : null}
          <div className="surface-note" data-testid="create-arka-whitelist-summary">
            Allowed asset set: {selectedWhitelistLabel}
          </div>
        </section>
      </div> : null}
    </section>
  );

  const renderFeesStep = (): ReactNode => (
    <section className="create-step-surface" data-testid="create-fees-panel">
      <div className="create-assistant-form-head">
        <div>
          <div className="surface-entry-title">Fee policy</div>
          <p className="surface-note">
            Set the fees investors will see before they deposit.
          </p>
        </div>
        <StatusPill label={creationFeeState !== "ready" ? "Creation fee not verified" : createSummary.feeRequired ? "Creation fee enabled" : "No creation fee"} tone="neutral" />
      </div>
      <div className="ops-form-grid">
        <p className="surface-note ops-field-span" data-testid="create-fee-live-status">Creation fee: {creationFeeDisplay}. Network fees are additional. {creationFeeState === "error" ? <button type="button" className="surface-table-link" onClick={() => setCreationFeeReadVersion((value) => value + 1)}>Recheck creation fee</button> : null}</p>
        <ActionField
          label="Management fee (%)"
          htmlFor="create-arka-mgmt-input"
          hint="Annual fee on the fund value, accrued over time. This is not a one-off deposit fee."
          error={feeValidation.fields.mgmt.error ?? undefined}
        >
          <input
            id="create-arka-mgmt-input"
            data-testid="create-arka-mgmt-input"
            className="ops-input"
            value={feesPct.mgmt}
            onChange={(event) => setFeesPct({ ...feesPct, mgmt: event.target.value })}
            placeholder="e.g. 2.0"
            inputMode="decimal"
          />
        </ActionField>
        <ActionField
          label="Performance fee (%)"
          htmlFor="create-arka-perf-input"
          hint="A share of eligible profits, not a percentage of all capital deposited."
          error={feeValidation.fields.perf.error ?? undefined}
        >
          <input
            id="create-arka-perf-input"
            data-testid="create-arka-perf-input"
            className="ops-input"
            value={feesPct.perf}
            onChange={(event) => setFeesPct({ ...feesPct, perf: event.target.value })}
            placeholder="e.g. 20"
            inputMode="decimal"
          />
        </ActionField>
        <ActionField
          label="Deposit fee (%)"
          htmlFor="create-arka-deposit-input"
          hint="One-off fee when an investor deposits. Set 0 for no deposit fee."
          error={feeValidation.fields.dep.error ?? undefined}
        >
          <input
            id="create-arka-deposit-input"
            data-testid="create-arka-deposit-input"
            className="ops-input"
            value={feesPct.dep}
            onChange={(event) => setFeesPct({ ...feesPct, dep: event.target.value })}
            placeholder="e.g. 0"
            inputMode="decimal"
          />
        </ActionField>
        <ActionField
          label="Withdrawal fee (%)"
          htmlFor="create-arka-redeem-input"
          hint="One-off fee when an investor withdraws by redeeming shares. Set 0 for no withdrawal fee."
          error={feeValidation.fields.red.error ?? undefined}
        >
          <input
            id="create-arka-redeem-input"
            data-testid="create-arka-redeem-input"
            className="ops-input"
            value={feesPct.red}
            onChange={(event) => setFeesPct({ ...feesPct, red: event.target.value })}
            placeholder="e.g. 0.5"
            inputMode="decimal"
          />
        </ActionField>
      </div>
      <TransactionReviewCard
        title="Fee summary"
        body="Review the percentages that will apply to this Arka."
        bullets={[
          `Management ${feesPct.mgmt || "0"}%`,
          `Performance ${feesPct.perf || "0"}%`,
          `Deposit ${feesPct.dep || "0"}%`,
          `Redemption ${feesPct.red || "0"}%`,
        ]}
        tone="neutral"
      />
    </section>
  );

  const renderAssetsManagementStep = (): ReactNode => (
    <section className="create-step-surface" data-testid="create-assets-management-panel">
      <div className="create-assistant-form-head">
        <div>
          <div className="surface-entry-title">After creation</div>
          <p className="surface-note">
            Choose the first workspace to open.
          </p>
        </div>
        <StatusPill label={`${whitelist.length} allowed assets`} tone="positive" />
      </div>
      <ManagedContextHelp icon label="About the first workspace" title="Your first workspace"><p>This only selects the next screen. Creating an Arka does not supply, borrow or swap funds. All other workspaces remain available afterwards.</p></ManagedContextHelp>
      <TransactionReviewCard
        title="Arka setup"
        body="Your denomination and allowed assets are already selected. You can change the selection before creating the Arka."
        bullets={[
          `Denomination: ${selectedDenominationLabel}`,
          `Allowed assets: ${selectedWhitelistLabel}`,
          setupIntent === "BLEND" ? "Open after creation: Blend" : "Open after creation: Swaps",
        ]}
        tone="neutral"
      />
      <div className="ops-action-row">
        <button
          type="button"
          className="surface-button surface-button-secondary"
          onClick={() => goToStep("basics")}
        >
          Edit allowed assets
        </button>
      </div>
      <ActionField
        label="Open after creation"
        htmlFor="create-arka-setup-intent"

        span
      >
        <select
          id="create-arka-setup-intent"
          data-testid="create-arka-setup-intent"
          className="ops-select"
          value={setupIntent}
          onChange={(event) => setSetupIntent(event.target.value as SetupIntent)}
        >
          <option value="REBALANCE">Swaps and rebalancing</option>
          <option value="BLEND">Blend</option>
        </select>
      </ActionField>
    </section>
  );

  const renderReviewStep = (): ReactNode => (
    <section className="create-step-surface create-review-grid" data-testid="create-review-panel">
      <article className="create-assistant-launch-card" data-testid="create-actions-table">
        <div className="create-assistant-form-head">
          <div className="surface-entry-title">Create Arka</div>
          <StatusPill label={UX_REVIEW_PREVIEW ? "Preview" : canSubmitCreate ? "Ready to create" : "Incomplete"} tone={canSubmitCreate ? "positive" : "neutral"} />
        </div>
        {!UX_REVIEW_PREVIEW ? <p className="surface-note">Review the setup and confirm it in your wallet.</p> : null}
        <TransactionReviewCard
          title="Your Arka"
          body={UX_REVIEW_PREVIEW ? "" : "Review the denomination, fees and allowed assets, then confirm the transaction in your wallet."}
          bullets={createReviewBullets}
          tone={createSummary.isReady ? "positive" : "warning"}
          testId="create-arka-review-card"
        />
        {assetLoadStatus}
        {MANAGED_CREATION && denominationContract && feeValidation.valid ? (
          <V3DefaultCreationReview draft={{creatorPubKey:pubKey,denominationContract,fees:feeValidation.bps,whitelistContracts:whitelist,routerId}}/>
        ) : null}
        {!MANAGED_CREATION ? <>
        <div className="ops-action-row">
          <button
            data-testid="create-arka-submit-button"
            className="surface-button surface-button-primary"
            disabled={!canSubmitCreate}
            title={
              UX_REVIEW_PREVIEW ? "Creating an Arka is disabled in this review preview." : !createSummary.isReady
                ? "Wallet, router and denomination are required before creation."
                : feeValidation.firstError ?? "Open create confirmation"
            }
            onClick={() => {
              if (!canSubmitCreate) return;
              setConfirmCreate(true);
            }}
          >
            Create Arka
          </button>
        </div>
        {!canSubmitCreate ? (
          <p className="ops-field-error" data-testid="create-submit-blocker">
            {UX_REVIEW_PREVIEW ? "Creation is disabled in this preview." : creationFeeState !== "ready" ? "The creation fee has not been verified. Recheck before signing." : feeValidation.firstError ??
              "Wallet, router and denomination are required before creation."}
          </p>
        ) : null}
        </>:null}
      </article>

      {createdArkaId || status || error || identitySaveStatus ? <article className="create-assistant-result-card" data-testid="create-arka-result">
        <div className="create-assistant-form-head">
          <div className="surface-entry-title">
            {createdArkaId ? "Created Arka" : "Confirmation"}
          </div>
          <StatusPill label={createdArkaId ? "Created" : "Waiting for creation"} tone={createdArkaId ? "positive" : "neutral"} />
        </div>
        <p className="surface-note">
          Confirmation and links will appear here after the wallet transaction succeeds.
        </p>
        <TransactionFeedbackRail
          loading={
            status.toLowerCase().includes("preparing") ||
            status.toLowerCase().includes("approving") ||
            status.toLowerCase().includes("building") ||
            status.toLowerCase().includes("signing") ||
            status.toLowerCase().includes("submitting")
          }
          loadingLabel={status || "Preparing create & init..."}
          status={status && status.toLowerCase().includes("confirmed") ? status : ""}
          error={error}
          statusTestId="create-arka-status"
          errorTestId="create-arka-error"
        />
        {identitySaveStatus ? (
          <div
            className={`transaction-rail-card ${
              identitySaveError ? "transaction-rail-card-error" : "transaction-rail-card-success"
            }`}
            data-testid="create-arka-identity-status"
            role="status"
          >
            <div className="transaction-rail-copy">
              <span className="transaction-rail-label">Public profile</span>
              <strong className="transaction-rail-value">{identitySaveStatus}</strong>
              {identitySaveError ? (
                <span className="surface-note">{identitySaveError}</span>
              ) : null}
            </div>
          </div>
        ) : null}
        {createdArkaId ? (
          <>
            <div className="surface-note ops-mono" data-testid="create-arka-created-id">
              {createdArkaId}
            </div>
            <div className="ops-action-row">
              <Link
                href={`/vaults/${createdArkaId}`}
                className="surface-button surface-button-secondary"
                data-testid="create-arka-profile-link"
              >
                Open Arka profile
              </Link>
              <Link
                href={`/arkas/${createdArkaId}`}
                className="surface-button surface-button-primary"
                data-testid="create-arka-open-link"
              >
                Open Arka actions
              </Link>
            </div>
          </>
        ) : null}
      </article> : null}
    </section>
  );

  const renderActiveCreateStep = (): ReactNode => {
    switch (activeCreateStep) {
      case "start":
        return renderWalletStartStep();
      case "basics":
        return renderBasicsStep();
      case "fees":
        return renderFeesStep();
      case "deposits":
      case "redemptions":
        return renderFeesStep();
      case "assets":
        return renderAssetsManagementStep();
      case "review":
        return renderReviewStep();
    }
  };

  return (
    <main
      className={`surface-stack create-assistant-shell create-assistant-step-${activeCreateStep}`}
      data-create-step={activeCreateStep}
    >
      <section className="create-assistant-layout">
        <section className="create-assistant-main">
          <header className="create-assistant-header create-assistant-active-header">
            <div>
              <span className="surface-eyebrow">Create Arka</span>
              <h2 className="create-stage-title create-active-stage-heading">
                {activeStep.label}
              </h2>
              <p className="surface-description create-stage-description">
                {activeStep.detail}
              </p>
            </div>
            <div className="surface-chip-wrap create-stage-tabs">
              <StatusPill label={setupIntent === "BLEND" ? "Blend" : "Swaps"} tone="neutral" />
            </div>
          </header>

          <section className="create-assistant-canvas">
            <div className="create-assistant-tabline">
              <h2 className="create-assistant-tab" id="create-stage-heading">{activeStep.label}</h2>
              <span className="create-assistant-tab-meta">{activeStep.detail}</span>
              <span className="create-assistant-progress-pill" data-testid="create-progress-summary">
                Step {visualStages.findIndex((step) => step.id === activeCreateStep) + 1} of {visualStages.length}
              </span>
            </div>

            {!activeStepReadiness.ready && !UX_REVIEW_PREVIEW ? (
              <div
                className="create-step-blocker"
                role="status"
                data-testid="create-step-blocker"
              >
                <StatusPill label="Complete this step" tone="warning" />
                <span>{activeStepReadiness.reason}</span>
              </div>
            ) : null}

            {!progressSummary.readyForSignature && activeStepReadiness.ready && !UX_REVIEW_PREVIEW ? (
              <div
                className="create-step-blocker create-step-blocker-soft"
                role="status"
                data-testid="create-progress-next-blocker"
              >
                <StatusPill label="Next step" tone="neutral" />
                <span>
                  {progressSummary.nextBlockingStep?.label}: {progressSummary.nextBlockingReason}
                </span>
              </div>
            ) : null}

            {renderActiveCreateStep()}

          </section>
        </section>

        <aside className="create-stepper-rail" data-testid="create-stepper-rail">
          <div className="create-stepper-titlebar">
            <div className="surface-table-hint">Creation flow</div>
            <h1 className="create-stepper-title" data-testid="create-page-heading">
              <span>Create your</span> <span>Arka</span>
            </h1>
            <p className="surface-note create-stepper-copy">
              Complete each step, review the setup and sign from your wallet.
            </p>
          </div>
          <div className="create-stepper-shell">
            <div className="create-stepper-list">
              {visualStages.map((step) => (
                <button
                  type="button"
                  key={step.id}
                  className={`create-stepper-item create-stepper-item-${step.state}`}
                  data-testid={`create-step-${step.id}`}
                  aria-current={step.state === "current" ? "step" : undefined}
                  aria-label={step.ariaLabel}
                  title={step.blockingReason ?? step.detail}
                  disabled={!wizardInteractive}
                  onClick={() => goToStep(step.id)}
                >
                  <div className="create-stepper-bullet" aria-hidden="true">
                    {step.state === "done" ? "✓" : step.state === "current" ? step.ordinal : ""}
                  </div>
                  <div className="create-stepper-content">
                    <div className="create-stepper-label-row">
                      <span className="create-stepper-label">{step.label}</span>
                      <span
                        className={`create-stepper-state create-stepper-state-${step.connectorState}`}
                        data-testid={`create-step-state-${step.id}`}
                      >
                        {step.statusLabel}
                      </span>
                    </div>
                    <div className="surface-note">{step.detail}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="create-stepper-progress" data-testid="create-stepper-progress">
              <div className="create-stepper-progress-meta">
                <span>Setup checks</span>
                <strong>{progressSummary.percent}%</strong>
              </div>
              <div className="create-stepper-progress-track" aria-hidden="true">
                <span style={{ width: `${progressSummary.percent}%` }} />
              </div>
              <p className="surface-note">
                {UX_REVIEW_PREVIEW ? "Draft review only. Creation and signing are disabled." : progressSummary.readyForSignature
                  ? "All steps are complete. You can review and create the Arka."
                  : `${progressSummary.nextBlockingStep?.label}: ${progressSummary.nextBlockingReason}`}
              </p>
            </div>

            <div className="create-stepper-actions">
              <button
                type="button"
                className="surface-button surface-button-secondary"
                onClick={previousStep ? goBack : undefined}
                disabled={!wizardInteractive || !previousStep}
                data-testid="create-step-back"
              >
                Back
              </button>
              <button
                type="button"
                className="surface-button surface-button-primary"
                onClick={nextStep ? goNext : undefined}
                disabled={!wizardInteractive || !nextStep}
                data-testid="create-step-next"
              >
                Next
              </button>
            </div>
          </div>
        </aside>
      </section>
      <TransactionConfirmDialog
        open={confirmCreate}
        title="Create a new Arka"
        body="Check the details below, then confirm the creation in your wallet."
        detail={`${whitelist.length} allowed assets · ${setupIntent === "BLEND" ? "Open Blend after creation" : "Open swaps after creation"}.`}
        bullets={createReviewBullets}
        confirmLabel="Create Arka"
        tone={createSummary.isReady ? "positive" : "warning"}
        onCancel={() => setConfirmCreate(false)}
        onConfirm={() => {
          setConfirmCreate(false);
          void submitCreateArka();
        }}
        confirmTestId="create-arka-confirm-button"
        cancelTestId="create-arka-cancel-button"
      />
      <TransactionSuccessDialog
        open={successDialogOpen && Boolean(createdArkaId)}
        title={`${identityDraft.displayName.trim() || "Arka"} created`}
        body="The Arka is available. You can open the public profile or go directly to the execution page."
        detailRows={[
          {
            label: "Arka address",
            value: createdArkaId,
          },
          {
            label: "Manager",
            value: pubKey || "Connected wallet",
          },
          {
            label: "Transaction",
            value: createdArkaTxHash || "Submitted",
          },
          {
            label: "Public profile",
            value: identitySaveStatus || "Ready",
          },
        ]}
        primaryLabel="Open execution page"
        secondaryLabel="Open Arka profile"
        primaryTestId="create-arka-success-open-actions"
        secondaryTestId="create-arka-success-open-profile"
        onClose={() => setSuccessDialogOpen(false)}
        onSecondary={() => {
          setSuccessDialogOpen(false);
          router.push(`/vaults/${createdArkaId}`);
        }}
        onPrimary={() => {
          setSuccessDialogOpen(false);
          router.push(`/arkas/${createdArkaId}`);
        }}
      />
    </main>
  );
}
