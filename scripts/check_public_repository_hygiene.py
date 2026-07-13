#!/usr/bin/env python3
"""Reject workstation-specific paths from tracked public repository content."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


FORBIDDEN_MARKERS = ("/" + "Users/", "/" + "home/", "/" + "private/var/folders/")
EXCLUDED_PREFIXES = (".git/", "target/", "node_modules/")


def tracked_files(root: Path) -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=root,
        check=True,
        capture_output=True,
    )
    return [root / path for path in result.stdout.decode().split("\0") if path]


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    violations: list[str] = []

    for path in tracked_files(root):
        relative = path.relative_to(root).as_posix()
        if relative.startswith(EXCLUDED_PREFIXES):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue

        for line_number, line in enumerate(text.splitlines(), start=1):
            if any(marker in line for marker in FORBIDDEN_MARKERS):
                violations.append(f"{relative}:{line_number}")

    if violations:
        print("Workstation-specific paths are not permitted in public repository content:")
        print("\n".join(violations))
        return 1

    print("Public repository hygiene check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
