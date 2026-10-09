"""Adds or removes a hostname in Firebase Auth's authorized-domains list.

This is the one thing that stands between a new hostname and a working sign-in
button. Firebase checks the domain the page is served from against this list, and
answers auth/unauthorized-domain when it is not on it -- which looks like the
site being broken rather than a list being incomplete.

It can be done from here, so the console and its password are not needed. The
list is read first and the new value is written back in full, because the API
replaces the list rather than adding to it.

Usage:
    python tools/set-auth-domains.py
    python tools/set-auth-domains.py add myclub.infinityfree.com
    python tools/set-auth-domains.py remove myclub.infinityfree.com
"""
import io
import json
import os
import sys
import urllib.parse
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with io.open(os.path.join(ROOT, ".firebaserc"), encoding="utf-8") as fh:
    PROJECT = json.load(fh)["projects"]["default"]

# The two the project answers on today. Kept here so a mistaken write can be
# corrected without a console, and so the defaults are never lost.
BASELINE = [
    "localhost",
    "sadara-platform-774c8.firebaseapp.com",
    "sadara-platform-774c8.web.app",
]

STORE = os.path.join(os.path.expanduser("~"), ".config", "configstore", "firebase-tools.json")


def access_token():
    if not os.path.exists(STORE):
        raise SystemExit("Not signed in to Firebase. Run:  npm run login")
    data = json.loads(io.open(STORE, encoding="utf-8").read())
    refresh = (data.get("tokens") or {}).get("refresh_token")
    if not refresh:
        raise SystemExit("No usable token in the Firebase store. Run:  npm run login")
    body = urllib.parse.urlencode({
        "client_id": "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
        "client_secret": "j9iVZfS8kkCEFUPaAeJV0sAi",
        "refresh_token": refresh,
        "grant_type": "refresh_token"}).encode()
    req = urllib.request.Request("https://oauth2.googleapis.com/token", data=body,
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


def read(token):
    st, res = call("https://identitytoolkit.googleapis.com/v2/projects/%s/config" % PROJECT, token)
    if st != 200:
        raise SystemExit("could not read the domain list (status %s)" % st)
    return res.get("authorizedDomains") or list(BASELINE)


def write(token, domains):
    # The API replaces the whole list, so the ones already there are sent back.
    url = ("https://identitytoolkit.googleapis.com/v2/projects/%s/config"
           "?updateMask=authorizedDomains" % PROJECT)
    st, res = call(url, token, "PATCH", {"authorizedDomains": domains})
    if st != 200:
        err = (res or {}).get("error", {}) or {}
        raise SystemExit("could not write the domain list: %s %s"
                         % (err.get("status", ""), str(err.get("message", ""))[:160]))
    return res.get("authorizedDomains") or domains


def main():
    token = access_token()
    current = read(token)
    action = sys.argv[1] if len(sys.argv) > 1 else "show"

    if action == "show":
        print("domains allowed to sign in to %s:" % PROJECT)
        for d in current:
            print("   " + d)
        print()
        print("A hostname that is not on this list answers")
        print("auth/unauthorized-domain, which reads like a broken site.")
        return 0

    if action not in ("add", "remove"):
        raise SystemExit("Use: show | add <domain> | remove <domain>")
    if len(sys.argv) < 3:
        raise SystemExit("Give the hostname, for example:\n"
                         "  python tools/set-auth-domains.py add myclub.infinityfree.com")
    host = sys.argv[2].strip().lower().lstrip(".")
    if "/" in host or " " in host:
        raise SystemExit("Give a bare hostname, not a URL: " + host)

    if action == "add":
        if host in current:
            print("%s is already allowed." % host)
            return 0
        wanted = current + [host]
    else:
        if host not in current:
            print("%s is not on the list." % host)
            return 0
        if host in BASELINE:
            print("Refusing to remove %s: it is one of the project's own domains." % host)
            return 1
        wanted = [d for d in current if d != host]

    result = write(token, wanted)
    print("%s %s" % ("domain added:" if action == "add" else "domain removed:", host))
    print("sign-in now answers on:")
    for d in result:
        print("   " + d)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
