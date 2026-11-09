import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dappRoot = resolve(__dirname, "..");
const defaultManualManifestPath = resolve(dappRoot, "docs/platform-manual-screen-manifest.json");

function readArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function resolveFromDapp(pathLike) {
  if (!pathLike) return null;
  return isAbsolute(pathLike) ? pathLike : resolve(dappRoot, pathLike);
}

function readJson(pathLike) {
  const path = resolveFromDapp(pathLike);
  if (!path || !existsSync(path)) {
    throw new Error(`Missing JSON file: ${pathLike}`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function relMarkdownLink(fromFile, targetPath) {
  const fromDir = dirname(resolve(fromFile));
  const resolvedTarget = resolve(targetPath);
  const link = relative(fromDir, resolvedTarget).replaceAll("\\", "/");
  return link.startsWith(".") ? link : `./${link}`;
}

function assertArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty array`);
  }
}

function formatList(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function formatRefList(outputPath, refs) {
  return refs
    .map((ref) => {
      const abs = resolveFromDapp(ref);
      return `- [${ref}](${relMarkdownLink(outputPath, abs)})`;
    })
    .join("\n");
}

function validateRefs(refs, label, issues) {
  for (const ref of refs ?? []) {
    const path = resolveFromDapp(ref);
    if (!path || !existsSync(path)) {
      issues.push(`${label} references missing path: ${ref}`);
    }
  }
}

function validateManualModel({ manualManifest, figmaManifest, outputPath }) {
  const issues = [];

  if (manualManifest.schemaVersion !== 1) {
    issues.push("platform manual manifest schemaVersion must be 1");
  }
  assertArray(manualManifest.screens, "manual screens");
  assertArray(manualManifest.claims, "manual claims");
  assertArray(manualManifest.mainnetBlockers, "mainnet blockers");
  assertArray(figmaManifest.captures, "figma captures");

  const screenKeys = new Set();
  const screensByKey = new Map();
  for (const screen of manualManifest.screens) {
    if (!screen.key || !/^[a-z0-9-]+$/.test(screen.key)) {
      issues.push(`invalid screen key: ${screen.key}`);
      continue;
    }
    if (screenKeys.has(screen.key)) {
      issues.push(`duplicate screen key: ${screen.key}`);
    }
    screenKeys.add(screen.key);
    screensByKey.set(screen.key, screen);
    for (const field of ["classification", "audience", "purpose", "boundary"]) {
      if (!screen[field]) {
        issues.push(`${screen.key} missing ${field}`);
      }
    }
    assertArray(screen.reads, `${screen.key} reads`);
    assertArray(screen.actions, `${screen.key} actions`);
    validateRefs(screen.implementationRefs, `${screen.key} implementation`, issues);
    validateRefs(screen.testRefs, `${screen.key} tests`, issues);
  }

  const captureKeys = new Set();
  const screenshotRoot = resolveFromDapp(manualManifest.screenshotRoot);
  for (const capture of figmaManifest.captures) {
    captureKeys.add(capture.key);
    const screen = screensByKey.get(capture.key);
    if (!screen) {
      issues.push(`figma capture ${capture.key} is missing from platform manual screens`);
      continue;
    }
    if (capture.route !== screen.route && screen.route) {
      issues.push(`${capture.key} route mismatch: manifest ${capture.route}, screen ${screen.route}`);
    }
    const screenshotPath = resolve(screenshotRoot, capture.manualFile ?? capture.currentFile);
    if (!existsSync(screenshotPath)) {
      issues.push(`${capture.key} missing manual screenshot: ${screenshotPath}`);
    }
  }

  for (const key of screenKeys) {
    if (!captureKeys.has(key)) {
      issues.push(`manual screen ${key} is missing from figma route capture manifest`);
    }
  }

  for (const claim of manualManifest.claims) {
    if (!claim.key || !claim.claim) {
      issues.push(`invalid claim entry: ${JSON.stringify(claim)}`);
    }
    validateRefs(claim.implementationRefs, `${claim.key} claim implementation`, issues);
    validateRefs(claim.testRefs, `${claim.key} claim tests`, issues);
  }

  for (const blocker of manualManifest.mainnetBlockers) {
    if (!blocker.key || !blocker.title || !blocker.description) {
      issues.push(`invalid mainnet blocker entry: ${JSON.stringify(blocker)}`);
    }
    validateRefs([blocker.evidenceRef], `${blocker.key} blocker evidence`, issues);
  }

  if (!outputPath.endsWith(".md")) {
    issues.push(`manual output must be markdown: ${outputPath}`);
  }

  return issues;
}

function renderManual({ manualManifest, figmaManifest, outputPath }) {
  const screenshotsRoot = resolveFromDapp(manualManifest.screenshotRoot);
  const screensByKey = new Map(manualManifest.screens.map((screen) => [screen.key, screen]));
  const orderedCaptures = figmaManifest.captures.map((capture) => ({
    capture,
    screen: screensByKey.get(capture.key),
  }));

  const publicCount = orderedCaptures.filter(
    ({ capture }) => !capture.requiresOperator,
  ).length;
  const operatorCount = orderedCaptures.length - publicCount;

  const claimBlocks = manualManifest.claims
    .map(
      (claim, index) => `### ${index + 1}. ${claim.key}

${claim.claim}

Implementation:
${formatRefList(outputPath, claim.implementationRefs)}

Tests:
${formatRefList(outputPath, claim.testRefs)}
`,
    )
    .join("\n");

  const screenBlocks = orderedCaptures
    .map(({ capture, screen }, index) => {
      const screenshotPath = resolve(screenshotsRoot, capture.manualFile ?? capture.currentFile);
      const access = capture.requiresOperator ? "verified operator" : "public/read";
      const figmaRef = capture.referenceFile
        ? `Figma/reference family: \`${capture.frameFamily}\`, reference \`${capture.referenceFile}\`.`
        : `Derived surface: \`${capture.frameFamily}\`, no direct Figma reference frame.`;

      return `### ${index + 1}. ${capture.title}

![${capture.title}](${relMarkdownLink(outputPath, screenshotPath)})

- Route: \`${capture.route}\`
- Access: \`${access}\`
- Classification: ${screen.classification}
- Audience: ${screen.audience}
- Visual source: ${figmaRef}

Purpose:

${screen.purpose}

Reads:
${formatList(screen.reads)}

Actions:
${formatList(screen.actions)}

Boundary:

${screen.boundary}

Implementation:
${formatRefList(outputPath, screen.implementationRefs)}

Tests:
${formatRefList(outputPath, screen.testRefs)}
`;
    })
    .join("\n");

  const blockerBlock = manualManifest.mainnetBlockers
    .map(
      (blocker) => `### ${blocker.title}

${blocker.description}

Evidence: [${blocker.evidenceRef}](${relMarkdownLink(
        outputPath,
        resolveFromDapp(blocker.evidenceRef),
      )})
`,
    )
    .join("\n");

  return `# Arka.fund Final Platform Manual

Date: ${manualManifest.date}

Status: ${manualManifest.status.scope}

This manual is generated from \`${relMarkdownLink(
    outputPath,
    defaultManualManifestPath,
  )}\` and \`${relMarkdownLink(
    outputPath,
    resolveFromDapp(manualManifest.figmaAuditManifest),
  )}\`. Screenshots are the same route captures used by the visual audit, so the document is tied to rendered product state rather than hand-written claims.

## Completion State

- Global status after T25: **${manualManifest.status.globalProgressAfterCompletion}**.
- Completed canonical items after T25: **${manualManifest.status.completedItemsAfterCompletion}**.
- Remaining canonical items: ${manualManifest.status.remainingItemsAfterCompletion.join(", ")}.
- Captured screens: **${orderedCaptures.length}**.
- Public/read captures: **${publicCount}**.
- Verified-operator captures: **${operatorCount}**.

## Mainnet Blockers

${blockerBlock}

## Claim Traceability

Every platform/security/protocol claim below links to implementation and test evidence. Mainnet-only claims remain blockers until T26/T27 evidence exists.

${claimBlocks}

## Screen Manual With Current Screenshots

${screenBlocks}

## Verification Commands

- Generate screenshots: \`npm run docs:screenshots\`.
- Regenerate this manual: \`npm run docs:platform-manual\`.
- Verify manual, screenshot paths and implementation/test refs: \`npm run docs:platform-manual:check\`.
- Run the focused unit/integration evidence: \`npx vitest run tests/unit/platform-manual-manifest.test.ts tests/integration/platform-manual-generator.test.ts\`.
- Run the E2E screenshot capture: \`npx playwright test e2e/design-audit.spec.ts --project=chromium --workers=1\`.
`;
}

const manualManifestPath = resolveFromDapp(readArgValue("--manual-manifest")) ?? defaultManualManifestPath;
const manualManifest = readJson(manualManifestPath);
const figmaManifest = readJson(manualManifest.figmaAuditManifest);
const outputPath = resolveFromDapp(readArgValue("--output")) ?? resolveFromDapp(manualManifest.manualPath);
const checkOnly = hasFlag("--check");

const issues = validateManualModel({ manualManifest, figmaManifest, outputPath });
if (issues.length > 0) {
  console.error(JSON.stringify({ ok: false, issues }, null, 2));
  process.exit(1);
}

const rendered = renderManual({ manualManifest, figmaManifest, outputPath });

if (checkOnly) {
  const current = existsSync(outputPath) ? readFileSync(outputPath, "utf8") : "";
  if (current !== rendered) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          issue: "manual_out_of_date",
          outputPath,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, outputPath, screens: manualManifest.screens.length }, null, 2));
} else {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, rendered, "utf8");
  console.log(JSON.stringify({ ok: true, outputPath, screens: manualManifest.screens.length }, null, 2));
}
