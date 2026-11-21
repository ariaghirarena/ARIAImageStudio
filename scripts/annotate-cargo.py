#!/usr/bin/env python3
"""Turn `cargo check --message-format=short` output into GitHub Actions annotations.

Usage: cargo check --message-format=short 2>&1 | python scripts/annotate-cargo.py
Every line is echoed, and error lines are emitted as ::error commands so they can be
read back through the check-run annotations API even when job logs are unavailable.
"""
import os
import re
import sys

print("::notice::ARIA cargo annotator active", flush=True)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
pattern = re.compile(r"^(?P<file>[^:]+):(?P<line>\d+):(?P<col>\d+): error(?:\[(?P<code>[^\]]+)\])?: (?P<msg>.*)$")
count = 0
LIMIT = 45

for raw in sys.stdin:
    line = raw.rstrip("\n").replace("\r", "")
    print(line, flush=True)
    match = pattern.match(line.strip())
    if not match or count >= LIMIT:
        continue
    path = os.path.abspath(os.path.join(ROOT, match.group("file")))
    try:
        rel = os.path.relpath(path, ROOT).replace("\\", "/")
    except ValueError:
        rel = match.group("file")
    code = f" [{match.group('code')}]" if match.group("code") else ""
    msg = match.group("msg").replace("%", "%25").replace("\n", " ")
    print(f"::error file={rel},line={match.group('line')},col={match.group('col')}::{code.strip()} {msg}".replace("  ", " "), flush=True)
    count += 1
