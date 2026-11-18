import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sorobanMocks = vi.hoisted(() => ({
  buildContractInvokeRaw: vi.fn(async () => "raw-xdr"),
  simulateContractReadonly: vi.fn(async () => null),
  scValToNative: vi.fn(() => ({ ok: true })),
}));

const txMocks = vi.hoisted(() => ({
  signXdr: vi.fn(async () => "signed-xdr"),
  submitSignedTx: vi.fn(async () => "HASH123"),
  waitForTx: vi.fn(async () => undefined),
}));

const walletMocks = vi.hoisted(() => ({
  getWalletsKit: vi.fn(() => ({}) as unknown),
  connectWallet: vi.fn(async () => "GTESTWALLET"),
  connectFreighterDirect: vi.fn(async () => "GTESTWALLET"),
  persistWalletPubkey: vi.fn(),
  isWalletSelectionClosedError: vi.fn(
    (event: unknown) => event instanceof Error && event.message === "Wallet selection was closed",
  ),
}));

vi.mock("@/lib/soroban", () => ({
  buildContractInvokeRaw: sorobanMocks.buildContractInvokeRaw,
  simulateContractReadonly: sorobanMocks.simulateContractReadonly,
  scValToNative: sorobanMocks.scValToNative,
  scValBytesN32: vi.fn(() => ({}) as unknown),
}));

vi.mock("@/lib/tx", () => ({
  signXdr: txMocks.signXdr,
  submitSignedTx: txMocks.submitSignedTx,
  waitForTx: txMocks.waitForTx,
}));

vi.mock("@/lib/walletKit", () => ({
  getWalletsKit: walletMocks.getWalletsKit,
  connectWallet: walletMocks.connectWallet,
  connectFreighterDirect: walletMocks.connectFreighterDirect,
  persistWalletPubkey: walletMocks.persistWalletPubkey,
  isWalletSelectionClosedError: walletMocks.isWalletSelectionClosedError,
}));

import ContractsPage from "@/app/contracts/page";
import { buildContractsMutationMatrixSnapshot } from "@/lib/contracts/mutationMatrix";
import { buildContractsSecurityAuditSnapshot } from "@/lib/contracts/securityAudit";
import { buildContractsStorageLifecycleSnapshot } from "@/lib/contracts/storageLifecycle";
import {
  buildGovernedActionPackage,
  GOVERNED_ACTION_DRAFT_STORAGE_KEY,
  GOVERNED_ACTION_TEMPLATES,
} from "@/lib/workflows/governanceComposer";

const VALID_ADDRESS = "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW";
const VALID_OPERATION_ID = "ab".repeat(32);

async function selectAction(user: ReturnType<typeof userEvent.setup>, actionId: string): Promise<void> {
  const select = screen.getByTestId("contracts-action-select");
  await user.selectOptions(select, actionId);
  await waitFor(() => {
    expect((screen.getByTestId("contracts-action-select") as HTMLSelectElement).value).toBe(actionId);
  });
}

async function fillField(
  user: ReturnType<typeof userEvent.setup>,
  fieldKey: string,
  value: string,
): Promise<void> {
  const field = screen.queryByTestId(`contracts-field-${fieldKey}`);
  if (!field) return;
  if (field.tagName === "SELECT") {
    await user.selectOptions(field, value);
    return;
  }
  fireEvent.change(field, { target: { value } });
}

function setFieldValue(testId: string, value: string): void {
  fireEvent.change(screen.getByTestId(testId), { target: { value } });
}

function isDaoGuardVisible(): boolean {
  return screen.queryByTestId("contracts-dao-guard-note") !== null;
}

async function runPreset(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByTestId("contracts-run-preset-button"));
  const confirmButton = screen.queryByTestId("contracts-confirm-button");
  if (confirmButton) {
    await user.click(confirmButton);
  }
}

async function runRawWrite(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByTestId("contracts-raw-write-button"));
  const confirmButton = screen.queryByTestId("contracts-confirm-button");
  if (confirmButton) {
    await user.click(confirmButton);
  }
}

function inferPresetFieldValue(fieldKey: string): string {
  if (fieldKey === "operation_id") return VALID_OPERATION_ID;
  if (fieldKey === "meta_hash") return VALID_OPERATION_ID;
  if (fieldKey === "impl_wasm_hash") return VALID_OPERATION_ID;
  if (
    fieldKey === "whitelist_contracts" ||
    fieldKey === "allowed_routers" ||
    fieldKey === "allowed_adapters"
  ) {
    return `${VALID_ADDRESS},${VALID_ADDRESS}`;
  }
  if (fieldKey === "kind") return "Oracle";
  if (fieldKey === "protocol") return "Blend";
  if (fieldKey === "market_id") return "0";
  if (
    /^(caller|payer|from|to|recipient|owner|user|vault|manager|router|adapter|governor|admin|treasury|claims_manager|share_token|asset|oracle|registrar|arka|primary|secondary|reserve_token|operator|manager_vault|community_fund|registry|token|old_arka|new_arka|account|delegatee)$/.test(
      fieldKey,
    )
  ) {
    return VALID_ADDRESS;
  }
  if (/(amount|limit|nav|period|delay|grace|points|threshold|bps|delta|min|max)/i.test(fieldKey)) {
    return "1";
  }
  return "1";
}

describe("ContractsPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    window.history.replaceState({}, "", "/contracts");
    window.localStorage.clear();
    sorobanMocks.buildContractInvokeRaw.mockClear();
    sorobanMocks.simulateContractReadonly.mockClear();
    sorobanMocks.scValToNative.mockClear();
    txMocks.signXdr.mockClear();
    txMocks.submitSignedTx.mockClear();
    txMocks.waitForTx.mockClear();
  });

  it("renders control-center shell and action selectors", () => {
    const { container } = render(<ContractsPage />);

    expect(container.querySelector("main")).toHaveClass(
      "contracts-fidelity-shell",
    );
    expect(screen.getByRole("heading", { name: /Contract Control Center/i })).toBeInTheDocument();
    expect(screen.getByTestId("contracts-stage-signals")).toHaveClass(
      "contracts-operator-summary",
    );
    expect(screen.getByTestId("contracts-execution-grid")).toHaveClass(
      "contracts-execution-grid",
    );
    expect(screen.getByTestId("contracts-preset-panel")).toHaveClass(
      "contracts-typed-workspace-panel",
    );
    expect(screen.getByTestId("contracts-preset-panel")).toHaveClass(
      "contracts-command-frame-cutover",
    );
    expect(screen.getByTestId("contracts-preset-table")).toHaveClass(
      "contracts-control-table-cutover",
    );
    expect(screen.getByTestId("contracts-raw-panel")).toHaveClass(
      "contracts-raw-workspace-panel",
    );
    expect(screen.getByTestId("contracts-raw-panel")).toHaveClass(
      "contracts-command-frame-cutover",
    );
    expect(screen.getByTestId("contracts-raw-table")).toHaveClass(
      "contracts-control-table-cutover",
    );
    expect(screen.getByTestId("contracts-typed-review-card")).toHaveClass(
      "transaction-surface-review-card",
    );
    expect(screen.getByTestId("contracts-raw-review-card")).toHaveClass(
      "transaction-surface-review-card",
    );
    expect(screen.getByTestId("contracts-action-select")).toBeInTheDocument();
    expect(screen.getByTestId("contracts-run-preset-button")).toBeInTheDocument();
    expect(screen.getByTestId("contracts-raw-read-button")).toBeInTheDocument();
    expect(screen.getByTestId("contracts-raw-write-button")).toBeInTheDocument();
  });

  it("loads a governed action draft from governance handoff into the typed lane", async () => {
    const template = GOVERNED_ACTION_TEMPLATES.find(
      (entry) => entry.id === "allowed-venues",
    );

    expect(template).toBeDefined();

    const draft = buildGovernedActionPackage({
      template: template!,
      contractId: VALID_ADDRESS,
      fieldValues: {
        caller: VALID_ADDRESS,
        allowed_routers: `${VALID_ADDRESS},${VALID_ADDRESS}`,
        allowed_adapters: `${VALID_ADDRESS},${VALID_ADDRESS}`,
      },
    });

    window.localStorage.setItem(
      GOVERNED_ACTION_DRAFT_STORAGE_KEY,
      JSON.stringify(draft),
    );
    window.history.pushState({}, "", "/contracts?draft=governed-action");

    render(<ContractsPage />);

    await waitFor(() => {
      expect(
        screen.getByTestId("contracts-preset-status"),
      ).toHaveTextContent("Loaded governed action draft");
    });

    expect(
      screen.getByTestId("contracts-action-select"),
    ).toHaveValue("arka-set-allowed-venues");
    expect(screen.getByTestId("contracts-contract-id-input")).toHaveValue(
      VALID_ADDRESS,
    );
    expect(
      screen.getByTestId("contracts-field-allowed_routers"),
    ).toHaveValue(`${VALID_ADDRESS},${VALID_ADDRESS}`);
    expect(
      screen.getByTestId("contracts-field-allowed_adapters"),
    ).toHaveValue(`${VALID_ADDRESS},${VALID_ADDRESS}`);
    expect(window.location.pathname).toBe("/contracts");
    expect(window.location.search).toBe("");
    expect(
      window.localStorage.getItem(GOVERNED_ACTION_DRAFT_STORAGE_KEY),
    ).toBeNull();
  });

  it("loads a coverage governed draft with large numeric payloads into the typed lane", async () => {
    const template = GOVERNED_ACTION_TEMPLATES.find(
      (entry) => entry.id === "coverage-covered-vault-policy",
    );

    expect(template).toBeDefined();

    const draft = buildGovernedActionPackage({
      template: template!,
      contractId: VALID_ADDRESS,
      fieldValues: {
        caller: VALID_ADDRESS,
        vault: VALID_ADDRESS,
        annual_premium_bps: "3.50",
        coverage_limit: "25000000",
      },
    });

    window.localStorage.setItem(
      GOVERNED_ACTION_DRAFT_STORAGE_KEY,
      JSON.stringify(draft),
    );
    window.history.pushState({}, "", "/contracts?draft=governed-action");

    render(<ContractsPage />);

    await waitFor(() => {
      expect(
        screen.getByTestId("contracts-preset-status"),
      ).toHaveTextContent("Loaded governed action draft");
    });

    expect(
      screen.getByTestId("contracts-action-select"),
    ).toHaveValue("coverage-fund-set-covered-vault-policy");
    expect(screen.getByTestId("contracts-contract-id-input")).toHaveValue(
      VALID_ADDRESS,
    );
    expect(screen.getByTestId("contracts-field-vault")).toHaveValue(
      VALID_ADDRESS,
    );
    expect(
      screen.getByTestId("contracts-field-annual_premium_bps"),
    ).toHaveValue("3.50");
    expect(
      screen.getByTestId("contracts-field-coverage_limit"),
    ).toHaveValue("25000000");
  });

  it("loads a factory creation-fee governed draft into the typed lane", async () => {
    const template = GOVERNED_ACTION_TEMPLATES.find(
      (entry) => entry.id === "factory-creation-fee",
    );

    expect(template).toBeDefined();

    const draft = buildGovernedActionPackage({
      template: template!,
      contractId: VALID_ADDRESS,
      fieldValues: {
        token: VALID_ADDRESS,
        amount: "15000000",
      },
    });

    window.localStorage.setItem(
      GOVERNED_ACTION_DRAFT_STORAGE_KEY,
      JSON.stringify(draft),
    );
    window.history.pushState({}, "", "/contracts?draft=governed-action");

    render(<ContractsPage />);

    await waitFor(() => {
      expect(
        screen.getByTestId("contracts-preset-status"),
      ).toHaveTextContent("Loaded governed action draft");
    });

    expect(
      screen.getByTestId("contracts-action-select"),
    ).toHaveValue("arka-factory-set-creation-fee");
    expect(screen.getByTestId("contracts-contract-id-input")).toHaveValue(
      VALID_ADDRESS,
    );
    expect(screen.getByTestId("contracts-field-token")).toHaveValue(
      VALID_ADDRESS,
    );
    expect(screen.getByTestId("contracts-field-amount")).toHaveValue(
      "15000000",
    );
  });

  it("loads a manager-tier thresholds governed draft into the typed lane", async () => {
    const template = GOVERNED_ACTION_TEMPLATES.find(
      (entry) => entry.id === "manager-tier-thresholds",
    );

    expect(template).toBeDefined();

    const draft = buildGovernedActionPackage({
      template: template!,
      contractId: VALID_ADDRESS,
      fieldValues: {
        caller: VALID_ADDRESS,
        tier1_threshold: "100",
        tier2_threshold: "500",
        tier3_threshold: "1000",
      },
    });

    window.localStorage.setItem(
      GOVERNED_ACTION_DRAFT_STORAGE_KEY,
      JSON.stringify(draft),
    );
    window.history.pushState({}, "", "/contracts?draft=governed-action");

    render(<ContractsPage />);

    await waitFor(() => {
      expect(
        screen.getByTestId("contracts-preset-status"),
      ).toHaveTextContent("Loaded governed action draft");
    });

    expect(screen.getByTestId("contracts-action-select")).toHaveValue(
      "manager-tier-set-thresholds",
    );
    expect(screen.getByTestId("contracts-contract-id-input")).toHaveValue(
      VALID_ADDRESS,
    );
    expect(
      screen.getByTestId("contracts-field-tier1_threshold"),
    ).toHaveValue("100");
    expect(
      screen.getByTestId("contracts-field-tier2_threshold"),
    ).toHaveValue("500");
    expect(
      screen.getByTestId("contracts-field-tier3_threshold"),
    ).toHaveValue("1000");
  });

  it("loads an executor governor governed draft that clears the governor binding", async () => {
    const template = GOVERNED_ACTION_TEMPLATES.find(
      (entry) => entry.id === "executor-governor",
    );

    expect(template).toBeDefined();

    const draft = buildGovernedActionPackage({
      template: template!,
      contractId: VALID_ADDRESS,
      fieldValues: {
        caller: VALID_ADDRESS,
        governor: "",
      },
    });

    window.localStorage.setItem(
      GOVERNED_ACTION_DRAFT_STORAGE_KEY,
      JSON.stringify(draft),
    );
    window.history.pushState({}, "", "/contracts?draft=governed-action");

    render(<ContractsPage />);

    await waitFor(() => {
      expect(
        screen.getByTestId("contracts-preset-status"),
      ).toHaveTextContent("Loaded governed action draft");
    });

    expect(screen.getByTestId("contracts-action-select")).toHaveValue(
      "executor-set-governor",
    );
    expect(screen.getByTestId("contracts-contract-id-input")).toHaveValue(
      VALID_ADDRESS,
    );
    expect(screen.getByTestId("contracts-field-caller")).toHaveValue(
      VALID_ADDRESS,
    );
    expect(screen.getByTestId("contracts-field-governor")).toHaveValue("");
  });

  it("renders the critical mutation matrix with machine-consumable rows", () => {
    render(<ContractsPage />);
    const snapshot = buildContractsMutationMatrixSnapshot();

    expect(screen.getByTestId("contracts-mutation-matrix-panel")).toBeInTheDocument();
    expect(screen.getByTestId("contracts-matrix-grid")).toHaveClass(
      "contracts-matrix-grid",
    );
    expect(screen.getByTestId("contracts-mutation-matrix-panel")).toHaveClass(
      "contracts-mutation-workspace-panel",
    );
    expect(screen.getByTestId("contracts-mutation-matrix-panel")).toHaveClass(
      "contracts-audit-panel-cutover",
    );
    expect(screen.getByTestId("contracts-mutation-matrix-table")).toHaveClass(
      "contracts-audit-table-cutover",
    );
    expect(screen.getByTestId("contracts-mutation-matrix-table")).toBeInTheDocument();
    for (const entry of snapshot.entries) {
      const row = screen.getByTestId(`contracts-mutation-matrix-row-${entry.id}`);
      expect(row).toHaveClass("contracts-audit-row-cutover");
      expect(row).toHaveTextContent(entry.title);
      expect(row).toHaveTextContent(entry.severity);
      expect(row).toHaveTextContent(
        entry.executionLane === "dao_executor"
          ? "DAO executor"
          : entry.executionLane === "wallet_backed"
            ? "Wallet backed"
            : "Blocked",
      );
      expect(row).toHaveTextContent(entry.writeActionId);
      expect(row).toHaveTextContent(entry.readActionId);
      for (const precondition of entry.preconditions) {
        expect(row).toHaveTextContent(precondition);
      }
      expect(row).toHaveTextContent(entry.postStateAssertion);
      expect(row).toHaveTextContent(entry.stateProbe);
      expect(row).toHaveTextContent(entry.rollbackStrategy);
      for (const control of entry.riskControls) {
        expect(row).toHaveTextContent(control);
      }
      expect(row).toHaveTextContent(entry.e2eScenario);
      if (entry.rollbackActionId) {
        expect(row).toHaveTextContent(entry.rollbackActionId);
      }
      if (entry.daoExecutorRequired) {
        expect(row).toHaveTextContent(/DAO/i);
      }
    }
  });

  it("renders the storage lifecycle hardening matrix with extend posture rows", () => {
    render(<ContractsPage />);
    const snapshot = buildContractsStorageLifecycleSnapshot();

    expect(screen.getByTestId("contracts-storage-lifecycle-panel")).toBeInTheDocument();
    expect(screen.getByTestId("contracts-storage-grid")).toHaveClass(
      "contracts-storage-grid",
    );
    expect(screen.getByTestId("contracts-storage-lifecycle-panel")).toHaveClass(
      "contracts-storage-workspace-panel",
    );
    expect(screen.getByTestId("contracts-storage-runbook-summary")).toHaveTextContent(
      "EXTEND_STORAGE_TTL",
    );
    expect(screen.getByTestId("contracts-storage-class-coverage")).toHaveTextContent(
      /persistent/i,
    );
    expect(screen.getByTestId("contracts-storage-safeguards")).toHaveTextContent(
      /dry-run/i,
    );
    expect(screen.getByTestId("contracts-storage-lifecycle-table")).toBeInTheDocument();
    for (const entry of snapshot.entries) {
      const row = screen.getByTestId(`contracts-storage-lifecycle-row-${entry.id}`);
      expect(row).toHaveTextContent(entry.title);
      expect(row).toHaveTextContent(entry.envKey);
      expect(row).toHaveTextContent(entry.category);
      expect(row).toHaveTextContent(entry.extendScopes[0]);
      expect(row).toHaveTextContent("persistent");
      expect(row).toHaveTextContent("temporary");
      expect(row).toHaveTextContent(entry.temporaryPolicy);
      expect(row).toHaveTextContent(String(entry.warningThresholdLedgers));
      if (entry.contractId) {
        expect(row).toHaveTextContent(entry.contractId);
      }
      if (entry.command) {
        expect(row).toHaveTextContent(entry.command);
      }
    }
  });

  it("renders the internal security audit closeout with findings and invariants", () => {
    render(<ContractsPage />);
    const snapshot = buildContractsSecurityAuditSnapshot();

    expect(screen.getByTestId("contracts-security-audit-panel")).toBeInTheDocument();
    expect(screen.getByTestId("contracts-security-grid")).toHaveClass(
      "contracts-security-grid",
    );
    expect(screen.getByTestId("contracts-security-audit-panel")).toHaveClass(
      "contracts-security-workspace-panel",
    );
    expect(screen.getByTestId("contracts-security-audit-summary")).toHaveTextContent(
      "docs/CONTRACTS_SECURITY_AUDIT.md",
    );
    expect(screen.getByTestId("contracts-security-audit-summary")).toHaveTextContent(
      "undocumented critical/high remaining",
    );
    expect(screen.getByTestId("contracts-security-domain-summary")).toHaveTextContent(
      /access control/i,
    );
    expect(screen.getByTestId("contracts-security-scope")).toHaveTextContent(
      /Access control and DAO executor gating/i,
    );
    expect(screen.getByTestId("contracts-security-findings-table")).toHaveClass(
      "contracts-audit-table-cutover",
    );
    expect(screen.getByTestId("contracts-security-invariants-table")).toHaveClass(
      "contracts-audit-table-cutover",
    );

    for (const finding of snapshot.findings) {
      const row = screen.getByTestId(`contracts-security-finding-${finding.id}`);
      expect(row).toHaveClass("contracts-audit-row-cutover");
      expect(row).toHaveTextContent(finding.title);
      expect(row).toHaveTextContent(finding.status.replaceAll("_", " "));
      expect(row).toHaveTextContent(finding.resolution);
      expect(row).toHaveTextContent(finding.residualRisk);
      for (const testRef of finding.testRefs) {
        expect(row).toHaveTextContent(testRef);
      }
    }

    for (const invariant of snapshot.invariants) {
      const row = screen.getByTestId(`contracts-security-invariant-${invariant.id}`);
      expect(row).toHaveClass("contracts-audit-row-cutover");
      expect(row).toHaveTextContent(invariant.statement);
      expect(row).toHaveTextContent("passed");
      expect(row).toHaveTextContent(invariant.evidence);
    }
  });

  it("keeps the full typed-action catalog selectable without duplicate action ids", async () => {
    const user = userEvent.setup();
    render(<ContractsPage />);

    const actionSelect = screen.getByTestId("contracts-action-select") as HTMLSelectElement;
    const actionIds = Array.from(actionSelect.options)
      .map((option) => option.value)
      .filter((value) => value.length > 0);

    expect(actionIds.length).toBeGreaterThanOrEqual(80);
    expect(new Set(actionIds).size).toBe(actionIds.length);

    for (const actionId of actionIds) {
      await user.selectOptions(actionSelect, actionId);
      await waitFor(() => {
        expect((screen.getByTestId("contracts-action-select") as HTMLSelectElement).value).toBe(actionId);
      });
      expect(screen.getByTestId("contracts-contract-id-input")).toBeInTheDocument();
      expect(screen.getByTestId("contracts-run-preset-button")).toBeEnabled();
    }
  }, 40_000);

  it("executes every typed action with generated valid field values", async () => {
    const user = userEvent.setup();
    render(<ContractsPage />);

    const connectButton = screen.getByRole("button", { name: /connect wallet/i });
    await user.click(connectButton);
    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });

    const actionSelect = screen.getByTestId("contracts-action-select") as HTMLSelectElement;
    const actionIds = Array.from(actionSelect.options)
      .map((option) => option.value)
      .filter((value) => value.length > 0);

    for (const actionId of actionIds) {
      await selectAction(user, actionId);
      setFieldValue("contracts-contract-id-input", VALID_ADDRESS);

      const fieldElements = Array.from(
        document.querySelectorAll<HTMLElement>('[data-testid^="contracts-field-"]'),
      );

      for (const element of fieldElements) {
        const testId = element.getAttribute("data-testid");
        if (!testId?.startsWith("contracts-field-")) continue;
        const fieldKey = testId.replace("contracts-field-", "");
        const fieldValue = inferPresetFieldValue(fieldKey);
        if (element.tagName === "SELECT") {
          const select = element as HTMLSelectElement;
          const option =
            Array.from(select.options).find((candidate) => candidate.value === fieldValue) ??
            Array.from(select.options).find((candidate) => candidate.value && !candidate.disabled);
          if (option) {
            await user.selectOptions(select, option.value);
          }
          continue;
        }
        fireEvent.change(element, { target: { value: fieldValue } });
      }

      const beforeOps =
        sorobanMocks.simulateContractReadonly.mock.calls.length + txMocks.submitSignedTx.mock.calls.length;
      const daoGuardVisible = isDaoGuardVisible();
      await runPreset(user);
      if (daoGuardVisible) {
        await waitFor(() => {
          expect(screen.getByTestId("contracts-preset-error")).toHaveTextContent(/dao policy|governance/i);
        });
        expect(
          sorobanMocks.simulateContractReadonly.mock.calls.length + txMocks.submitSignedTx.mock.calls.length,
        ).toBe(beforeOps);
      } else {
        await waitFor(() => {
          expect(
            sorobanMocks.simulateContractReadonly.mock.calls.length +
              txMocks.submitSignedTx.mock.calls.length,
          ).toBeGreaterThan(beforeOps);
        });
        expect(screen.queryByTestId("contracts-preset-error")).not.toBeInTheDocument();
      }
    }
  }, 240_000);

  it("executes a typed read action and shows normalized result", async () => {
    const user = userEvent.setup();
    const view = render(<ContractsPage />);

    await user.selectOptions(view.getByTestId("contracts-action-select"), "executor-config");
    await user.clear(view.getByTestId("contracts-contract-id-input"));
    await user.type(view.getByTestId("contracts-contract-id-input"), "CEXECUTOR");
    await runPreset(user);

    await waitFor(() => {
      expect(sorobanMocks.simulateContractReadonly).toHaveBeenCalledWith(
        "CEXECUTOR",
        "config",
        expect.any(Array),
        undefined,
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("contracts-preset-status")).toHaveTextContent("Read call completed");
    });
  });

  it("supports typed read presets with required argument validation paths", async () => {
    const user = userEvent.setup();
    render(<ContractsPage />);

    const readScenarios: Array<{ actionId: string; fields?: Array<{ key: string; value: string }> }> = [
      { actionId: "executor-config" },
      { actionId: "arka-read-nav" },
      { actionId: "arka-read-fees" },
      { actionId: "arka-read-governor" },
      { actionId: "arka-read-denomination" },
      { actionId: "arka-read-share-token" },
      { actionId: "arka-read-swap-risk-policy" },
      { actionId: "arka-read-swap-oracle" },
      { actionId: "arka-read-allowed-routers" },
      { actionId: "arka-read-allowed-adapters" },
      { actionId: "arka-read-protocol-fee-policy" },
      { actionId: "arka-read-fee-state" },
      { actionId: "arka-preview-fee-settlement" },
      { actionId: "arka-read-whitelist" },
      {
        actionId: "arka-read-liquid-balance",
        fields: [{ key: "asset", value: VALID_ADDRESS }],
      },
      {
        actionId: "arka-read-shares-of",
        fields: [{ key: "owner", value: VALID_ADDRESS }],
      },
      { actionId: "arka-read-credit-protocols" },
      {
        actionId: "arka-read-credit-markets",
        fields: [{ key: "protocol", value: "Blend" }],
      },
      {
        actionId: "arka-read-credit-market-config",
        fields: [
          { key: "protocol", value: "Blend" },
          { key: "market_id", value: "0" },
        ],
      },
      { actionId: "arka-factory-read-protocol-treasury" },
      { actionId: "arka-factory-read-protocol-mgmt-fee-bps" },
      { actionId: "arka-factory-read-protocol-perf-fee-bps" },
      { actionId: "arka-factory-read-creation-fee-token" },
      { actionId: "arka-factory-read-creation-fee-amount" },
      { actionId: "arka-factory-read-share-token-implementation" },
      {
        actionId: "arka-factory-read-migrated-to",
        fields: [{ key: "old_arka", value: VALID_ADDRESS }],
      },
      {
        actionId: "arka-factory-read-migrated-from",
        fields: [{ key: "new_arka", value: VALID_ADDRESS }],
      },
      {
        actionId: "arka-factory-read-share-token-of",
        fields: [{ key: "arka", value: VALID_ADDRESS }],
      },
      {
        actionId: "arka-factory-read-arkas-by-manager",
        fields: [{ key: "manager", value: VALID_ADDRESS }],
      },
      { actionId: "arka-factory-read-arkas" },
      { actionId: "arka-registry-read-count" },
      {
        actionId: "arka-registry-read-count-by-manager",
        fields: [{ key: "manager", value: VALID_ADDRESS }],
      },
      {
        actionId: "arka-registry-read-is-registrar",
        fields: [{ key: "registrar", value: VALID_ADDRESS }],
      },
      { actionId: "arka-registry-read-arkas" },
      {
        actionId: "arka-registry-read-arkas-by-manager",
        fields: [{ key: "manager", value: VALID_ADDRESS }],
      },
      {
        actionId: "arka-registry-read-is-manager-curated",
        fields: [{ key: "manager", value: VALID_ADDRESS }],
      },
      {
        actionId: "arka-registry-read-is-delisted",
        fields: [{ key: "arka", value: VALID_ADDRESS }],
      },
      { actionId: "claims-manager-read-treasury" },
      { actionId: "claims-manager-read-governor" },
      { actionId: "claims-manager-read-next-incident-id" },
      {
        actionId: "claims-manager-read-covered-vault",
        fields: [{ key: "vault", value: VALID_ADDRESS }],
      },
      {
        actionId: "claims-manager-read-is-vault-frozen",
        fields: [{ key: "vault", value: VALID_ADDRESS }],
      },
      {
        actionId: "claims-manager-read-incident",
        fields: [{ key: "incident_id", value: "1" }],
      },
      { actionId: "oracle-guard-read-admin" },
      {
        actionId: "oracle-guard-read-stellar-asset-policy",
        fields: [{ key: "asset", value: VALID_ADDRESS }],
      },
      {
        actionId: "oracle-guard-inspect-stellar",
        fields: [{ key: "asset", value: VALID_ADDRESS }],
      },
      { actionId: "coverage-fund-read-governor" },
      { actionId: "coverage-fund-read-treasury" },
      { actionId: "coverage-fund-read-reserve-token" },
      { actionId: "coverage-fund-read-bootstrap-token" },
      { actionId: "coverage-fund-read-claim-capacity" },
      {
        actionId: "coverage-fund-quote-premium",
        fields: [{ key: "vault", value: VALID_ADDRESS }],
      },
      {
        actionId: "coverage-fund-read-stake-of",
        fields: [{ key: "user", value: VALID_ADDRESS }],
      },
      {
        actionId: "coverage-fund-read-pending-rewards",
        fields: [{ key: "user", value: VALID_ADDRESS }],
      },
      {
        actionId: "coverage-fund-read-covered-vault-policy",
        fields: [{ key: "vault", value: VALID_ADDRESS }],
      },
      {
        actionId: "coverage-fund-read-covered-nav",
        fields: [{ key: "vault", value: VALID_ADDRESS }],
      },
      {
        actionId: "coverage-fund-read-premiums-paid-by-vault",
        fields: [{ key: "vault", value: VALID_ADDRESS }],
      },
      { actionId: "coverage-fund-read-metrics" },
      {
        actionId: "coverage-vault-read-manager",
      },
      { actionId: "coverage-vault-read-governor" },
      { actionId: "coverage-vault-read-claims-manager" },
      { actionId: "coverage-vault-read-token" },
      { actionId: "coverage-vault-read-balance" },
      { actionId: "coverage-vault-read-max-withdrawable" },
      { actionId: "coverage-vault-read-claim-capacity" },
      {
        actionId: "manager-tier-read-points-of",
        fields: [{ key: "manager", value: VALID_ADDRESS }],
      },
      { actionId: "locked-arka-total-supply" },
      {
        actionId: "locked-arka-balance",
        fields: [{ key: "account", value: VALID_ADDRESS }],
      },
      {
        actionId: "locked-arka-locked-balance",
        fields: [{ key: "account", value: VALID_ADDRESS }],
      },
      {
        actionId: "locked-arka-lock-position",
        fields: [{ key: "account", value: VALID_ADDRESS }],
      },
      { actionId: "locked-arka-get-past-total-supply" },
      {
        actionId: "locked-arka-get-votes",
        fields: [{ key: "account", value: VALID_ADDRESS }],
      },
      {
        actionId: "locked-arka-get-past-votes",
        fields: [{ key: "account", value: VALID_ADDRESS }],
      },
      {
        actionId: "locked-arka-get-delegate",
        fields: [{ key: "account", value: VALID_ADDRESS }],
      },
      { actionId: "locked-arka-read-admin" },
      { actionId: "locked-arka-read-governor" },
      { actionId: "locked-arka-read-config" },
      { actionId: "manager-tier-read-thresholds" },
      { actionId: "manager-tier-read-governor" },
      {
        actionId: "executor-status",
        fields: [{ key: "operation_id", value: VALID_OPERATION_ID }],
      },
      {
        actionId: "executor-ready",
        fields: [{ key: "operation_id", value: VALID_OPERATION_ID }],
      },
      {
        actionId: "executor-operation",
        fields: [{ key: "operation_id", value: VALID_OPERATION_ID }],
      },
    ];

    for (const [index, scenario] of readScenarios.entries()) {
      await selectAction(user, scenario.actionId);
      setFieldValue("contracts-contract-id-input", VALID_ADDRESS);
      for (const field of scenario.fields ?? []) {
        await fillField(user, field.key, field.value);
      }
      await runPreset(user);
      await waitFor(() => {
        expect(sorobanMocks.simulateContractReadonly).toHaveBeenCalledTimes(index + 1);
      });
    }

    expect(sorobanMocks.simulateContractReadonly).toHaveBeenCalledTimes(readScenarios.length);
  }, 90_000);

  it("supports representative typed write presets across all governance domains", async () => {
    const user = userEvent.setup();
    render(<ContractsPage />);

    const connectButton = screen.getByRole("button", { name: /connect wallet/i });
    await user.click(connectButton);
    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });

    const writeScenarios: Array<{ actionId: string; fields: Array<{ key: string; value: string }> }> = [
      {
        actionId: "arka-set-governor",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "governor", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "arka-set-manager",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "manager", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "arka-set-router",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "router", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "arka-set-share-token",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "share_token", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "arka-set-allowed-venues",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "allowed_routers", value: `${VALID_ADDRESS},${VALID_ADDRESS}` },
          { key: "allowed_adapters", value: `${VALID_ADDRESS},${VALID_ADDRESS}` },
        ],
      },
      {
        actionId: "arka-set-protocol-fee-policy",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "treasury", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "arka-set-swap-risk-policy",
        fields: [{ key: "caller", value: VALID_ADDRESS }],
      },
      {
        actionId: "arka-set-swap-oracle",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "oracle", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "arka-set-blend-risk-policy",
        fields: [{ key: "caller", value: VALID_ADDRESS }],
      },
      {
        actionId: "arka-configure-credit-market",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "protocol", value: "Blend" },
          { key: "adapter", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "arka-settle-fees",
        fields: [],
      },
      {
        actionId: "arka-factory-set-governor",
        fields: [{ key: "governor", value: VALID_ADDRESS }],
      },
      {
        actionId: "arka-factory-set-implementation",
        fields: [{ key: "impl_wasm_hash", value: VALID_OPERATION_ID }],
      },
      {
        actionId: "arka-factory-set-share-token-implementation",
        fields: [{ key: "impl_wasm_hash", value: VALID_OPERATION_ID }],
      },
      {
        actionId: "arka-factory-set-registry",
        fields: [{ key: "registry", value: VALID_ADDRESS }],
      },
      {
        actionId: "arka-factory-set-protocol-treasury",
        fields: [{ key: "treasury", value: VALID_ADDRESS }],
      },
      {
        actionId: "arka-factory-set-protocol-fee-splits",
        fields: [],
      },
      {
        actionId: "arka-factory-set-creation-fee",
        fields: [{ key: "token", value: VALID_ADDRESS }],
      },
      {
        actionId: "arka-registry-init-admin",
        fields: [{ key: "admin", value: VALID_ADDRESS }],
      },
      {
        actionId: "arka-registry-set-registrar",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "registrar", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "arka-registry-register",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "manager", value: VALID_ADDRESS },
          { key: "arka", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "arka-registry-register-admin",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "manager", value: VALID_ADDRESS },
          { key: "arka", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "arka-registry-set-manager-curated",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "manager", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "arka-registry-set-delisted",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "arka", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "claims-manager-init",
        fields: [
          { key: "admin", value: VALID_ADDRESS },
          { key: "reserve_token", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "claims-manager-set-governor",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "governor", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "claims-manager-set-treasury",
        fields: [{ key: "caller", value: VALID_ADDRESS }],
      },
      {
        actionId: "claims-manager-set-risk-operator",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "operator", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "claims-manager-register-covered-vault",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "vault", value: VALID_ADDRESS },
          { key: "manager_vault", value: VALID_ADDRESS },
          { key: "community_fund", value: VALID_ADDRESS },
          { key: "recipient", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "claims-manager-trigger-incident",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "vault", value: VALID_ADDRESS },
          { key: "kind", value: "Oracle" },
          { key: "meta_hash", value: VALID_OPERATION_ID },
        ],
      },
      {
        actionId: "claims-manager-approve-incident",
        fields: [{ key: "caller", value: VALID_ADDRESS }],
      },
      {
        actionId: "claims-manager-reject-incident",
        fields: [{ key: "caller", value: VALID_ADDRESS }],
      },
      {
        actionId: "claims-manager-execute-incident",
        fields: [],
      },
      {
        actionId: "oracle-guard-init",
        fields: [{ key: "admin", value: VALID_ADDRESS }],
      },
      {
        actionId: "oracle-guard-set-admin",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "admin", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "oracle-guard-set-stellar-asset-policy",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "asset", value: VALID_ADDRESS },
          { key: "primary", value: VALID_ADDRESS },
          { key: "secondary", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "oracle-guard-clear-stellar-asset-policy",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "asset", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "coverage-fund-set-governor",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "governor", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "coverage-fund-set-claims-manager",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "claims_manager", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "coverage-fund-set-treasury",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "treasury", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "coverage-fund-set-economics-policy",
        fields: [{ key: "caller", value: VALID_ADDRESS }],
      },
      {
        actionId: "coverage-fund-set-covered-vault-policy",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "vault", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "coverage-fund-remove-covered-vault",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "vault", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "coverage-fund-fund-bootstrap-rewards",
        fields: [{ key: "caller", value: VALID_ADDRESS }],
      },
      {
        actionId: "coverage-fund-pay-premium",
        fields: [
          { key: "payer", value: VALID_ADDRESS },
          { key: "vault", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "coverage-fund-claim-from-community",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "recipient", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "coverage-vault-set-governor",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "governor", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "coverage-vault-set-lock-bps",
        fields: [{ key: "caller", value: VALID_ADDRESS }],
      },
      {
        actionId: "coverage-vault-set-claims-manager",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "claims_manager", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "coverage-vault-deposit",
        fields: [{ key: "from", value: VALID_ADDRESS }],
      },
      {
        actionId: "coverage-vault-withdraw",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "to", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "coverage-vault-claim-payout",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "recipient", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "manager-tier-set-governor",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "governor", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "manager-tier-add-points",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "manager", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "manager-tier-set-points",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "manager", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "manager-tier-set-thresholds",
        fields: [{ key: "caller", value: VALID_ADDRESS }],
      },
      {
        actionId: "locked-arka-init",
        fields: [
          { key: "admin", value: VALID_ADDRESS },
          { key: "token", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "locked-arka-set-admin",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "admin", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "locked-arka-set-governor",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "governor", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "locked-arka-create-lock",
        fields: [{ key: "account", value: VALID_ADDRESS }],
      },
      {
        actionId: "locked-arka-increase-amount",
        fields: [{ key: "account", value: VALID_ADDRESS }],
      },
      {
        actionId: "locked-arka-extend-lock",
        fields: [{ key: "account", value: VALID_ADDRESS }],
      },
      {
        actionId: "locked-arka-withdraw",
        fields: [{ key: "account", value: VALID_ADDRESS }],
      },
      {
        actionId: "locked-arka-delegate",
        fields: [
          { key: "account", value: VALID_ADDRESS },
          { key: "delegatee", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "locked-arka-set-vote-sequence",
        fields: [{ key: "sequence", value: "1" }],
      },
      {
        actionId: "executor-set-admin",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "admin", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "executor-set-min-delay",
        fields: [{ key: "caller", value: VALID_ADDRESS }],
      },
      {
        actionId: "executor-set-grace-period",
        fields: [{ key: "caller", value: VALID_ADDRESS }],
      },
      {
        actionId: "executor-set-governor",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "governor", value: VALID_ADDRESS },
        ],
      },
      {
        actionId: "executor-cancel",
        fields: [
          { key: "caller", value: VALID_ADDRESS },
          { key: "operation_id", value: VALID_OPERATION_ID },
        ],
      },
      {
        actionId: "executor-execute",
        fields: [{ key: "operation_id", value: VALID_OPERATION_ID }],
      },
    ];

    let submittedWrites = 0;
    let blockedByDao = 0;

    for (const scenario of writeScenarios) {
      await selectAction(user, scenario.actionId);
      setFieldValue("contracts-contract-id-input", VALID_ADDRESS);
      for (const field of scenario.fields) {
        await fillField(user, field.key, field.value);
      }
      const beforeSubmitted = txMocks.submitSignedTx.mock.calls.length;
      const beforeWait = txMocks.waitForTx.mock.calls.length;
      const daoGuardVisible = isDaoGuardVisible();
      await runPreset(user);
      if (daoGuardVisible) {
        blockedByDao += 1;
        await waitFor(() => {
          expect(screen.getByTestId("contracts-preset-error")).toHaveTextContent(/dao policy|governance/i);
        });
        expect(txMocks.submitSignedTx.mock.calls.length).toBe(beforeSubmitted);
        expect(txMocks.waitForTx.mock.calls.length).toBe(beforeWait);
      } else {
        submittedWrites += 1;
        await waitFor(() => {
          expect(txMocks.submitSignedTx.mock.calls.length).toBeGreaterThan(beforeSubmitted);
        });
        await waitFor(() => {
          expect(txMocks.waitForTx.mock.calls.length).toBeGreaterThan(beforeWait);
        });
        expect(screen.queryByTestId("contracts-preset-error")).not.toBeInTheDocument();
      }
    }

    expect(submittedWrites).toBeGreaterThan(0);
    expect(blockedByDao).toBeGreaterThan(0);
    expect(sorobanMocks.buildContractInvokeRaw).toHaveBeenCalledTimes(submittedWrites);
    expect(txMocks.signXdr).toHaveBeenCalledTimes(submittedWrites);
    expect(txMocks.waitForTx).toHaveBeenCalledTimes(submittedWrites);
  }, 120_000);

  it("enforces typed write required-field guardrails before tx build", async () => {
    const user = userEvent.setup();
    render(<ContractsPage />);

    const requiredScenarios: Array<{
      actionId: string;
      contractId: string;
      expectedError: RegExp;
    }> = [
      {
        actionId: "claims-manager-trigger-incident",
        contractId: VALID_ADDRESS,
        expectedError: /required/i,
      },
      {
        actionId: "claims-manager-approve-incident",
        contractId: VALID_ADDRESS,
        expectedError: /required/i,
      },
      {
        actionId: "coverage-fund-pay-premium",
        contractId: VALID_ADDRESS,
        expectedError: /required/i,
      },
      {
        actionId: "coverage-vault-withdraw",
        contractId: VALID_ADDRESS,
        expectedError: /required/i,
      },
      {
        actionId: "locked-arka-create-lock",
        contractId: VALID_ADDRESS,
        expectedError: /required/i,
      },
      {
        actionId: "executor-set-admin",
        contractId: VALID_ADDRESS,
        expectedError: /required/i,
      },
    ];

    for (const scenario of requiredScenarios) {
      await selectAction(user, scenario.actionId);
      setFieldValue("contracts-contract-id-input", scenario.contractId);
      await runPreset(user);
      await waitFor(() => {
        expect(screen.getByTestId("contracts-preset-error")).toHaveTextContent(
          scenario.expectedError,
        );
      });
    }

    expect(sorobanMocks.buildContractInvokeRaw).not.toHaveBeenCalled();
    expect(txMocks.signXdr).not.toHaveBeenCalled();
    expect(txMocks.submitSignedTx).not.toHaveBeenCalled();
    expect(txMocks.waitForTx).not.toHaveBeenCalled();
  });

  it("supports optional-address writes with explicit empty values", async () => {
    const user = userEvent.setup();
    render(<ContractsPage />);

    const connectButton = screen.getByRole("button", { name: /connect wallet/i });
    await user.click(connectButton);
    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });

    const optionalAddressScenarios: Array<{ actionId: string; emptyFieldKey: string }> = [
      { actionId: "executor-set-governor", emptyFieldKey: "governor" },
      { actionId: "claims-manager-approve-incident", emptyFieldKey: "recipient" },
    ];

    for (const [index, scenario] of optionalAddressScenarios.entries()) {
      await selectAction(user, scenario.actionId);
      setFieldValue("contracts-contract-id-input", VALID_ADDRESS);
      await fillField(user, "caller", VALID_ADDRESS);
      await fillField(user, scenario.emptyFieldKey, "");
      await runPreset(user);
      await waitFor(() => {
        expect(txMocks.submitSignedTx).toHaveBeenCalledTimes(index + 1);
      });
      await waitFor(() => {
        expect(txMocks.waitForTx).toHaveBeenCalledTimes(index + 1);
      });
      expect(screen.queryByTestId("contracts-preset-error")).not.toBeInTheDocument();
    }
  }, 30_000);

  it("validates typed write field formats before tx build", async () => {
    const user = userEvent.setup();
    render(<ContractsPage />);

    await selectAction(user, "coverage-fund-pay-premium");
    setFieldValue("contracts-contract-id-input", VALID_ADDRESS);
    await fillField(user, "payer", VALID_ADDRESS);
    await fillField(user, "vault", "not-an-address");
    await runPreset(user);
    await waitFor(() => {
      expect(screen.getByTestId("contracts-preset-error")).toHaveTextContent(
        /invalid|address|encoded|string/i,
      );
    });

    await selectAction(user, "coverage-fund-pay-premium");
    setFieldValue("contracts-contract-id-input", VALID_ADDRESS);
    await fillField(user, "payer", VALID_ADDRESS);
    await fillField(user, "vault", VALID_ADDRESS);
    await fillField(user, "covered_nav", "abc");
    await runPreset(user);
    await waitFor(() => {
      expect(screen.getByTestId("contracts-preset-error")).toHaveTextContent(
        /expected integer|required/i,
      );
    });

    expect(sorobanMocks.buildContractInvokeRaw).not.toHaveBeenCalled();
    expect(txMocks.signXdr).not.toHaveBeenCalled();
    expect(txMocks.submitSignedTx).not.toHaveBeenCalled();
    expect(txMocks.waitForTx).not.toHaveBeenCalled();
  });

  it("blocks DAO-guarded writes in the typed lane and routes users to governance flow", async () => {
    const user = userEvent.setup();
    render(<ContractsPage />);

    await user.click(screen.getByRole("button", { name: /connect wallet/i }));
    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });

    await selectAction(user, "arka-set-governor");
    expect(screen.getByTestId("contracts-dao-guard-pill")).toBeInTheDocument();
    expect(screen.getByTestId("contracts-dao-guard-note")).toHaveTextContent(/governance/i);

    setFieldValue("contracts-contract-id-input", VALID_ADDRESS);
    await fillField(user, "caller", VALID_ADDRESS);
    await fillField(user, "governor", VALID_ADDRESS);
    await runPreset(user);

    await waitFor(() => {
      expect(screen.getByTestId("contracts-preset-error")).toHaveTextContent(/dao policy|governance/i);
    });
    expect(sorobanMocks.buildContractInvokeRaw).not.toHaveBeenCalled();
    expect(txMocks.signXdr).not.toHaveBeenCalled();
    expect(txMocks.submitSignedTx).not.toHaveBeenCalled();
    expect(txMocks.waitForTx).not.toHaveBeenCalled();
  });

  it("validates typed read field formats before readonly simulate", async () => {
    const user = userEvent.setup();
    render(<ContractsPage />);

    await selectAction(user, "coverage-fund-quote-premium");
    setFieldValue("contracts-contract-id-input", VALID_ADDRESS);
    await fillField(user, "vault", VALID_ADDRESS);
    await fillField(user, "covered_nav", "abc");
    await fillField(user, "coverage_period_bps", "50.00");
    await runPreset(user);
    await waitFor(() => {
      expect(screen.getByTestId("contracts-preset-error")).toHaveTextContent(
        /expected integer|required/i,
      );
    });

    await selectAction(user, "arka-read-liquid-balance");
    setFieldValue("contracts-contract-id-input", VALID_ADDRESS);
    await fillField(user, "asset", "not-an-address");
    await runPreset(user);
    await waitFor(() => {
      expect(screen.getByTestId("contracts-preset-error")).toHaveTextContent(/invalid|address/i);
    });

    expect(sorobanMocks.simulateContractReadonly).not.toHaveBeenCalled();
  });

  it("supports raw read and raw write contract flows", async () => {
    const user = userEvent.setup();
    render(<ContractsPage />);

    setFieldValue("contracts-raw-contract-input", VALID_ADDRESS);
    setFieldValue("contracts-raw-method-input", "config");
    fireEvent.change(screen.getByTestId("contracts-raw-args-input"), { target: { value: "[]" } });

    await user.click(screen.getByTestId("contracts-raw-read-button"));
    await waitFor(() => {
      expect(sorobanMocks.simulateContractReadonly).toHaveBeenCalledWith(
        VALID_ADDRESS,
        "config",
        [],
        undefined,
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("contracts-raw-status")).toHaveTextContent("Raw read call completed");
    });

    await user.click(screen.getByRole("button", { name: /connect wallet/i }));
    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("contracts-raw-write-button"));
    await waitFor(() =>
      expect(screen.getByTestId("transaction-confirm-dialog")).toHaveClass(
        "transaction-surface-confirm-dialog",
      ),
    );
    await user.click(screen.getByTestId("contracts-cancel-button"));

    await runRawWrite(user);
    await waitFor(() => {
      expect(sorobanMocks.buildContractInvokeRaw).toHaveBeenCalledWith(
        "GTESTWALLET",
        VALID_ADDRESS,
        "config",
        [],
      );
    });
    await waitFor(() => {
      expect(txMocks.submitSignedTx).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(txMocks.waitForTx).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("contracts-raw-error")).not.toBeInTheDocument();
  });

  it("keeps raw write wallet signer rejection visible and retryable without submission", async () => {
    const user = userEvent.setup();
    txMocks.signXdr.mockRejectedValueOnce(
      new Error("Wallet signature rejected by user"),
    );
    render(<ContractsPage />);

    await user.click(screen.getByRole("button", { name: /connect wallet/i }));
    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });

    setFieldValue("contracts-raw-contract-input", VALID_ADDRESS);
    setFieldValue("contracts-raw-method-input", "config");
    fireEvent.change(screen.getByTestId("contracts-raw-args-input"), {
      target: { value: "[]" },
    });

    await runRawWrite(user);
    await waitFor(() => {
      expect(screen.getByTestId("contracts-raw-error")).toHaveTextContent(
        /wallet signature rejected by user/i,
      );
    });
    expect(sorobanMocks.buildContractInvokeRaw).toHaveBeenCalledWith(
      "GTESTWALLET",
      VALID_ADDRESS,
      "config",
      [],
    );
    expect(txMocks.submitSignedTx).not.toHaveBeenCalled();
    expect(txMocks.waitForTx).not.toHaveBeenCalled();

    txMocks.signXdr.mockRejectedValueOnce(
      new Error("Wallet signature rejected by user"),
    );
    await runRawWrite(user);
    await waitFor(() => expect(txMocks.signXdr).toHaveBeenCalledTimes(2));
    expect(txMocks.submitSignedTx).not.toHaveBeenCalled();
  });

  it("shows deterministic validation errors for raw lane input guards", async () => {
    const user = userEvent.setup();
    render(<ContractsPage />);

    setFieldValue("contracts-raw-contract-input", "");
    await user.click(screen.getByTestId("contracts-raw-read-button"));
    await waitFor(() => {
      expect(screen.getByTestId("contracts-raw-error")).toHaveTextContent(/raw contract id is required/i);
    });

    setFieldValue("contracts-raw-contract-input", VALID_ADDRESS);
    setFieldValue("contracts-raw-method-input", "");
    await user.click(screen.getByTestId("contracts-raw-read-button"));
    await waitFor(() => {
      expect(screen.getByTestId("contracts-raw-error")).toHaveTextContent(/raw method is required/i);
    });

    setFieldValue("contracts-raw-method-input", "config");
    fireEvent.change(screen.getByTestId("contracts-raw-args-input"), { target: { value: "{" } });
    await user.click(screen.getByTestId("contracts-raw-read-button"));
    await waitFor(() => {
      expect(screen.getByTestId("contracts-raw-error")).toHaveTextContent(
        /unexpected token|end of json input|expected property name|json/i,
      );
    });
  });

  it("blocks DAO-sensitive raw writes outside the governance executor lane", async () => {
    const user = userEvent.setup();
    render(<ContractsPage />);

    setFieldValue("contracts-raw-contract-input", VALID_ADDRESS);
    setFieldValue("contracts-raw-method-input", "set_governor");
    fireEvent.change(screen.getByTestId("contracts-raw-args-input"), { target: { value: "[]" } });

    expect(screen.getByTestId("contracts-raw-dao-guard-note")).toHaveTextContent(/governance/i);

    await runRawWrite(user);
    await waitFor(() => {
      expect(screen.getByTestId("contracts-raw-error")).toHaveTextContent(/dao policy|governance/i);
    });
    expect(sorobanMocks.buildContractInvokeRaw).not.toHaveBeenCalled();
    expect(txMocks.signXdr).not.toHaveBeenCalled();
    expect(txMocks.submitSignedTx).not.toHaveBeenCalled();
    expect(txMocks.waitForTx).not.toHaveBeenCalled();
  });
});
