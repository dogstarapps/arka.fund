#!/usr/bin/env python3
"""Measure the public Arkafund catalog API latency from a CI runner."""

from __future__ import annotations

import argparse
import statistics
import time
from dataclasses import dataclass
from typing import Sequence
from http.client import HTTPSConnection
from urllib.parse import SplitResult, urlsplit


DEFAULT_ENDPOINT = "https://app.arka.fund/api/nav"


@dataclass(frozen=True)
class LatencySummary:
    samples: int
    average_ms: float
    p50_ms: float
    p95_ms: float


def percentile(values_ms: Sequence[float], fraction: float) -> float:
    if not values_ms:
        raise ValueError("at least one latency sample is required")
    if not 0 <= fraction <= 1:
        raise ValueError("percentile fraction must be between 0 and 1")
    ordered = sorted(values_ms)
    position = round((len(ordered) - 1) * fraction)
    return ordered[position]


def summarize(values_ms: Sequence[float]) -> LatencySummary:
    if not values_ms:
        raise ValueError("at least one latency sample is required")
    return LatencySummary(
        samples=len(values_ms),
        average_ms=statistics.fmean(values_ms),
        p50_ms=percentile(values_ms, 0.50),
        p95_ms=percentile(values_ms, 0.95),
    )


def parse_https_endpoint(endpoint: str) -> tuple[str, int, str]:
    parsed: SplitResult = urlsplit(endpoint)
    if parsed.scheme != "https" or not parsed.hostname:
        raise ValueError("endpoint must be an absolute HTTPS URL")
    target = parsed.path or "/"
    if parsed.query:
        target = f"{target}?{parsed.query}"
    return parsed.hostname, parsed.port or 443, target


def request_ok(connection: HTTPSConnection, target: str) -> None:
    connection.request("GET", target, headers={"Connection": "keep-alive"})
    response = connection.getresponse()
    if response.status != 200:
        raise RuntimeError(f"request returned HTTP {response.status}")
    response.read()


def warm_connection(
    host: str,
    port: int,
    target: str,
    timeout_seconds: float,
    attempts: int,
) -> HTTPSConnection:
    last_error: OSError | RuntimeError | None = None
    for _ in range(attempts):
        connection = HTTPSConnection(host, port, timeout=timeout_seconds)
        try:
            request_ok(connection, target)
            return connection
        except (OSError, RuntimeError) as error:
            last_error = error
            connection.close()
    raise RuntimeError(f"warm-up failed after {attempts} attempts: {last_error}")


def measure(
    endpoint: str,
    samples: int,
    timeout_seconds: float,
    warm_up_attempts: int = 3,
) -> list[float]:
    if samples < 1:
        raise ValueError("samples must be at least 1")
    host, port, target = parse_https_endpoint(endpoint)
    connection = warm_connection(
        host,
        port,
        target,
        timeout_seconds,
        warm_up_attempts,
    )
    try:
        values_ms: list[float] = []
        for index in range(samples):
            started = time.perf_counter()
            try:
                request_ok(connection, target)
            except RuntimeError as error:
                raise RuntimeError(f"sample {index + 1} failed: {error}") from error
            values_ms.append((time.perf_counter() - started) * 1000)
        return values_ms
    finally:
        connection.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--endpoint", default=DEFAULT_ENDPOINT)
    parser.add_argument("--samples", type=int, default=20)
    parser.add_argument("--timeout-seconds", type=float, default=10.0)
    parser.add_argument("--max-average-ms", type=float, default=200.0)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        summary = summarize(measure(args.endpoint, args.samples, args.timeout_seconds))
    except (OSError, RuntimeError, ValueError) as error:
        print(f"Catalog latency check failed: {error}")
        return 1

    print(
        "Catalog API latency: "
        f"samples={summary.samples} "
        f"average_ms={summary.average_ms:.2f} "
        f"p50_ms={summary.p50_ms:.2f} "
        f"p95_ms={summary.p95_ms:.2f}"
    )
    if summary.average_ms > args.max_average_ms:
        print(f"Average latency exceeds {args.max_average_ms:.2f} ms")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
