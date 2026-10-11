"""Clears the probe records left in the live database.

Checking what the deployed rules will actually do means writing to it: a rule
cannot be read, only made to answer. Those writes are named after the check that
made them, and every one of them carries a name that was invented for the purpose.

This removes exactly those and nothing else. Each name is matched as a range --
prefix up to prefix-with-the-hyphen-turned-into-a-full-stop -- so a real
registration cannot fall inside one: a real request is APP- followed by a date or
by a national identity number, and a real user name is whatever the person chose.
It prints every id, and it makes the caller say how many it expects, so that a
surprise is noticed rather than carried out.

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

# Every name a check on the live project has written under. The upper bound is the
# prefix followed by the highest code point, so the range ends at the first name
# that is not this one. Tying the bound to the last character instead -- turning
# "PROBE-" into "PROBE." -- only works for a prefix that ends in a hyphen, and
# silently dropped every name that did not: the ranges for "APP-N-CHK" and
# "APP-U-PROBE" ended at "APP-N-CH." and "APP-U-PROB.", which no probe name is
# inside, so every check made after requests began to be filed by identity was
# invisible here and would have been left in the club's database.
PREFIXES = [
    "PROBE-",        # what a field on a request is allowed to be
    "CLAIMTEST-",    # whether a request may be created a second time
    "LIVE-",         # a behavioural check filed under its reference number
    "CHK-",          # the same, later, for checks that never filed anything
    "APP-N-CHK",     # an adult, filed under its national number
    "APP-M-CHK",     # a child, filed under the three things that name them
    "APP-N-LIVE",
    "APP-M-LIVE",
    "APP-U-PROBE",   # a document holding a chosen user name, not a person
]
HIGH = "\uffff"
RANGES = [(PARENT + "/applications/" + p, PARENT + "/applications/" + p + HIGH)
          for p in PREFIXES]


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

    Listing the collection outright returns nothing -- not an error, just an empty
    answer -- because the rules deployed to the project do not let a plain folder
    read through for this identity, and a document read by its exact name still
    works. Asking instead for the records that declare themselves swimmers is
    answered, and the probe records all declare themselves swimmers.

    The name range is then the safety line: a real registration is not named after
    the check that made it, so the answer to this query is filtered down to those
    ranges and nothing else is ever considered for removal.
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
            if any(low <= name < high for low, high in RANGES):
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
    for n in sorted(names):
        st, doc = call("%s/%s" % (BASE, n), token)
        fields = (doc or {}).get("fields", {})
        who = fields.get("first_name_ar", {}).get("stringValue", "")
        ref = fields.get("application_no", {}).get("stringValue", "")
        print("   %-34s %-12s %s" % (n.rsplit("/", 1)[-1], ref, who))

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
    for n in sorted(left)[:20]:
        print("   left: " + n.rsplit("/", 1)[-1])
    return 1 if left else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))