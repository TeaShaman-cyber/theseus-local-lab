"""Unit tests for measure_output_tokens (no network, no state.db)."""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from measure_output_tokens import DETAIL_PATTERN, Generation, classify, percentile  # noqa: E402

BASE = datetime(2026, 10, 29, 12, 0, tzinfo=timezone.utc)


def _gen(seconds: float) -> Generation:
    return Generation(start=BASE + timedelta(seconds=seconds), output=100)


def _turn(seconds: float, text: str) -> tuple[float, str]:
    return ((BASE + timedelta(seconds=seconds)).timestamp(), text)


def test_percentile_nearest_rank() -> None:
    ordered = [10, 20, 30, 40, 50]
    assert percentile(ordered, 0.50) == 30
    assert percentile(ordered, 0.90) == 50
    assert percentile([], 0.5) == 0
    assert percentile([7], 0.9) == 7


def test_detail_pattern_matches_explicit_requests() -> None:
    for text in ("разверни", "Объясни по Фейнману", "дай подробнее", "по шагам"):
        assert DETAIL_PATTERN.search(text), text
    for text in ("мерж", "запусти тесты", "что дальше"):
        assert not DETAIL_PATTERN.search(text), text


def test_classify_labels_only_turns_after_a_detail_request() -> None:
    turns = [_turn(0, "разверни")]
    generations = [_gen(10), _gen(120), _gen(400)]
    classify(generations, turns, window=300.0)
    assert [g.label for g in generations] == ["expanded", "expanded", "default"]


def test_classify_ignores_plain_user_turn() -> None:
    turns = [_turn(0, "мерж")]
    generations = [_gen(10)]
    classify(generations, turns, window=300.0)
    assert generations[0].label == "default"


def test_classify_uses_latest_turn_only() -> None:
    turns = [_turn(0, "разверни"), _turn(100, "мерж")]
    generations = [_gen(150)]
    classify(generations, turns, window=300.0)
    assert generations[0].label == "default"


def test_classify_when_no_turn_precedes() -> None:
    generations = [_gen(-50)]
    classify(generations, [_turn(0, "разверни")], window=300.0)
    assert generations[0].label == "default"


if __name__ == "__main__":
    import pytest

    raise SystemExit(pytest.main([__file__, "-q"]))
