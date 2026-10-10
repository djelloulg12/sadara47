"""Checks the deployment manifests against what the platform actually is.

Two things had drifted apart, and both would only have shown up after deploying:

  * render.yaml declared a Docker web service running server.py. server.py has its
    own SQLite login and knows nothing about Firebase, so that service would have
    been a second, parallel platform: different accounts, an empty database, none
    of the rules, and a SQLite file wiped on every restart.

  * the Dockerfile does `COPY . .` with nothing to exclude it, so it would have
    copied the local SQLite databases -- rows and all -- into a publishable image.

The manifest is checked rather than trusted: a blueprint that names a runtime the
platform does not use, or that expects an environment variable nothing reads, is
reported here instead of at deploy time.
"""
import io
import json
import os
import re

ROOT = os.environ["SADARA_ROOT"]
errors = []

ry = io.open(os.path.join(ROOT, "render.yaml"), encoding="utf-8").read()
di_path = os.path.join(ROOT, ".dockerignore")

# ---- the blueprint must serve the static tree, not run a second backend ----
if "staticSites:" not in ry:
    errors.append("render.yaml does not declare a static site; "
                  "a web service here would run server.py, which has its own "
                  "SQLite login and none of the club's data")
if "services:" in ry:
    errors.append("render.yaml still declares a service; see the note in the file")

m = re.search(r"publishPath:\s*(\S+)", ry)
if not m:
    errors.append("render.yaml has no publishPath")
elif m.group(1).strip("./ ") != "firebase-public":
    errors.append("render.yaml publishes %s, but firebase-public is the tree Firebase "
                  "serves and every test loads" % m.group(1))

pub = m.group(1).strip("./ ") if m else "firebase-public"
for needed in ("index.html", "app.js", "firebase-adapter.js", "firebase-config.js", "styles.css"):
    if not os.path.exists(os.path.join(ROOT, pub, needed)):
        errors.append("render.yaml publishes %s but %s is not in it" % (pub, needed))

# the public registration page is a folder of its own and must travel with it
if m and not os.path.isdir(os.path.join(ROOT, pub, "istimara")):
    errors.append("firebase-public/istimara is missing; the public sign-up page would 404")

# ---- no environment variables the platform does not read ------------------
declared = re.findall(r"key:\s*(\w+)", ry)
# The only variables the platform reads are these; anything else would sit in the
# dashboard looking meaningful and changing nothing.
KNOWN = {"SADARA_DB_PATH", "SADARA_ADMIN_EMAIL", "SADARA_ADMIN_PASSWORD",
         "SADARA_PRESIDENT_EMAIL", "SADARA_PRESIDENT_PASSWORD",
         "SADARA_COACH_EMAIL", "SADARA_COACH_PASSWORD", "SADARA_PORT", "PORT"}
for k in declared:
    if k not in KNOWN:
        errors.append("render.yaml declares %s, which nothing in the platform reads" % k)

# ---- the image must not carry the databases ------------------------------
if not os.path.exists(di_path):
    errors.append(".dockerignore is missing, so `COPY . .` would put the local "
                  "SQLite databases into a publishable image")
else:
    di = io.open(di_path, encoding="utf-8").read()
    for pattern, why in ((r"(?m)^\*\.db\b", "the local SQLite databases"),
                         (r"(?m)^uploads/", "uploaded documents"),
                         (r"(?m)^\.env\b", "local secrets")):
        if not re.search(pattern, di):
            errors.append(".dockerignore does not exclude %s" % why)

df = io.open(os.path.join(ROOT, "Dockerfile"), encoding="utf-8").read()
if "COPY . ." in df and not os.path.exists(di_path):
    errors.append("Dockerfile copies the whole tree with nothing to exclude it")

# ---- the database must be Firestore, and that is stated somewhere ---------
adapter = io.open(os.path.join(ROOT, "firebase-adapter.js"), encoding="utf-8").read()
if "firebase.firestore()" not in adapter:
    errors.append("the adapter no longer reads Firestore; where the data lives has changed")

if errors:
    print("PROBLEMS:\n  - " + "\n  - ".join(errors))
    raise SystemExit(1)
print("Deployment manifests agree with the platform: static site from firebase-public, "
      "data in Firestore, no databases in the build context.")
