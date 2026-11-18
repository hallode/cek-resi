"""Runs language-neutral spec cases (specs/*/cases*.json) against a FastAPI app.

Matching rules: specs/README.md#format-casesjson.
"""

import json
from pathlib import Path
from typing import Any


def repo_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "specs").is_dir():
            return parent
    raise RuntimeError("specs/ not found above " + __file__)


def load(rel: str) -> Any:
    """Loads a JSON file given relative to the repo root."""
    return json.loads((repo_root() / rel).read_text(encoding="utf-8"))


def match_partial(expected: Any, actual: Any, path: str = "$") -> list[str]:
    """Partial deep match; returns one message per mismatch (empty = match)."""
    if isinstance(expected, list):
        if not isinstance(actual, list) or len(actual) != len(expected):
            return [f"{path}: want array of length {len(expected)}, got {actual!r}"]
        return [
            m
            for i, (e, a) in enumerate(zip(expected, actual, strict=True))
            for m in match_partial(e, a, f"{path}[{i}]")
        ]
    if isinstance(expected, dict):
        if list(expected) == ["$length"]:
            ok = isinstance(actual, list) and len(actual) == expected["$length"]
            return (
                []
                if ok
                else [f"{path}: want array of length {expected['$length']}, got {actual!r}"]
            )
        if not isinstance(actual, dict):
            return [f"{path}: want object, got {actual!r}"]
        return [
            m
            for k, v in expected.items()
            for m in (
                match_partial(v, actual[k], f"{path}.{k}")
                if k in actual
                else [f"{path}.{k}: missing"]
            )
        ]
    # bool is a subclass of int in Python: compare types explicitly (true != 1).
    if type(expected) is type(actual) and expected == actual:
        return []
    return [f"{path}: want {expected!r}, got {actual!r}"]


def run_cases(client: Any, spec_file: dict[str, Any], target: str) -> list[str]:
    """Runs every case whose target (case-level, else file-level) equals target.

    Returns one message per failing case (empty = all passed).
    """
    cases = [c for c in spec_file["cases"] if c.get("target", spec_file["target"]) == target]
    if not cases:
        raise AssertionError(f"{spec_file['spec']}: no cases for target {target}")

    failures: list[str] = []
    for c in cases:
        req, expect = c["request"], c["expect"]
        res = client.request(req["method"], req["path"], json=req.get("body"))
        errs = []
        if res.status_code != expect["status"]:
            errs.append(f"status = {res.status_code}, want {expect['status']}")
        if "body" in expect:
            errs += match_partial(expect["body"], res.json())
        if errs:
            failures.append(f"{spec_file['spec']} / {c['name']}: " + "; ".join(errs))
    return failures
