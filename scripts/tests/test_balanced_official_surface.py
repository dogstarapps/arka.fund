import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import verify_balanced_official_surface as surface


APP_HTML = """
<!doctype html>
<html>
  <head>
    <script type="module" crossorigin src="/assets/index-C41ZfSgF.js"></script>
  </head>
</html>
"""

BUNDLE_JS = """
var config={
  [STELLAR_MAINNET_CHAIN_ID$2]:{
    addresses:{
      connection:"CDFQDDPUPAM3XPGORHDOEFRNLMKOH3N3X6XTXNLSXJQXIU3RVCM3OPEP",
      assetManager:"CCGF33A4CO6D3BXFEKPXVCFCZBK76I3AQOZK6KIKRPAWAZR3632WHCJ3",
      xTokenManager:"",
      rateLimit:"CB6G3ULISTTBPXUN3BI6ADHQGWJEN7BPQINHL45TCB6TDFM5QWU24HAY"
    }
  }
}
"""

STELLAR_PAGE = """
<h1>Cross-chain DeFi on Stellar</h1>
<p>Balanced uses intent-based trades, so you can move between assets within 30 seconds at the best price available.</p>
"""

SWAP_DOCS = """
<p>The other will update to reflect the current rate.</p>
<p>Any price change is factored into the quote.</p>
<p>You can view the trade in Recent Activity.</p>
<p>The trade will auto-cancel after 5 minutes if it has not settled.</p>
"""

TRADE_BLOG = """
<p>Swaps are routed through SODAX Intents.</p>
<p>The quote courtesy of SODAX is shown before you submit.</p>
<p>Recent Activity lets you inspect or cancel a pending trade if it takes more than 5 minutes.</p>
<p>If you want to use the previous route, use the legacy Trade page / legacy exchange.</p>
<p>Liquidity pools are still available via the legacy Trade page.</p>
"""

Q3_BLOG = """
<p>Added support for intent-based trades on Stellar.</p>
<p>The core backend and smart contract work are now covered by SODAX.</p>
"""

SODAX_PACKAGES = """
<p>getSupportedSwapTokensByChainId</p>
"""

SODAX_WALLET_PROVIDERS = """
<p>IStellarWalletProvider</p>
"""

SODAX_SPOKE_PROVIDER = """
<p>StellarRawSpokeProvider</p>
"""

SODAX_SDK_BLOG = """
<p>sodax.solver.getQuote(...)</p>
<p>sodax.solver.getStatus(...)</p>
<p>sodax.solver.cancelIntent(...)</p>
"""


class BalancedOfficialSurfaceTests(unittest.TestCase):
    def test_parse_bundle_path(self) -> None:
        self.assertEqual(
            surface.parse_bundle_path(APP_HTML),
            "/assets/index-C41ZfSgF.js",
        )

    def test_parse_stellar_mainnet_addresses(self) -> None:
        addresses = surface.parse_stellar_mainnet_addresses(BUNDLE_JS)
        self.assertEqual(
            addresses["connection"],
            "CDFQDDPUPAM3XPGORHDOEFRNLMKOH3N3X6XTXNLSXJQXIU3RVCM3OPEP",
        )
        self.assertEqual(
            addresses["assetManager"],
            "CCGF33A4CO6D3BXFEKPXVCFCZBK76I3AQOZK6KIKRPAWAZR3632WHCJ3",
        )
        self.assertEqual(
            addresses["rateLimit"],
            "CB6G3ULISTTBPXUN3BI6ADHQGWJEN7BPQINHL45TCB6TDFM5QWU24HAY",
        )

    def test_derive_report_detects_intent_based_mainnet_only_surface(self) -> None:
        report = surface.derive_report(
            app_html=APP_HTML,
            bundle_js=BUNDLE_JS,
            stellar_page_html=STELLAR_PAGE,
            swap_docs_html=SWAP_DOCS,
            trade_blog_html=TRADE_BLOG,
            q3_blog_html=Q3_BLOG,
            sodax_packages_html=SODAX_PACKAGES,
            sodax_wallet_providers_html=SODAX_WALLET_PROVIDERS,
            sodax_spoke_provider_html=SODAX_SPOKE_PROVIDER,
            sodax_sdk_blog_html=SODAX_SDK_BLOG,
            bundle_url="https://app.balanced.network/assets/index-C41ZfSgF.js",
        )
        self.assertEqual(report["topology"], "intent_based")
        self.assertEqual(report["swapModel"], "sodax_intents")
        self.assertEqual(report["liquidityModel"], "legacy_exchange_only")
        self.assertFalse(report["supportsPublicStellarTestnet"])
        self.assertFalse(report["canonicalRouterCutoverPossible"])
        self.assertIsNone(report["publicRouterContractId"])
        self.assertEqual(report["intentAdapter"]["quoteProvider"], "sodax")
        self.assertTrue(report["intentAdapter"]["quoteVisibleInApp"])
        self.assertEqual(report["intentAdapter"]["statusSurface"], "recent_activity")
        self.assertEqual(report["intentAdapter"]["cancellationWindowSeconds"], 300)
        self.assertEqual(
            report["intentAdapter"]["publicQuoteEndpoint"],
            "sdk:@sodax/sdk::swaps.getQuote",
        )
        self.assertEqual(
            report["intentAdapter"]["publicStatusEndpoint"],
            "sdk:@sodax/sdk::swaps.getStatus",
        )
        self.assertFalse(report["intentAdapter"]["quoteComparableForArka"])
        self.assertTrue(any("SODAX Intents" in finding for finding in report["findings"]))
        self.assertTrue(any("machine-consumable quote surface" in finding for finding in report["findings"]))

    def test_update_deployments_validation(self) -> None:
        report = surface.derive_report(
            app_html=APP_HTML,
            bundle_js=BUNDLE_JS,
            stellar_page_html=STELLAR_PAGE,
            swap_docs_html=SWAP_DOCS,
            trade_blog_html=TRADE_BLOG,
            q3_blog_html=Q3_BLOG,
            sodax_packages_html=SODAX_PACKAGES,
            sodax_wallet_providers_html=SODAX_WALLET_PROVIDERS,
            sodax_spoke_provider_html=SODAX_SPOKE_PROVIDER,
            sodax_sdk_blog_html=SODAX_SDK_BLOG,
            bundle_url="https://app.balanced.network/assets/index-C41ZfSgF.js",
        )
        with tempfile.TemporaryDirectory() as tmpdir:
            deployments = Path(tmpdir) / "deployments.json"
            deployments.write_text('{"validations":{}}', encoding="utf-8")
            out_json = Path(tmpdir) / "balanced-official-surface.json"
            surface.update_deployments_validation(
                deployments,
                out_json=out_json,
                report=report,
            )
            updated = surface.read_text(deployments)
            self.assertEqual(
                updated["validations"]["balancedOfficialSurface"]["topology"],
                "intent_based",
            )
            self.assertEqual(
                updated["validations"]["balancedOfficialSurface"]["intentAdapter"]["statusSurface"],
                "recent_activity",
            )
            self.assertIsNone(
                updated["validations"]["balancedOfficialSurface"]["publicRouterContractId"]
            )


if __name__ == "__main__":
    unittest.main()
