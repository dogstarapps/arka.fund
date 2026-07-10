import importlib.util
import sys
import unittest
from pathlib import Path


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


if __name__ == "__main__":
    unittest.main()
