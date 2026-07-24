import json
import tempfile
import unittest
from pathlib import Path

from normalize import normalize_export
from locate import locate_fragments


class CorpusLocatorTests(unittest.TestCase):
    def test_ranks_specific_multi_term_hits_and_returns_bounded_snippets(self):
        fixture = [{
            "id": "c1", "title": "synthetic", "inserted_at": "2025-01-01T00:00:00+08:00", "updated_at": "2025-01-01T00:10:00+08:00",
            "mapping": {
                "root": {"id":"root","parent":None,"children":["1"],"message":None},
                "1": {"id":"1","parent":"root","children":["2"],"message":{"model":"deepseek-reasoner","inserted_at":"2025-01-01T00:00:01+08:00","fragments":[{"type":"REQUEST","content":"Обсудим ТИД и показатель Херста."}]}},
                "2": {"id":"2","parent":"1","children":[],"message":{"model":"deepseek-reasoner","inserted_at":"2025-01-01T00:00:02+08:00","fragments":[{"type":"RESPONSE","content":"Теория Измерения Динамики использует Херст и мультифрактальность. " + "x"*500}]}}
            }
        }]
        with tempfile.TemporaryDirectory() as tmp:
            tmp=Path(tmp); src=tmp/'c.json'; out=tmp/'norm'
            src.write_text(json.dumps(fixture,ensure_ascii=False),encoding='utf-8')
            normalize_export(src,out)
            result=locate_fragments(out,["теория измерения динамики","тид","херст","мультифракт"],limit=10,snippet_chars=120)
            self.assertEqual(len(result),2)
            self.assertEqual(result[0]['node_id'],'2')
            self.assertGreater(result[0]['score'],result[1]['score'])
            self.assertIn('херст',result[0]['matched_terms'])
            self.assertEqual(result[0]['model'],'deepseek-reasoner')
            self.assertLessEqual(len(result[0]['snippet']),124)
            self.assertNotIn('content',result[0])

if __name__ == '__main__':
    unittest.main()
