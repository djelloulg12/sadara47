"""Removes one registration request from the live database.

A request can arrive in error -- sent twice, or by somebody testing the form --
and the manager needs it gone without waiting for a developer. This deletes one
named request and nothing else.

It is deliberately narrow. The number is matched exactly against a document id;
there is no list, no filter, no "delete by name". Printing what it is about to
remove comes first, because the document id on the screen is not always the
document id in the database -- and because a deletion that prints nothing is a
deletion nobody can account for afterwards.

Signed in through the same route the other tools here use: the Firebase CLI's own
session, which is the club owner's account and already has rights over the
project. No password is read, asked for, or stored anywhere.

    python tools/remove-application.py APP-20261011-1E79
    python tools/remove-application.py APP-20261011-1E79 --yes
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

COLLECTION = "applications"
# A document id, not a search term. Kept tight on purpose: anything looser would
# turn one mistyped number into a deletion nobody asked for.
DOCUMENT_ID = re.compile(r"^APP-[0-9]{8}-[0-9A-F]{4}$")


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


def call(url, token, method="GET"):
    req = urllib.request.Request(url, method=method, headers={
        "Authorization": "Bearer " + token, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read().decode()
            return r.status, (json.loads(body) if body else None)
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, None


def doc_url(doc_id):
    return ("https://firestore.googleapis.com/v1/projects/%s/databases/(default)"
            "/documents/%s/%s" % (PROJECT, COLLECTION, doc_id))


def describe(doc):
    f = (doc or {}).get("fields") or {}
    out = {}
    for key in ("first_name_ar", "last_name_ar", "category", "phone",
                "status", "application_no"):
        if key in f:
            out[key] = f[key].get("stringValue", f[key].get("timestampValue", ""))
    return out


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    yes = "--yes" in argv
    if len(args) != 1:
        raise SystemExit(__doc__.strip())

    number = args[0].strip().upper()
    if not DOCUMENT_ID.match(number):
        raise SystemExit(
            "That is not a registration number. Expected APP-YYYYMMDD-XXXX, "
            "for example APP-20261011-1E79.\nNothing was removed.")

    token = access_token()

    status, doc = call(doc_url(number), token)
    if status == 404:
        print("no such request: " + number)
        return 1
    if status != 200:
        print("could not read it: HTTP %s -- nothing was removed" % status)
        return 1

    info = describe(doc)
    print("request %s" % number)
    for key in ("first_name_ar", "last_name_ar", "category", "phone", "status"):
        if info.get(key):
            print("   %-15s %s" % (key, info[key]))

    if not yes:
        answer = input("remove this request? [y/N] ").strip().lower()
        if answer not in ("y", "yes"):
            print("left as it was.")
            return 0

    status, body = call(doc_url(number), token, "DELETE")
    if status in (200, 204):
        print("removed %s" % number)
        return 0
    detail = (body or {}).get("error", {}).get("message", "")
    print("could not remove it: HTTP %s %s" % (status, detail))
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
