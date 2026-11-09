import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

import MigrationsPage from "@/app/migrations/page";
import { readGovernedComposerDraft } from "@/lib/workflows/governanceComposer";

const VALID_ADDRESS =
  "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW";
const VALID_HASH = "ab".repeat(32);

describe("MigrationsPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    fetchMock.mockReset();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/migrations");
    fetchMock.mockImplementation(async (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof Request
            ? input.url
            : "";
      if (url.includes("/api/migrations/simulate")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            source: "api_migrations_simulate",
            sourceAccount: "GCO7KAJ7WCIFDLAEDHKSFQRNQLR3SQ6JTIVSMYYFUC5KRTA2KG2QJYDE",
            summary: {
              total: 3,
              simulated: 3,
              failed: 0,
            },
            entries: [
              {
                id: "factory-implementation",
                title: "Factory implementation",
                method: "set_implementation",
                contractId: VALID_ADDRESS,
                status: "Simulated",
                tone: "positive",
                detail: "Simulated successfully.",
                xdrBytes: 512,
                argCount: 1,
              },
            ],
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          ok: true,
          snapshot: {
            factoryId:
              "CAP5PLAGVFFDGKIUER3BSL5XMUXF4SUGHKI5RYCD4YAS4RWWP755LDQG",
            registryId: VALID_ADDRESS,
            sourceArka: VALID_ADDRESS,
            targetArka: VALID_ADDRESS,
            implementationGetterSupported: true,
            currentImplementation: VALID_HASH,
            registryGetterSupported: true,
            currentRegistry: VALID_ADDRESS,
            currentShareTokenImplementation: VALID_HASH,
            migratedTo: "",
            migratedFrom: "",
            sourceShareToken: VALID_ADDRESS,
            targetShareToken: VALID_ADDRESS,
          },
        }),
      };
    });
  });

  it("renders migration inspection and queues governance drafts", async () => {
    const user = userEvent.setup();
    render(<MigrationsPage />);

    await waitFor(() =>
      expect(screen.getByTestId("migration-status")).toHaveTextContent(
        "Migration inspection refreshed.",
      ),
    );

    expect(screen.getByTestId("migrations-workspace-summary")).toHaveTextContent(
      "Plan",
    );
    expect(screen.getByTestId("migrations-workspace-panel")).toHaveClass(
      "migrations-utility-grid",
    );
    expect(screen.getByTestId("migrations-workspace-tab-plan")).toHaveAttribute(
      "aria-controls",
      "migrations-workspace-panel-plan",
    );
    expect(screen.getByTestId("migrations-workspace-panel")).toHaveAttribute(
      "id",
      "migrations-workspace-panel-plan",
    );
    expect(screen.getByTestId("migration-inspection-panel")).toHaveTextContent(
      "Share-token implementation",
    );
    expect(screen.getByTestId("migration-plan-panel")).toHaveClass(
      "migration-plan-workspace-panel",
    );
    expect(screen.getByTestId("migration-inspection-panel")).toHaveClass(
      "migration-inspection-workspace-panel",
    );
    expect(
      screen.getByTestId("migration-current-share-token-implementation"),
    ).toHaveTextContent(VALID_HASH);

    await user.click(screen.getByTestId("migrations-workspace-tab-export"));
    expect(screen.getByTestId("migrations-workspace-tab-export")).toHaveAttribute(
      "aria-controls",
      "migrations-workspace-panel-export",
    );
    expect(screen.getByTestId("migrations-workspace-panel")).toHaveAttribute(
      "id",
      "migrations-workspace-panel-export",
    );
    expect(screen.getByTestId("migration-export-panel")).toHaveClass(
      "migration-export-workspace-panel",
    );
    expect(screen.getByTestId("migration-handoff-panel")).toHaveClass(
      "migration-handoff-workspace-panel",
    );
    expect(screen.getByTestId("migration-bundle-table")).toHaveTextContent(
      "Factory implementation",
    );
    expect(
      screen.getByTestId("migration-open-implementation-governance"),
    ).toBeDisabled();
    expect(
      screen.getByTestId("migration-open-implementation-governance"),
    ).not.toHaveAttribute("href");
    expect(
      screen.getByTestId("migration-open-share-token-governance"),
    ).toBeDisabled();
    expect(
      screen.getByTestId("migration-open-registry-governance"),
    ).toHaveAttribute("href", "/governance/console?draft=governed-composer");

    await user.click(screen.getByTestId("migrations-workspace-tab-plan"));
    await user.clear(screen.getByTestId("migration-implementation-hash-input"));
    await user.type(
      screen.getByTestId("migration-implementation-hash-input"),
      VALID_HASH,
    );
    await user.type(
      screen.getByTestId("migration-share-token-hash-input"),
      VALID_HASH,
    );

    await user.click(screen.getByTestId("migrations-workspace-tab-verify"));
    expect(screen.getByTestId("migrations-workspace-panel")).toHaveAttribute(
      "id",
      "migrations-workspace-panel-verify",
    );
    expect(screen.getByTestId("migration-verification-panel")).toHaveClass(
      "migration-verification-workspace-panel",
    );
    expect(screen.getByTestId("migration-dry-run-panel")).toHaveClass(
      "migration-dry-run-workspace-panel",
    );
    expect(screen.getByTestId("migration-verification-table")).toHaveTextContent(
      "Share-token implementation",
    );
    expect(screen.getByTestId("migration-dry-run-table")).toHaveTextContent(
      "Factory implementation post-check",
    );
    expect(
      screen.getByTestId("migration-dry-run-row-share-token-post-check"),
    ).toHaveTextContent("Already aligned");
    expect(
      screen.getByTestId("migration-verification-row-share-token-implementation"),
    ).toHaveTextContent("Aligned");

    await user.click(screen.getByTestId("migrations-workspace-tab-export"));
    expect(
      screen.getByTestId("migration-open-implementation-governance"),
    ).toHaveAttribute("href", "/governance/console?draft=governed-composer");
    expect(
      screen.getByTestId("migration-open-share-token-governance"),
    ).toHaveAttribute("href", "/governance/console?draft=governed-composer");
    await user.click(
      screen.getByTestId("migration-open-implementation-governance"),
    );

    const draft = readGovernedComposerDraft();
    expect(draft?.templateId).toBe("factory-implementation");
    expect(draft?.fieldValues.impl_wasm_hash).toBe(VALID_HASH);
    expect(screen.getByTestId("migration-copy-bundle")).toBeVisible();
    expect(screen.getByTestId("migration-bundle-json")).toHaveTextContent(
      '"kind": "migration-governance-bundle"',
    );
    expect(screen.getByTestId("migration-bundle-json")).toHaveTextContent(
      '"templateId": "factory-implementation"',
    );

    await user.click(screen.getByTestId("migrations-workspace-tab-simulate"));
    expect(screen.getByTestId("migrations-workspace-panel")).toHaveAttribute(
      "id",
      "migrations-workspace-panel-simulate",
    );
    expect(screen.getByTestId("migration-simulation-panel")).toHaveClass(
      "migration-simulation-workspace-panel",
    );
    await user.click(screen.getByTestId("migration-simulate-button"));

    await waitFor(() =>
      expect(screen.getByTestId("migration-simulation-status")).toHaveTextContent(
        "Simulated 3/3 governed migration writes.",
      ),
    );
    expect(
      screen.getByTestId("migration-simulation-row-factory-implementation"),
    ).toHaveTextContent("512 bytes / 1 args");
    expect(
      screen.getByTestId("migration-simulation-source-note"),
    ).toHaveTextContent("GCO7KAJ7WCIFDLAEDHKSFQRNQLR3SQ6JTIVSMYYFUC5KRTA2KG2QJYDE");
  }, 20_000);

  it("surfaces degraded inspection state and recovers on retry", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          ok: false,
          error: "Factory inspection offline.",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          snapshot: {
            factoryId:
              "CAP5PLAGVFFDGKIUER3BSL5XMUXF4SUGHKI5RYCD4YAS4RWWP755LDQG",
            registryId: VALID_ADDRESS,
            sourceArka: VALID_ADDRESS,
            targetArka: VALID_ADDRESS,
            implementationGetterSupported: true,
            currentImplementation: VALID_HASH,
            registryGetterSupported: true,
            currentRegistry: VALID_ADDRESS,
            currentShareTokenImplementation: VALID_HASH,
            migratedTo: "",
            migratedFrom: "",
            sourceShareToken: VALID_ADDRESS,
            targetShareToken: VALID_ADDRESS,
          },
        }),
      });

    render(<MigrationsPage />);

    await waitFor(() =>
      expect(screen.getByTestId("migration-error")).toHaveTextContent(
        "Factory inspection offline.",
      ),
    );
    expect(screen.getByTestId("migration-inspection-mode-note")).toHaveTextContent(
      "Factory inspection is currently unavailable",
    );

    await user.click(screen.getByTestId("migration-inspect-button"));

    await waitFor(() =>
      expect(screen.getByTestId("migration-status")).toHaveTextContent(
        "Migration inspection refreshed.",
      ),
    );
    expect(screen.getByTestId("migration-inspection-mode-note")).toHaveTextContent(
      "Latest factory inspection is live.",
    );
  });

  it("keeps governed write simulation degraded, disabled in flight and retryable", async () => {
    const user = userEvent.setup();
    let simulateRequests = 0;
    let releaseFirstSimulation: (() => void) | null = null;

    fetchMock.mockImplementation(async (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof Request
            ? input.url
            : "";

      if (url.includes("/api/migrations/simulate")) {
        simulateRequests += 1;
        if (simulateRequests === 1) {
          return await new Promise((resolve) => {
            releaseFirstSimulation = () =>
              resolve({
                ok: false,
                json: async () => ({
                  ok: false,
                  error: "Migration simulation offline.",
                }),
              });
          });
        }

        return {
          ok: true,
          json: async () => ({
            ok: true,
            source: "api_migrations_simulate",
            sourceAccount:
              "GCO7KAJ7WCIFDLAEDHKSFQRNQLR3SQ6JTIVSMYYFUC5KRTA2KG2QJYDE",
            summary: {
              total: 3,
              simulated: 3,
              failed: 0,
            },
            entries: [
              {
                id: "factory-implementation",
                title: "Factory implementation",
                method: "set_implementation",
                contractId: VALID_ADDRESS,
                status: "Simulated",
                tone: "positive",
                detail: "Simulated successfully.",
                xdrBytes: 512,
                argCount: 1,
              },
            ],
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          ok: true,
          snapshot: {
            factoryId:
              "CAP5PLAGVFFDGKIUER3BSL5XMUXF4SUGHKI5RYCD4YAS4RWWP755LDQG",
            registryId: VALID_ADDRESS,
            sourceArka: VALID_ADDRESS,
            targetArka: VALID_ADDRESS,
            implementationGetterSupported: true,
            currentImplementation: VALID_HASH,
            registryGetterSupported: true,
            currentRegistry: VALID_ADDRESS,
            currentShareTokenImplementation: VALID_HASH,
            migratedTo: "",
            migratedFrom: "",
            sourceShareToken: VALID_ADDRESS,
            targetShareToken: VALID_ADDRESS,
          },
        }),
      };
    });

    render(<MigrationsPage />);

    await waitFor(() =>
      expect(screen.getByTestId("migration-status")).toHaveTextContent(
        "Migration inspection refreshed.",
      ),
    );

    await user.type(screen.getByTestId("migration-implementation-hash-input"), VALID_HASH);
    await user.type(screen.getByTestId("migration-share-token-hash-input"), VALID_HASH);
    await user.click(screen.getByTestId("migrations-workspace-tab-simulate"));
    await user.click(screen.getByTestId("migration-simulate-button"));

    await waitFor(() =>
      expect(screen.getByTestId("migration-simulate-button")).toBeDisabled(),
    );
    const releaseSimulation = releaseFirstSimulation as (() => void) | null;
    if (!releaseSimulation) {
      throw new Error("Simulation release hook was not installed.");
    }
    releaseSimulation();

    await waitFor(() =>
      expect(screen.getByTestId("migration-simulation-error")).toHaveTextContent(
        "Migration simulation offline.",
      ),
    );
    expect(screen.getByTestId("migration-simulation-empty")).toHaveTextContent(
      "Run a write simulation",
    );
    expect(screen.getByTestId("migration-simulate-button")).toBeEnabled();

    await user.click(screen.getByTestId("migration-simulate-button"));

    await waitFor(() =>
      expect(screen.getByTestId("migration-simulation-status")).toHaveTextContent(
        "Simulated 3/3 governed migration writes.",
      ),
    );
    expect(
      screen.getByTestId("migration-simulation-row-factory-implementation"),
    ).toHaveTextContent("512 bytes / 1 args");
    expect(simulateRequests).toBe(2);
  });

  it("invalidates stale simulation rows when the migration plan changes", async () => {
    const user = userEvent.setup();
    render(<MigrationsPage />);

    await waitFor(() =>
      expect(screen.getByTestId("migration-status")).toHaveTextContent(
        "Migration inspection refreshed.",
      ),
    );

    await user.type(screen.getByTestId("migration-implementation-hash-input"), VALID_HASH);
    await user.type(screen.getByTestId("migration-share-token-hash-input"), VALID_HASH);
    await user.click(screen.getByTestId("migrations-workspace-tab-simulate"));
    await user.click(screen.getByTestId("migration-simulate-button"));

    await waitFor(() =>
      expect(screen.getByTestId("migration-simulation-status")).toHaveTextContent(
        "Simulated 3/3 governed migration writes.",
      ),
    );
    expect(
      screen.getByTestId("migration-simulation-row-factory-implementation"),
    ).toBeVisible();

    await user.click(screen.getByTestId("migrations-workspace-tab-plan"));
    await user.clear(screen.getByTestId("migration-share-token-hash-input"));
    await user.type(
      screen.getByTestId("migration-share-token-hash-input"),
      "cd".repeat(32),
    );
    await user.click(screen.getByTestId("migrations-workspace-tab-simulate"));

    await waitFor(() =>
      expect(screen.getByTestId("migration-simulation-error")).toHaveTextContent(
        "Migration plan changed after the last simulation.",
      ),
    );
    expect(
      screen.queryByTestId("migration-simulation-row-factory-implementation"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("migration-simulation-empty")).toHaveTextContent(
      "Run a write simulation",
    );
    expect(screen.getByTestId("migration-simulation-source-note")).toHaveTextContent(
      "Pending simulation",
    );
  }, 20_000);
});
