"""Creates the staff accounts in Firebase Auth and gives each one its role.

Both halves are required: without an account in Authentication, and without a
users/{uid} document carrying the role, the security rules refuse everything.

Needs Firebase Authentication enabled in the console once:
  console.firebase.google.com/project/<id>/authentication/providers  ->  Get started
  then enable the Email/Password provider

The password is never taken from this file. Give it as an argument, through
SADARA_SEED_PASSWORD, or let the script ask for it without echoing:

  python tools/seed-accounts.py
  python tools/seed-accounts.py "a password of your own"

The addresses below are the ones the club already uses while working locally.
Replace them with real ones before the site goes public:

  SADARA_SEED_ACCOUNTS="Manager@club.example,admin;Head@club.example,president"

Roles: admin, president, coach, member, parent, swimmer_adult, swimmer_minor.
Anything else is refused: an account with an unknown role could do nothing at all.
"""
import getpass
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


# The club owner. Listed in Firestore config/owners, which is what actually
# grants every right; the role below is written alongside so the account also
# carries it in the interface.
OWNER_ADDRESS = "kabrag12@gmail.com"

# Three addresses that exist only for a developer's own machine. They are not the
# default any more: someone following the deploy notes made three accounts nobody
# could sign in with, and still had no account for the owner.
DEMO_ACCOUNTS = [
    ("admin@sadara.local", "admin"),
    ("president@sadara.local", "president"),
    ("coach@sadara.local", "coach"),
]


def read_accounts():
    """address;role,address;role -- or the owner's own account."""
    raw = os.environ.get("SADARA_SEED_ACCOUNTS", "").strip()
    if os.environ.get("SADARA_SEED_DEMO"):
        raw = ";".join("%s,%s" % a for a in DEMO_ACCOUNTS)
    if not raw:
        return [(OWNER_ADDRESS, "admin")]
    out = []
    for item in raw.split(";"):
        item = item.strip()
        if not item:
            continue
        if "," not in item:
            raise SystemExit("Each account needs an address and a role: " + item)
        address, role = item.split(",", 1)
        out.append((address.strip(), role.strip()))
    if not out:
        raise SystemExit("SADARA_SEED_ACCOUNTS is empty")
    return out


ACCOUNTS = read_accounts()

# The only roles the platform recognises, in firestore.rules and in the page
# itself. A role outside this list would produce an account that can do nothing
# at all, so it is refused rather than created.
STAFF_ROLES = ('admin', 'president', 'coach')
MEMBER_ROLES = ('member', 'parent', 'swimmer_adult', 'swimmer_minor')
ROLES = STAFF_ROLES + MEMBER_ROLES

for _address, _role in ACCOUNTS:
    if _role not in ROLES:
        raise SystemExit("Unknown role %r for %s.\n  Known roles: %s"
                         % (_role, _address, ", ".join(ROLES)))

if "--show" in sys.argv[1:]:
    print("accounts this would create:")
    for _address, _role in ACCOUNTS:
        note = "  (the club owner -- every right, from config/owners)" \
            if _address == OWNER_ADDRESS else ""
        print("   %-30s %s%s" % (_address, _role, note))
    print()
    print("Run without --show to create them. You will be asked for a password;")
    print("it is never printed, never stored, and never sent to this project")
    print("in plain text.")
    raise SystemExit(0)

PASSWORD = (os.environ.get("SADARA_SEED_PASSWORD")
            or (sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] != "--show" else ""))
if not PASSWORD:
    if not sys.stdin.isatty():
        raise SystemExit(
            "No password given.\n"
            "  Pass one as an argument, or set SADARA_SEED_PASSWORD.\n"
            "  This script never invents one and never stores it.")
    PASSWORD = getpass.getpass(
        "Password for %s: " % (ACCOUNTS[0][0] if len(ACCOUNTS) == 1
                               else "%d accounts" % len(ACCOUNTS)))
if len(PASSWORD) < 10:
    raise SystemExit("That password is too short for a public site. Use at least 10 characters.")

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
print("accounts:", ", ".join(a for a, _ in ACCOUNTS))
print("password: supplied by you, not shown here")
print()

NAMES = {
    "admin": ("مدير", "النادي"),
    "president": ("رئيس", "الجمعية"),
    "coach": ("مدرب", "النادي"),
    "parent": ("ولي", "أمر"),
    "member": ("عضو", "النادي"),
    "swimmer_adult": ("سباح", "النادي"),
    "swimmer_minor": ("سباح", "قاصر"),
}

NOW = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
failed = 0

for email, role in ACCOUNTS:
    first, last = NAMES.get(role, ("عضو", "النادي"))
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
    print()
    print("Sign in on the site's login page with the address and the password you gave.")
    print("Run this script again with the same password to change one.")