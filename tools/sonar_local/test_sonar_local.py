from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent))

import sonar_local


class SonarLocalTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.db = self.root / "sonar.duckdb"
        self.out = self.root / "out"
        self.snapshot = self.root / "snapshot.json"
        self.snapshot.write_text(
            json.dumps(
                {
                    "nodes": [
                        {
                            "id": "wsl-route",
                            "content": "Prefer WSL and Node over long PowerShell commands after repeated Windows quoting failures.",
                            "type": "Decision",
                            "tags": ["wsl", "powershell", "shell-routing"],
                            "importance": 0.95,
                            "confidence": 0.95,
                        },
                        {
                            "id": "old-route",
                            "content": "Use PowerShell for every local automation task.",
                            "type": "Context",
                            "tags": ["powershell", "deprecated"],
                            "importance": 0.6,
                            "confidence": 0.7,
                        },
                        {
                            "id": "runtime-proof",
                            "content": "Configuration visibility is not runtime proof; verify the live execution context.",
                            "type": "Pattern",
                            "tags": ["runtime", "verification"],
                            "importance": 0.9,
                            "confidence": 0.95,
                        },
                    ],
                    "edges": [
                        {
                            "source": "old-route",
                            "target": "wsl-route",
                            "type": "CONTRADICTS",
                            "strength": 0.9,
                        },
                        {
                            "source": "wsl-route",
                            "target": "runtime-proof",
                            "type": "LEADS_TO",
                            "strength": 0.8,
                        },
                    ],
                    "stats": {"total_nodes": 3, "total_edges": 2},
                }
            ),
            encoding="utf-8",
        )
        sonar_local.refresh(
            SimpleNamespace(
                snapshot_file=str(self.snapshot),
                api_url="http://unused",
                db=str(self.db),
            )
        )

    def tearDown(self) -> None:
        self.temp.cleanup()

    def run_query(self, query: str) -> dict:
        return sonar_local.preflight(
            SimpleNamespace(query=query, limit=3, db=str(self.db), out_dir=str(self.out))
        )

    def test_powershell_query_prefers_wsl_route_and_requires_runtime_bridge(self) -> None:
        result = self.run_query("Why should this Docker task avoid PowerShell on Windows?")
        self.assertEqual(result["current_view"][0]["id"], "wsl-route")
        self.assertIn("runtime", result["domains"])
        self.assertIn("live_runtime_verification_required", result["gaps"])
        self.assertTrue(any(edge["target"] == "LocalOperationalRuntime" for edge in result["required_bridges"]))

    def test_conflict_is_reported_without_claiming_absence(self) -> None:
        result = self.run_query("PowerShell WSL route conflict")
        self.assertTrue(any(edge["relation"] == "CONTRADICTS" for edge in result["conflicts"]))

    def test_basic_memory_is_not_a_runtime_dependency(self) -> None:
        result = self.run_query("AutoMem memory continuity after compact")
        self.assertFalse(result["meta"]["basic_memory_required"])


if __name__ == "__main__":
    unittest.main()
