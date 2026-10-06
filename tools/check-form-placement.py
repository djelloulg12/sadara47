"""Checks the printed form's value boxes against the scan itself.

Every field on assets/form-registration-01.jpg is printed as "label:" followed by
a blank space, and the club reads right to left, so a value belongs between the
printed label on its left and the colon on its right. This reads FORM_SPOTS out
of the built app.js and measures the scan to confirm three things:

  * the box starts tight against its colon, so the value reads "after the :"
  * the box stays inside the line the colon introduces
  * the box lands on blank paper -- if the scan already has ink where the value
    would go, printing would overwrite the club's own wording

Usage:  python tools/check-form-placement.py
"""
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "assets", "form-registration-01.jpg")
APP = os.path.join(ROOT, "app.js")

PAGE_W, PAGE_H = 210.0, 297.0
GAP = 1.6      # mm kept clear between the colon and the first character
CLEAR = 0.4    # mm kept clear between the value and the rule it sits on
TEXT_H = 4.95  # mm the value text occupies: 12.5pt at line-height 1.05, plus padding
INK = 150      # grey level below which a pixel counts as printed


def read_spots():
    src = io.open(APP, encoding="utf-8").read()
    block = re.search(r"const FORM_SPOTS = \[(.*?)\n\];", src, re.S)
    if not block:
        raise SystemExit("FORM_SPOTS not found in app.js -- run: npm run build")
    spots = []
    for m in re.finditer(r"\{\s*id:\s*'([^']+)',\s*y:\s*([\d.]+),\s*x0:\s*([\d.]+),\s*colon:\s*([\d.]+)\s*\}",
                         block.group(1)):
        spots.append({"id": m.group(1), "y": float(m.group(2)),
                      "x0": float(m.group(3)), "colon": float(m.group(4))})
    if not spots:
        raise SystemExit("could not read any spot out of FORM_SPOTS")
    return spots


def main():
    try:
        from PIL import Image
    except ImportError:
        print("Pillow is not installed, so the scan cannot be measured.")
        print("Install it with:  python -m pip install pillow")
        return 0

    spots = read_spots()
    im = Image.open(IMG).convert("L")
    W, H = im.size
    px = im.load()
    ppm = W / PAGE_W

    def ink(x0, x1, y0, y1):
        n = 0
        for y in range(max(0, int(y0 * ppm)), min(H, int(y1 * ppm))):
            for x in range(max(0, int(x0 * ppm)), min(W, int(x1 * ppm))):
                if px[x, y] < INK:
                    n += 1
        return n

    print("scan: %dx%d px, %.3f px/mm" % (W, H, ppm))
    print("boxes: %d\n" % len(spots))
    print("%-20s %-8s %-8s %-8s %-8s %-7s %s" % (
        "field", "rule y", "from", "to", "ink %", "width", "verdict"))
    print("-" * 78)

    problems = []
    for s in spots:
        left, right = s["x0"], s["colon"] - GAP
        width = right - left
        top, bottom = s["y"] - TEXT_H, s["y"] - CLEAR

        n = ink(left, right, top, bottom)
        area = max(1, (int(right * ppm) - int(left * ppm)) * (int(bottom * ppm) - int(top * ppm)))
        pct = 100.0 * n / area

        why = []
        if width <= 0:
            why.append("no room before the colon")
        if left < 0 or right > PAGE_W:
            why.append("runs off the side of the page")
        if s["y"] - TEXT_H < 0 or s["y"] > PAGE_H:
            why.append("off the page vertically")
        if pct >= 3:
            why.append("lands on printed text (%.1f%%)" % pct)

        verdict = "ok" if not why else "; ".join(why)
        if why:
            problems.append(s["id"] + ": " + verdict)
        print("%-20s %-8.2f %-8.1f %-8.1f %-8.2f %-7.1f %s" % (
            s["id"], s["y"], left, right, pct, width, verdict))

    print()
    if problems:
        print("PROBLEMS:")
        for p in problems:
            print("  - " + p)
        return 1
    print("every value lands after its colon, on its own line, on blank paper")
    return 0


if __name__ == "__main__":
    sys.exit(main())
