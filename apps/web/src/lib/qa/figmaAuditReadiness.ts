import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type FigmaAuditCaptureManifest = {
  key: string;
  title: string;
  route: string;
  figmaNode: string | null;
  frameFamily: string;
  states?: string[];
  viewports?: FigmaAuditViewport[];
  currentFile: string;
  manualFile: string;
  referenceFile: string | null;
  referenceDisposition?:
    | "figma-reference"
    | "derived-from-figma-family"
    | "derived-without-figma-reference";
  sourceAsset?: string | null;
  auditRules?: string[];
  strictSimilarity: number | null;
  requiresOperator: boolean;
};

export type FigmaAuditViewport = {
  name: string;
  width: number;
  height: number;
};

export type FigmaAuditManifest = {
  schemaVersion: number;
  date?: string;
  figmaFile: string;
  referenceRoot: string;
  currentRoot: string;
  manualRoot: string;
  defaultViewport?: {
    width: number;
    height: number;
  };
  requiredViewportFamilies?: Array<
    FigmaAuditViewport & {
      purpose: string;
    }
  >;
  captures: FigmaAuditCaptureManifest[];
};

export type FigmaAuditCaptureReadiness = {
  key: string;
  title: string;
  route: string;
  frameFamily: string;
  states: string[];
  viewports: FigmaAuditViewport[];
  referenceDisposition:
    | "figma-reference"
    | "derived-from-figma-family"
    | "derived-without-figma-reference"
    | null;
  auditRules: string[];
  figmaMapped: boolean;
  derived: boolean;
  requiresOperator: boolean;
  strictComparable: boolean;
  strictSimilarity: number | null;
  status:
    | "ready"
    | "derived_ready"
    | "missing_reference"
    | "missing_current"
    | "missing_manual";
  files: {
    reference: string | null;
    current: string;
    manual: string;
  };
  checks: {
    referenceRequired: boolean;
    referenceExists: boolean;
    currentExists: boolean;
    manualExists: boolean;
  };
};

export type FigmaAuditReadiness = {
  ok: boolean;
  source: "figma_route_audit_manifest";
  generatedAt: string;
  manifestPath: string;
  figmaFile: string;
  summary: {
    totalCaptures: number;
    figmaMappedCaptures: number;
    derivedCaptures: number;
    referencedCaptures: number;
    strictComparableCaptures: number;
    stateMappedCaptures: number;
    viewportMappedCaptures: number;
    auditRuleMappedCaptures: number;
    derivedDispositionCaptures: number;
    manifestContractIssueCount: number;
    publicCaptures: number;
    operatorCaptures: number;
    currentReadyCount: number;
    manualReadyCount: number;
    referenceReadyCount: number;
    missingReferenceCount: number;
    missingCurrentCount: number;
    missingManualCount: number;
    readyCaptureCount: number;
    frameFamilies: string[];
    lowestStrictSimilarity: number | null;
  };
  missing: {
    references: string[];
    current: string[];
    manual: string[];
    manifestContract: string[];
  };
  captures: FigmaAuditCaptureReadiness[];
};

export function resolveFigmaAuditManifestPath(
  manifestPath = "docs/figma-route-audit-manifest.json",
  dappRoot = process.cwd(),
): string {
  return resolve(dappRoot, manifestPath);
}

export function readFigmaAuditManifest(
  manifestPath = resolveFigmaAuditManifestPath(),
): FigmaAuditManifest {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as FigmaAuditManifest;
}

function resolveManifestRoot(dappRoot: string, manifestRoot: string): string {
  return resolve(dappRoot, manifestRoot);
}

function resolveManifestFile(
  dappRoot: string,
  manifestRoot: string,
  fileName: string | null,
): string | null {
  if (!fileName) return null;
  return resolve(resolveManifestRoot(dappRoot, manifestRoot), fileName);
}

function isValidIdentifier(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(value);
}

export function validateFigmaAuditManifest(input: {
  manifest: FigmaAuditManifest;
  dappRoot?: string;
}): string[] {
  const issues: string[] = [];
  const keys = new Set<string>();
  const currentFiles = new Set<string>();
  const manualFiles = new Set<string>();

  if (input.manifest.schemaVersion < 2) {
    issues.push("manifest:schemaVersion must be >= 2 for state/viewport mapping");
  }
  if (!input.manifest.referenceRoot.startsWith("public/figma/references")) {
    issues.push("manifest:referenceRoot must point to committed public/figma/references");
  }

  for (const capture of input.manifest.captures) {
    const prefix = `${capture.key}:`;

    if (!isValidIdentifier(capture.key)) {
      issues.push(`${prefix} key must be stable kebab-case`);
    }
    if (keys.has(capture.key)) {
      issues.push(`${prefix} duplicate capture key`);
    }
    keys.add(capture.key);

    if (!capture.route.startsWith("/")) {
      issues.push(`${prefix} route must be absolute`);
    }
    if (currentFiles.has(capture.currentFile)) {
      issues.push(`${prefix} duplicate current file ${capture.currentFile}`);
    }
    if (manualFiles.has(capture.manualFile)) {
      issues.push(`${prefix} duplicate manual file ${capture.manualFile}`);
    }
    currentFiles.add(capture.currentFile);
    manualFiles.add(capture.manualFile);

    const states = capture.states ?? [];
    if (states.length === 0) {
      issues.push(`${prefix} states must declare the captured runtime state`);
    }
    for (const state of states) {
      if (!isValidIdentifier(state)) {
        issues.push(`${prefix} invalid state ${state}`);
      }
    }

    const viewports = capture.viewports ?? [];
    if (viewports.length === 0) {
      issues.push(`${prefix} viewports must declare at least one audited viewport`);
    }
    for (const viewport of viewports) {
      if (!isValidIdentifier(viewport.name)) {
        issues.push(`${prefix} invalid viewport name ${viewport.name}`);
      }
      if (!Number.isInteger(viewport.width) || viewport.width < 320) {
        issues.push(`${prefix} viewport ${viewport.name} width must be >= 320`);
      }
      if (!Number.isInteger(viewport.height) || viewport.height < 480) {
        issues.push(`${prefix} viewport ${viewport.name} height must be >= 480`);
      }
    }

    const auditRules = capture.auditRules ?? [];
    if (auditRules.length < 4) {
      issues.push(`${prefix} auditRules must define at least four concrete checks`);
    }
    for (const rule of auditRules) {
      if (!isValidIdentifier(rule)) {
        issues.push(`${prefix} invalid audit rule ${rule}`);
      }
    }

    if (capture.referenceFile) {
      if (capture.figmaNode && capture.referenceDisposition !== "figma-reference") {
        issues.push(`${prefix} Figma-mapped capture must use figma-reference`);
      }
      if (
        !capture.figmaNode &&
        capture.referenceDisposition !== "derived-from-figma-family"
      ) {
        issues.push(
          `${prefix} derived capture with reference must use derived-from-figma-family`,
        );
      }
      if (typeof capture.strictSimilarity !== "number" || capture.strictSimilarity <= 0.8) {
        issues.push(`${prefix} referenced captures need a diagnostic strictSimilarity > 0.8`);
      }
      if (
        capture.sourceAsset &&
        !capture.sourceAsset.startsWith(input.manifest.referenceRoot)
      ) {
        issues.push(`${prefix} sourceAsset must point inside the committed reference root`);
      }
    } else {
      if (capture.figmaNode) {
        issues.push(`${prefix} Figma-mapped capture must declare a referenceFile`);
      }
      if (capture.referenceDisposition !== "derived-without-figma-reference") {
        issues.push(
          `${prefix} missing-reference captures must declare derived-without-figma-reference`,
        );
      }
    }
  }

  return issues;
}

function deriveCaptureReadiness(
  capture: FigmaAuditCaptureManifest,
  manifest: FigmaAuditManifest,
  dappRoot: string,
): FigmaAuditCaptureReadiness {
  const reference = resolveManifestFile(
    dappRoot,
    manifest.referenceRoot,
    capture.referenceFile,
  );
  const current = resolveManifestFile(dappRoot, manifest.currentRoot, capture.currentFile);
  const manual = resolveManifestFile(dappRoot, manifest.manualRoot, capture.manualFile);
  const referenceRequired = Boolean(capture.referenceFile);
  const referenceExists = reference ? existsSync(reference) : false;
  const currentFileExists = current ? existsSync(current) : false;
  const manualExists = manual ? existsSync(manual) : false;
  const effectiveCurrent = currentFileExists ? current : manualExists ? manual : current;
  const currentExists = currentFileExists || manualExists;
  const strictComparable =
    referenceRequired &&
    referenceExists &&
    currentExists &&
    typeof capture.strictSimilarity === "number";

  let status: FigmaAuditCaptureReadiness["status"] = capture.figmaNode
    ? "ready"
    : "derived_ready";
  if (referenceRequired && !referenceExists) status = "missing_reference";
  else if (!currentExists) status = "missing_current";
  else if (!manualExists) status = "missing_manual";

  return {
    key: capture.key,
    title: capture.title,
    route: capture.route,
    frameFamily: capture.frameFamily,
    states: capture.states ?? [],
    viewports: capture.viewports ?? [],
    referenceDisposition: capture.referenceDisposition ?? null,
    auditRules: capture.auditRules ?? [],
    figmaMapped: Boolean(capture.figmaNode),
    derived: !capture.figmaNode,
    requiresOperator: Boolean(capture.requiresOperator),
    strictComparable,
    strictSimilarity: capture.strictSimilarity,
    status,
    files: {
      reference,
      current: effectiveCurrent ?? "",
      manual: manual ?? "",
    },
    checks: {
      referenceRequired,
      referenceExists,
      currentExists: Boolean(currentExists),
      manualExists: Boolean(manualExists),
    },
  };
}

export function deriveFigmaAuditReadiness(input: {
  manifest: FigmaAuditManifest;
  manifestPath?: string;
  dappRoot?: string;
  generatedAt?: string;
}): FigmaAuditReadiness {
  const dappRoot = input.dappRoot ?? process.cwd();
  const manifestContractIssues = validateFigmaAuditManifest({
    manifest: input.manifest,
    dappRoot,
  });
  const captures = input.manifest.captures.map((capture) =>
    deriveCaptureReadiness(capture, input.manifest, dappRoot),
  );
  const missingReferences = captures
    .filter((capture) => capture.checks.referenceRequired && !capture.checks.referenceExists)
    .map((capture) => capture.key);
  const missingCurrent = captures
    .filter((capture) => !capture.checks.currentExists)
    .map((capture) => capture.key);
  const missingManual = captures
    .filter((capture) => !capture.checks.manualExists)
    .map((capture) => capture.key);
  const strictSimilarities = captures
    .map((capture) => capture.strictSimilarity)
    .filter((value): value is number => typeof value === "number");
  const frameFamilies = Array.from(
    new Set(captures.map((capture) => capture.frameFamily)),
  ).sort();
  const readyCaptureCount = captures.filter(
    (capture) =>
      (capture.status === "ready" || capture.status === "derived_ready") &&
      capture.checks.currentExists &&
      capture.checks.manualExists,
  ).length;

  return {
    ok:
      missingReferences.length === 0 &&
      missingCurrent.length === 0 &&
      missingManual.length === 0 &&
      manifestContractIssues.length === 0,
    source: "figma_route_audit_manifest",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    manifestPath: input.manifestPath ?? resolveFigmaAuditManifestPath(),
    figmaFile: input.manifest.figmaFile,
    summary: {
      totalCaptures: captures.length,
      figmaMappedCaptures: captures.filter((capture) => capture.figmaMapped).length,
      derivedCaptures: captures.filter((capture) => capture.derived).length,
      referencedCaptures: captures.filter((capture) => capture.checks.referenceRequired)
        .length,
      strictComparableCaptures: captures.filter((capture) => capture.strictComparable)
        .length,
      stateMappedCaptures: captures.filter((capture) => capture.states.length > 0)
        .length,
      viewportMappedCaptures: captures.filter((capture) => capture.viewports.length > 0)
        .length,
      auditRuleMappedCaptures: captures.filter(
        (capture) => capture.auditRules.length >= 4,
      ).length,
      derivedDispositionCaptures: captures.filter(
        (capture) =>
          capture.referenceDisposition === "derived-from-figma-family" ||
          capture.referenceDisposition === "derived-without-figma-reference",
      ).length,
      manifestContractIssueCount: manifestContractIssues.length,
      publicCaptures: captures.filter((capture) => !capture.requiresOperator).length,
      operatorCaptures: captures.filter((capture) => capture.requiresOperator).length,
      currentReadyCount: captures.filter((capture) => capture.checks.currentExists).length,
      manualReadyCount: captures.filter((capture) => capture.checks.manualExists).length,
      referenceReadyCount: captures.filter(
        (capture) => capture.checks.referenceRequired && capture.checks.referenceExists,
      ).length,
      missingReferenceCount: missingReferences.length,
      missingCurrentCount: missingCurrent.length,
      missingManualCount: missingManual.length,
      readyCaptureCount,
      frameFamilies,
      lowestStrictSimilarity:
        strictSimilarities.length > 0 ? Math.min(...strictSimilarities) : null,
    },
    missing: {
      references: missingReferences,
      current: missingCurrent,
      manual: missingManual,
      manifestContract: manifestContractIssues,
    },
    captures,
  };
}

export function readFigmaAuditReadiness(input?: {
  manifestPath?: string;
  dappRoot?: string;
  generatedAt?: string;
}): FigmaAuditReadiness {
  const manifestPath = input?.manifestPath ?? resolveFigmaAuditManifestPath();
  const manifest = readFigmaAuditManifest(manifestPath);
  return deriveFigmaAuditReadiness({
    manifest,
    manifestPath,
    dappRoot: input?.dappRoot,
    generatedAt: input?.generatedAt,
  });
}
