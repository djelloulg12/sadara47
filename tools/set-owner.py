"""Names the club owner, who holds every permission on the published platform.

The owner is recorded by address in Firestore, config/owners. Two reasons it is
not a role on the user's own document:

  * a users/{uid} document needs a uid, and a uid only exists once an account has
    been created -- so the owner would have to wait for an account before being
    able to create one
  * the right then follows the person, so a new device or a rebuilt database
    needs no second document

Usage:
    python tools/set-owner.py                       # show the current list
    python tools/set-owner.py add me@example.com
    python tools/set-owner.py remove me@example.com
"""
import io
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOME = os.path.expanduser("~")
STORE = os.path.join(HOME, ".config", "configstore", "firebase-tools.json")

with io.open(os.path.join(ROOT, ".firebaserc"), encoding="utf-8") as fh:
    PROJECT = json.load(fh)["projects"]["default"]

COLLECTION = "config"
DOCUMENT = "owners"
FIELD = "emails"


def access_token():
    if not os.path.exists(STORE):
        raise SystemExit("Not signed in to Firebase. Run:  npm run login")
    data = json.loads(io.open(STORE, encoding="utf-8").read())
    refresh = (data.get("tokens") or {}).get("refresh_token")
    if not refresh:
        raise SystemExit("No usable token in the Firebase store. Run:  npm run login")
    # the public client credentials the CLI itself ships with
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
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, None



def account_state(token, address):
    """None if unknown, else a dict of what the account actually has.

    The project-wide accounts list reports zero accounts while accounts
    demonstrably exist, so it is looked up by address instead -- that endpoint
    also works when the list one does not.
    """
    url = ("https://identitytoolkit.googleapis.com/v1/projects/%s/accounts:lookup"
           % PROJECT)
    st, res = call(url, token, "POST", {"email": [address]})
    if st != 200:
        return None
    users = (res or {}).get("users") or []
    if not users:
        return None
    u = users[0]
    return {"uid": u.get("localId"), "verified": bool(u.get("emailVerified")),
            "disabled": bool(u.get("disabled"))}


def report(token, addresses):
    """Say what the list says, and what the accounts say. They can disagree, and
    when they do the platform quietly shows the person as a member."""
    print("owners of %s:" % PROJECT)
    for a in addresses:
        print("   " + a)
    if not addresses:
        print("   (none -- nobody holds owner rights)")
        print()
        return

    print()
    for a in addresses:
        info = account_state(token, a)
        if info is None:
            print("   %s -- NO ACCOUNT. Create it: python tools\\seed-accounts.py" % a)
            continue
        if info["disabled"]:
            print("   %s -- the account is DISABLED, so it cannot sign in." % a)
            continue
        if not info["verified"]:
            # This is the one that costs days: the address is on the list, the
            # account works, and the platform still refuses every owner right.
            print("   %s -- NOT VERIFIED." % a)
            print("      The rules require a verified address, so until it is the")
            print("      platform shows this account as an ordinary member. Verify it:")
            print("         python tools\\verify-owner-account.py")
            continue
        print("   %s -- verified, every right granted." % a)

def main():
    token = access_token()
    base = ("https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents"
            % PROJECT)

    st, res = call("%s/%s/%s" % (base, COLLECTION, DOCUMENT), token)
    current = []
    if st == 200:
        for v in (res.get("fields", {}).get(FIELD, {}).get("arrayValue", {})
                  .get("values", [])):
            current.append(v.get("stringValue", ""))

    action = sys.argv[1] if len(sys.argv) > 1 else "show"
    if action == "show":
        report(token, current)
        return 0

    if action not in ("add", "remove"):
        raise SystemExit("Use: show | add <address> | remove <address>")
    if len(sys.argv) < 3:
        raise SystemExit("Give the address: python tools/set-owner.py %s you@example.com" % action)
    address = sys.argv[2].strip().lower()
    if "@" not in address or "." not in address.split("@")[-1]:
        raise SystemExit("That does not look like an email address: " + address)

    if action == "add":
        if address in current:
            print("%s is already an owner." % address)
            return 0
        current.append(address)
    else:
        if address not in current:
            print("%s is not an owner." % address)
            return 0
        current.remove(address)

    if not current:
        # leaving nobody with owner rights would lock the club out of its own
        # platform, so the document is emptied but kept.
        print("Refusing to remove the last owner.")
        return 1

    fields = {FIELD: {"arrayValue": {"values": [{"stringValue": e} for e in current]}}}

    # Rewriting a list that already exists is PATCH against the document's own
    # path, with the update mask as a query parameter. Passing documentId as a
    # query parameter to PATCH is rejected outright, and naming the document in the
    # path without a mask replaces the whole document instead. This is the only
    # combination the API accepts, and it is what makes `add` work on an existing
    # list -- without it the tool could only ever create the list once.
    if st == 200:
        url = "%s/%s/%s?updateMask.fieldPaths=%s" % (base, COLLECTION, DOCUMENT, FIELD)
        st, _ = call(url, token, "PATCH", {"fields": fields})
    else:
        url = "%s/%s?documentId=%s" % (base, COLLECTION, DOCUMENT)
        st, _ = call(url, token, "POST", {"fields": fields})
    if st not in (200, 201):
        print("could not write the owner list (status %s)" % st)
        print("the request went to: " + url)
        return 1

    print("%s %s" % ("owner added:" if action == "add" else "owner removed:", address))
    print()
    report(token, current)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
