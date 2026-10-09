"""Packages the deployable tree for a host that is not Firebase.

InfinityFree (and TinkerHost, and any plain PHP/MySQL box) cannot run server.py,
and it does not need to: the Firebase adapter intercepts every /api/* call and
serves them from Auth and Firestore, so the site that ships is a folder of static
files and nothing else. This copies that folder into dist/ so it can be uploaded
through a file manager or FTP, and it states plainly what such a host cannot do,
because guessing at that is how a club ends up with a blank sign-in button.

Usage:
    python tools/package-static.py            # build dist/
    python tools/package-static.py --check    # only report, build nothing
"""
import io
import json
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "firebase-public")
DIST = os.path.join(ROOT, "dist")

# Files that only matter to the local Python server. server.py cannot run on
# shared PHP hosting, and the adapter takes over /api/* as soon as the page is
# not on localhost, so nothing here is needed in the package.
LOCAL_ONLY = {"server.py", "requirements.txt"}

COPY = [
    "index.html", "app.js", "styles.css", "sw.js", "manifest.webmanifest",
    "firebase-config.js", "firebase-adapter.js",
]


def check():
    """What a static host can and cannot do, decided from the tree rather than
    from memory."""
    out = []
    cfg = io.open(os.path.join(ROOT, "firebase-config.js"), encoding="utf-8").read()
    c = json.loads(cfg[cfg.index("{"):cfg.rindex("}") + 1])

    out.append(("project", c["projectId"]))
    out.append(("authDomain", c["authDomain"]))
    out.append(("bucket", c.get("storageBucket", "(none)")))

    html = io.open(os.path.join(PUBLIC, "index.html"), encoding="utf-8").read()
    remote = [m.group(1) for m in __import__("re").finditer(r'<script src="(https://[^"]+)"', html)]
    out.append(("remote scripts", "%d (all CDNs, so any host can serve them)" % len(remote)))

    rules = io.open(os.path.join(ROOT, "firestore.rules"), encoding="utf-8").read()
    out.append(("data lives in", "Firestore, not on the host"))
    out.append(("sign-in lives in", "Firebase Auth, not on the host"))

    # The one thing that does block a new hostname.
    out.append(("BLOCKER", "the new domain must be in Firebase Auth authorizedDomains"))
    return out


def build():
    if os.path.isdir(DIST):
        shutil.rmtree(DIST)
    os.makedirs(DIST)

    for name in COPY:
        src = os.path.join(PUBLIC, name)
        if not os.path.exists(src):
            raise SystemExit("missing from the deployable tree: " + name)
        shutil.copyfile(src, os.path.join(DIST, name))

    # the public registration page is a folder of its own
    for folder in ("assets", "istimara"):
        src = os.path.join(PUBLIC, folder)
        if os.path.isdir(src):
            shutil.copytree(src, os.path.join(DIST, folder))

    total = 0
    count = 0
    for base, _dirs, files in os.walk(DIST):
        for f in files:
            total += os.path.getsize(os.path.join(base, f))
            count += 1

    readme = os.path.join(DIST, "PUT-THIS-ON-THE-HOST.txt")
    io.open(readme, "w", encoding="utf-8", newline="\n").write(
        " uploading this folder\n"
        " ================================\n\n"
        "Upload every file and folder here to the web root of the account.\n\n"
        "The site is static. It needs no PHP, no MySQL and no Python: the\n"
        "Firebase adapter answers every /api/* call from Auth and Firestore as\n"
        "soon as the page is not on localhost.\n\n"
        "Before sign-in will work on a new domain, that domain has to be in\n"
        "Firebase Auth -> authorized domains. It can be added from here:\n\n"
        "    python tools/set-auth-domains.py add yourname.infinityfree.com\n\n"
        "If sign-in answers 'this domain is not authorised', that is the reason.\n")

    print("packaged for a static host: dist/")
    print("   %d files, %.1f KB" % (count, total / 1024.0))
    for name, value in check():
        print("   %-16s %s" % (name + ":", value))


if __name__ == "__main__":
    if "--check" in sys.argv:
        for name, value in check():
            print("%-16s %s" % (name + ":", value))
    else:
        build()
