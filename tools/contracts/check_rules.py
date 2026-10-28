"""Проверка машинночитаемого контракта правил.

Использование:
    python tools/contracts/check_rules.py                      # проверить docs/reference/git
    python tools/contracts/check_rules.py --rules <yaml> --doc <md>
    python tools/contracts/check_rules.py --self-test          # негативный контроль

Коды результата: PASS, FAIL (нарушен инвариант), REVIEW (проверить нечем).
Отсутствие проверки никогда не превращается в PASS.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    print("REVIEW: нет pyyaml — формальная проверка невозможна")
    sys.exit(2)

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_RULES = ROOT / "docs/reference/git.rules.yaml"
DEFAULT_DOC = ROOT / "docs/reference/git.md"

OBLIGATIONS = {"MUST", "MUST_NOT", "MAY", "SHOULD"}
ID_RE = re.compile(r"^[A-Z]+-\d{3}$")
REF_RE = re.compile(r"\b([A-Z]+-\d{3})\b")
REQUIRED_FIELDS = ("id", "obligation", "statement", "verification")


def load_rules(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def check(rules_path: Path, doc_path: Path) -> tuple[str, list[str], list[str]]:
    """Возвращает (статус, найденные проблемы, пройденные проверки)."""
    problems: list[str] = []
    passed: list[str] = []

    try:
        data = load_rules(rules_path)
    except Exception as exc:
        return "REVIEW", [f"не удалось прочитать {rules_path}: {exc}"], []

    if not isinstance(data, dict) or "rules" not in data:
        return "REVIEW", [f"{rules_path}: нет ключа rules"], []

    rules = data.get("rules") or []
    if not rules:
        return "FAIL", ["набор правил пуст"], []

    if not data.get("revision"):
        problems.append("нет поля revision — версию контракта нельзя назвать")
    else:
        passed.append(f"revision = {data['revision']}")

    ids: list[str] = []
    for i, rule in enumerate(rules):
        where = f"правило #{i + 1}"
        if not isinstance(rule, dict):
            problems.append(f"{where}: не словарь")
            continue
        for field in REQUIRED_FIELDS:
            value = rule.get(field)
            if not isinstance(value, str) or not value.strip():
                problems.append(f"{where}: пустое или отсутствующее поле {field}")
        rid = rule.get("id")
        if isinstance(rid, str):
            where = f"{rid}"
            if not ID_RE.match(rid):
                problems.append(f"{where}: идентификатор не в формате ABC-123")
            ids.append(rid)
        oblig = rule.get("obligation")
        if isinstance(oblig, str) and oblig not in OBLIGATIONS:
            problems.append(f"{where}: обязательство '{oblig}' не из {sorted(OBLIGATIONS)}")
        if oblig in {"MUST", "MUST_NOT"}:
            ver = rule.get("verification") or ""
            if len(str(ver).strip()) < 10:
                problems.append(f"{where}: обязательное правило без внятной проверки")

    if len(ids) != len(set(ids)):
        dupes = sorted({x for x in ids if ids.count(x) > 1})
        problems.append(f"повторяющиеся идентификаторы: {dupes}")
    else:
        passed.append(f"{len(ids)} уникальных идентификаторов")

    try:
        doc = doc_path.read_text(encoding="utf-8")
    except OSError as exc:
        return "REVIEW", problems + [f"не удалось прочитать {doc_path}: {exc}"], passed

    referenced = set(REF_RE.findall(doc))
    missing_in_doc = sorted(set(ids) - referenced)
    unknown_in_doc = sorted(referenced - set(ids))
    if missing_in_doc:
        problems.append(f"правила есть в yaml, но не упомянуты в документе: {missing_in_doc}")
    if unknown_in_doc:
        problems.append(f"документ ссылается на несуществующие правила: {unknown_in_doc}")
    if not missing_in_doc and not unknown_in_doc:
        passed.append(f"документ и набор правил ссылаются друг на друга полностью ({len(ids)}/{len(ids)})")

    status = "FAIL" if problems else "PASS"
    return status, problems, passed


def self_test() -> int:
    """Негативный контроль: проверка обязана ловить заведомо сломанный набор."""
    import tempfile

    good = {
        "revision": "test",
        "rules": [
            {"id": "T-001", "obligation": "MUST", "statement": "делать",
             "verification": "посмотреть глазами и подтвердить"},
        ],
    }
    broken = {
        "revision": "test",
        "rules": [
            {"id": "T-001", "obligation": "MUST", "statement": "делать",
             "verification": "посмотреть глазами и подтвердить"},
            {"id": "T-001", "obligation": "MUST", "statement": "дубль",
             "verification": "посмотреть глазами и подтвердить"},
            {"id": "плохой id", "obligation": "НУЖНО", "statement": "",
             "verification": ""},
        ],
    }
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        doc = td / "doc.md"
        doc.write_text("T-001 упомянуто\n", encoding="utf-8")

        gp, bp = td / "good.yaml", td / "broken.yaml"
        gp.write_text(yaml.safe_dump(good, allow_unicode=True), encoding="utf-8")
        bp.write_text(yaml.safe_dump(broken, allow_unicode=True), encoding="utf-8")

        s_good, p_good, _ = check(gp, doc)
        s_bad, p_bad, _ = check(bp, doc)

    ok = s_good == "PASS" and s_bad == "FAIL" and len(p_bad) >= 3
    print(f"self-test: полный набор -> {s_good} (ожидали PASS)")
    print(f"self-test: сломанный набор -> {s_bad} (ожидали FAIL), проблем: {len(p_bad)}")
    for p in p_bad:
        print(f"  - {p}")
    print("self-test:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


def discover() -> list[tuple[Path, Path]]:
    """Все пары «набор правил — документ» в docs/reference."""
    pairs = []
    for rules_path in sorted((ROOT / "docs/reference").glob("*.rules.yaml")):
        doc_path = rules_path.with_name(rules_path.name.replace(".rules.yaml", ".md"))
        pairs.append((rules_path, doc_path))
    return pairs


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--rules", type=Path, default=None)
    ap.add_argument("--doc", type=Path, default=None)
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()

    if args.self_test:
        return self_test()

    if args.rules and args.doc:
        pairs = [(args.rules, args.doc)]
    elif args.rules or args.doc:
        print("FAIL: --rules и --doc задаются только вместе")
        return 1
    else:
        pairs = discover()

    if not pairs:
        print("REVIEW: не найдено ни одного набора правил в docs/reference")
        return 2

    worst = 0
    for rules_path, doc_path in pairs:
        status, problems, passed = check(rules_path, doc_path)
        print(f"\n=== {rules_path.name}")
        for p in passed:
            print(f"  ok   {p}")
        for p in problems:
            print(f"  --   {p}")
        print(f"  результат: {status}")
        worst = max(worst, {"PASS": 0, "REVIEW": 2, "FAIL": 1}[status])

    print(f"\nвсего наборов: {len(pairs)}; итог: {'PASS' if worst == 0 else 'FAIL/REVIEW'}")
    return 0 if worst == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
