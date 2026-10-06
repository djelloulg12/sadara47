"""Creates the staff accounts in Firebase Auth and gives each one its role.

Both halves are required: without an account in Authentication, and without a
users/{uid} document carrying the role, the security rules refuse everything.

Needs Firebase Authentication enabled in the console once:
  console.firebase.google.com/project/<id>/authentication/providers  ->  Get started

Change the password before the site is used for real: the default below is the
one already used during local development.
"""
import io
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HOME = os.path.expanduser("~")
STORE = os.path.join(HOME, ".config", "configstore", "firebase-tools.json")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with io.open(os.path.join(ROOT, ".firebaserc"), encoding="utf-8") as fh:
    PROJECT = json.load(fh)["projects"]["default"]

PASSWORD = (os.environ.get("SADARA_SEED_PASSWORD")
            or (sys.argv[1] if len(sys.argv) > 1 else "")
            or "Sadara@2026")

ACCOUNTS = [
    ("admin@sadara.local", "مدير", "النادي", "admin"),
    ("president@sadara.local", "رئيس", "الجمعية", "president"),
    ("coach@sadara.local", "مدرب", "النادي", "coach"),
]

if not os.path.exists(STORE):
    raise SystemExit("Not signed in to Firebase. Run:  npm run login")

data = json.loads(io.open(STORE, encoding="utf-8").read())
refresh = (data.get("tokens") or {}).get("refresh_token")
if not refresh:
    raise SystemExit("No usable token in the Firebase store. Run:  npm run login")

# the public client credentials the CLI itself ships with
CLIENT_ID = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com"
CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi"


def post_form(url, fields):
    body = urllib.parse.urlencode(fields).encode()
    req = urllib.request.Request(
        url, data=body, headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


access = post_form("https://oauth2.googleapis.com/token", {
    "client_id": CLIENT_ID, "client_secret": CLIENT_SECRET,
    "refresh_token": refresh, "grant_type": "refresh_token",
})["access_token"]

HEADERS = {"Authorization": "Bearer " + access, "Content-Type": "application/json"}
V1 = "https://identitytoolkit.googleapis.com/v1/projects/" + PROJECT
DOCS = ("https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents"
        % PROJECT)


def call(url, method="GET", payload=None):
    body = json.dumps(payload).encode() if payload else None
    req = urllib.request.Request(url, data=body, method=method, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, None


def brief(res, n=170):
    if isinstance(res, dict) and "error" in res:
        return str(res["error"].get("message", ""))[:n]
    return ""


st, res = call(V1 + "/config")
if st != 200:
    print("Authentication is not switched on for " + PROJECT)
    print("Open: https://console.firebase.google.com/project/%s/authentication/providers" % PROJECT)
    print("Click Get started, enable Email/Password, then run this again.")
    raise SystemExit(1)

print("project:", PROJECT)
print("password:", "(from SADARA_SEED_PASSWORD or the argument)" if (os.environ.get("SADARA_SEED_PASSWORD") or len(sys.argv) > 1) else "Sadara@2026")
print()

NOW = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
failed = 0

for email, first, last, role in ACCOUNTS:
    # sign in first: an existing account comes back with its uid
    st, res = call(V1 + "/accounts:signInWithPassword", "POST",
                   {"email": email, "password": PASSWORD, "returnSecureToken": True})
    if st == 200:
        uid, made = res.get("localId"), False
    else:
        st, res = call(V1 + "/accounts", "POST", {
            "email": email, "password": PASSWORD, "emailVerified": True,
            "displayName": (first + " " + last).strip(), "disabled": False})
        if st == 200:
            uid, made = res.get("localId"), True
        else:
            print("  FAIL  %-28s %s" % (email, brief(res)))
            failed += 1
            continue

    fields = {
        "email": {"stringValue": email},
        "first_name": {"stringValue": first},
        "last_name": {"stringValue": last},
        "role": {"stringValue": role},
        "status": {"stringValue": "active"},
        "created_at": {"timestampValue": NOW},
    }
    url = DOCS + "/users?documentId=" + urllib.parse.quote(uid)
    ok = False
    for method in ("POST", "PATCH"):
        req = urllib.request.Request(url, data=json.dumps({"fields": fields}).encode(),
                                     method=method, headers=HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                ok = True
                break
        except urllib.error.HTTPError as e:
            if method == "POST" and e.code == 409:
                continue          # already there: fall through to the update
            print("  FAIL  %-28s role document: %s" % (email, e.read().decode()[:130]))
            break

    print("  %s  %-28s role=%-9s %s" % (
        "ok  " if ok else "FAIL", email, role, "created" if made else "already existed"))
    if not ok:
        failed += 1

print()
if failed:
    print("%d account(s) failed" % failed)
else:
    print("all staff accounts exist with their roles")
    print("Change the password before the site takes real use.")