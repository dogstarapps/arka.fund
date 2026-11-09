import {
  buildGovernedActionPackage,
  GOVERNED_COMPOSER_DRAFT_QUERY,
  GOVERNED_ACTION_TEMPLATES,
  type GovernedActionPackage,
} from "@/lib/workflows/governanceComposer";

export type MigrationInspectionSnapshot = {
  sourceArka: string;
  targetArka: string;
  registryId: string;
  implementationGetterSupported: boolean;
  currentImplementation: string | null;
  registryGetterSupported: boolean;
  currentRegistry: string | null;
  currentShareTokenImplementation: string;
  migratedTo: string | null;
  migratedFrom: string | null;
  sourceShareToken: string | null;
  targetShareToken: string | null;
};

export type MigrationPreflightRow = {
  id: string;
  label: string;
  value: string;
  detail: string;
  state: string;
  tone: "positive" | "warning" | "neutral";
};

export type MigrationSpotlight = {
  id: string;
  label: string;
  value: string;
  meta: string;
  state: string;
  tone: "positive" | "warning" | "neutral";
  stripPct: number;
};

export type MigrationPlanInput = {
  factoryId: string;
  sourceArka: string;
  targetArka: string;
  registryId: string;
  implementationHash: string;
  shareTokenImplementationHash: string;
};

export type MigrationVerificationRow = {
  id: string;
  label: string;
  current: string;
  expected: string;
  detail: string;
  state: string;
  tone: "positive" | "warning" | "neutral";
};

export type MigrationDryRunRow = {
  id: string;
  label: string;
  current: string;
  expected: string;
  detail: string;
  state: string;
  tone: "positive" | "warning" | "neutral";
};

export type MigrationGovernanceBundleEntry = {
  id: MigrationGovernanceActionId;
  title: string;
  method: string;
  status: string;
  tone: "positive" | "warning" | "neutral";
  detail: string;
  pkg: GovernedActionPackage | null;
};

export type MigrationGovernanceActionId =
  | "factory-implementation"
  | "factory-share-token-implementation"
  | "factory-registry-binding";

export type MigrationGovernanceHandoffState = {
  enabled: boolean;
  href: string | null;
  label: string;
  reason: string;
};

export type MigrationGovernanceBundle = {
  version: 1;
  kind: "migration-governance-bundle";
  generatedAt: string;
  factoryId: string;
  sourceArka: string;
  targetArka: string;
  packages: GovernedActionPackage[];
  entries: MigrationGovernanceBundleEntry[];
  reviewBullets: string[];
};

function compactValue(value: string | null | undefined): string {
  const normalized = value?.trim() ?? "";
  if (!normalized) return "Unavailable";
  if (normalized.length <= 12) return normalized;
  return `${normalized.slice(0, 8)}...${normalized.slice(-4)}`;
}

function sameValue(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left?.trim().toLowerCase() ?? "") === (right?.trim().toLowerCase() ?? "");
}

export function buildMigrationPreflightRows(
  snapshot: MigrationInspectionSnapshot,
): MigrationPreflightRow[] {
  const sourceMapped = Boolean(snapshot.migratedTo?.trim());
  const targetMapped = Boolean(snapshot.migratedFrom?.trim());
  const shareTokenImplReady = Boolean(
    snapshot.currentShareTokenImplementation.trim(),
  );
  const implementationGetterReady = snapshot.implementationGetterSupported;
  const registryGetterReady = snapshot.registryGetterSupported;
  const registryReady = Boolean(snapshot.registryId.trim());

  return [
    {
      id: "source-map",
      label: "Source mapping",
      value: sourceMapped ? compactValue(snapshot.migratedTo) : "Not mapped",
      detail: snapshot.sourceArka.trim()
        ? "Factory migrated_to(source) inspection."
        : "Provide a source Arka to inspect existing migration state.",
      state: sourceMapped ? "Mapped" : "Clear",
      tone: sourceMapped ? "warning" : "positive",
    },
    {
      id: "target-map",
      label: "Target mapping",
      value: targetMapped ? compactValue(snapshot.migratedFrom) : "Not mapped",
      detail: snapshot.targetArka.trim()
        ? "Factory migrated_from(target) inspection."
        : "Provide a target Arka to inspect reverse mapping state.",
      state: targetMapped ? "Mapped" : "Clear",
      tone: targetMapped ? "warning" : "positive",
    },
    {
      id: "factory-implementation",
      label: "Factory implementation",
      value: implementationGetterReady
        ? compactValue(snapshot.currentImplementation)
        : "Getter unavailable",
      detail: implementationGetterReady
        ? "Factory get_implementation() is readable for post-check alignment."
        : "Factory get_implementation() is not exposed in the current runtime.",
      state: implementationGetterReady ? "Readable" : "Unavailable",
      tone: implementationGetterReady ? "positive" : "warning",
    },
    {
      id: "registry-binding",
      label: "Registry binding",
      value: registryGetterReady
        ? compactValue(snapshot.currentRegistry)
        : compactValue(snapshot.registryId),
      detail: registryGetterReady
        ? "Factory get_registry() is readable for post-execution verification."
        : registryReady
          ? "Registry target ready for governance packaging, but runtime getter is unavailable."
          : "Registry contract is missing from the migration plan.",
      state: registryGetterReady ? "Readable" : registryReady ? "Plan only" : "Missing",
      tone: registryGetterReady ? "positive" : "warning",
    },
    {
      id: "share-token-implementation",
      label: "Share-token implementation",
      value: compactValue(snapshot.currentShareTokenImplementation),
      detail: shareTokenImplReady
        ? "Current canonical share-token implementation is readable."
        : "Implementation hash not loaded yet.",
      state: shareTokenImplReady ? "Loaded" : "Missing",
      tone: shareTokenImplReady ? "positive" : "warning",
    },
    {
      id: "source-share-token",
      label: "Source share token",
      value: compactValue(snapshot.sourceShareToken),
      detail: snapshot.sourceArka.trim()
        ? "Factory share_token_of(source) inspection."
        : "Awaiting source Arka input.",
      state: snapshot.sourceShareToken ? "Loaded" : "Unknown",
      tone: snapshot.sourceShareToken ? "positive" : "neutral",
    },
    {
      id: "target-share-token",
      label: "Target share token",
      value: compactValue(snapshot.targetShareToken),
      detail: snapshot.targetArka.trim()
        ? "Factory share_token_of(target) inspection."
        : "Awaiting target Arka input.",
      state: snapshot.targetShareToken ? "Loaded" : "Unknown",
      tone: snapshot.targetShareToken ? "positive" : "neutral",
    },
  ];
}

export function buildMigrationSpotlights(
  rows: MigrationPreflightRow[],
): MigrationSpotlight[] {
  const readyCount = rows.filter((row) => row.tone === "positive").length;
  const warningCount = rows.filter((row) => row.tone === "warning").length;

  return [
    {
      id: "migration-ready",
      label: "Preflight",
      value: `${readyCount}/${rows.length} ready`,
      meta: "Current migration checks already resolved from the active plan.",
      state: warningCount > 0 ? "Review" : "Ready",
      tone: warningCount > 0 ? "warning" : "positive",
      stripPct: warningCount > 0 ? 58 : 92,
    },
    {
      id: "migration-maps",
      label: "Mapping posture",
      value: rows
        .filter((row) => row.id === "source-map" || row.id === "target-map")
        .map((row) => row.state)
        .join(" / "),
      meta: "Shows whether source/target mappings are already populated in factory state.",
      state: warningCount > 0 ? "Inspect" : "Clear",
      tone: warningCount > 0 ? "warning" : "positive",
      stripPct: warningCount > 0 ? 47 : 86,
    },
    {
      id: "migration-governance",
      label: "Governance handoff",
      value: "Composer-ready",
      meta: "Implementation, share-token implementation and registry binding can be handed off to governance authoring.",
      state: "Operator lane",
      tone: "neutral",
      stripPct: 74,
    },
  ];
}

export function buildMigrationVerificationRows(
  snapshot: MigrationInspectionSnapshot,
  plan: MigrationPlanInput,
): MigrationVerificationRow[] {
  const rows: MigrationVerificationRow[] = [];

  if (plan.implementationHash.trim()) {
    const implementationAligned = snapshot.implementationGetterSupported
      ? sameValue(snapshot.currentImplementation, plan.implementationHash)
      : false;
    rows.push({
      id: "factory-implementation",
      label: "Factory implementation",
      current: snapshot.implementationGetterSupported
        ? compactValue(snapshot.currentImplementation)
        : "Getter unavailable",
      expected: compactValue(plan.implementationHash),
      detail: snapshot.implementationGetterSupported
        ? "Compares the planned factory implementation hash against get_implementation()."
        : "Factory get_implementation() is not available in the current runtime, so direct readback cannot be proven yet.",
      state: snapshot.implementationGetterSupported
        ? implementationAligned
          ? "Aligned"
          : "Pending"
        : "Unverifiable",
      tone: snapshot.implementationGetterSupported
        ? implementationAligned
          ? "positive"
          : "warning"
        : "warning",
    });
  }

  if (plan.sourceArka.trim() && plan.targetArka.trim()) {
    const forwardAligned = sameValue(snapshot.migratedTo, plan.targetArka);
    rows.push({
      id: "forward-map",
      label: "Forward map",
      current: compactValue(snapshot.migratedTo),
      expected: compactValue(plan.targetArka),
      detail: "Checks factory `migrated_to(source)` against the planned target Arka.",
      state: forwardAligned ? "Aligned" : snapshot.migratedTo ? "Mismatch" : "Pending",
      tone: forwardAligned ? "positive" : "warning",
    });

    const reverseAligned = sameValue(snapshot.migratedFrom, plan.sourceArka);
    rows.push({
      id: "reverse-map",
      label: "Reverse map",
      current: compactValue(snapshot.migratedFrom),
      expected: compactValue(plan.sourceArka),
      detail: "Checks factory `migrated_from(target)` against the planned source Arka.",
      state: reverseAligned ? "Aligned" : snapshot.migratedFrom ? "Mismatch" : "Pending",
      tone: reverseAligned ? "positive" : "warning",
    });
  }

  if (plan.shareTokenImplementationHash.trim()) {
    const shareTokenAligned = sameValue(
      snapshot.currentShareTokenImplementation,
      plan.shareTokenImplementationHash,
    );
    rows.push({
      id: "share-token-implementation",
      label: "Share-token implementation",
      current: compactValue(snapshot.currentShareTokenImplementation),
      expected: compactValue(plan.shareTokenImplementationHash),
      detail:
        "Compares the planned share-token implementation hash against the current factory getter.",
      state: shareTokenAligned ? "Aligned" : "Pending",
      tone: shareTokenAligned ? "positive" : "warning",
    });
  }

  if (plan.registryId.trim()) {
    const registryAligned = snapshot.registryGetterSupported
      ? sameValue(snapshot.currentRegistry, plan.registryId)
      : false;
    rows.push({
      id: "registry-binding",
      label: "Registry binding",
      current: snapshot.registryGetterSupported
        ? compactValue(snapshot.currentRegistry)
        : "Getter unavailable",
      expected: compactValue(plan.registryId),
      detail: snapshot.registryGetterSupported
        ? "Compares the planned registry contract against get_registry()."
        : "Factory get_registry() is not available in the current runtime, so this check stays export-only.",
      state: snapshot.registryGetterSupported
        ? registryAligned
          ? "Aligned"
          : "Pending"
        : "Unverifiable",
      tone: snapshot.registryGetterSupported
        ? registryAligned
          ? "positive"
          : "warning"
        : "warning",
    });
  }

  if (plan.sourceArka.trim()) {
    rows.push({
      id: "source-share-token-readback",
      label: "Source share token",
      current: compactValue(snapshot.sourceShareToken),
      expected: "Readable",
      detail: "Operational readback of `share_token_of(source)` after migration planning.",
      state: snapshot.sourceShareToken ? "Loaded" : "Unknown",
      tone: snapshot.sourceShareToken ? "positive" : "neutral",
    });
  }

  if (plan.targetArka.trim()) {
    rows.push({
      id: "target-share-token-readback",
      label: "Target share token",
      current: compactValue(snapshot.targetShareToken),
      expected: "Readable",
      detail: "Operational readback of `share_token_of(target)` after migration planning.",
      state: snapshot.targetShareToken ? "Loaded" : "Unknown",
      tone: snapshot.targetShareToken ? "positive" : "neutral",
    });
  }

  return rows;
}

function statusToTone(
  status: string,
): "positive" | "warning" | "neutral" {
  if (
    status === "Ready to verify" ||
    status === "Already aligned" ||
    status === "Covered"
  ) {
    return "positive";
  }
  if (
    status === "Blocked" ||
    status === "Unverifiable" ||
    status === "Missing plan"
  ) {
    return "warning";
  }
  return "neutral";
}

function buildMigrationBundleEntry(input: {
  id: MigrationGovernanceActionId;
  fieldValues: Record<string, string>;
  detail: string;
  factoryId: string;
}): MigrationGovernanceBundleEntry {
  const template = GOVERNED_ACTION_TEMPLATES.find((entry) => entry.id === input.id);
  if (!template) {
    return {
      id: input.id,
      title: input.id,
      method: "missing_template",
      status: "Missing template",
      tone: "warning",
      detail: "Template is not registered in the governance composer.",
      pkg: null,
    };
  }

  const missingField = template.fields.find(
    (field) => !(input.fieldValues[field.key] ?? "").trim(),
  );
  if (missingField) {
    return {
      id: input.id,
      title: template.title,
      method: template.method,
      status: "Missing input",
      tone: "warning",
      detail: `${input.detail} Missing ${missingField.label.toLowerCase()}.`,
      pkg: null,
    };
  }

  try {
    const pkg = buildGovernedActionPackage({
      template,
      contractId: input.factoryId,
      fieldValues: input.fieldValues,
    });
    return {
      id: input.id,
      title: template.title,
      method: template.method,
      status: "Ready",
      tone: "positive",
      detail: input.detail,
      pkg,
    };
  } catch (error) {
    return {
      id: input.id,
      title: template.title,
      method: template.method,
      status: "Invalid",
      tone: "warning",
      detail:
        error instanceof Error
          ? `${input.detail} ${error.message}`
          : `${input.detail} Package validation failed.`,
      pkg: null,
    };
  }
}

export function deriveMigrationGovernanceHandoffState(
  bundle: MigrationGovernanceBundle,
  actionId: MigrationGovernanceActionId,
): MigrationGovernanceHandoffState {
  const entry = bundle.entries.find((item) => item.id === actionId);
  if (!entry) {
    return {
      enabled: false,
      href: null,
      label: "Missing entry",
      reason: "This migration action is not present in the governance bundle.",
    };
  }

  if (entry.pkg && entry.status === "Ready") {
    return {
      enabled: true,
      href: `/governance/console?draft=${GOVERNED_COMPOSER_DRAFT_QUERY}`,
      label: "Governance ready",
      reason: `${entry.title} is validated and can be opened in the governed composer.`,
    };
  }

  return {
    enabled: false,
    href: null,
    label: entry.status,
    reason: entry.detail,
  };
}

export function buildMigrationGovernanceBundle(
  plan: MigrationPlanInput,
): MigrationGovernanceBundle {
  const entries = [
    buildMigrationBundleEntry({
      id: "factory-implementation",
      fieldValues: {
        impl_wasm_hash: plan.implementationHash,
      },
      detail: "Promote the target Arka implementation hash through the factory governor lane.",
      factoryId: plan.factoryId,
    }),
    buildMigrationBundleEntry({
      id: "factory-share-token-implementation",
      fieldValues: {
        impl_wasm_hash: plan.shareTokenImplementationHash,
      },
      detail: "Promote the target share-token implementation hash through the factory governor lane.",
      factoryId: plan.factoryId,
    }),
    buildMigrationBundleEntry({
      id: "factory-registry-binding",
      fieldValues: {
        registry: plan.registryId,
      },
      detail: "Bind the canonical registry target used for factory-backed discovery.",
      factoryId: plan.factoryId,
    }),
  ];

  const packages = entries.flatMap((entry) => (entry.pkg ? [entry.pkg] : []));

  return {
    version: 1,
    kind: "migration-governance-bundle",
    generatedAt: new Date().toISOString(),
    factoryId: plan.factoryId,
    sourceArka: plan.sourceArka.trim(),
    targetArka: plan.targetArka.trim(),
    packages,
    entries,
    reviewBullets: [
      `Factory: ${plan.factoryId}`,
      `Source Arka: ${plan.sourceArka.trim() || "not provided"}`,
      `Target Arka: ${plan.targetArka.trim() || "not provided"}`,
      `Ready governance packages: ${packages.length}/${entries.length}`,
      "Sequence these through governance in the order shown once the target hashes and registry target are confirmed.",
    ],
  };
}

export function serializeMigrationGovernanceBundle(
  bundle: MigrationGovernanceBundle,
): string {
  return JSON.stringify(bundle, null, 2);
}

export function buildMigrationDryRunRows(input: {
  snapshot: MigrationInspectionSnapshot;
  plan: MigrationPlanInput;
  bundle: MigrationGovernanceBundle;
}): MigrationDryRunRow[] {
  const { snapshot, plan, bundle } = input;
  const getEntry = (
    id: MigrationGovernanceBundleEntry["id"],
  ): MigrationGovernanceBundleEntry | undefined =>
    bundle.entries.find((entry) => entry.id === id);
  const implementationEntry = getEntry("factory-implementation");
  const shareTokenEntry = getEntry("factory-share-token-implementation");
  const registryEntry = getEntry("factory-registry-binding");
  const bundleReady = bundle.packages.length === bundle.entries.length;

  const rows: MigrationDryRunRow[] = [
    {
      id: "bundle-admission",
      label: "Governance bundle",
      current: `${bundle.packages.length}/${bundle.entries.length} ready`,
      expected: "All canonical factory packages ready",
      detail:
        "Checks whether implementation, share-token implementation and registry packages are all valid before governance handoff.",
      state: bundleReady ? "Ready to verify" : "Blocked",
      tone: bundleReady ? "positive" : "warning",
    },
  ];

  if (plan.implementationHash.trim()) {
    const state = !implementationEntry || implementationEntry.status !== "Ready"
      ? "Blocked"
      : !snapshot.implementationGetterSupported
        ? "Unverifiable"
        : sameValue(snapshot.currentImplementation, plan.implementationHash)
          ? "Already aligned"
          : "Ready to verify";
    rows.push({
      id: "implementation-post-check",
      label: "Factory implementation post-check",
      current: snapshot.implementationGetterSupported
        ? compactValue(snapshot.currentImplementation)
        : "Getter unavailable",
      expected: compactValue(plan.implementationHash),
      detail:
        "Uses the package readiness plus factory get_implementation() readback to decide whether the implementation change can be proven after execution.",
      state,
      tone: statusToTone(state),
    });
  }

  if (plan.shareTokenImplementationHash.trim()) {
    const state = !shareTokenEntry || shareTokenEntry.status !== "Ready"
      ? "Blocked"
      : sameValue(
            snapshot.currentShareTokenImplementation,
            plan.shareTokenImplementationHash,
          )
        ? "Already aligned"
        : "Ready to verify";
    rows.push({
      id: "share-token-post-check",
      label: "Share-token implementation post-check",
      current: compactValue(snapshot.currentShareTokenImplementation),
      expected: compactValue(plan.shareTokenImplementationHash),
      detail:
        "Combines the governance package readiness with get_share_token_implementation() so operators know whether the new share-token backend can be proved after execution.",
      state,
      tone: statusToTone(state),
    });
  }

  if (plan.registryId.trim()) {
    const state = !registryEntry || registryEntry.status !== "Ready"
      ? "Blocked"
      : !snapshot.registryGetterSupported
        ? "Unverifiable"
        : sameValue(snapshot.currentRegistry, plan.registryId)
          ? "Already aligned"
          : "Ready to verify";
    rows.push({
      id: "registry-post-check",
      label: "Registry binding post-check",
      current: snapshot.registryGetterSupported
        ? compactValue(snapshot.currentRegistry)
        : "Getter unavailable",
      expected: compactValue(plan.registryId),
      detail:
        "Combines registry package readiness with get_registry() when the factory exposes it, so the post-execution registry binding can be verified without leaving the workspace.",
      state,
      tone: statusToTone(state),
    });
  }

  if (plan.sourceArka.trim() && plan.targetArka.trim()) {
    const mappingsCovered =
      Boolean(snapshot.sourceShareToken) && Boolean(snapshot.targetShareToken);
    rows.push({
      id: "mapping-observability",
      label: "Mapping observability",
      current: `${snapshot.migratedTo ? "forward visible" : "forward pending"} / ${
        snapshot.migratedFrom ? "reverse visible" : "reverse pending"
      }`,
      expected: "Forward and reverse mappings observable after execution",
      detail:
        "Confirms that migrated_to, migrated_from and share_token_of readbacks are available for the source/target pair used in the migration plan.",
      state: mappingsCovered ? "Covered" : "Ready to verify",
      tone: mappingsCovered ? "positive" : "neutral",
    });
  }

  return rows;
}
