"""Breaks the stylesheet on purpose, to prove the new guard is not decorative.

A test that has never failed is not known to work. This puts back exactly the
mistake that shipped once -- a "+" in front of a comment, which turns
`'...' + '...'` into `'...' + + '...'` and every rule after it into NaN -- checks
the suite says so, and puts the file back.

Run from the repository root:

    python tools/prove-print-css-guard.py
"""
import io
import os
import subprocess
import sys

ROOT = os.environ.get("SADARA_ROOT") or os.getcwd()
NODE = r"C:\Program Files\nodejs\node.exe"
TARGET = os.path.join(ROOT, "firebase-public", "istimara", "print.js")
SUITE = os.path.join(ROOT, "tools", "tests", "istimara.test.js")

BROKEN = "+   /* broken on purpose */ +   '.f-hint{display:none}}'"
WHOLE = "+   '.f-hint{display:none}}'"

original = io.open(TARGET, encoding="utf-8").read()
assert WHOLE in original, "the rule to break is not where it was"

print("breaking the stylesheet the way it broke once...")
io.open(TARGET, "w", encoding="utf-8", newline="\n").write(original.replace(WHOLE, BROKEN, 1))
try:
    run = subprocess.run([NODE, SUITE], cwd=ROOT, capture_output=True)
    out = (run.stdout or b"").decode("utf-8", "replace") + (run.stderr or b"").decode("utf-8", "replace")
finally:
    io.open(TARGET, "w", encoding="utf-8", newline="\n").write(original)

caught = "assembled wrong" in out
for line in out.splitlines():
    if "assembled wrong" in line or "instruction bar" in line:
        print("   " + line.strip())

print()
print("the guard fired: %s" % ("yes" if caught else "NO -- it would have shipped again"))
sys.exit(0 if caught else 1)
