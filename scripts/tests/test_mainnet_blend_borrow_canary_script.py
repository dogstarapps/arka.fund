import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "validate-mainnet-blend-borrow-repay.sh"
ESTIMATE_SCRIPT = ROOT / "scripts" / "estimate-mainnet-contract-deploy.sh"


class MainnetBlendBorrowCanaryScriptTests(unittest.TestCase):
    def test_failed_exit_always_runs_isolated_position_cleanup(self):
        source = SCRIPT.read_text()

        self.assertIn("trap - ERR EXIT", source)
        self.assertIn("cleanup_failed_canary", source)
        self.assertIn("trap 'exit_code=$?; if [[ \"$exit_code\" -ne 0 ]]; then cleanup_failed_canary \"$exit_code\"; fi' EXIT", source)
        self.assertIn("disable_venue", source)
        self.assertIn("redeem_canary_capital", source)

    def test_fresh_mainnet_deploy_requires_separate_explicit_acknowledgement(self):
        source = SCRIPT.read_text()

        self.assertIn("ALLOW_FRESH_MAINNET_BLEND_CANARY_DEPLOYMENT", source)
        self.assertIn("deploy-fresh-mainnet-blend-canary", source)
        self.assertIn("Refusing to deploy fresh Mainnet canary contracts.", source)

    def test_deploy_estimate_is_read_only_and_does_not_claim_to_quote_storage_rent(self):
        source = ESTIMATE_SCRIPT.read_text()

        self.assertIn("--build-only", source)
        self.assertIn("simulateTransaction", source)
        self.assertNotIn("--send=yes", source)
        self.assertIn("not a complete quote for fresh Mainnet storage rent", source)

    def test_canary_uses_a_fixed_budgeted_account_for_contract_execution(self):
        source = SCRIPT.read_text()

        self.assertIn('CANARY_BUDGET_STROOPS="${BLEND_CANARY_BUDGET_STROOPS:-300000000}"', source)
        self.assertIn('MIN_ADMIN_RESERVE_STROOPS="${BLEND_CANARY_MIN_ADMIN_RESERVE_STROOPS:-1000000000}"', source)
        self.assertIn("assert_canary_budget", source)
        self.assertIn("create_canary_account", source)
        self.assertIn("close_canary_account", source)
        self.assertIn('keys generate "$CANARY_IDENTITY" >/dev/null', source)
        self.assertIn('keys secret "$CANARY_IDENTITY"', source)
        self.assertIn('account_exists "$CANARY_ADDRESS"', source)
        self.assertIn('--source-account "$CANARY_SECRET"', source)
        self.assertIn('invoke_send_as "$CANARY_SECRET"', source)

    def test_administrator_is_limited_to_venue_governance_and_canary_lifecycle(self):
        source = SCRIPT.read_text()

        self.assertIn('invoke_admin_send "$VENUE_REGISTRY" set_venue_status', source)
        self.assertIn('invoke_admin_send "$VENUE_REGISTRY" disable_venue', source)
        self.assertIn('stellar -q tx new create-account', source)
        self.assertIn('stellar -q tx new account-merge', source)
        self.assertNotIn('| stellar tx send', source)
        self.assertIn('--manager "$CANARY_ADDRESS"', source)
        self.assertIn('--caller "$CANARY_ADDRESS"', source)


if __name__ == "__main__":
    unittest.main()
