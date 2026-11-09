import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dappRoot = resolve(__dirname, "..");
const workspaceRoot = resolve(dappRoot, "..");
const defaultManifestPath = resolve(dappRoot, "docs/figma-route-audit-manifest.json");
const defaultOutputRoot = resolve(workspaceRoot, "arkafund/tmp/design-audit");

function readArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function resolveFromDapp(pathLike) {
  if (!pathLike) return null;
  return isAbsolute(pathLike) ? pathLike : resolve(dappRoot, pathLike);
}

function relativeLink(fromFile, target) {
  const absoluteTarget = resolve(target);
  const relative = absoluteTarget.startsWith(dirname(fromFile))
    ? absoluteTarget.slice(dirname(fromFile).length + 1)
    : absoluteTarget;
  return relative.replaceAll("\\", "/");
}

function loadManifest(manifestPath) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest.captures)) {
    throw new Error("Design audit manifest must include a captures array");
  }
  return manifest;
}

function captureStatus(pathLike) {
  return pathLike && existsSync(pathLike) ? "present" : "missing";
}

function renderCapture(manifest, reportPath, capture) {
  const referencePath = capture.referenceFile
    ? resolveFromDapp(`${manifest.referenceRoot}/${capture.referenceFile}`)
    : null;
  const currentPath = resolveFromDapp(`${manifest.currentRoot}/${capture.currentFile}`);
  const manualPath = capture.manualFile
    ? resolveFromDapp(`${manifest.manualRoot}/${capture.manualFile}`)
    : null;
  const referenceStatus = capture.referenceFile
    ? captureStatus(referencePath)
    : "not-applicable";
  const currentStatus = captureStatus(currentPath);
  const manualStatus = capture.manualFile ? captureStatus(manualPath) : "not-applicable";
  const strictThreshold =
    typeof capture.strictSimilarity === "number"
      ? `${Math.round(capture.strictSimilarity * 100)}%`
      : "derived/manual review";
  const governance = capture.requiresOperator ? "operator-gated" : "public";
  const figmaNode = capture.figmaNode ?? "derived/no direct frame";

  const referenceBlock = capture.referenceFile
    ? `Reference (${referenceStatus}):
![${capture.title} reference](${relativeLink(reportPath, referencePath)})`
    : `Reference: derived surface without exact Figma reference frame.`;

  const currentBlock = `Current (${currentStatus}):
![${capture.title} current](${relativeLink(reportPath, currentPath)})`;

  const manualLine = capture.manualFile
    ? `- Manual screenshot: \`${capture.manualFile}\` (${manualStatus})`
    : "- Manual screenshot: not configured";

  return `## ${capture.title}

- Key: \`${capture.key}\`
- Route: \`${capture.route}\`
- Frame family: \`${capture.frameFamily}\`
- Figma node: \`${figmaNode}\`
- Access surface: \`${governance}\`
- Strict threshold: \`${strictThreshold}\`
- Current screenshot: \`${capture.currentFile}\` (${currentStatus})
${manualLine}

${referenceBlock}

${currentBlock}

Review checklist:
- Compare spacing rhythm, type scale, panel density and action hierarchy against the reference family.
- Confirm extra fields that do not exist in Figma stay aligned, readable and data-backed instead of becoming visual clutter.
- Confirm no compact status/action label is split across visual lines and no visible control clips outside the viewport.
`;
}

const manifestPath = resolveFromDapp(readArgValue("--manifest")) ?? defaultManifestPath;
const outputRoot = resolveFromDapp(readArgValue("--output-root")) ?? defaultOutputRoot;
const manifest = loadManifest(manifestPath);
const reportPath = resolve(outputRoot, "report.md");

mkdirSync(outputRoot, { recursive: true });

const counts = manifest.captures.reduce(
  (acc, capture) => {
    acc.total += 1;
    if (capture.referenceFile) acc.referenceBacked += 1;
    if (capture.requiresOperator) acc.operator += 1;
    return acc;
  },
  { total: 0, referenceBacked: 0, operator: 0 },
);

const missing = manifest.captures.flatMap((capture) => {
  const entries = [];
  const currentPath = resolveFromDapp(`${manifest.currentRoot}/${capture.currentFile}`);
  if (!existsSync(currentPath)) entries.push(`${capture.key}: missing current screenshot`);
  if (capture.referenceFile) {
    const referencePath = resolveFromDapp(`${manifest.referenceRoot}/${capture.referenceFile}`);
    if (!existsSync(referencePath)) entries.push(`${capture.key}: missing reference screenshot`);
  }
  return entries;
});

const report = `# Frontend Design Audit

Generated: ${new Date().toISOString()}

Manifest: \`${manifestPath}\`

Coverage summary:
- Captures: ${counts.total}
- Reference-backed captures: ${counts.referenceBacked}
- Derived/manual-review captures: ${counts.total - counts.referenceBacked}
- Operator-gated captures: ${counts.operator}
- Default viewport: ${manifest.defaultViewport?.width ?? "n/a"}x${
  manifest.defaultViewport?.height ?? "n/a"
}

Status:
${missing.length === 0 ? "- All declared current/reference screenshots are present." : missing.map((item) => `- ${item}`).join("\n")}

This report is generated from the same manifest used by the Playwright design-audit capture. It is intentionally route-complete: public product screens, detail screens and operator-gated surfaces appear in one review queue.

${manifest.captures.map((capture) => renderCapture(manifest, reportPath, capture)).join("\n")}
`;

writeFileSync(reportPath, report, "utf8");
console.log(reportPath);
