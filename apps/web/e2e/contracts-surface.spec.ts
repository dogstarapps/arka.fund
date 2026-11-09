import { expect, test, type Locator, type Page } from "@playwright/test";
import { enableOperatorMode } from "./helpers/operator-mode";

test.beforeEach(async ({ page }) => {
  await enableOperatorMode(page);
});

async function confirmContractsIfVisible(page: Page): Promise<void> {
  const confirmButton = page.getByTestId("contracts-confirm-button");
  if (await confirmButton.count()) {
    await confirmButton.click();
  }
}

async function expectNoUnresolvedSurfaceCopy(locator: Locator): Promise<void> {
  const text = await locator.innerText();
  expect(text).not.toMatch(/\b(undefined|null|NaN|TODO|lorem|fake|stub)\b/i);
}

test("contracts surface exposes typed and raw execution lanes", async ({ page }) => {
  await page.goto("/contracts");

  await expect(page.locator("main")).toHaveClass(/contracts-fidelity-shell/);
  await expect(page.getByRole("heading", { name: /Contract Control Center/i })).toBeVisible();
  await expect(page.getByTestId("contracts-stage-signals")).toHaveClass(
    /contracts-operator-summary/,
  );
  await expect(page.getByTestId("contracts-execution-grid")).toHaveClass(
    /contracts-execution-grid/,
  );
  await expect(page.getByTestId("contracts-preset-panel")).toContainText("Typed actions");
  await expect(page.getByTestId("contracts-preset-panel")).toHaveClass(
    /contracts-typed-workspace-panel/,
  );
  await expect(page.getByTestId("contracts-preset-panel")).toHaveClass(
    /contracts-command-frame-cutover/,
  );
  await expect(page.getByTestId("contracts-preset-table")).toHaveClass(
    /contracts-control-table-cutover/,
  );
  await expect(page.getByTestId("contracts-raw-panel")).toContainText("Raw invoke lane");
  await expect(page.getByTestId("contracts-raw-panel")).toHaveClass(
    /contracts-raw-workspace-panel/,
  );
  await expect(page.getByTestId("contracts-raw-table")).toHaveClass(
    /contracts-control-table-cutover/,
  );
  await expect(page.getByTestId("contracts-run-preset-button")).toBeVisible();
  await expect(page.getByTestId("contracts-raw-read-button")).toBeVisible();
  await expect(page.getByTestId("contracts-raw-write-button")).toBeVisible();
});

test("contracts surface supports action switching and local validation paths", async ({ page }) => {
  await page.goto("/contracts");

  const actionSelect = page.getByTestId("contracts-action-select");
  const runPresetButton = page.getByTestId("contracts-run-preset-button");

  await actionSelect.selectOption("arka-set-allowed-venues");
  await expect(page.getByTestId("contracts-field-allowed_routers")).toBeVisible();
  await expect(page.getByTestId("contracts-field-allowed_adapters")).toBeVisible();

  await actionSelect.selectOption("arka-set-governor");
  await expect(page.getByTestId("contracts-dao-guard-pill")).toBeVisible();
  await expect(page.getByTestId("contracts-dao-guard-note")).toContainText(/governance/i);

  await actionSelect.selectOption("executor-cancel");
  await expect(page.getByTestId("contracts-dao-guard-pill")).toHaveCount(0);
  await expect(page.getByTestId("contracts-field-operation_id")).toBeVisible();

  await page.getByTestId("contracts-contract-id-input").fill("");
  await runPresetButton.click();
  await confirmContractsIfVisible(page);
  await expect(page.getByTestId("contracts-preset-error")).toContainText(/contract id is required/i);

  await page.getByTestId("contracts-raw-contract-input").fill("");
  await page.getByTestId("contracts-raw-method-input").fill("config");
  await page.getByTestId("contracts-raw-args-input").fill("[]");
  await page.getByTestId("contracts-raw-read-button").click();
  await expect(page.getByTestId("contracts-raw-error")).toContainText(/raw contract id is required/i);

  await page.getByTestId("contracts-raw-contract-input").fill("CEXAMPLE");
  await page.getByTestId("contracts-raw-method-input").fill("set_governor");
  await page.getByTestId("contracts-raw-args-input").fill("[]");
  await expect(page.getByTestId("contracts-raw-dao-guard-note")).toContainText(/governance/i);
  await page.getByTestId("contracts-raw-write-button").click();
  await confirmContractsIfVisible(page);
  await expect(page.getByTestId("contracts-raw-error")).toContainText(/dao policy|governance/i);

  await page.getByTestId("contracts-raw-method-input").fill("config");
  await page.getByTestId("contracts-raw-args-input").fill("{");
  await page.getByTestId("contracts-raw-read-button").click();
  await expect(page.getByTestId("contracts-raw-error")).toContainText(/json|unexpected token|position|raw args/i);
});

test("contracts write confirmation supports cancel, blocked confirm and retry without mutating form state", async ({
  page,
}) => {
  const validAddress =
    "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW";

  await page.goto("/contracts");
  await expect(page.getByTestId("contracts-raw-panel")).toBeVisible();

  await page.getByTestId("contracts-raw-contract-input").fill(validAddress);
  await page.getByTestId("contracts-raw-method-input").fill("set_governor");
  await page.getByTestId("contracts-raw-args-input").fill("[]");
  await expect(page.getByTestId("contracts-raw-dao-guard-note")).toContainText(
    /governance/i,
  );

  await page.getByTestId("contracts-raw-write-button").click();
  await expect(page.getByTestId("contracts-confirm-button")).toBeVisible();
  await expect(page.getByTestId("contracts-cancel-button")).toBeVisible();
  await expect(page.getByTestId("transaction-confirm-dialog")).toHaveClass(
    /transaction-surface-confirm-dialog/,
  );
  await expect(page.getByRole("dialog")).toContainText("set_governor");
  await page.getByTestId("contracts-cancel-button").click();

  await expect(page.getByTestId("contracts-confirm-button")).toHaveCount(0);
  await expect(page.getByTestId("contracts-raw-contract-input")).toHaveValue(
    validAddress,
  );
  await expect(page.getByTestId("contracts-raw-method-input")).toHaveValue(
    "set_governor",
  );
  await expect(page.getByTestId("contracts-raw-args-input")).toHaveValue("[]");
  await expect(page.getByTestId("contracts-raw-error")).toHaveCount(0);

  await page.getByTestId("contracts-raw-write-button").click();
  await expect(page.getByTestId("contracts-confirm-button")).toBeVisible();
  await page.getByTestId("contracts-confirm-button").click();
  await expect(page.getByTestId("contracts-raw-error")).toContainText(
    /dao policy|governance/i,
  );

  await page.getByTestId("contracts-raw-write-button").click();
  await expect(page.getByTestId("contracts-confirm-button")).toBeVisible();
  await page.getByTestId("contracts-confirm-button").click();
  await expect(page.getByTestId("contracts-raw-error")).toContainText(
    /dao policy|governance/i,
  );
  await expect(page.getByTestId("contracts-raw-contract-input")).toHaveValue(
    validAddress,
  );
  await expect(page.getByTestId("contracts-raw-method-input")).toHaveValue(
    "set_governor",
  );
});

test("contracts surface exposes machine-consumable critical mutation matrix", async ({
  page,
}) => {
  const response = await page.request.get("/api/contracts/mutation-matrix");
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    ok: boolean;
    entries: Array<{
      id: string;
      title: string;
      category: string;
      severity: "critical" | "high" | "medium";
      writeActionId: string;
      readActionId: string;
      rollbackActionId: string | null;
      preconditions: string[];
      postStateAssertion: string;
      stateProbe: string;
      rollbackStrategy: string;
      riskControls: string[];
      e2eScenario: string;
      contractId: string | null;
      contractRequirement: "runtime_input" | "configured";
      status: "ready" | "blocked_missing_contract" | "blocked_manual_runbook";
      daoExecutorRequired: boolean;
      executionLane: "wallet_backed" | "dao_executor" | "blocked_missing_contract" | "blocked_manual_runbook";
    }>;
    summary: {
      total: number;
      ready: number;
      blocked: number;
      daoExecutorRequired: number;
      walletBackedExecutable: number;
    };
  };

  expect(payload.ok).toBe(true);
  expect(payload.summary.total).toBe(payload.entries.length);
  expect(payload.summary.ready).toBeGreaterThan(0);
  expect(payload.summary.ready + payload.summary.blocked).toBe(payload.summary.total);
  expect(payload.summary.daoExecutorRequired).toBeGreaterThan(0);
  expect(payload.summary.walletBackedExecutable).toBeGreaterThanOrEqual(0);

  await page.goto("/contracts");
  await expect(page.getByTestId("contracts-mutation-matrix-panel")).toBeVisible();
  await expect(page.getByTestId("contracts-matrix-grid")).toHaveClass(
    /contracts-matrix-grid/,
  );
  await expect(page.getByTestId("contracts-mutation-matrix-panel")).toHaveClass(
    /contracts-mutation-workspace-panel/,
  );
  await expect(page.getByTestId("contracts-mutation-matrix-table")).toHaveClass(
    /contracts-audit-table-cutover/,
  );
  const availableActionIds = new Set(
    await page
      .getByTestId("contracts-action-select")
      .locator("option")
      .evaluateAll((options) =>
        options
          .map((option) => (option as HTMLOptionElement).value)
          .filter(Boolean),
      ),
  );
  expect(availableActionIds.size).toBeGreaterThanOrEqual(payload.entries.length);
  await expect(
    page.locator('[data-testid^="contracts-mutation-matrix-row-"]'),
  ).toHaveCount(payload.entries.length);

  for (const entry of payload.entries) {
    expect(availableActionIds.has(entry.writeActionId)).toBe(true);
    expect(availableActionIds.has(entry.readActionId)).toBe(true);
    if (entry.rollbackActionId) {
      expect(availableActionIds.has(entry.rollbackActionId)).toBe(true);
    }
    const row = page.getByTestId(`contracts-mutation-matrix-row-${entry.id}`);
    await expect(row).toHaveClass(/contracts-audit-row-cutover/);
    await expect(row).toContainText(entry.title);
    await expect(row).toContainText(entry.category);
    await expect(row).toContainText(entry.severity);
    await expect(row).toContainText(
      entry.executionLane === "dao_executor"
        ? "DAO executor"
        : entry.executionLane === "wallet_backed"
          ? "Wallet backed"
          : "Blocked",
    );
    await expect(row).toContainText(entry.writeActionId);
    await expect(row).toContainText(entry.readActionId);
    for (const precondition of entry.preconditions) {
      await expect(row).toContainText(precondition);
    }
    await expect(row).toContainText(entry.postStateAssertion);
    await expect(row).toContainText(entry.stateProbe);
    await expect(row).toContainText(entry.rollbackStrategy);
    for (const control of entry.riskControls) {
      await expect(row).toContainText(control);
    }
    await expect(row).toContainText(entry.e2eScenario);
    await expect(row).toContainText(entry.status === "ready" ? "ready" : "blocked");
    if (entry.rollbackActionId) {
      await expect(row).toContainText(entry.rollbackActionId);
    }
    if (entry.contractRequirement === "runtime_input") {
      await expect(row).toContainText("Runtime Arka input");
    } else if (entry.contractId) {
      await expect(row).toContainText(entry.contractId);
    } else {
      await expect(row).toContainText("Missing");
    }
    if (entry.daoExecutorRequired) {
      await expect(row).toContainText("DAO");
    }
    await expectNoUnresolvedSurfaceCopy(row);
  }
});

test("contracts surface exposes machine-consumable storage lifecycle matrix", async ({
  page,
}) => {
  const response = await page.request.get("/api/contracts/storage-lifecycle");
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    ok: boolean;
    entries: Array<{
      id: string;
      title: string;
      category: string;
      envKey: string;
      required: boolean;
      contractId: string | null;
      status:
        | "ready"
        | "blocked_missing_contract"
        | "blocked_missing_source_account"
        | "optional_missing_contract";
      storageClassesAudited: string[];
      extendScopes: string[];
      temporaryPolicy: string;
      cadenceDays: number;
      warningThresholdLedgers: number;
      command: string | null;
    }>;
    summary: {
      total: number;
      ready: number;
      blocked: number;
      optionalMissing: number;
      byStorageClass: Record<string, { audited: number; extendable: number; excluded: number }>;
    };
    runbook: {
      defaultCadenceDays: number;
      liveRunConfirmationEnv: string;
      liveRunConfirmationValue: string;
      safeguards: string[];
    };
  };

  expect(payload.ok).toBe(true);
  expect(payload.summary.total).toBe(payload.entries.length);
  expect(payload.summary.ready + payload.summary.blocked + payload.summary.optionalMissing).toBe(
    payload.summary.total,
  );
  expect(payload.summary.byStorageClass.persistent.audited).toBe(payload.entries.length);
  expect(payload.summary.byStorageClass.instance.extendable).toBe(payload.entries.length);
  expect(payload.summary.byStorageClass.temporary.extendable).toBe(0);
  expect(payload.runbook.liveRunConfirmationEnv).toBe("ARKAFUND_STORAGE_EXTEND_CONFIRM");
  expect(payload.runbook.liveRunConfirmationValue).toBe("EXTEND_STORAGE_TTL");

  await page.goto("/contracts");
  await expect(page.getByTestId("contracts-storage-lifecycle-panel")).toBeVisible();
  await expect(page.getByTestId("contracts-storage-grid")).toHaveClass(
    /contracts-storage-grid/,
  );
  await expect(page.getByTestId("contracts-storage-lifecycle-panel")).toHaveClass(
    /contracts-storage-workspace-panel/,
  );
  await expect(page.getByTestId("contracts-storage-lifecycle-table")).toHaveClass(
    /contracts-audit-table-cutover/,
  );
  await expect(page.getByTestId("contracts-storage-runbook-summary")).toContainText(
    "EXTEND_STORAGE_TTL",
  );
  await expect(page.getByTestId("contracts-storage-class-coverage")).toContainText(
    /persistent/i,
  );
  await expect(page.getByTestId("contracts-storage-safeguards")).toContainText(
    /dry-run/i,
  );
  await expect(
    page.locator('[data-testid^="contracts-storage-lifecycle-row-"]'),
  ).toHaveCount(payload.entries.length);

  for (const entry of payload.entries) {
    const row = page.getByTestId(`contracts-storage-lifecycle-row-${entry.id}`);
    await row.scrollIntoViewIfNeeded();
    await expect(row).toHaveClass(/contracts-audit-row-cutover/);
    await expect(row).toContainText(entry.title);
    await expect(row).toContainText(entry.category);
    await expect(row).toContainText(entry.envKey);
    await expect(row).toContainText(entry.status);
    await expect(row).toContainText(entry.extendScopes[0]);
    await expect(row).toContainText("persistent");
    await expect(row).toContainText("temporary");
    await expect(row).toContainText(String(entry.cadenceDays));
    await expect(row).toContainText(String(entry.warningThresholdLedgers));
    await expect(row).toContainText("intentionally excluded");
    if (entry.contractId) {
      await expect(row).toContainText(entry.contractId);
    } else if (entry.required) {
      await expect(row).toContainText("Required contract is missing");
    } else {
      await expect(row).toContainText("Optional contract is not configured");
    }
    if (entry.command) {
      await expect(row).toContainText("stellar contract extend");
    }
    await expectNoUnresolvedSurfaceCopy(row);
  }
});

test("contracts surface exposes internal security audit closeout", async ({
  page,
}) => {
  const response = await page.request.get("/api/contracts/security-audit");
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    ok: boolean;
    auditDate: string;
    artifact: string;
    findings: Array<{
      id: string;
      title: string;
      status: "resolved" | "accepted_risk" | "blocking";
      severity: "critical" | "high" | "medium" | "low";
      resolution: string;
      residualRisk: string;
      testRefs: string[];
    }>;
    invariants: Array<{
      id: string;
      statement: string;
      status: "passed" | "failed";
      evidence: string;
    }>;
    releaseGate: {
      ready: boolean;
      status: "ready" | "blocked";
      checks: {
        criticalHighBlockingFindingCount: number;
        failedInvariantCount: number;
      };
    };
  };

  expect(payload.ok).toBe(true);
  expect(payload.auditDate).toBe("2026-05-20");
  expect(payload.artifact).toBe("docs/CONTRACTS_SECURITY_AUDIT.md");
  expect(payload.releaseGate.ready).toBe(true);
  expect(payload.releaseGate.status).toBe("ready");
  expect(payload.releaseGate.checks.criticalHighBlockingFindingCount).toBe(0);
  expect(payload.releaseGate.checks.failedInvariantCount).toBe(0);
  expect(payload.findings.length).toBeGreaterThanOrEqual(10);
  expect(payload.invariants.length).toBeGreaterThanOrEqual(10);
  expect(payload.findings.every((finding) => finding.status !== "blocking")).toBe(true);
  expect(payload.invariants.every((invariant) => invariant.status === "passed")).toBe(true);

  await page.goto("/contracts");
  await expect(page.getByTestId("contracts-security-audit-panel")).toBeVisible();
  await expect(page.getByTestId("contracts-security-grid")).toHaveClass(
    /contracts-security-grid/,
  );
  await expect(page.getByTestId("contracts-security-audit-panel")).toHaveClass(
    /contracts-security-workspace-panel/,
  );
  await expect(page.getByTestId("contracts-security-audit-summary")).toContainText(
    "docs/CONTRACTS_SECURITY_AUDIT.md",
  );
  await expect(page.getByTestId("contracts-security-audit-summary")).toContainText(
    "undocumented critical/high remaining",
  );
  await expect(page.getByTestId("contracts-security-domain-summary")).toContainText(
    /access control/i,
  );
  await expect(
    page.locator('[data-testid^="contracts-security-finding-"]'),
  ).toHaveCount(payload.findings.length);
  await expect(
    page.locator('[data-testid^="contracts-security-invariant-"]'),
  ).toHaveCount(payload.invariants.length);

  for (const finding of payload.findings) {
    const row = page.getByTestId(`contracts-security-finding-${finding.id}`);
    await row.scrollIntoViewIfNeeded();
    await expect(row).toHaveClass(/contracts-audit-row-cutover/);
    await expect(row).toContainText(finding.title);
    await expect(row).toContainText(finding.status.replaceAll("_", " "));
    await expect(row).toContainText(finding.resolution);
    await expect(row).toContainText(finding.residualRisk);
    for (const testRef of finding.testRefs) {
      await expect(row).toContainText(testRef);
    }
    await expectNoUnresolvedSurfaceCopy(row);
  }

  for (const invariant of payload.invariants) {
    const row = page.getByTestId(`contracts-security-invariant-${invariant.id}`);
    await row.scrollIntoViewIfNeeded();
    await expect(row).toHaveClass(/contracts-audit-row-cutover/);
    await expect(row).toContainText(invariant.statement);
    await expect(row).toContainText("passed");
    await expect(row).toContainText(invariant.evidence);
    await expectNoUnresolvedSurfaceCopy(row);
  }
});

test("contracts section navigation and responsive layout stay usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/contracts", { waitUntil: "domcontentloaded" });

  await expect(page.locator("main")).toHaveClass(/contracts-fidelity-shell/);
  for (const label of [
    "Typed actions",
    "Raw invoke",
    "Mutation matrix",
    "Storage lifecycle",
    "Security audit",
  ]) {
    await expect(page.getByRole("link", { name: label })).toBeVisible();
  }

  await page.getByRole("link", { name: "Mutation matrix" }).click();
  await expect(page.locator("#contracts-mutation-matrix")).toBeVisible();
  await page.getByRole("link", { name: "Storage lifecycle" }).click();
  await expect(page.locator("#contracts-storage-lifecycle")).toBeVisible();
  await page.getByRole("link", { name: "Security audit" }).click();
  await expect(page.locator("#contracts-security-audit")).toBeVisible();

  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(2);
});
