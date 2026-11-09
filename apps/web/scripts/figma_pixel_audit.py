#!/usr/bin/env python3
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import argparse
import hashlib
import html
import json
import math
import os
import re
import shutil
from pathlib import Path
import subprocess


@dataclass(frozen=True)
class DynamicMaskRegion:
    label: str
    x_pct: float
    y_pct: float
    width_pct: float
    height_pct: float


@dataclass(frozen=True)
class Comparison:
    key: str
    title: str
    route: str
    frame_family: str
    figma_node: str | None
    reference: Path
    current: Path
    reference_file: str
    current_file: str
    requires_operator: bool
    states: tuple[str, ...] = ()
    viewports: tuple[dict[str, object], ...] = ()
    reference_disposition: str | None = None
    threshold: float | None = None
    dynamic_mask_regions: tuple[DynamicMaskRegion, ...] = ()


@dataclass(frozen=True)
class AuditConfig:
    manifest_path: Path
    output_root: Path | None
    strict_mode: bool
    write_json: bool
    allow_partial_current: bool


def quality_bucket(similarity: float) -> str:
    if similarity >= 0.90:
        return "tight"
    if similarity >= 0.85:
        return "near"
    return "drift"


def strict_delta(similarity: float | None, threshold: float | None) -> float | None:
    if similarity is None or threshold is None:
        return None
    return similarity - threshold


def format_delta(value: object) -> str:
    if value is None:
        return "n/a"
    return f"{float(value) * 100:+.2f}pp"


def html_path(from_dir: Path, target: object) -> str:
    if not target:
        return ""
    try:
        return os.path.relpath(str(target), str(from_dir)).replace("\\", "/")
    except ValueError:
        return str(target)


def run(cmd: list[str]) -> str:
    completed = subprocess.run(
        cmd,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    return completed.stdout


def resolve_binary(name: str) -> str:
    direct = shutil.which(name)
    if direct:
        return direct
    fallback = Path("/opt/homebrew/bin") / name
    if fallback.exists():
        return str(fallback)
    raise FileNotFoundError(f"Missing required binary: {name}")


def resolve_manifest_path(dapp_root: Path, configured: str) -> Path:
    candidate = Path(configured)
    if candidate.is_absolute():
        return candidate
    return (dapp_root / candidate).resolve()


def parse_dynamic_mask_regions(capture: dict) -> tuple[DynamicMaskRegion, ...]:
    regions = capture.get("dynamicMaskRegions") or []
    parsed: list[DynamicMaskRegion] = []
    for index, region in enumerate(regions):
        if not isinstance(region, dict):
            raise ValueError(f"{capture.get('key', 'capture')}: dynamic mask #{index + 1} must be an object")
        label = str(region.get("label") or f"dynamic-region-{index + 1}")
        try:
            x_pct = float(region["xPct"])
            y_pct = float(region["yPct"])
            width_pct = float(region["widthPct"])
            height_pct = float(region["heightPct"])
        except KeyError as error:
            raise ValueError(
                f"{capture.get('key', 'capture')}: dynamic mask {label} is missing {error.args[0]}"
            ) from error
        except (TypeError, ValueError) as error:
            raise ValueError(
                f"{capture.get('key', 'capture')}: dynamic mask {label} has non-numeric coordinates"
            ) from error
        if width_pct <= 0 or height_pct <= 0:
            raise ValueError(
                f"{capture.get('key', 'capture')}: dynamic mask {label} must have positive width and height"
            )
        if x_pct < 0 or y_pct < 0 or x_pct + width_pct > 100 or y_pct + height_pct > 100:
            raise ValueError(
                f"{capture.get('key', 'capture')}: dynamic mask {label} must stay inside 0-100% bounds"
            )
        parsed.append(
            DynamicMaskRegion(
                label=label,
                x_pct=x_pct,
                y_pct=y_pct,
                width_pct=width_pct,
                height_pct=height_pct,
            )
        )
    return tuple(parsed)


def parse_iso_date(value: object) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        normalized = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def resolve_valid_waivers(manifest: dict, captures: list[dict]) -> tuple[dict[str, dict], list[str]]:
    capture_keys = {str(capture["key"]) for capture in captures}
    raw_waivers = manifest.get("strictWaivers") or []
    valid: dict[str, dict] = {}
    issues: list[str] = []
    now = datetime.now(timezone.utc)

    if not isinstance(raw_waivers, list):
        return valid, ["manifest: strictWaivers must be an array when present"]

    for index, waiver in enumerate(raw_waivers):
        prefix = f"waiver[{index}]"
        if not isinstance(waiver, dict):
            issues.append(f"{prefix}: waiver must be an object")
            continue
        key = str(waiver.get("key") or "")
        reason = str(waiver.get("reason") or "")
        owner = str(waiver.get("owner") or "")
        expires_at = parse_iso_date(waiver.get("expiresAt"))
        if key not in capture_keys:
            issues.append(f"{prefix}: key {key or '<missing>'} does not match a manifest capture")
        if len(reason.strip()) < 16:
            issues.append(f"{prefix}: reason must explain the visual waiver in at least 16 characters")
        if len(owner.strip()) < 2:
            issues.append(f"{prefix}: owner is required")
        if expires_at is None:
            issues.append(f"{prefix}: expiresAt must be a valid ISO date")
        elif expires_at <= now:
            issues.append(f"{prefix}: expiresAt {waiver.get('expiresAt')} is expired")
        if key in capture_keys and reason.strip() and owner.strip() and expires_at and expires_at > now:
            valid[key] = {
                "key": key,
                "reason": reason,
                "owner": owner,
                "expiresAt": expires_at.isoformat().replace("+00:00", "Z"),
            }

    return valid, issues


def parse_args() -> AuditConfig:
    script_dir = Path(__file__).resolve().parent
    dapp_root = script_dir.parent
    parser = argparse.ArgumentParser(
        description="Compare Playwright route screenshots with Figma reference frames.",
    )
    parser.add_argument(
        "--manifest",
        default=os.environ.get(
            "FIGMA_PIXEL_AUDIT_MANIFEST",
            str(dapp_root / "docs" / "figma-route-audit-manifest.json"),
        ),
        help="Path to figma-route-audit-manifest.json.",
    )
    parser.add_argument(
        "--output-root",
        default=os.environ.get("FIGMA_PIXEL_AUDIT_OUTPUT_ROOT"),
        help="Directory for report.md, report.json and diff heatmaps. Defaults to <currentRoot>/../pixel.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        default=os.environ.get("FIGMA_PIXEL_AUDIT_STRICT") == "1",
        help="Fail when any referenced frame is missing or below its strictSimilarity threshold.",
    )
    parser.add_argument(
        "--no-json",
        action="store_true",
        help="Skip report.json generation.",
    )
    parser.add_argument(
        "--allow-partial-current",
        action="store_true",
        help=(
            "Allow diagnostic reports when only some current screenshots exist. "
            "By default, a partial current set fails even outside --strict because it "
            "usually means the capture test and pixel audit raced each other."
        ),
    )
    args = parser.parse_args()

    return AuditConfig(
        manifest_path=Path(args.manifest).resolve(),
        output_root=Path(args.output_root).resolve() if args.output_root else None,
        strict_mode=bool(args.strict),
        write_json=not bool(args.no_json),
        allow_partial_current=bool(args.allow_partial_current),
    )


def resolve_comparisons(
    dapp_root: Path,
    manifest: dict,
) -> tuple[Path, Path, list[Comparison]]:
    current_dir = resolve_manifest_path(dapp_root, manifest["currentRoot"])
    reference_dir = resolve_manifest_path(dapp_root, manifest["referenceRoot"])
    pairs: list[Comparison] = []
    for capture in manifest["captures"]:
        reference_file = capture.get("referenceFile")
        if not reference_file:
            continue
        pairs.append(
            Comparison(
                key=capture["key"],
                title=capture["title"],
                route=capture["route"],
                frame_family=capture["frameFamily"],
                figma_node=capture.get("figmaNode"),
                reference=reference_dir / reference_file,
                current=current_dir / capture["currentFile"],
                reference_file=reference_file,
                current_file=capture["currentFile"],
                requires_operator=bool(capture.get("requiresOperator")),
                states=tuple(str(state) for state in (capture.get("states") or [])),
                viewports=tuple(dict(viewport) for viewport in (capture.get("viewports") or [])),
                reference_disposition=capture.get("referenceDisposition"),
                threshold=capture.get("strictSimilarity"),
                dynamic_mask_regions=parse_dynamic_mask_regions(capture),
            )
        )
    return current_dir, reference_dir, pairs


def read_image_dimensions(path: Path, ffprobe: str) -> tuple[int, int]:
    dimensions = run(
        [
            ffprobe,
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "csv=s=x:p=0",
            str(path),
        ]
    ).strip()
    width, height = dimensions.split("x", maxsplit=1)
    return int(width), int(height)


def mask_region_to_pixels(
    region: DynamicMaskRegion,
    width: int,
    height: int,
) -> tuple[int, int, int, int]:
    x = max(0, min(width - 1, round((region.x_pct / 100) * width)))
    y = max(0, min(height - 1, round((region.y_pct / 100) * height)))
    w = max(1, round((region.width_pct / 100) * width))
    h = max(1, round((region.height_pct / 100) * height))
    return x, y, min(w, width - x), min(h, height - y)


def dynamic_mask_coverage(regions: tuple[DynamicMaskRegion, ...]) -> float:
    # Regions are intentionally expected to be sparse. We report the summed
    # coverage as a conservative warning signal; overlapping regions are rare in
    # the manifest and should stay small enough to avoid hiding layout drift.
    return sum((region.width_pct * region.height_pct) / 10000 for region in regions)


def apply_dynamic_masks(
    source: Path,
    target: Path,
    regions: tuple[DynamicMaskRegion, ...],
    width: int,
    height: int,
    ffmpeg: str,
) -> None:
    filters: list[str] = []
    for region in regions:
        x, y, w, h = mask_region_to_pixels(region, width, height)
        filters.append(
            f"drawbox=x={x}:y={y}:w={w}:h={h}:color=0x12072d@1:t=fill"
        )
    run(
        [
            ffmpeg,
            "-y",
            "-v",
            "error",
            "-i",
            str(source),
            "-vf",
            ",".join(filters),
            str(target),
        ]
    )


def write_diff_heatmap(
    reference: Path,
    current: Path,
    diff_path: Path,
    ffmpeg: str,
) -> None:
    run(
        [
            ffmpeg,
            "-y",
            "-v",
            "error",
            "-i",
            str(reference),
            "-i",
            str(current),
            "-filter_complex",
            "[0][1]blend=all_mode=difference,eq=contrast=3:brightness=0.03:saturation=2",
            "-frames:v",
            "1",
            str(diff_path),
        ]
    )


def compare_images(reference: Path, current: Path, ffmpeg: str) -> dict[str, float]:
    ssim_output = run(
        [
            ffmpeg,
            "-v",
            "info",
            "-i",
            str(reference),
            "-i",
            str(current),
            "-lavfi",
            "ssim",
            "-f",
            "null",
            "-",
        ]
    )
    psnr_output = run(
        [
            ffmpeg,
            "-v",
            "info",
            "-i",
            str(reference),
            "-i",
            str(current),
            "-lavfi",
            "psnr",
            "-f",
            "null",
            "-",
        ]
    )
    signal_output = run(
        [
            ffmpeg,
            "-v",
            "warning",
            "-i",
            str(reference),
            "-i",
            str(current),
            "-filter_complex",
            "[0][1]blend=all_mode=difference,signalstats,metadata=print:file=-",
            "-frames:v",
            "1",
            "-f",
            "null",
            "-",
        ]
    )

    ssim_match = re.search(r"All:(\d+(?:\.\d+)?)", ssim_output)
    psnr_match = re.search(r"average:(-?\d+(?:\.\d+)?)", psnr_output)
    yavg_match = re.search(r"lavfi\.signalstats\.YAVG=(\d+(?:\.\d+)?)", signal_output)
    similarity = float(ssim_match.group(1)) if ssim_match else 0.0
    psnr = float(psnr_match.group(1)) if psnr_match else 0.0
    mse = (255.0 * 255.0) / (10 ** (psnr / 10)) if psnr > 0 else 255.0 * 255.0
    rmse = math.sqrt(mse) / 255.0
    mae = (float(yavg_match.group(1)) / 255.0) if yavg_match else rmse
    return {"similarity": similarity, "mae": mae, "rmse": rmse}


def compare_pair(
    pair: Comparison,
    pixel_dir: Path,
    ffmpeg: str,
    ffprobe: str,
) -> dict[str, object]:
    diff_path = pixel_dir / f"{pair.key}-diff.png"
    structural_diff_path = pixel_dir / f"{pair.key}-structural-diff.png"
    current_aligned_path = pixel_dir / f"{pair.key}-current-aligned.png"
    reference_masked_path = pixel_dir / f"{pair.key}-reference-structural.png"
    current_masked_path = pixel_dir / f"{pair.key}-current-structural.png"

    width, height = read_image_dimensions(pair.reference, ffprobe)
    run(
        [
            ffmpeg,
            "-y",
            "-v",
            "error",
            "-i",
            str(pair.current),
            "-vf",
            f"scale={width}:{height}",
            str(current_aligned_path),
        ]
    )
    write_diff_heatmap(pair.reference, current_aligned_path, diff_path, ffmpeg)
    raw_metrics = compare_images(pair.reference, current_aligned_path, ffmpeg)

    structural_metrics: dict[str, float] | None = None
    structural_diff: str | None = None
    if pair.dynamic_mask_regions:
        apply_dynamic_masks(
            pair.reference,
            reference_masked_path,
            pair.dynamic_mask_regions,
            width,
            height,
            ffmpeg,
        )
        apply_dynamic_masks(
            current_aligned_path,
            current_masked_path,
            pair.dynamic_mask_regions,
            width,
            height,
            ffmpeg,
        )
        write_diff_heatmap(reference_masked_path, current_masked_path, structural_diff_path, ffmpeg)
        structural_metrics = compare_images(reference_masked_path, current_masked_path, ffmpeg)
        structural_diff = str(structural_diff_path)

    similarity = raw_metrics["similarity"]
    structural_similarity = (
        structural_metrics["similarity"] if structural_metrics is not None else None
    )

    return {
        "key": pair.key,
        "title": pair.title,
        "route": pair.route,
        "frameFamily": pair.frame_family,
        "figmaNode": pair.figma_node,
        "requiresOperator": pair.requires_operator,
        "states": list(pair.states),
        "viewports": list(pair.viewports),
        "referenceDisposition": pair.reference_disposition,
        "status": quality_bucket(similarity),
        "similarity": similarity,
        "mae": raw_metrics["mae"],
        "rmse": raw_metrics["rmse"],
        "structuralStatus": quality_bucket(structural_similarity) if structural_similarity is not None else None,
        "structuralSimilarity": structural_similarity,
        "structuralMae": structural_metrics["mae"] if structural_metrics is not None else None,
        "structuralRmse": structural_metrics["rmse"] if structural_metrics is not None else None,
        "threshold": pair.threshold,
        "strictDelta": strict_delta(similarity, pair.threshold),
        "structuralStrictDelta": strict_delta(structural_similarity, pair.threshold),
        "dynamicMaskRegions": [
            {
                "label": region.label,
                "xPct": region.x_pct,
                "yPct": region.y_pct,
                "widthPct": region.width_pct,
                "heightPct": region.height_pct,
            }
            for region in pair.dynamic_mask_regions
        ],
        "dynamicMaskCoverage": dynamic_mask_coverage(pair.dynamic_mask_regions),
        "referenceFile": pair.reference_file,
        "currentFile": pair.current_file,
        "reference": str(pair.reference),
        "currentOriginal": str(pair.current),
        "current": str(current_aligned_path),
        "diff": str(diff_path),
        "structuralDiff": structural_diff,
    }


def format_percent(value: object) -> str:
    return f"{float(value) * 100:.2f}%"


def build_missing_row(pair: Comparison, reason: str) -> dict[str, object]:
    return {
        "key": pair.key,
        "title": pair.title,
        "route": pair.route,
        "frameFamily": pair.frame_family,
        "figmaNode": pair.figma_node,
        "requiresOperator": pair.requires_operator,
        "states": list(pair.states),
        "viewports": list(pair.viewports),
        "referenceDisposition": pair.reference_disposition,
        "status": "missing",
        "reason": reason,
        "similarity": None,
        "mae": None,
        "rmse": None,
        "structuralStatus": None,
        "structuralSimilarity": None,
        "structuralMae": None,
        "structuralRmse": None,
        "threshold": pair.threshold,
        "strictDelta": None,
        "structuralStrictDelta": None,
        "dynamicMaskRegions": [
            {
                "label": region.label,
                "xPct": region.x_pct,
                "yPct": region.y_pct,
                "widthPct": region.width_pct,
                "heightPct": region.height_pct,
            }
            for region in pair.dynamic_mask_regions
        ],
        "dynamicMaskCoverage": dynamic_mask_coverage(pair.dynamic_mask_regions),
        "referenceFile": pair.reference_file,
        "currentFile": pair.current_file,
        "reference": str(pair.reference),
        "currentOriginal": str(pair.current),
        "current": str(pair.current),
        "diff": None,
        "structuralDiff": None,
    }


def build_error_row(pair: Comparison, error: Exception, pixel_dir: Path) -> dict[str, object]:
    return {
        "key": pair.key,
        "title": pair.title,
        "route": pair.route,
        "frameFamily": pair.frame_family,
        "figmaNode": pair.figma_node,
        "requiresOperator": pair.requires_operator,
        "states": list(pair.states),
        "viewports": list(pair.viewports),
        "referenceDisposition": pair.reference_disposition,
        "status": "error",
        "reason": str(error),
        "similarity": None,
        "mae": None,
        "rmse": None,
        "structuralStatus": None,
        "structuralSimilarity": None,
        "structuralMae": None,
        "structuralRmse": None,
        "threshold": pair.threshold,
        "strictDelta": None,
        "structuralStrictDelta": None,
        "dynamicMaskRegions": [
            {
                "label": region.label,
                "xPct": region.x_pct,
                "yPct": region.y_pct,
                "widthPct": region.width_pct,
                "heightPct": region.height_pct,
            }
            for region in pair.dynamic_mask_regions
        ],
        "dynamicMaskCoverage": dynamic_mask_coverage(pair.dynamic_mask_regions),
        "referenceFile": pair.reference_file,
        "currentFile": pair.current_file,
        "reference": str(pair.reference),
        "currentOriginal": str(pair.current),
        "current": str(pixel_dir / f"{pair.key}-current-aligned.png"),
        "diff": str(pixel_dir / f"{pair.key}-diff.png"),
        "structuralDiff": None,
    }


def build_summary(rows: list[dict[str, object]], strict_failures: list[str]) -> dict[str, object]:
    compared = [row for row in rows if isinstance(row.get("similarity"), float)]
    structurally_compared = [
        row for row in rows if isinstance(row.get("structuralSimilarity"), float)
    ]
    missing = [row for row in rows if row.get("status") == "missing"]
    errored = [row for row in rows if row.get("status") == "error"]
    below_threshold = [
        row
        for row in compared
        if row.get("threshold") is not None
        and float(row["similarity"]) < float(row["threshold"])
    ]
    waived_below_threshold = [row for row in below_threshold if row.get("waiver")]
    unwaived_below_threshold = [row for row in below_threshold if not row.get("waiver")]
    sorted_by_similarity = sorted(
        compared,
        key=lambda row: float(row["similarity"]),
    )
    worst = sorted_by_similarity[0] if sorted_by_similarity else None
    sorted_by_structural_similarity = sorted(
        structurally_compared,
        key=lambda row: float(row["structuralSimilarity"]),
    )
    structural_worst = (
        sorted_by_structural_similarity[0] if sorted_by_structural_similarity else None
    )
    all_thresholds_met = not missing and not errored and not unwaived_below_threshold
    compared_viewports = sorted(
        {
            str(viewport.get("name"))
            for row in rows
            for viewport in row.get("viewports", [])
            if isinstance(viewport, dict) and viewport.get("name")
        }
    )
    return {
        "total": len(rows),
        "compared": len(compared),
        "missing": len(missing),
        "errors": len(errored),
        "belowThreshold": len(unwaived_below_threshold),
        "rawBelowThreshold": len(below_threshold),
        "waivedBelowThreshold": len(waived_below_threshold),
        "strictFailureCount": len(strict_failures),
        "ok": not strict_failures,
        "allThresholdsMet": all_thresholds_met,
        "needsReview": not all_thresholds_met or bool(waived_below_threshold),
        "comparedViewports": compared_viewports,
        "worstKey": worst["key"] if worst else None,
        "worstSimilarity": worst["similarity"] if worst else None,
        "structuralCompared": len(structurally_compared),
        "structuralWorstKey": structural_worst["key"] if structural_worst else None,
        "structuralWorstSimilarity": structural_worst["structuralSimilarity"] if structural_worst else None,
        "worstFrames": [
            {
                "key": row["key"],
                "title": row["title"],
                "route": row["route"],
                "similarity": row["similarity"],
                "threshold": row["threshold"],
                "strictDelta": row["strictDelta"],
                "status": row["status"],
            }
            for row in sorted_by_similarity[:5]
        ],
        "structuralWorstFrames": [
            {
                "key": row["key"],
                "title": row["title"],
                "route": row["route"],
                "similarity": row["structuralSimilarity"],
                "threshold": row["threshold"],
                "strictDelta": row["structuralStrictDelta"],
                "status": row["structuralStatus"],
            }
            for row in sorted_by_structural_similarity[:5]
        ],
    }


def current_capture_completeness(pairs: list[Comparison]) -> tuple[int, list[Comparison]]:
    existing = [pair for pair in pairs if pair.current.exists()]
    missing = [pair for pair in pairs if not pair.current.exists()]
    return len(existing), missing


def write_diff_index(
    pixel_dir: Path,
    generated: str,
    manifest_path: Path,
    rows: list[dict[str, object]],
    summary: dict[str, object],
) -> Path:
    index_path = pixel_dir / "diff-index.html"
    sorted_rows = sorted(
        rows,
        key=lambda row: (
            row.get("similarity") is None,
            float(row.get("similarity") or 1.0),
            str(row.get("key")),
        ),
    )
    cards: list[str] = []
    for row in sorted_rows:
        similarity = "n/a" if row["similarity"] is None else format_percent(row["similarity"])
        structural_similarity = (
            "n/a"
            if row.get("structuralSimilarity") is None
            else format_percent(row["structuralSimilarity"])
        )
        threshold = "n/a" if row["threshold"] is None else format_percent(row["threshold"])
        delta = format_delta(row.get("strictDelta"))
        structural_delta = format_delta(row.get("structuralStrictDelta"))
        access = "operator" if row.get("requiresOperator") else "public"
        viewports = ", ".join(
            str(viewport.get("name"))
            for viewport in row.get("viewports", [])
            if isinstance(viewport, dict) and viewport.get("name")
        ) or "n/a"
        status = str(row["status"])
        reason = row.get("reason")
        image_panels = []
        for label, key in [
            ("Reference", "reference"),
            ("Current", "current"),
            ("Diff", "diff"),
            ("Structural diff", "structuralDiff"),
        ]:
            path = row.get(key)
            if not path:
                image_panels.append(
                    f"<figure><figcaption>{label}</figcaption><div class=\"empty\">not available</div></figure>"
                )
                continue
            image_panels.append(
                "<figure>"
                f"<figcaption>{html.escape(label)}</figcaption>"
                f"<img src=\"{html.escape(html_path(pixel_dir, Path(str(path))))}\" alt=\"{html.escape(str(row['title']))} {html.escape(label.lower())}\">"
                "</figure>"
            )

        cards.append(
            f"""
<article class="card status-{html.escape(status)}">
  <header>
    <div>
      <p class="eyebrow">{html.escape(str(row['key']))} · {html.escape(str(row['frameFamily']))} · {access}</p>
      <h2>{html.escape(str(row['title']))}</h2>
      <p class="route">{html.escape(str(row['route']))}</p>
    </div>
    <dl>
      <div><dt>Status</dt><dd>{html.escape(status)}</dd></div>
      <div><dt>Similarity</dt><dd>{html.escape(similarity)}</dd></div>
      <div><dt>Structural</dt><dd>{html.escape(structural_similarity)}</dd></div>
      <div><dt>Threshold</dt><dd>{html.escape(threshold)}</dd></div>
      <div><dt>Delta</dt><dd>{html.escape(delta)}</dd></div>
      <div><dt>Structural delta</dt><dd>{html.escape(structural_delta)}</dd></div>
      <div><dt>Viewport</dt><dd>{html.escape(viewports)}</dd></div>
    </dl>
  </header>
  {f'<p class="reason">{html.escape(str(reason))}</p>' if reason else ''}
  <div class="panels">
    {''.join(image_panels)}
  </div>
</article>
"""
        )

    html_doc = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Arka Fund Figma Pixel Audit</title>
  <style>
    :root {{
      color-scheme: dark;
      --bg: #10072d;
      --panel: #1c104b;
      --panel-2: #271766;
      --line: #6b4bdd;
      --cyan: #6addff;
      --pink: #ff5fd2;
      --green: #61ff92;
      --text: #f5f0ff;
      --muted: #b7abd7;
      font-family: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
    }}
    body {{
      margin: 0;
      background:
        radial-gradient(circle at 16% 0%, rgba(255, 95, 210, 0.14), transparent 28rem),
        radial-gradient(circle at 86% 6%, rgba(106, 221, 255, 0.16), transparent 28rem),
        var(--bg);
      color: var(--text);
    }}
    main {{
      width: min(118rem, calc(100vw - 2rem));
      margin: 0 auto;
      padding: 2rem 0 4rem;
    }}
    .summary, .card {{
      border: 1px solid rgba(106, 221, 255, 0.28);
      background: linear-gradient(180deg, rgba(39, 22, 102, 0.92), rgba(19, 10, 55, 0.96));
      box-shadow: 0 1.5rem 4rem rgba(5, 0, 25, 0.28);
    }}
    .summary {{
      padding: 1.2rem;
      margin-bottom: 1rem;
    }}
    h1, h2, p {{ margin: 0; }}
    h1 {{ font-size: clamp(1.8rem, 3vw, 3.4rem); letter-spacing: -0.04em; }}
    .summary p {{ color: var(--muted); margin-top: .45rem; line-height: 1.45; }}
    .metrics {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      gap: .7rem;
      margin-top: 1rem;
    }}
    .metrics div {{
      border: 1px solid rgba(139, 108, 255, 0.38);
      background: rgba(17, 8, 48, 0.72);
      padding: .78rem;
    }}
    .metrics dt, .eyebrow, figcaption {{
      color: var(--muted);
      font-size: .72rem;
      font-weight: 700;
      letter-spacing: .12em;
      text-transform: uppercase;
    }}
    .metrics dd {{
      margin: .18rem 0 0;
      color: var(--text);
      font-size: 1.35rem;
      font-weight: 800;
    }}
    .card {{
      margin-top: 1rem;
      padding: 1rem;
    }}
    .card header {{
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(26rem, .8fr);
      gap: 1rem;
      align-items: start;
    }}
    .card h2 {{ font-size: clamp(1.2rem, 1.8vw, 2rem); letter-spacing: -.03em; }}
    .route, .reason {{ margin-top: .35rem; color: var(--muted); overflow-wrap: anywhere; }}
    .reason {{ color: #ffb84d; }}
    .card dl {{
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: .5rem;
      margin: 0;
    }}
    .card dl div {{
      border: 1px solid rgba(139, 108, 255, 0.32);
      background: rgba(13, 6, 39, 0.72);
      padding: .58rem;
    }}
    .card dt {{ color: var(--muted); font-size: .68rem; text-transform: uppercase; letter-spacing: .1em; }}
    .card dd {{ margin: .12rem 0 0; font-weight: 800; }}
    .status-drift {{ border-color: rgba(255, 95, 210, 0.55); }}
    .status-near {{ border-color: rgba(255, 184, 77, 0.52); }}
    .status-tight {{ border-color: rgba(97, 255, 146, 0.48); }}
    .panels {{
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: .72rem;
      margin-top: 1rem;
    }}
    figure {{
      margin: 0;
      min-width: 0;
    }}
    figcaption {{
      margin-bottom: .35rem;
    }}
    img, .empty {{
      display: block;
      width: 100%;
      max-height: 32rem;
      object-fit: contain;
      border: 1px solid rgba(139, 108, 255, 0.32);
      background: rgba(7, 2, 24, 0.72);
    }}
    .empty {{
      display: grid;
      min-height: 10rem;
      place-items: center;
      color: var(--muted);
    }}
    @media (max-width: 900px) {{
      main {{ width: min(100% - 1rem, 72rem); }}
      .card header, .panels {{ grid-template-columns: 1fr; }}
      .card dl {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }}
    }}
  </style>
</head>
<body>
  <main>
    <section class="summary">
      <h1>Arka Fund Figma Pixel Audit</h1>
      <p>Generated {html.escape(generated)} from <code>{html.escape(str(manifest_path))}</code>. Frames are sorted from worst similarity to best so visual repair can start where it matters most.</p>
      <dl class="metrics">
        <div><dt>Total</dt><dd>{summary['total']}</dd></div>
        <div><dt>Compared</dt><dd>{summary['compared']}</dd></div>
        <div><dt>Below threshold</dt><dd>{summary['belowThreshold']}</dd></div>
        <div><dt>Missing</dt><dd>{summary['missing']}</dd></div>
        <div><dt>Errors</dt><dd>{summary['errors']}</dd></div>
        <div><dt>Worst</dt><dd>{html.escape(str(summary['worstKey'] or 'n/a'))}</dd></div>
        <div><dt>Strict-ready</dt><dd>{'yes' if summary['allThresholdsMet'] else 'no'}</dd></div>
      </dl>
    </section>
    {''.join(cards)}
  </main>
</body>
</html>
"""
    index_path.write_text(html_doc, encoding="utf-8")
    return index_path


def main() -> int:
    config = parse_args()
    script_dir = Path(__file__).resolve().parent
    dapp_root = script_dir.parent
    manifest_path = config.manifest_path
    manifest_bytes = manifest_path.read_bytes()
    manifest_hash = hashlib.sha256(manifest_bytes).hexdigest()
    manifest = json.loads(manifest_bytes.decode("utf-8"))
    current_dir, _reference_dir, pairs = resolve_comparisons(dapp_root, manifest)
    valid_waivers, waiver_issues = resolve_valid_waivers(manifest, manifest.get("captures", []))
    audit_root = current_dir.parent
    pixel_dir = config.output_root or (audit_root / "pixel")
    pixel_dir.mkdir(parents=True, exist_ok=True)

    ffmpeg = resolve_binary("ffmpeg")
    ffprobe = resolve_binary("ffprobe")

    rows: list[dict[str, object]] = []
    strict_failures: list[str] = []
    strict_mode = config.strict_mode
    if strict_mode and not pairs:
        strict_failures.append("manifest: no reference-backed captures available for strict audit")
    if strict_mode and waiver_issues:
        strict_failures.extend(waiver_issues)
    existing_current_count, missing_current_pairs = current_capture_completeness(pairs)
    if (
        missing_current_pairs
        and existing_current_count > 0
        and not config.allow_partial_current
    ):
        missing_keys = ", ".join(pair.key for pair in missing_current_pairs[:8])
        suffix = "..." if len(missing_current_pairs) > 8 else ""
        strict_failures.append(
            "current capture set incomplete: "
            f"{len(missing_current_pairs)}/{len(pairs)} current screenshots missing "
            f"({missing_keys}{suffix}). "
            "Run the Playwright design capture to completion before pixel audit, "
            "or pass --allow-partial-current only for diagnostic reports."
        )

    for pair in pairs:
        if not pair.reference.exists() or not pair.current.exists():
            missing_parts = []
            if not pair.reference.exists():
                missing_parts.append("reference")
            if not pair.current.exists():
                missing_parts.append("current")
            reason = f"missing {' and '.join(missing_parts)} image"
            if strict_mode:
                strict_failures.append(f"{pair.key}: {reason}")
            rows.append(build_missing_row(pair, reason))
            continue

        try:
            row = compare_pair(pair, pixel_dir, ffmpeg, ffprobe)
        except Exception as error:
            if strict_mode:
                strict_failures.append(f"{pair.key}: pixel comparison error")
            rows.append(build_error_row(pair, error, pixel_dir))
            continue

        threshold = pair.threshold
        similarity = float(row["similarity"])
        passed_strict = threshold is None or similarity >= threshold
        row["passedStrict"] = passed_strict
        if not passed_strict and pair.key in valid_waivers:
            row["waiver"] = valid_waivers[pair.key]
            row["waivedStrict"] = True
        else:
            row["waivedStrict"] = False
        if strict_mode and not passed_strict and not row["waivedStrict"]:
            strict_failures.append(
                f"{pair.key}: similarity {similarity:.4f} below threshold {threshold:.4f}"
            )

        rows.append(row)

    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ")
    summary = build_summary(rows, strict_failures)
    diff_index_path = write_diff_index(pixel_dir, generated, manifest_path, rows, summary)
    json_report_path = pixel_dir / "report.json"
    report_path = pixel_dir / "report.md"
    lines = [
        "# Pixel Audit Report",
        "",
        f"Generated: {generated}",
        f"Manifest: `{manifest_path}`",
        f"Strict mode: `{strict_mode}`",
        f"Diff index: `{diff_index_path}`",
        "",
        "## Summary",
        "",
        f"- Compared captures: {summary['compared']} / {summary['total']}",
        f"- Missing captures: {summary['missing']}",
        f"- Error captures: {summary['errors']}",
        f"- Below-threshold captures: {summary['belowThreshold']}",
        f"- Raw below-threshold captures: {summary['rawBelowThreshold']}",
        f"- Waived below-threshold captures: {summary['waivedBelowThreshold']}",
        f"- Compared viewports: `{', '.join(summary['comparedViewports']) or 'n/a'}`",
        f"- Strict-ready: `{'yes' if summary['allThresholdsMet'] else 'no'}`",
        f"- Worst frame: `{summary['worstKey']}` at {format_percent(summary['worstSimilarity']) if summary['worstSimilarity'] is not None else 'n/a'}",
        f"- Structurally masked captures: {summary['structuralCompared']} / {summary['total']}",
        f"- Worst structural frame: `{summary['structuralWorstKey']}` at {format_percent(summary['structuralWorstSimilarity']) if summary['structuralWorstSimilarity'] is not None else 'n/a'}",
        "",
        "| Screen | Status | Similarity | Structural similarity | MAE | RMSE |",
        "| --- | --- | ---: | ---: | ---: | ---: |",
    ]
    for row in rows:
        similarity = "n/a" if row["similarity"] is None else format_percent(row["similarity"])
        structural_similarity = (
            "n/a"
            if row.get("structuralSimilarity") is None
            else format_percent(row["structuralSimilarity"])
        )
        mae = "n/a" if row["mae"] is None else format_percent(row["mae"])
        rmse = "n/a" if row["rmse"] is None else format_percent(row["rmse"])
        lines.append(
            f"| {row['title']} | {row['status']} | {similarity} | {structural_similarity} | {mae} | {rmse} |"
        )

    lines.append("")
    lines.append("## Visual Diff Panels")
    lines.append("")
    for row in rows:
        lines.append(f"### {row['title']}")
        lines.append("")
        lines.append(f"- Route: `{row['route']}`")
        lines.append(
            f"- Viewports: `{', '.join(str(viewport.get('name')) for viewport in row.get('viewports', []) if isinstance(viewport, dict) and viewport.get('name')) or 'n/a'}`"
        )
        lines.append(f"- Frame family: `{row['frameFamily']}`")
        lines.append(f"- Access: `{'operator' if row['requiresOperator'] else 'public'}`")
        lines.append(f"- Threshold: `{format_percent(row['threshold']) if row['threshold'] is not None else 'n/a'}`")
        lines.append(f"- Strict delta: `{format_delta(row.get('strictDelta'))}`")
        lines.append(f"- Dynamic mask coverage: `{format_percent(row.get('dynamicMaskCoverage') or 0)}`")
        lines.append(
            f"- Structural similarity: `{format_percent(row['structuralSimilarity']) if row.get('structuralSimilarity') is not None else 'n/a'}`"
        )
        lines.append(f"- Structural delta: `{format_delta(row.get('structuralStrictDelta'))}`")
        lines.append(f"- Reference: `{row['reference']}`")
        lines.append(f"- Current (original): `{row['currentOriginal']}`")
        lines.append(f"- Current (aligned): `{row['current']}`")
        lines.append(f"- Diff heatmap: `{row['diff']}`")
        lines.append(f"- Structural diff heatmap: `{row.get('structuralDiff') or 'n/a'}`")
        if row.get("waiver"):
            waiver = row["waiver"]
            lines.append(
                f"- Waiver: `{waiver['owner']}` until `{waiver['expiresAt']}` - {waiver['reason']}"
            )
        lines.append("")
        if row["diff"]:
            lines.append(f"![{row['title']} diff]({row['diff']})")
            lines.append("")
        if row.get("structuralDiff"):
            lines.append(f"![{row['title']} structural diff]({row['structuralDiff']})")
            lines.append("")

    if strict_failures:
        lines.append("## Strict Gate Failures")
        lines.append("")
        for failure in strict_failures:
            lines.append(f"- {failure}")
        lines.append("")

    report_path.write_text("\n".join(lines), encoding="utf-8")
    if config.write_json:
        json_report_path.write_text(
            json.dumps(
                {
                    "generatedAt": generated,
                    "manifest": str(manifest_path),
                    "manifestHash": manifest_hash,
                    "referenceRoot": manifest.get("referenceRoot"),
                    "currentRoot": manifest.get("currentRoot"),
                    "expectedReferencedCaptures": len(pairs),
                    "strictMode": strict_mode,
                    "ok": not strict_failures,
                    "summary": summary,
                    "failureCount": len(strict_failures),
                    "failures": strict_failures,
                    "comparisons": rows,
                    "report": str(report_path),
                    "diffIndex": str(diff_index_path),
                },
                indent=2,
                sort_keys=True,
            ),
            encoding="utf-8",
        )
    print(report_path)
    return 1 if strict_failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
