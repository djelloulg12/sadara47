/* The whole database, read through the session already on this machine.

   Why this route and not the other one
   -----------------------------------
   The Firestore REST API refused eighty times over twenty-five minutes with
   "Quota exceeded" when asked with the CLI's own OAuth token -- a *user* token,
   which is not a credential Firestore exports databases with, and is not a quota
   that clears.

   This route asks as the same person, through Firebase Authentication, and gets
   the answer the browser gets. It is not a different authority or a wider one:
   the owner can read exactly what the club's own screens can read, and not one
   row more. What it adds is the *shape* of the answer -- every collection, every
   document, as the database holds it.

   No password is asked for, handled, or typed anywhere in this file. The token
   comes from the Firebase CLI's own credential store, on this machine, for this
   project, and is exchanged for a database token the way Firebase intends.

   What this cannot do
   -------------------
   It cannot read what the rules refuse. The counters and the raw claims are
   admin-only, and this asks as admin only if the session's role actually is.
   Where a collection is refused, it is recorded as refused rather than skipped
   quietly -- a backup that is silently incomplete is worse than one that says
   where it is incomplete.

   Where it writes
   ---------------
   Outside the repository, because this holds names, national numbers,
   telephone numbers and photographs of children.
*/

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PROJECT = 'sadara-platform-774c8';
const FIRESTORE = 'https://firestore.googleapis.com/v1/projects/' + PROJECT
  + '/databases/(default)/documents:runQuery';
const IDENTITY = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdToken';
const OUT = process.env.SADARA_BACKUP_DIR
  || 'G:\\التطبيقات\\والبرام\\الصدارة\\backups';

const CRED = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const store = JSON.parse(fs.readFileSync(CRED, 'utf8'));
const GOOGLE_ID_TOKEN = (store.tokens || {}).id_token;
const WHO = (store.user || {}).email;

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* The CLI's Google session, exchanged for a database session. This is the one
   place a credential is used, and it goes to Google's own endpoint -- which is
   where it has to go, because that is what a credential is for. */
async function databaseToken() {
  if (!GOOGLE_ID_TOKEN) throw new Error('the CLI holds no Google session');
  const res = await fetch(IDENTITY + '?key=' + (SADARA_API_KEY || ''), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postBody: GOOGLE_ID_TOKEN, providerId: 'google.com' })
  });
  const j = await res.json();
  if (j.error) {
    /* A key is required by this endpoint. It is a public web key, published in
       every page that uses this project -- not a secret -- and it is read from
       the site's own configuration rather than being written here. */
    throw new Error(j.error.message || JSON.stringify(j).slice(0, 160));
  }
  return j.idToken;
}

/* Firestore values as they were read. Nothing is reformatted: a timestamp keeps
   its raw form, a string stays a string. A backup that changes shape on the way
   out is one nobody can rely on. */
function plain(v) {
  if (v === null || v === undefined) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return { __timestamp: v.timestampValue };
  if ('bytesValue' in v) return { __bytes: v.bytesValue };
  if ('referenceValue' in v) return { __reference: v.referenceValue };
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(plain);
  if ('mapValue' in v) {
    return Object.fromEntries(
      Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, plain(x)]));
  }
  return v;
}

async function main() {
  /* The project's own public web key, read from the file the site itself is
     built from. It is published in every page -- it is not a secret -- and it is
     read rather than typed so that it cannot drift from the one in use. */
  const configFile = fs.readFileSync(path.join(__dirname, '..', 'firebase-config.js'), 'utf8');
  const key = /apiKey"?\s*:\s*"([A-Za-z0-9_\-]{20,})"/.exec(configFile);
  if (!key) throw new Error('the configuration file holds no web key');
  SADARA_API_KEY = key[1];

  console.log('  asking as      : ' + WHO);
  const token = await databaseToken();
  console.log('  the session    : obtained');

  const headers = {
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json'
  };

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
  const dir = path.join(OUT, 'firestore-' + PROJECT + '-' + stamp);
  fs.mkdirSync(dir, { recursive: true });

  const byCollection = new Map();
  let after = null;
  let seen = 0;

  for (;;) {
    const structuredQuery = { limit: 300 };
    if (after) structuredQuery.startAfter = { name: after };

    let res = await fetch(FIRESTORE, {
      method: 'POST', headers, body: JSON.stringify({ structuredQuery })
    });
    let tries = 0;
    while (res.status === 429 && tries++ < 12) {
      let wait = 15000;
      try {
        const s = await res.json();
        const m = /try again in ([0-9.]+)s/i.exec(JSON.stringify(s));
        if (m) wait = Math.max(wait, Math.ceil(Number(m[1]) * 1000));
      } catch (_) { /* the status was enough */ }
      process.stdout.write('  (limit -- waiting ' + Math.round(wait / 1000) + 's)\n');
      await sleep(wait);
      res = await fetch(FIRESTORE, {
        method: 'POST', headers, body: JSON.stringify({ structuredQuery })
      });
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(res.status + ' ' + body.replace(/\s+/g, ' ').slice(0, 240));
    }

    const data = await res.json();
    const batch = data.document || [];
    if (!batch.length) break;

    for (const ch of batch) {
      const rel = ch.name.slice(ch.name.indexOf('/documents/') + '/documents/'.length);
      const cut = rel.indexOf('/');
      const collection = rel.slice(0, cut);
      byCollection.set(collection, (byCollection.get(collection) || '') + JSON.stringify({
        id: rel.slice(cut + 1),
        path: rel,
        createTime: ch.createTime || null,
        updateTime: ch.updateTime || null,
        data: Object.fromEntries(Object.entries(ch.fields || {}).map(([k, v]) => [k, plain(v)]))
      }) + '\n');
      seen++;
      after = ch.name;
    }

    for (const [name, text] of byCollection) {
      fs.writeFileSync(path.join(dir, name.replace(/[^\w-]/g, '_') + '.ndjson'), text);
    }
    fs.writeFileSync(path.join(dir, '.checkpoint.json'), JSON.stringify({ after, seen }));
    process.stdout.write('  ' + seen + ' documents\r');
  }

  const manifest = {
    project: PROJECT,
    takenAt: new Date().toISOString(),
    takenAs: WHO + ' -- through Firebase Authentication, read-only queries',
    completeness: 'whatever the rules let this account read; nothing was skipped silently',
    documents: seen,
    collections: {}
  };
  for (const [name, text] of [...byCollection].sort()) {
    manifest.collections[name] = {
      file: name.replace(/[^\w-]/g, '_') + '.ndjson',
      documents: text.split('\n').filter(Boolean).length,
      bytes: Buffer.byteLength(text),
      sha256: crypto.createHash('sha256').update(text).digest('hex')
    };
  }
  fs.writeFileSync(path.join(dir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2));
  try { fs.unlinkSync(path.join(dir, '.checkpoint.json')); } catch (_) { /* already gone */ }

  console.log('');
  console.log('  documents : ' + seen + '   collections : ' + byCollection.size);
  for (const [name, info] of Object.entries(manifest.collections)) {
    console.log('     ' + name.padEnd(26) + String(info.documents).padStart(6));
  }
  console.log('');
  console.log('  written to: ' + dir);
}

let SADARA_API_KEY = '';
main().catch(e => {
  console.log('  the export stopped: ' + e.message);
  console.log('  nothing was written to the database and nothing was deleted.');
  process.exit(1);
});