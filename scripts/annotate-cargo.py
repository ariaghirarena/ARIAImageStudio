#!/usr/bin/env python3
"""Surface `cargo check` diagnostics as GitHub Actions annotations.

Job logs are not always reachable from automation, but check-run annotations are, so
every compiler error is mirrored into an annotation (max 45 per run).
"""
import os
import re
import sys

for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
SHORT = re.compile(r"^(?P<file>[^:]+?):(?P<line>\d+):(?P<col>\d+): error(?:\[(?P<code>[^\]]+)\])?: (?P<msg>.*)$")
LIMIT = 45

print("::notice::ARIA cargo annotator active", flush=True)

emitted = 0
fallback = []
pending = ""

for raw in sys.stdin:
    line = ANSI.sub("", raw.rstrip("\n").replace("\r", ""))
    print(line, flush=True)
    if not line.strip():
        continue

    stripped = line.strip()
    short = SHORT.match(stripped)
    if short and emitted < LIMIT:
        path = os.path.abspath(os.path.join(ROOT, short.group("file")))
        try:
            rel = os.path.relpath(path, ROOT).replace("\\", "/")
        except ValueError:
            rel = short.group("file").replace("\\", "/")
        code = f" [{short.group('code')}]" if short.group("code") else ""
        msg = short.group("msg").replace("%", "%25").replace("\n", " ")
        print(f"::error file={rel},line={short.group('line')},col={short.group('col')}::{code}{msg}", flush=True)
        emitted += 1
        continue

    if stripped.startswith("error") or stripped.startswith("warning: unused") or "panicked at" in stripped or stripped.startswith("help:"):
        fallback.append(stripped)
    elif stripped.startswith("-->"):
        fallback.append(stripped)

if emitted == 0:
    for index, line in enumerate(fallback[:LIMIT]):
        safe = line.replace("%", "%25").replace("\n", " ")[:900]
        print(f"::error file=.github/workflows/build-windows.yml,line=1::cargo#{index} {safe}", flush=True)
    if not fallback:
        print("::error file=.github/workflows/build-windows.yml,line=1::cargo produced no recognisable diagnostics", flush=True)
