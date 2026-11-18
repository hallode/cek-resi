#!/usr/bin/env python3
"""Apply model/effort from .claude/agents.toml to the frontmatter of .claude/agents/<role>.md.

Claude Code reads model and effort from each agent file's frontmatter, so this keeps the
single config and the agent files in sync. `--check` changes nothing and exits 1 on drift.
"""

import re
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / ".claude" / "agents.toml"
AGENTS = ROOT / ".claude" / "agents"
MODELS = {"opus", "sonnet", "haiku", "fable", "inherit"}
EFFORTS = {"low", "medium", "high", "xhigh", "max"}
FRONTMATTER = re.compile(r"\A---\n(.*?)\n---\n", re.S)


def validate(role: str, key: str, value: object) -> str:
    ok = isinstance(value, str) and (
        value in EFFORTS if key == "effort" else value in MODELS or value.startswith("claude-")
    )
    if not ok:
        sys.exit(f"{CONFIG.name}: [{role}] {key} = {value!r} is not valid")
    return value


def main() -> int:
    check = "--check" in sys.argv[1:]
    config = tomllib.loads(CONFIG.read_text())
    defaults = config.pop("defaults", {})
    stale = []

    for role, own in config.items():
        path = AGENTS / f"{role}.md"
        if not path.exists():
            sys.exit(f"{CONFIG.name}: [{role}] has no agent file {path.relative_to(ROOT)}")
        text = path.read_text()
        match = FRONTMATTER.match(text)
        if not match:
            sys.exit(f"{path.relative_to(ROOT)}: missing frontmatter")

        front = match.group(1)
        for key in ("model", "effort"):
            if key not in own and key not in defaults:
                continue
            line = f"{key}: {validate(role, key, own.get(key, defaults.get(key)))}"
            pattern = re.compile(rf"^{key}:.*$", re.M)
            front = pattern.sub(line, front) if pattern.search(front) else f"{front}\n{line}"

        updated = f"---\n{front}\n---\n{text[match.end():]}"
        if updated != text:
            stale.append(path.relative_to(ROOT))
            if not check:
                path.write_text(updated)

    for path in stale:
        print(f"{'out of date' if check else 'updated'}: {path}")
    if check and stale:
        print("run: mise run agents:sync")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
