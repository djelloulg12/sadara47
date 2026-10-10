"""Prune provably-dead legacy code from the baseline app.js before the Sadara
layers are appended.

Every removal is done with a parameter-list-aware brace matcher, and the caller
verifies the result with node --check plus eight behavioural suites.
"""
import io
import re


def extract(src, name):
    """Return the text of a top-level `function name(...) { ... }` block."""
    m = re.search(r"(?:async\s+)?function\s+" + re.escape(name) + r"\s*\(", src)
    if not m:
        return None
    i = m.start()
    p = src.index("(", i)
    depth = 0
    q = p
    while True:
        if src[q] == "(":
            depth += 1
        elif src[q] == ")":
            depth -= 1
            if depth == 0:
                break
        q += 1
    j = src.index("{", q)
    depth = 0
    k = j
    n = len(src)
    while k < n:
        c = src[k]
        if c in "'\"`":
            quote = c
            k += 1
            while k < n:
                if src[k] == "\\":
                    k += 2
                    continue
                if src[k] == quote:
                    break
                k += 1
            k += 1
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return src[i:k + 1]
        k += 1
    return None


def drop(src, name):
    """Remove a top-level function declaration; returns (src, chars_removed)."""
    block = extract(src, name)
    if block is None:
        raise SystemExit("cannot locate " + name)
    if block.count("{") != block.count("}"):
        raise SystemExit("unbalanced braces in " + name)
    return src.replace(block, "", 1), len(block)


BASE_PAGES = [
    "overview", "subscriptionsPage", "usersPage", "schedulePage",
    "attendancePage", "noticesPage", "cardPage", "settingsPage",
]

# base declarations every later layer rebinds, so the bindings must survive
BASE_SHELLS = """// minimal base declarations; the Sadara Core layers below rebind both names
function pageView(p){ return pageApplications(); }
function pageTitle(p){ return '\\u0646\\u0638\\u0631\\u0629 \\u0639\\u0627\\u0645\\u0629'; }
"""

# the two retired form generators both fold into the official overlay sheet
FORM_ROUTES = [
    ("if(a==='print-registration-form'){printRegistrationForm();return}",
     "if(a==='print-registration-form'){printOfficialForms([registrationRecordFromForm()]);return}"),
    ("if(a==='print-registration'){printRegistrationFormA4();return}",
     "if(a==='print-registration'){printOfficialForms([registrationRecordFromForm()]);return}"),
]


def prune(base):
    removed = 0

    # the old pageView dispatched to the legacy builders; only its name matters now
    base, n = drop(base, "pageView")
    removed += n
    base, n = drop(base, "pageTitle")
    removed += n
    base = base.replace(BASE_SHELLS.rstrip(), "", 1)

    for name in BASE_PAGES:
        base, n = drop(base, name)
        removed += n

    # 7.4 KB duplicate form writer plus its superseding sibling
    for name in ("printRegistrationForm", "printRegistrationFormA4"):
        base, n = drop(base, name)
        removed += n

    for old, new in FORM_ROUTES:
        if old not in base:
            raise SystemExit("form route not found: " + old)
        base = base.replace(old, new, 1)

    # the base bindings must exist before any layer captures them
    anchor = "function pageApplications("
    if anchor not in base:
        raise SystemExit("pageApplications anchor missing")
    base = base.replace(anchor, BASE_SHELLS + anchor, 1)

    if base.count("{") != base.count("}"):
        raise SystemExit("prune unbalanced the file")
    for leftover in ("printRegistrationFormA4", "+117", "[72,88,67,93,81,96,92]"):
        if leftover in base:
            raise SystemExit("leftover after prune: " + leftover)
    return base, removed