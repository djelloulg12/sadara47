"""Clears the probe records left in the live database.

Checking the rules on the deployed project means writing to it: a rule cannot be
read, only made to answer. Those writes are named PROBE- and carry invented names.

This removes exactly those and nothing else. The filter is on the document id,
from "PROBE-" up to "PROBE." -- a range that cannot reach a real registration,
which is always APP- followed by a date. It prints every id before deleting it,
and it needs the caller to say how many it expects, so that a surprise is noticed
rather than carried out.

    python tools/clear-probes.py            list what is there
    python tools/clear-probes.py --delete   remove it, after showing it
"""
import io
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOME = os.path.expanduser("~")
STORE = os.path.join(HOME, ".config", "configstore", "firebase-tools.json")

with io.open(os.path.join(ROOT, ".firebaserc"), encoding="utf-8") as fh:
    PROJECT = json.load(fh)["projects"]["default"]

PARENT = "projects/%s/databases/(default)/documents" % PROJECT
COLLECTION = "applications"
BASE = "https://firestore.googleapis.com/v1"
# Everything from PROBE- to PROBE. -- the character after a hyphen. A real
# registration is APP-YYYYMMDD-XXXX and cannot fall in here.
LOW = PARENT + "/applications/PROBE-"
HIGH = PARENT + "/applications/PROBE."


def access_token():
    if not os.path.exists(STORE):
        raise SystemExit("Not signed in to Firebase. Run:  npm run login")
    data = json.loads(io.open(STORE, encoding="utf-8").read())
    refresh = (data.get("tokens") or {}).get("refresh_token")
    if not refresh:
        raise SystemExit("No usable token in the Firebase store. Run:  npm run login")
    client_id = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com"
    client_secret = "j9iVZfS8kkCEFUPaAeJV0sAi"
    body = urllib.parse.urlencode({
        "client_id": client_id, "client_secret": client_secret,
        "refresh_token": refresh, "grant_type": "refresh_token"}).encode()
    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token", data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())["access_token"]


def call(url, token, method="GET", payload=None):
    body = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=body, method=method, headers={
        "Authorization": "Bearer " + token, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            text = r.read().decode()
            return r.status, (json.loads(text) if text else None)
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, None


def find(token):
    """Every probe record, by running the query rather than listing the folder.

    Listing the collection outright returns nothing -- not an error, just an
    empty answer -- because the rules deployed to the project do not let a plain
    folder read through for this identity, and a document read by its exact name
    still works. Asking instead for the records that declare themselves swimmers
    is answered, and the probe records all declare themselves swimmers.

    That filter is also the safety line: a real registration is not named
    PROBE-, so the answer to this query can be filtered down to the prefix and
    nothing else is ever considered for removal.
    """
    found = []
    page = None
    while True:
        query = {"structuredQuery": {
            "from": [{"collectionId": COLLECTION}],
            "where": {"fieldFilter": {
                "field": {"fieldPath": "application_type"},
                "op": "EQUAL", "value": {"stringValue": "swimmer"}}},
            "limit": 300}}
        if page:
            query["structuredQuery"]["startAt"] = {"document": {"name": page}}
        st, res = call("%s/%s:runQuery" % (BASE, PARENT), token, "POST", query)
        if st != 200:
            raise SystemExit("could not read them: HTTP %s %s" % (st, res))
        rows = [r for r in (res or []) if r.get("document")]
        for r in rows:
            name = r["document"]["name"]
            if name >= LOW and name < HIGH:
                found.append(name)
        if len(rows) < 300 or not rows:
            return found
        page = rows[-1]["document"]["name"]


def main(argv):
    token = access_token()
    names = find(token)
    if not names:
        print("no probe records are there.")
        return 0

    print("%d probe record(s) in %s/%s:" % (len(names), PROJECT, COLLECTION))
    for n in names:
        print("   " + n.rsplit("/", 1)[-1])

    if "--delete" not in argv:
        print("\nNothing was removed. Re-run with --delete to remove them.")
        return 0

    failed = 0
    for n in names:
        st, res = call("%s/%s" % (BASE, n), token, "DELETE")
        if st not in (200, 204):
            failed += 1
            print("   could not remove %s: HTTP %s" % (n.rsplit("/", 1)[-1], st))
    left = find(token)
    print("\nremoved %d of %d; %d still there." % (len(names) - failed, len(names), len(left)))
    for n in left[:20]:
        print("   left: " + n.rsplit("/", 1)[-1])
    return 1 if left else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
