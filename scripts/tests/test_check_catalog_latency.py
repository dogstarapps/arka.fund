import importlib.util
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch


ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = ROOT / "scripts" / "check_catalog_latency.py"
spec = importlib.util.spec_from_file_location("check_catalog_latency", MODULE_PATH)
latency = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules[spec.name] = latency
spec.loader.exec_module(latency)


class CatalogLatencyTests(unittest.TestCase):
    def test_summary_uses_all_samples_and_nearest_percentiles(self):
        summary = latency.summarize([10.0, 20.0, 30.0, 40.0, 50.0])

        self.assertEqual(summary.samples, 5)
        self.assertEqual(summary.average_ms, 30.0)
        self.assertEqual(summary.p50_ms, 30.0)
        self.assertEqual(summary.p95_ms, 50.0)

    def test_percentile_rejects_invalid_input(self):
        with self.assertRaises(ValueError):
            latency.percentile([], 0.5)
        with self.assertRaises(ValueError):
            latency.percentile([10.0], 1.1)

    def test_parse_https_endpoint_keeps_path_and_query(self):
        host, port, target = latency.parse_https_endpoint("https://catalog.arka.fund:8443/v1/nav?window=1w")

        self.assertEqual(host, "catalog.arka.fund")
        self.assertEqual(port, 8443)
        self.assertEqual(target, "/v1/nav?window=1w")

    def test_parse_https_endpoint_rejects_non_https_urls(self):
        with self.assertRaises(ValueError):
            latency.parse_https_endpoint("http://catalog.arka.fund/v1/nav")

    def test_warm_connection_retries_with_a_fresh_connection(self):
        first_connection = Mock()
        second_connection = Mock()
        with (
            patch.object(
                latency,
                "HTTPSConnection",
                side_effect=[first_connection, second_connection],
            ) as connection_factory,
            patch.object(
                latency,
                "request_ok",
                side_effect=[OSError("cold start timeout"), None],
            ) as request_ok,
        ):
            connection = latency.warm_connection(
                "app.arka.fund",
                443,
                "/api/nav",
                10.0,
                3,
            )

        self.assertIs(connection, second_connection)
        self.assertEqual(connection_factory.call_count, 2)
        self.assertEqual(request_ok.call_count, 2)
        first_connection.close.assert_called_once_with()
        second_connection.close.assert_not_called()


if __name__ == "__main__":
    unittest.main()
