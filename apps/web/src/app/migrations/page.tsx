"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ActionField,
  Panel,
  StatusPill,
  SurfaceTable,
  TransactionFeedbackRail,
  TransactionReviewCard,
} from "@/components/product/surfacePrimitives";
import { ARKA_FACTORY, ARKA_REGISTRY } from "@/lib/config";
import {
  buildGovernedComposerDraft,
  GOVERNED_ACTION_TEMPLATES,
  writeGovernedComposerDraft,
} from "@/lib/workflows/governanceComposer";
import {
  buildMigrationWorkspaceState,
  MIGRATION_WORKSPACE_TABS,
  type MigrationWorkspaceId,
} from "@/lib/workflows/operatorWorkspaces";
import {
  buildMigrationDryRunRows,
  buildMigrationGovernanceBundle,
  buildMigrationPreflightRows,
  buildMigrationVerificationRows,
  deriveMigrationGovernanceHandoffState,
  serializeMigrationGovernanceBundle,
  type MigrationGovernanceActionId,
  type MigrationGovernanceHandoffState,
  type MigrationInspectionSnapshot,
  type MigrationPlanInput,
} from "@/lib/workflows/migrationWorkspace";

type MigrationInspectResponse = {
  ok: boolean;
  error?: string;
  snapshot?: MigrationInspectionSnapshot & {
    factoryId: string;
  };
};

type MigrationSimulateResponse = {
  ok: boolean;
  error?: string;
  source?: string;
  generatedAt?: string;
  sourceAccount?: string;
  note?: string;
  summary?: {
    total: number;
    simulated: number;
    failed: number;
  };
  entries?: Array<{
    id: string;
    title: string;
    method: string;
    contractId: string;
    status: string;
    tone: "positive" | "warning" | "neutral";
    detail: string;
    xdrBytes: number | null;
    argCount: number;
  }>;
};

const EMPTY_SNAPSHOT: MigrationInspectionSnapshot = {
  sourceArka: "",
  targetArka: "",
  registryId: ARKA_REGISTRY,
  implementationGetterSupported: false,
  currentImplementation: null,
  registryGetterSupported: false,
  currentRegistry: null,
  currentShareTokenImplementation: "",
  migratedTo: null,
  migratedFrom: null,
  sourceShareToken: null,
  targetShareToken: null,
};

function formatMigrationStatePill(state: string): string {
  switch (state) {
    case "Clear":
      return "OK";
    case "Missing":
      return "No";
    case "Readable":
      return "Read";
    case "Unavailable":
      return "N/A";
    case "Plan only":
      return "Plan";
    case "Loaded":
      return "Set";
    case "Unknown":
      return "TBD";
    default:
      return state;
  }
}

function MigrationGovernanceHandoffAction({
  state,
  onActivate,
  testId,
}: {
  state: MigrationGovernanceHandoffState;
  onActivate: () => boolean;
  testId: string;
}) {
  if (!state.enabled || !state.href) {
    return (
      <button
        type="button"
        disabled
        title={state.reason}
        className="surface-button surface-button-primary disabled:cursor-not-allowed disabled:opacity-50"
        data-testid={testId}
      >
        Open in governance
      </button>
    );
  }

  return (
    <Link
      href={state.href}
      onClick={(event) => {
        if (!onActivate()) {
          event.preventDefault();
        }
      }}
      title={state.reason}
      className="surface-button surface-button-primary"
      data-testid={testId}
    >
      Open in governance
    </Link>
  );
}

export default function MigrationsPage() {
  const [activeWorkspace, setActiveWorkspace] =
    useState<MigrationWorkspaceId>("plan");
  const [sourceArka, setSourceArka] = useState("");
  const [targetArka, setTargetArka] = useState("");
  const [registryId, setRegistryId] = useState(ARKA_REGISTRY);
  const [implementationHash, setImplementationHash] = useState("");
  const [shareTokenImplementationHash, setShareTokenImplementationHash] =
    useState("");
  const [snapshot, setSnapshot] =
    useState<MigrationInspectionSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [inspectionMode, setInspectionMode] = useState<
    "loading" | "live" | "stale" | "unavailable"
  >("loading");
  const [lastInspectionAt, setLastInspectionAt] = useState("");
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationStatus, setSimulationStatus] = useState("");
  const [simulationError, setSimulationError] = useState("");
  const [simulationSourceAccount, setSimulationSourceAccount] = useState("");
  const [simulationPlanSignature, setSimulationPlanSignature] = useState("");
  const [simulationEntries, setSimulationEntries] = useState<
    NonNullable<MigrationSimulateResponse["entries"]>
  >([]);

  const preflightRows = useMemo(
    () =>
      buildMigrationPreflightRows({
        ...snapshot,
        sourceArka,
        targetArka,
        registryId,
      }),
    [registryId, snapshot, sourceArka, targetArka],
  );
  const migrationPlan = useMemo<MigrationPlanInput>(
    () => ({
      factoryId: ARKA_FACTORY,
      sourceArka,
      targetArka,
      registryId,
      implementationHash,
      shareTokenImplementationHash,
    }),
    [
      implementationHash,
      registryId,
      shareTokenImplementationHash,
      sourceArka,
      targetArka,
    ],
  );
  const migrationPlanSignature = useMemo(
    () =>
      JSON.stringify({
        factoryId: migrationPlan.factoryId,
        sourceArka: migrationPlan.sourceArka.trim(),
        targetArka: migrationPlan.targetArka.trim(),
        registryId: migrationPlan.registryId.trim(),
        implementationHash: migrationPlan.implementationHash.trim(),
        shareTokenImplementationHash:
          migrationPlan.shareTokenImplementationHash.trim(),
      }),
    [migrationPlan],
  );
  const verificationRows = useMemo(
    () => buildMigrationVerificationRows(snapshot, migrationPlan),
    [migrationPlan, snapshot],
  );
  const governanceBundle = useMemo(
    () => buildMigrationGovernanceBundle(migrationPlan),
    [migrationPlan],
  );
  const governanceBundleJson = useMemo(
    () => serializeMigrationGovernanceBundle(governanceBundle),
    [governanceBundle],
  );
  const dryRunRows = useMemo(
    () =>
      buildMigrationDryRunRows({
        snapshot,
        plan: migrationPlan,
        bundle: governanceBundle,
      }),
    [governanceBundle, migrationPlan, snapshot],
  );
  const handoffStates = useMemo<
    Record<MigrationGovernanceActionId, MigrationGovernanceHandoffState>
  >(
    () => ({
      "factory-implementation": deriveMigrationGovernanceHandoffState(
        governanceBundle,
        "factory-implementation",
      ),
      "factory-share-token-implementation": deriveMigrationGovernanceHandoffState(
        governanceBundle,
        "factory-share-token-implementation",
      ),
      "factory-registry-binding": deriveMigrationGovernanceHandoffState(
        governanceBundle,
        "factory-registry-binding",
      ),
    }),
    [governanceBundle],
  );
  const migrationReviewBullets = useMemo(
    () => [
      `Factory: ${ARKA_FACTORY}`,
      `Registry target: ${registryId.trim() || "missing"}`,
      `Source Arka: ${sourceArka.trim() || "not provided"}`,
      `Target Arka: ${targetArka.trim() || "not provided"}`,
      `Implementation hash: ${implementationHash.trim() || "not provided"}`,
      `Share-token hash: ${
        shareTokenImplementationHash.trim() || "not provided"
      }`,
    ],
    [implementationHash, registryId, shareTokenImplementationHash, sourceArka, targetArka],
  );
  const inspectionModePill = useMemo(() => {
    if (loading) {
      return { label: "Inspection refreshing", tone: "neutral" as const };
    }
    if (inspectionMode === "live") {
      return { label: "Live readback", tone: "positive" as const };
    }
    if (inspectionMode === "stale") {
      return { label: "Stale readback", tone: "warning" as const };
    }
    return { label: "Inspection unavailable", tone: "warning" as const };
  }, [inspectionMode, loading]);
  const inspectionModeNote = useMemo(() => {
    if (inspectionMode === "live") {
      return lastInspectionAt
        ? `Latest factory inspection is live. Last successful readback: ${new Date(
            lastInspectionAt,
          ).toLocaleString()}.`
        : "Latest factory inspection is live.";
    }
    if (inspectionMode === "stale") {
      return lastInspectionAt
        ? `Latest refresh failed. The workspace is still showing the last successful factory readback from ${new Date(
            lastInspectionAt,
          ).toLocaleString()}. Retry to refresh the verification deck.`
        : "Latest refresh failed. The workspace is still showing the last successful factory readback. Retry to refresh the verification deck.";
    }
    if (inspectionMode === "unavailable") {
      return "Factory inspection is currently unavailable. Governance packaging remains usable, but getter-backed verification stays blocked until retry succeeds.";
    }
    return "Refreshing factory inspection and post-check posture.";
  }, [inspectionMode, lastInspectionAt]);
  const migrationWorkspaceState = useMemo(
    () =>
      buildMigrationWorkspaceState(
        {
          inspectionMode,
          loading,
          preflightReadyCount: preflightRows.filter(
            (row) => row.tone === "positive",
          ).length,
          preflightTotalCount: preflightRows.length,
          verificationRowCount: verificationRows.length,
          dryRunRowCount: dryRunRows.length,
          readyPackageCount: governanceBundle.packages.length,
          bundleEntryCount: governanceBundle.entries.length,
          simulationEntryCount: simulationEntries.length,
          simulationLoading,
          simulationError,
          status,
          error,
        },
        activeWorkspace,
      ),
    [
      activeWorkspace,
      dryRunRows.length,
      error,
      governanceBundle.entries.length,
      governanceBundle.packages.length,
      inspectionMode,
      loading,
      preflightRows,
      simulationEntries.length,
      simulationError,
      simulationLoading,
      status,
      verificationRows.length,
    ],
  );

  const inspectMigrationState = async (): Promise<void> => {
    try {
      setLoading(true);
      setError("");
      setStatus("");
      setInspectionMode(lastInspectionAt ? "stale" : "loading");
      const params = new URLSearchParams();
      if (sourceArka.trim()) params.set("sourceArka", sourceArka.trim());
      if (targetArka.trim()) params.set("targetArka", targetArka.trim());
      const response = await fetch(`/api/migrations/inspect?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as MigrationInspectResponse;
      if (!response.ok || !payload.ok || !payload.snapshot) {
        throw new Error(payload.error || "Failed to inspect migration state.");
      }
      setSnapshot({
        sourceArka: payload.snapshot.sourceArka,
        targetArka: payload.snapshot.targetArka,
        registryId,
        implementationGetterSupported:
          payload.snapshot.implementationGetterSupported,
        currentImplementation: payload.snapshot.currentImplementation,
        registryGetterSupported: payload.snapshot.registryGetterSupported,
        currentRegistry: payload.snapshot.currentRegistry,
        currentShareTokenImplementation:
          payload.snapshot.currentShareTokenImplementation,
        migratedTo: payload.snapshot.migratedTo,
        migratedFrom: payload.snapshot.migratedFrom,
        sourceShareToken: payload.snapshot.sourceShareToken,
        targetShareToken: payload.snapshot.targetShareToken,
      });
      const inspectedAt = new Date().toISOString();
      setLastInspectionAt(inspectedAt);
      setInspectionMode("live");
      setStatus("Migration inspection refreshed.");
    } catch (refreshError) {
      if (!lastInspectionAt) {
        setSnapshot(EMPTY_SNAPSHOT);
        setInspectionMode("unavailable");
      } else {
        setInspectionMode("stale");
        setStatus("Showing the last successful migration inspection.");
      }
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Failed to inspect migration state.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void inspectMigrationState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      !simulationPlanSignature ||
      simulationPlanSignature === migrationPlanSignature
    ) {
      return;
    }

    setSimulationEntries([]);
    setSimulationSourceAccount("");
    setSimulationStatus("");
    setSimulationError(
      "Migration plan changed after the last simulation. Re-run simulation before relying on results.",
    );
    setSimulationPlanSignature("");
  }, [migrationPlanSignature, simulationPlanSignature]);

  const queueGovernanceDraft = (
    templateId:
      | "factory-implementation"
      | "factory-share-token-implementation"
      | "factory-registry-binding",
  ) => {
    const template = GOVERNED_ACTION_TEMPLATES.find(
      (entry) => entry.id === templateId,
    );
    if (!template) {
      setError(`Missing governed template ${templateId}.`);
      setStatus("");
      return false;
    }

    try {
      const fieldValues: Record<string, string> = {};

      if (templateId === "factory-implementation") {
        fieldValues.impl_wasm_hash = implementationHash;
      } else if (templateId === "factory-share-token-implementation") {
        fieldValues.impl_wasm_hash = shareTokenImplementationHash;
      } else {
        fieldValues.registry = registryId;
      }

      const draft = buildGovernedComposerDraft({
        template,
        contractId: ARKA_FACTORY,
        fieldValues,
        origin: "migration-workspace",
      });

      writeGovernedComposerDraft(draft);
      setStatus(`Governed composer draft queued for ${template.method}.`);
      setError("");
      return true;
    } catch (draftError) {
      setError(
        draftError instanceof Error
          ? draftError.message
          : "Failed to queue migration governance draft.",
      );
      setStatus("");
      return false;
    }
  };

  const copyGovernanceBundle = async () => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        throw new Error("Clipboard is not available in this environment.");
      }
      await navigator.clipboard.writeText(governanceBundleJson);
      setStatus("Migration governance bundle copied.");
      setError("");
    } catch (copyError) {
      setError(
        copyError instanceof Error
          ? copyError.message
          : "Failed to copy migration governance bundle.",
      );
    }
  };

  const simulateGovernanceBundle = async (): Promise<void> => {
    if (governanceBundle.packages.length === 0) {
      setSimulationEntries([]);
      setSimulationStatus("");
      setSimulationError("Add at least one ready migration package before simulation.");
      setSimulationSourceAccount("");
      return;
    }

    try {
      setSimulationLoading(true);
      setSimulationStatus("");
      setSimulationError("");
      const response = await fetch("/api/migrations/simulate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          packages: governanceBundle.packages,
        }),
      });
      const payload = (await response.json()) as MigrationSimulateResponse;
      if (!response.ok || !payload.ok || !payload.entries) {
        throw new Error(payload.error || "Failed to simulate migration writes.");
      }
      setSimulationEntries(payload.entries);
      setSimulationSourceAccount(payload.sourceAccount ?? "");
      setSimulationPlanSignature(migrationPlanSignature);
      setSimulationStatus(
        `Simulated ${payload.summary?.simulated ?? 0}/${payload.summary?.total ?? payload.entries.length} governed migration writes.`,
      );
    } catch (simulateError) {
      setSimulationEntries([]);
      setSimulationSourceAccount("");
      setSimulationPlanSignature("");
      setSimulationError(
        simulateError instanceof Error
          ? simulateError.message
          : "Failed to simulate migration writes.",
      );
    } finally {
      setSimulationLoading(false);
    }
  };

  return (
    <main className="surface-stack control-room-fidelity-shell migrations-fidelity-shell secondary-operator-shell-cutover migrations-secondary-cutover">
      <header className="surface-stage-header">
        <span className="surface-eyebrow">Migrations</span>
        <h1 className="surface-title">Migration workspace</h1>
        <p className="surface-description">
          Inspect factory migration mappings, verify canonical routing posture
          and hand off implementation changes into governance authoring without
          leaving the operator shell.
        </p>
      </header>

      <section
        className="operator-workspace-summary secondary-operator-summary-cutover"
        data-testid="migrations-workspace-summary"
      >
        <div className="operator-workspace-summary-copy">
          <span className="surface-eyebrow">
            {migrationWorkspaceState.tab.eyebrow}
          </span>
          <strong>{migrationWorkspaceState.tab.label}</strong>
          <p className="surface-note">
            {migrationWorkspaceState.tab.description}
          </p>
        </div>
        <div className="operator-workspace-summary-grid">
          {migrationWorkspaceState.signals.map((signal) => (
            <article
              key={signal.id}
              className={`surface-signal-card workflow-signal-card operator-workspace-signal operator-workspace-signal-${signal.tone}`}
            >
              <span className="workflow-signal-label">{signal.label}</span>
              <strong className="workflow-signal-value">{signal.value}</strong>
              <span className="workflow-signal-detail">{signal.detail}</span>
            </article>
          ))}
        </div>
      </section>

      <nav
        className="operator-workspace-tabs operator-workspace-tabs-four secondary-operator-tabs-cutover"
        aria-label="Migration workspaces"
        data-testid="migrations-workspace-tabs"
      >
        {MIGRATION_WORKSPACE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`surface-tab ${activeWorkspace === tab.id ? "surface-tab-active" : ""}`}
            aria-pressed={activeWorkspace === tab.id}
            aria-controls={`migrations-workspace-panel-${tab.id}`}
            data-testid={`migrations-workspace-tab-${tab.id}`}
            onClick={() => setActiveWorkspace(tab.id)}
          >
            <span>{tab.label}</span>
            <small>{tab.eyebrow}</small>
          </button>
        ))}
      </nav>

      <TransactionFeedbackRail
        loading={loading}
        loadingLabel="Inspecting factory migration state..."
        status={status}
        error={error}
        statusTestId="migration-status"
        errorTestId="migration-error"
      />

      {activeWorkspace === "plan" ? (
      <section
        id="migrations-workspace-panel-plan"
        className="surface-grid surface-grid-two control-room-stage-grid operator-workspace-stage migration-workspace-stage migrations-utility-grid migrations-plan-workspace-grid secondary-operator-stage-cutover"
        data-testid="migrations-workspace-panel"
      >
        <Panel
          id="migration-plan"
          title="Migration plan"
          subtitle="Define source, target and target hashes before governance packaging"
          testId="migration-plan-panel"
          className="migrations-workspace-panel migration-plan-workspace-panel secondary-operator-panel-cutover"
        >
          <div className="surface-chip-wrap surface-spotlight-tabs">
            <StatusPill label="Operator lane" tone="positive" />
            <StatusPill label="Governed" tone="neutral" />
            <StatusPill label={inspectionModePill.label} tone={inspectionModePill.tone} />
          </div>

          <TransactionReviewCard
            title="Migration posture"
            body="This workspace prepares migration-related governance changes and verifies factory mapping state. It does not bypass governance or pretend to execute raw migration writes directly."
            bullets={migrationReviewBullets}
            tone={error ? "warning" : "neutral"}
            testId="migration-review-card"
          />

          <div className="ops-form-grid secondary-operator-form-cutover">
            <ActionField
              label="Source Arka"
              hint="Optional. Used to inspect migrated_to(source) and current share_token_of(source)."
            >
              <input
                className="ops-input"
                value={sourceArka}
                onChange={(event) => setSourceArka(event.target.value)}
                placeholder="C..."
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                data-testid="migration-source-input"
              />
            </ActionField>
            <ActionField
              label="Target Arka"
              hint="Optional. Used to inspect migrated_from(target) and share_token_of(target)."
            >
              <input
                className="ops-input"
                value={targetArka}
                onChange={(event) => setTargetArka(event.target.value)}
                placeholder="C..."
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                data-testid="migration-target-input"
              />
            </ActionField>
            <ActionField
              label="Registry target"
              hint="Canonical registry binding to package into governance when needed."
            >
              <input
                className="ops-input"
                value={registryId}
                onChange={(event) => setRegistryId(event.target.value)}
                placeholder="C..."
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                data-testid="migration-registry-input"
              />
            </ActionField>
            <ActionField
              label="Target implementation hash"
              hint="Factory implementation hash (bytes32 hex) for the target migration package."
            >
              <input
                className="ops-input"
                value={implementationHash}
                onChange={(event) => setImplementationHash(event.target.value)}
                placeholder="64 hex chars"
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                data-testid="migration-implementation-hash-input"
              />
            </ActionField>
            <ActionField
              label="Target share-token hash"
              hint="Share-token implementation hash (bytes32 hex) for factory governance."
            >
              <input
                className="ops-input"
                value={shareTokenImplementationHash}
                onChange={(event) =>
                  setShareTokenImplementationHash(event.target.value)
                }
                placeholder="64 hex chars"
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                data-testid="migration-share-token-hash-input"
              />
            </ActionField>
          </div>

          <div className="ops-action-row secondary-operator-actions-cutover">
            <button
              type="button"
              onClick={() => void inspectMigrationState()}
              disabled={loading}
              aria-busy={loading}
              className="surface-button surface-button-primary"
              data-testid="migration-inspect-button"
            >
              {loading ? "Inspecting migration state..." : "Inspect migration state"}
            </button>
          </div>
        </Panel>

        <Panel
          id="migration-inspection"
          title="Inspection and preflight"
          subtitle="Read current mappings and canonical share-token implementation from the factory"
          testId="migration-inspection-panel"
          className="migrations-workspace-panel migration-inspection-workspace-panel secondary-operator-panel-cutover"
        >
          <SurfaceTable
            columnsClassName="status-oracle-table migration-preflight-table"
            headers={["Signal", "Value", "State"]}
            testId="migration-preflight-table"
            className="status-oracle-table migration-preflight-table secondary-operator-table-cutover"
          >
            {preflightRows.map((row) => (
              <div
                key={row.id}
                className="surface-table-row status-oracle-table migration-preflight-table secondary-operator-row-cutover"
                data-testid={`migration-preflight-row-${row.id}`}
              >
                <div className="surface-table-cell surface-table-cell-stack">
                  <strong className="surface-table-cell-strong">{row.label}</strong>
                  <span className="surface-table-subtle">{row.detail}</span>
                </div>
                <div className="surface-table-cell">
                  <strong className="surface-table-cell-strong ops-mono">
                    {row.value}
                  </strong>
                </div>
                <div className="surface-table-cell migration-state-cell">
                  <StatusPill
                    label={formatMigrationStatePill(row.state)}
                    tone={row.tone}
                  />
                </div>
              </div>
            ))}
          </SurfaceTable>
          <div className="surface-note">
            Current canonical share-token implementation:{" "}
            <code className="ops-mono" data-testid="migration-current-share-token-implementation">
              {snapshot.currentShareTokenImplementation || "Unavailable"}
            </code>
          </div>
          <div className="surface-note" data-testid="migration-inspection-mode-note">
            {inspectionModeNote}
          </div>
        </Panel>
      </section>
      ) : null}

      {activeWorkspace === "verify" ? (
      <section
        id="migrations-workspace-panel-verify"
        className="surface-grid surface-grid-two control-room-stage-grid operator-workspace-stage migration-workspace-stage migrations-utility-grid migrations-verify-workspace-grid secondary-operator-stage-cutover"
        data-testid="migrations-workspace-panel"
      >
        <Panel
          id="migration-verification"
          title="Verification deck"
          subtitle="Re-run inspection after governance execution and compare the live factory state against the migration target"
          testId="migration-verification-panel"
          className="migrations-workspace-panel migration-verification-workspace-panel secondary-operator-panel-cutover"
        >
          <SurfaceTable
            columnsClassName="status-oracle-table migration-verification-table"
            headers={["Signal", "Current", "Expected", "State"]}
            testId="migration-verification-table"
            className="status-oracle-table migration-verification-table secondary-operator-table-cutover"
          >
            {verificationRows.length > 0 ? (
              verificationRows.map((row) => (
                <div
                  key={row.id}
                  className="surface-table-row status-oracle-table migration-verification-table secondary-operator-row-cutover"
                  data-testid={`migration-verification-row-${row.id}`}
                >
                  <div className="surface-table-cell surface-table-cell-stack">
                    <strong className="surface-table-cell-strong">{row.label}</strong>
                    <span className="surface-table-subtle">{row.detail}</span>
                  </div>
                  <div className="surface-table-cell">
                    <strong className="surface-table-cell-strong ops-mono">
                      {row.current}
                    </strong>
                  </div>
                  <div className="surface-table-cell">
                    <strong className="surface-table-cell-strong ops-mono">
                      {row.expected}
                    </strong>
                  </div>
                  <div className="surface-table-cell migration-state-cell">
                    <StatusPill
                      label={formatMigrationStatePill(row.state)}
                      tone={row.tone}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="surface-note" data-testid="migration-verification-empty">
                Add source/target Arkas or a target share-token hash to unlock live verification rows.
              </div>
            )}
          </SurfaceTable>
          <div className="surface-note">
            This verification deck only labels checks as aligned when the factory exposes the
            underlying readback today. Inputs without a readable getter stay in the export lane,
            not in the verified lane.
          </div>
        </Panel>

        <Panel
          id="migration-dry-run"
          title="Dry-run and post-checks"
          subtitle="Getter-backed operator dry-run of the current migration plan and the checks that will still be provable after governance execution"
          testId="migration-dry-run-panel"
          className="migrations-workspace-panel migration-dry-run-workspace-panel secondary-operator-panel-cutover"
        >
          <SurfaceTable
            columnsClassName="status-oracle-table migration-verification-table"
            headers={["Signal", "Current", "Expected", "State"]}
            testId="migration-dry-run-table"
            className="status-oracle-table migration-verification-table secondary-operator-table-cutover"
          >
            {dryRunRows.map((row) => (
              <div
                key={row.id}
                className="surface-table-row status-oracle-table migration-verification-table secondary-operator-row-cutover"
                data-testid={`migration-dry-run-row-${row.id}`}
              >
                <div className="surface-table-cell surface-table-cell-stack">
                  <strong className="surface-table-cell-strong">{row.label}</strong>
                  <span className="surface-table-subtle">{row.detail}</span>
                </div>
                <div className="surface-table-cell">
                  <strong className="surface-table-cell-strong ops-mono">
                    {row.current}
                  </strong>
                </div>
                <div className="surface-table-cell">
                  <strong className="surface-table-cell-strong ops-mono">
                    {row.expected}
                  </strong>
                </div>
                <div className="surface-table-cell migration-state-cell">
                  <StatusPill
                    label={formatMigrationStatePill(row.state)}
                    tone={row.tone}
                  />
                </div>
              </div>
            ))}
          </SurfaceTable>
          <div className="surface-note">
            This dry-run does not pretend to execute migration writes directly. It validates the
            governed package set, probes the factory getters that are actually available today, and
            tells you which post-checks remain provable after execution.
          </div>
        </Panel>
      </section>
      ) : null}

      {activeWorkspace === "simulate" ? (
      <section
        id="migrations-workspace-panel-simulate"
        className="surface-grid surface-grid-two control-room-stage-grid operator-workspace-stage migration-workspace-stage migrations-utility-grid migrations-simulate-workspace-grid secondary-operator-stage-cutover"
        data-testid="migrations-workspace-panel"
      >
        <Panel
          id="migration-simulation"
          title="Write simulation"
          subtitle="RPC-backed simulation of the governed migration writes before handoff into the governor lane"
          testId="migration-simulation-panel"
          className="migrations-workspace-panel migration-simulation-workspace-panel secondary-operator-panel-cutover"
          actions={
            <button
              type="button"
              onClick={() => void simulateGovernanceBundle()}
              disabled={simulationLoading}
              aria-busy={simulationLoading}
              className="surface-button surface-button-primary"
              data-testid="migration-simulate-button"
            >
              {simulationLoading
                ? "Simulating governance bundle..."
                : "Simulate governance bundle"}
            </button>
          }
        >
          <SurfaceTable
            columnsClassName="status-oracle-table migration-simulation-table"
            headers={["Governed change", "Simulation", "State"]}
            testId="migration-simulation-table"
            className="status-oracle-table migration-simulation-table secondary-operator-table-cutover"
          >
            {simulationEntries.length > 0 ? (
              simulationEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="surface-table-row status-oracle-table migration-simulation-table secondary-operator-row-cutover"
                  data-testid={`migration-simulation-row-${entry.id}`}
                >
                  <div className="surface-table-cell surface-table-cell-stack">
                    <strong className="surface-table-cell-strong">{entry.title}</strong>
                    <span className="surface-table-subtle">
                      {entry.method} on <code className="ops-mono">{entry.contractId}</code>
                    </span>
                  </div>
                  <div className="surface-table-cell surface-table-cell-stack">
                    <strong className="surface-table-cell-strong">
                      {entry.xdrBytes !== null
                        ? `${entry.xdrBytes} bytes / ${entry.argCount} args`
                        : `${entry.argCount} args`}
                    </strong>
                    <span className="surface-table-subtle">{entry.detail}</span>
                  </div>
                  <div className="surface-table-cell">
                    <StatusPill label={entry.status} tone={entry.tone} />
                  </div>
                </div>
              ))
            ) : (
              <div className="surface-note" data-testid="migration-simulation-empty">
                Run a write simulation to validate the current migration bundle against live RPC
                state before governance handoff.
              </div>
            )}
          </SurfaceTable>
          <div className="surface-note" data-testid="migration-simulation-source-note">
            Simulation source account:{" "}
            <code className="ops-mono">{simulationSourceAccount || "Pending simulation"}</code>
          </div>
          <div className="surface-note">
            This simulates the target contract writes from the current bundle. It does not publish a
            governor proposal and it does not bypass authorization or timelock policy.
          </div>
          <TransactionFeedbackRail
            loading={simulationLoading}
            loadingLabel="Simulating governed migration writes..."
            status={simulationStatus}
            error={simulationError}
            statusTestId="migration-simulation-status"
            errorTestId="migration-simulation-error"
          />
        </Panel>
      </section>
      ) : null}

      {activeWorkspace === "export" ? (
      <section
        id="migrations-workspace-panel-export"
        className="surface-grid surface-grid-two control-room-stage-grid operator-workspace-stage migration-workspace-stage migrations-utility-grid migrations-export-workspace-grid secondary-operator-stage-cutover"
        data-testid="migrations-workspace-panel"
      >
        <Panel
          id="migration-export"
          title="Export bundle"
          subtitle="Machine-consumable governance bundle for the current migration plan"
          testId="migration-export-panel"
          className="migrations-workspace-panel migration-export-workspace-panel secondary-operator-panel-cutover"
        >
          <TransactionReviewCard
            title="Bundle posture"
            body="This bundle reuses the governed package format already used by the composer, but groups the migration-related factory changes into one exportable operator artifact."
            bullets={governanceBundle.reviewBullets}
            tone={governanceBundle.packages.length > 0 ? "positive" : "warning"}
            testId="migration-export-review-card"
          />
          <SurfaceTable
            columnsClassName="governance-actions-table"
            headers={["Governed change", "Method", "Status"]}
            testId="migration-bundle-table"
            className="governance-actions-table secondary-operator-table-cutover"
          >
            {governanceBundle.entries.map((entry) => (
              <div
                key={entry.id}
                className="surface-table-row governance-actions-table secondary-operator-row-cutover"
                data-testid={`migration-bundle-row-${entry.id}`}
              >
                <div className="surface-table-cell surface-table-cell-stack">
                  <strong className="surface-table-cell-strong">{entry.title}</strong>
                  <span className="surface-table-subtle">{entry.detail}</span>
                </div>
                <div className="surface-table-cell">
                  <code className="ops-mono">{entry.method}</code>
                </div>
                <div className="surface-table-cell">
                  <StatusPill label={entry.status} tone={entry.tone} />
                </div>
              </div>
            ))}
          </SurfaceTable>
          <div className="ops-action-row secondary-operator-actions-cutover">
            <button
              type="button"
              onClick={() => void copyGovernanceBundle()}
              className="surface-button surface-button-primary"
              data-testid="migration-copy-bundle"
            >
              Copy bundle JSON
            </button>
          </div>
          <pre className="surface-code-block" data-testid="migration-bundle-json">
            {governanceBundleJson}
          </pre>
        </Panel>

        <Panel
          id="migration-handoff"
          title="Governance handoff"
          subtitle="Queue migration-related governance authoring directly into the composer lane"
          testId="migration-handoff-panel"
          className="migrations-workspace-panel migration-handoff-workspace-panel secondary-operator-panel-cutover"
        >
          <SurfaceTable
            columnsClassName="governance-actions-table"
            headers={["Governed change", "Purpose", "Action"]}
            testId="migration-handoff-table"
            className="governance-actions-table secondary-operator-table-cutover"
          >
            <div className="surface-table-row governance-actions-table secondary-operator-row-cutover">
              <div className="surface-table-cell surface-table-cell-stack">
                <strong className="surface-table-cell-strong">
                  Factory implementation
                </strong>
                <span className="surface-table-subtle">
                  Prepare `set_implementation` with the target factory wasm hash.
                </span>
              </div>
              <div className="surface-table-cell">
                <span className="surface-table-hint">
                  Use this when the migration requires promoting a new canonical
                  Arka implementation.
                </span>
              </div>
              <div className="surface-table-cell surface-table-actions">
                <MigrationGovernanceHandoffAction
                  state={handoffStates["factory-implementation"]}
                  onActivate={() =>
                    queueGovernanceDraft("factory-implementation")
                  }
                  testId="migration-open-implementation-governance"
                />
              </div>
            </div>
            <div className="surface-table-row governance-actions-table secondary-operator-row-cutover">
              <div className="surface-table-cell surface-table-cell-stack">
                <strong className="surface-table-cell-strong">
                  Share-token implementation
                </strong>
                <span className="surface-table-subtle">
                  Prepare `set_share_token_implementation` with the target
                  share-token wasm hash.
                </span>
              </div>
              <div className="surface-table-cell">
                <span className="surface-table-hint">
                  Use this when migration changes the canonical share-token
                  backend.
                </span>
              </div>
              <div className="surface-table-cell surface-table-actions">
                <MigrationGovernanceHandoffAction
                  state={handoffStates["factory-share-token-implementation"]}
                  onActivate={() =>
                    queueGovernanceDraft("factory-share-token-implementation")
                  }
                  testId="migration-open-share-token-governance"
                />
              </div>
            </div>
            <div className="surface-table-row governance-actions-table secondary-operator-row-cutover">
              <div className="surface-table-cell surface-table-cell-stack">
                <strong className="surface-table-cell-strong">
                  Registry binding
                </strong>
                <span className="surface-table-subtle">
                  Prepare `set_registry` with the canonical registry target.
                </span>
              </div>
              <div className="surface-table-cell">
                <span className="surface-table-hint">
                  Use this when migration requires promoting a different external
                  registry.
                </span>
              </div>
              <div className="surface-table-cell surface-table-actions">
                <MigrationGovernanceHandoffAction
                  state={handoffStates["factory-registry-binding"]}
                  onActivate={() =>
                    queueGovernanceDraft("factory-registry-binding")
                  }
                  testId="migration-open-registry-governance"
                />
              </div>
            </div>
          </SurfaceTable>
        </Panel>
      </section>
      ) : null}
    </main>
  );
}
