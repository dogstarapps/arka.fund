import { describe, expect, it } from "vitest";
import {
  buildMigrationDryRunRows,
  buildMigrationGovernanceBundle,
  buildMigrationPreflightRows,
  buildMigrationSpotlights,
  buildMigrationVerificationRows,
  deriveMigrationGovernanceHandoffState,
} from "@/lib/workflows/migrationWorkspace";

describe("migrationWorkspace", () => {
  it("marks a clear mapping posture when no source/target mappings exist", () => {
    const rows = buildMigrationPreflightRows({
      sourceArka: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      targetArka: "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      registryId: "CREGISTRY",
      implementationGetterSupported: true,
      currentImplementation: "cd".repeat(32),
      registryGetterSupported: true,
      currentRegistry: "CREGISTRY",
      currentShareTokenImplementation: "ab".repeat(32),
      migratedTo: null,
      migratedFrom: null,
      sourceShareToken: "CSHARESOURCE",
      targetShareToken: "CSHARETARGET",
    });

    expect(rows.find((row) => row.id === "source-map")?.state).toBe("Clear");
    expect(rows.find((row) => row.id === "target-map")?.state).toBe("Clear");
    expect(
      rows.find((row) => row.id === "share-token-implementation")?.state,
    ).toBe("Loaded");
  });

  it("derives review-oriented spotlights from preflight rows", () => {
    const rows = buildMigrationPreflightRows({
      sourceArka: "CSOURCE",
      targetArka: "CTARGET",
      registryId: "",
      implementationGetterSupported: false,
      currentImplementation: null,
      registryGetterSupported: false,
      currentRegistry: null,
      currentShareTokenImplementation: "",
      migratedTo: "CNEWTARGET",
      migratedFrom: null,
      sourceShareToken: null,
      targetShareToken: null,
    });
    const spotlights = buildMigrationSpotlights(rows);

    expect(spotlights).toHaveLength(3);
    expect(spotlights[0]?.state).toBe("Review");
    expect(spotlights[1]?.value).toContain("Mapped");
    expect(spotlights[2]?.value).toBe("Composer-ready");
  });

  it("builds a machine-consumable governance bundle with ready and missing entries", () => {
    const bundle = buildMigrationGovernanceBundle({
      factoryId: "CAP5PLAGVFFDGKIUER3BSL5XMUXF4SUGHKI5RYCD4YAS4RWWP755LDQG",
      sourceArka: "CSOURCE",
      targetArka: "CTARGET",
      registryId: "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
      implementationHash: "ab".repeat(32),
      shareTokenImplementationHash: "",
    });

    expect(bundle.entries).toHaveLength(3);
    expect(bundle.packages).toHaveLength(2);
    expect(bundle.entries.find((entry) => entry.id === "factory-implementation")?.status).toBe(
      "Ready",
    );
    expect(
      bundle.entries.find(
        (entry) => entry.id === "factory-share-token-implementation",
      )?.status,
    ).toBe("Missing input");
  });

  it("derives governance handoff state from validated migration packages", () => {
    const partialBundle = buildMigrationGovernanceBundle({
      factoryId: "CAP5PLAGVFFDGKIUER3BSL5XMUXF4SUGHKI5RYCD4YAS4RWWP755LDQG",
      sourceArka: "CSOURCE",
      targetArka: "CTARGET",
      registryId: "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
      implementationHash: "",
      shareTokenImplementationHash: "",
    });

    expect(
      deriveMigrationGovernanceHandoffState(
        partialBundle,
        "factory-implementation",
      ),
    ).toMatchObject({
      enabled: false,
      href: null,
      label: "Missing input",
    });

    expect(
      deriveMigrationGovernanceHandoffState(
        partialBundle,
        "factory-registry-binding",
      ),
    ).toMatchObject({
      enabled: true,
      href: "/governance/console?draft=governed-composer",
      label: "Governance ready",
    });

    const readyBundle = buildMigrationGovernanceBundle({
      factoryId: "CAP5PLAGVFFDGKIUER3BSL5XMUXF4SUGHKI5RYCD4YAS4RWWP755LDQG",
      sourceArka: "CSOURCE",
      targetArka: "CTARGET",
      registryId: "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
      implementationHash: "ab".repeat(32),
      shareTokenImplementationHash: "cd".repeat(32),
    });

    expect(
      deriveMigrationGovernanceHandoffState(
        readyBundle,
        "factory-share-token-implementation",
      ),
    ).toMatchObject({
      enabled: true,
      href: "/governance/console?draft=governed-composer",
      label: "Governance ready",
    });
  });

  it("derives live verification rows from factory inspection and planned migration targets", () => {
    const rows = buildMigrationVerificationRows(
      {
        sourceArka: "CSOURCE",
        targetArka: "CTARGET",
        registryId: "CREGISTRY",
        implementationGetterSupported: true,
        currentImplementation: "cd".repeat(32),
        registryGetterSupported: true,
        currentRegistry: "CREGISTRY",
        currentShareTokenImplementation: "ab".repeat(32),
        migratedTo: "CTARGET",
        migratedFrom: "CSOURCE",
        sourceShareToken: "CSHARESOURCE",
        targetShareToken: "CSHARETARGET",
      },
      {
        factoryId: "CFACTORY",
        sourceArka: "CSOURCE",
        targetArka: "CTARGET",
        registryId: "CREGISTRY",
        implementationHash: "",
        shareTokenImplementationHash: "ab".repeat(32),
      },
    );

    expect(rows.find((row) => row.id === "forward-map")?.state).toBe("Aligned");
    expect(rows.find((row) => row.id === "reverse-map")?.state).toBe("Aligned");
    expect(rows.find((row) => row.id === "factory-implementation")).toBeUndefined();
    expect(
      rows.find((row) => row.id === "share-token-implementation")?.state,
    ).toBe("Aligned");
    expect(rows.find((row) => row.id === "registry-binding")?.state).toBe(
      "Aligned",
    );
  });

  it("builds a getter-backed dry-run deck for migration execution and post-checks", () => {
    const bundle = buildMigrationGovernanceBundle({
      factoryId: "CFACTORY",
      sourceArka: "CSOURCE",
      targetArka: "CTARGET",
      registryId: "CREGISTRY",
      implementationHash: "ab".repeat(32),
      shareTokenImplementationHash: "cd".repeat(32),
    });

    const rows = buildMigrationDryRunRows({
      snapshot: {
        sourceArka: "CSOURCE",
        targetArka: "CTARGET",
        registryId: "CREGISTRY",
        implementationGetterSupported: true,
        currentImplementation: "ef".repeat(32),
        registryGetterSupported: true,
        currentRegistry: "CREGISTRY",
        currentShareTokenImplementation: "cd".repeat(32),
        migratedTo: null,
        migratedFrom: null,
        sourceShareToken: "CSHARESOURCE",
        targetShareToken: "CSHARETARGET",
      },
      plan: {
        factoryId: "CFACTORY",
        sourceArka: "CSOURCE",
        targetArka: "CTARGET",
        registryId: "CREGISTRY",
        implementationHash: "ab".repeat(32),
        shareTokenImplementationHash: "cd".repeat(32),
      },
      bundle,
    });

    expect(rows.find((row) => row.id === "bundle-admission")?.state).toBe(
      "Ready to verify",
    );
    expect(
      rows.find((row) => row.id === "implementation-post-check")?.state,
    ).toBe("Ready to verify");
    expect(rows.find((row) => row.id === "share-token-post-check")?.state).toBe(
      "Already aligned",
    );
    expect(rows.find((row) => row.id === "registry-post-check")?.state).toBe(
      "Already aligned",
    );
  });
});
