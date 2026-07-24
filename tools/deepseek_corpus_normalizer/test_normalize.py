import json
import tempfile
import unittest
from pathlib import Path

import pyarrow.parquet as pq

from normalize import normalize_export


class DeepSeekNormalizerTests(unittest.TestCase):
    def test_preserves_tree_fragments_models_and_timestamps(self):
        fixture = [
            {
                "id": "conv-1",
                "title": "synthetic",
                "inserted_at": "2025-01-01T10:00:00+08:00",
                "updated_at": "2025-01-01T10:05:00+08:00",
                "mapping": {
                    "root": {"id": "root", "parent": None, "children": ["1"], "message": None},
                    "1": {
                        "id": "1",
                        "parent": "root",
                        "children": ["2", "3"],
                        "message": {
                            "files": [],
                            "model": "deepseek-reasoner",
                            "inserted_at": "2025-01-01T10:00:01+08:00",
                            "fragments": [
                                {"type": "REQUEST", "content": "question"},
                                {"type": "THINK", "content": "reasoning"},
                            ],
                        },
                    },
                    "2": {
                        "id": "2",
                        "parent": "1",
                        "children": [],
                        "message": {
                            "files": [],
                            "model": "deepseek-reasoner",
                            "inserted_at": "2025-01-01T10:00:02+08:00",
                            "fragments": [{"type": "RESPONSE", "content": "answer-a"}],
                        },
                    },
                    "3": {
                        "id": "3",
                        "parent": "1",
                        "children": [],
                        "message": {
                            "files": [],
                            "model": "deepseek-chat",
                            "inserted_at": "2025-01-01T10:00:03+08:00",
                            "fragments": [{"type": "RESPONSE", "content": "answer-b"}],
                        },
                    },
                },
            }
        ]
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            src = tmp / "conversations.json"
            out = tmp / "normalized"
            src.write_text(json.dumps(fixture, ensure_ascii=False), encoding="utf-8")

            manifest = normalize_export(src, out)

            self.assertEqual(manifest["counts"]["conversations"], 1)
            self.assertEqual(manifest["counts"]["messages"], 3)
            self.assertEqual(manifest["counts"]["edges"], 3)
            self.assertEqual(manifest["counts"]["fragments"], 4)

            conversations = pq.read_table(out / "conversations.parquet").to_pylist()
            messages = pq.read_table(out / "messages.parquet").to_pylist()
            edges = pq.read_table(out / "edges.parquet").to_pylist()
            fragments = pq.read_table(out / "fragments.parquet").to_pylist()

            self.assertEqual(conversations[0]["conversation_id"], "conv-1")
            self.assertEqual({m["node_id"] for m in messages}, {"1", "2", "3"})
            self.assertIn({"conversation_id": "conv-1", "parent_id": "1", "child_id": "3"}, edges)
            self.assertEqual([f["fragment_type"] for f in fragments if f["node_id"] == "1"], ["REQUEST", "THINK"])
            self.assertEqual([f["fragment_index"] for f in fragments if f["node_id"] == "1"], [0, 1])
            self.assertEqual(next(m for m in messages if m["node_id"] == "3")["model"], "deepseek-chat")
            self.assertEqual(next(m for m in messages if m["node_id"] == "2")["inserted_at"], "2025-01-01T10:00:02+08:00")
            self.assertEqual(next(f for f in fragments if f["content"] == "reasoning")["fragment_type"], "THINK")

            written_manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(written_manifest["source"]["sha256"], manifest["source"]["sha256"])
            for name in ["conversations.parquet", "messages.parquet", "edges.parquet", "fragments.parquet"]:
                self.assertIn(name, written_manifest["artifacts"])
                self.assertEqual(len(written_manifest["artifacts"][name]["sha256"]), 64)


if __name__ == "__main__":
    unittest.main()
