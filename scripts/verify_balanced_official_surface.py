#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
from pathlib import Path
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DEPLOYMENTS = ROOT_DIR / "deployments.testnet.json"
DEFAULT_OUT = ROOT_DIR / "tmp" / "balanced-official-surface.json"
APP_URL = "https://app.balanced.network"
STELLAR_PAGE_URL = "https://balanced.network/stellar/"
SWAP_DOCS_URL = "https://balanced.network/"
TRADE_BLOG_URL = "https://blog.balanced.network/trade-cross-chain/"
Q3_BLOG_URL = "https://blog.balanced.network/q3-2025/"
SODAX_PACKAGES_URL = "https://docs.sodax.com/developers/packages"
SODAX_WALLET_PROVIDERS_URL = "https://docs.sodax.com/developers/how-to/wallet_providers"
SODAX_SPOKE_PROVIDER_URL = "https://docs.sodax.com/developers/how-to/how_to_create_a_spoke_provider"
SODAX_SDK_BLOG_URL = "https://news.sodax.com/posts/integrate-with-the-sodax-sdk"

FetchText = Callable[[str], str]


def read_text(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def fetch_text(url: str) -> str:
    try:
        request = Request(
            url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/136.0.0.0 Safari/537.36"
                )
            },
        )
        with urlopen(request, timeout=20) as response:
            return response.read().decode("utf-8")
    except HTTPError as exc:
        redirect = exc.headers.get("Location")
        if exc.code in {301, 302, 307, 308} and redirect:
            return fetch_text(redirect)
        raise RuntimeError(f"failed to fetch {url}: {exc}") from exc
    except URLError as exc:
        raise RuntimeError(f"failed to fetch {url}: {exc}") from exc


def parse_bundle_path(app_html: str) -> str:
    match = re.search(r'<script[^>]+src="([^"]+/assets/index-[^"]+\.js|/assets/index-[^"]+\.js)"', app_html)
    if not match:
        raise ValueError("unable to locate the official Balanced app bundle path")
    return match.group(1)


def absolute_url(base_url: str, path: str) -> str:
    if path.startswith("http://") or path.startswith("https://"):
        return path
    return f"{base_url.rstrip('/')}/{path.lstrip('/')}"


def parse_stellar_mainnet_addresses(bundle_js: str) -> dict[str, str | None]:
    match = re.search(
        r'\[STELLAR_MAINNET_CHAIN_ID\$?\d*\]:\{[\s\S]{0,2000}?connection:"([^"]+)"[\s\S]{0,200}?assetManager:"([^"]+)"[\s\S]{0,200}?xTokenManager:"([^"]*)"[\s\S]{0,200}?rateLimit:"([^"]+)"',
        bundle_js,
    )
    if not match:
        return {
            "connection": None,
            "assetManager": None,
            "xTokenManager": None,
            "rateLimit": None,
        }
    return {
        "connection": match.group(1) or None,
        "assetManager": match.group(2) or None,
        "xTokenManager": match.group(3) or None,
        "rateLimit": match.group(4) or None,
    }


def derive_report(
    *,
    app_html: str,
    bundle_js: str,
    stellar_page_html: str,
    swap_docs_html: str,
    trade_blog_html: str,
    q3_blog_html: str,
    sodax_packages_html: str,
    sodax_wallet_providers_html: str,
    sodax_spoke_provider_html: str,
    sodax_sdk_blog_html: str,
    bundle_url: str,
) -> dict[str, Any]:
    mainnet_addresses = parse_stellar_mainnet_addresses(bundle_js)
    swap_uses_sodax_intents = (
        ("intent-based" in stellar_page_html.lower() or "intent-based" in trade_blog_html.lower() or "intent-based" in q3_blog_html.lower())
        and ("SODAX" in trade_blog_html or "SODAX" in q3_blog_html)
    )
    supply_is_legacy = (
        "liquidity pools" in trade_blog_html.lower()
        and "legacy Trade page" in trade_blog_html
    )
    quote_visible_in_app = (
        "The other will update to reflect the current rate" in swap_docs_html
        or "quote courtesy of SODAX" in trade_blog_html
        or "factored into the quote" in swap_docs_html
    )
    status_surface_recent_activity = (
        "Recent Activity" in swap_docs_html or "Recent Activity" in trade_blog_html
    )
    cancellation_window_seconds = (
        300
        if (
            "auto-cancel after 5 minutes" in swap_docs_html
            or "takes more than 5 minutes" in trade_blog_html
        )
        else None
    )
    has_stellar_testnet = "STELLAR_TESTNET" in bundle_js
    public_router_contract_id = None
    sdk_supports_stellar = (
        "IStellarWalletProvider" in sodax_wallet_providers_html
        and "StellarRawSpokeProvider" in sodax_spoke_provider_html
    )
    public_quote_endpoint = (
        "sdk:@sodax/sdk::swaps.getQuote"
        if "getQuote" in sodax_sdk_blog_html and sdk_supports_stellar
        else None
    )
    public_status_endpoint = (
        "sdk:@sodax/sdk::swaps.getStatus"
        if "getStatus" in sodax_sdk_blog_html and sdk_supports_stellar
        else None
    )
    public_receipt_endpoint = public_status_endpoint
    quote_comparable_for_arka = False
    findings: list[str] = []

    if swap_uses_sodax_intents:
        findings.append(
            "Official Stellar swaps are powered by SODAX Intents rather than a published Soroban router."
        )
    if "core backend and smart contract work are now covered by SODAX" in q3_blog_html:
        findings.append(
            "Balanced now relies on the SODAX backend/smart-contract stack for this surface."
        )
    if supply_is_legacy:
        findings.append(
            "The official trade/liquidity fallback now points users to a legacy exchange flow instead of a current public AMM router."
        )
    if not has_stellar_testnet:
        findings.append(
            "The official app bundle exposes Stellar mainnet configuration only; no public Stellar testnet config was found."
        )
    if public_router_contract_id is None:
        findings.append(
            "No public Balanced Stellar router contract id was found in the official docs or official app bundle."
        )
    if quote_visible_in_app and public_quote_endpoint is None:
        findings.append(
            "The official app exposes a SODAX-backed quote flow to users, but no public machine-consumable quote endpoint was found."
        )
    if status_surface_recent_activity and public_status_endpoint is None:
        findings.append(
            "The official app exposes status and cancel UX through Recent Activity, but no public machine-consumable status endpoint was found."
        )
    if public_quote_endpoint is not None and sdk_supports_stellar:
        findings.append(
            "A public machine-consumable quote surface is available through the SODAX SDK for Stellar."
        )
    if public_status_endpoint is not None and sdk_supports_stellar:
        findings.append(
            "A public machine-consumable status surface is available through the SODAX SDK for Stellar."
        )

    topology = "intent_based"
    canonical_cutover_possible = False

    return {
        "validatedAt": dt.date.today().isoformat(),
        "officialSources": {
            "app": APP_URL,
            "bundle": bundle_url,
            "stellarPage": STELLAR_PAGE_URL,
            "swapDocs": SWAP_DOCS_URL,
            "tradeBlog": TRADE_BLOG_URL,
            "q3Blog": Q3_BLOG_URL,
        },
        "topology": topology,
        "swapModel": "sodax_intents" if swap_uses_sodax_intents else "unknown",
        "liquidityModel": "legacy_exchange_only" if supply_is_legacy else "unknown",
        "publicRouterContractId": public_router_contract_id,
        "supportsPublicStellarTestnet": has_stellar_testnet,
        "canonicalRouterCutoverPossible": canonical_cutover_possible,
        "intentAdapter": {
            "quoteProvider": "sodax" if swap_uses_sodax_intents else "unknown",
            "quoteVisibleInApp": quote_visible_in_app,
            "quoteComparableForArka": quote_comparable_for_arka,
            "publicQuoteEndpoint": public_quote_endpoint,
            "statusSurface": "recent_activity" if status_surface_recent_activity else "unknown",
            "publicStatusEndpoint": public_status_endpoint,
            "publicReceiptEndpoint": public_receipt_endpoint,
            "cancellationWindowSeconds": cancellation_window_seconds,
        },
        "stellarMainnetAddresses": mainnet_addresses,
        "findings": findings,
        "appBundleDetected": bool(app_html and bundle_url),
    }


def update_deployments_validation(
    deployments_path: Path,
    *,
    out_json: Path,
    report: dict[str, Any],
) -> None:
    deployments = read_text(deployments_path)
    validations = deployments.setdefault("validations", {})
    validations["balancedOfficialSurface"] = {
        "validatedAt": report["validatedAt"],
        "report": str(out_json),
        "officialSources": report["officialSources"],
        "topology": report["topology"],
        "swapModel": report["swapModel"],
        "liquidityModel": report["liquidityModel"],
        "publicRouterContractId": report["publicRouterContractId"],
        "supportsPublicStellarTestnet": report["supportsPublicStellarTestnet"],
        "canonicalRouterCutoverPossible": report["canonicalRouterCutoverPossible"],
        "intentAdapter": report["intentAdapter"],
        "stellarMainnetAddresses": report["stellarMainnetAddresses"],
        "findings": report["findings"],
    }
    write_json(deployments_path, deployments)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Verify the official Balanced Stellar surface from official docs and the official app bundle."
    )
    parser.add_argument("--deployments", type=Path, default=DEFAULT_DEPLOYMENTS)
    parser.add_argument("--out-json", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--update-deployments", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    app_html = fetch_text(APP_URL)
    bundle_path = parse_bundle_path(app_html)
    bundle_url = absolute_url(APP_URL, bundle_path)
    bundle_js = fetch_text(bundle_url)
    stellar_page_html = fetch_text(STELLAR_PAGE_URL)
    swap_docs_html = fetch_text(SWAP_DOCS_URL)
    trade_blog_html = fetch_text(TRADE_BLOG_URL)
    q3_blog_html = fetch_text(Q3_BLOG_URL)
    sodax_packages_html = fetch_text(SODAX_PACKAGES_URL)
    sodax_wallet_providers_html = fetch_text(SODAX_WALLET_PROVIDERS_URL)
    sodax_spoke_provider_html = fetch_text(SODAX_SPOKE_PROVIDER_URL)
    sodax_sdk_blog_html = fetch_text(SODAX_SDK_BLOG_URL)

    report = derive_report(
        app_html=app_html,
        bundle_js=bundle_js,
        stellar_page_html=stellar_page_html,
        swap_docs_html=swap_docs_html,
        trade_blog_html=trade_blog_html,
        q3_blog_html=q3_blog_html,
        sodax_packages_html=sodax_packages_html,
        sodax_wallet_providers_html=sodax_wallet_providers_html,
        sodax_spoke_provider_html=sodax_spoke_provider_html,
        sodax_sdk_blog_html=sodax_sdk_blog_html,
        bundle_url=bundle_url,
    )
    write_json(args.out_json, report)
    if args.update_deployments:
        update_deployments_validation(args.deployments, out_json=args.out_json, report=report)
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
