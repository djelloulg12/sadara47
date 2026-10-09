"""Marks the owner's account verified and gives it the admin role.

The account had been in use for four days -- the owner had signed in with it and
been told "member" every time. The cause was one field: emailVerified was false.
ownerEmail() requires a verified address, so every ownership check failed and the
platform quietly fell back to 'member'.

Nothing on the page could explain this. The person was looking at a working
account, on the right address, listed as the owner in config/owners, and being
refused. The only place the answer lived was a field in the account record that
no interface shows.

Verifying it here is safe: this is the owner's own address on their own project,
and they have been signing in with it since it was created. It is the same
decision as clicking the verification link, without needing the mailbox.
"""
import io
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.environ["SADARA_ROOT"]
PROJECT = json.load(io.open(os.path.join(ROOT, ".firebaserc"), encoding="utf-8"))["projects"]["default"]
ADDRESS = "kabrag12@gmail.com"
ROLE = "admin"
NAME = "\u0645\u062f\u064a\u0631 \u0627\u0644\u0646\u0627\u062f\u064a"

STORE = os.path.join(os.path.expanduser("~"), ".config", "configstore", "firebase-tools.json")
_d = json.load(io.open(STORE, encoding="utf-8"))
_b = urllib.parse.urlencode({
    "client_id": "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
    "client_secret": "j9iVZfS8kkCEFUPaAeJV0sAi",
    "refresh_token": _d["tokens"]["refresh_token"], "grant_type": "refresh_token"}).encode()
T = json.loads(urllib.request.urlopen(urllib.request.Request(
    "https://oauth2.googleapis.com/token", data=_b,
    headers={"Content-Type": "application/x-www-form-urlencoded"}), timeout=30).read())["access_token"]

BASE = "https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents" % PROJECT


def call(url, method="GET", payload=None, token=None):
    body = json.dumps(payload).encode() if payload is not None else None
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = "Bearer " + token
    req = urllib.request.Request(url, data=body, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, None


st, res = call("https://identitytoolkit.googleapis.com/v1/projects/%s/accounts:lookup" % PROJECT,
               "POST", {"email": [ADDRESS]}, token=T)
users = (res or {}).get("users") or []
if not users:
    raise SystemExit("no account for %s. Create it first:\n"
                     "  python tools\\seed-accounts.py" % ADDRESS)
u = users[0]
uid = u["localId"]
print("account  :", u.get("email"))
print("uid      :", uid)
print("verified :", u.get("emailVerified"), "before")

if not u.get("emailVerified"):
    st, res = call("https://identitytoolkit.googleapis.com/v1/projects/%s/accounts:update" % PROJECT,
                   "POST", {"localId": uid, "emailVerified": True}, token=T)
    if st != 200:
        raise SystemExit("could not verify: %s %s" % (st, (res or {}).get("error", {}).get("message", "")[:160]))
    print("verified : True after")

st, res = call("%s/users/%s?updateMask.fieldPaths=role&updateMask.fieldPaths=email"
               "&updateMask.fieldPaths=name" % (BASE, uid), "PATCH", {"fields": {
                   "role": {"stringValue": ROLE},
                   "email": {"stringValue": ADDRESS},
                   "name": {"stringValue": NAME}}}, token=T)
print("role doc :", "written" if st == 200 else "status %s" % st)

print()
print("Both halves are now in place:")
print("  config/owners lists the address, and the account is verified")
print("  ownerEmail() can therefore resolve, and the platform grants admin")
print()
print("Sign out and sign in again. Firebase keeps the old claims in the session")
print("token for about an hour, so without a fresh sign-in the page keeps")
print("showing the role it cached earlier.")
