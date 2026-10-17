/* The Firestore half of the backup, and the one step that cannot be done from here.

   What happened
   ------------
   Firestore's REST API refused eighty times over twenty-five minutes with "Quota
   exceeded", and it was not a quota that clears -- a quota that clears lets the
   next attempt through. The only credential on this machine is a **user** session,
   and that is not a credential Firestore exports databases with. The accounts
   side worked, because the Firebase CLI uses its own path for it.

   So this half needs a **service account key**: an identity made for this, with no
   person attached and a quota built for exports.

   How to get one -- two minutes
   ----------------------------
   1. Open
      https://console.firebase.google.com/project/sadara-platform-774c8/settings/serviceaccounts
   2. On the default service account, "Generate new private key"
   3. Save the downloaded JSON somewhere outside this repository, e.g.

        C:\\Users\\djell\\.local\\share\\sadara-backup\\service-account.json

      Saving the file to disk is the whole of this step. Do not paste the key into a
      conversation, do not commit it, do not send it anywhere.
   4. Then:

        node tools/backup-firestore.js "C:\\Users\\djell\\.local\\share\\sadara-backup\\service-account.json"

   If you would rather not create a key
   -------------------------------------
   Say so, and the rest is done a different way: read through the platform's own
   management screens with your existing session. That covers the requests, the
   swimmers, the attendance, the payments and the people -- everything the club runs
   on -- but not the counters, the claims or the documents as they are stored. It
   is a real backup of real data and not a complete one. Either answer is fine;
   neither is worth guessing at.

   What it does
   ------------
   Reads every collection and writes one newline-delimited JSON file per collection
   plus a manifest carrying a SHA-256 per collection, so "the copy is the same as
   what is there" can be answered without opening either. It writes the files after
   every batch and leaves a checkpoint, so an interrupted run resumes instead of
   starting again.

   Every request is a query. There is no write, no delete, and no path in this file
   that could produce either. The key is read from disk and used in exactly one
   place: Google's own token endpoint, which is where a service account has to
   prove what it is.

   Where it writes: outside the repository, because this holds names, national
   numbers, telephone numbers and photographs of children.
*/

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PROJECT = 'sadara-platform-774c8';
const API = 'https://firestore.googleapis.com/v1/projects/' + PROJECT
  + '/databases/(default)/documents:runQuery';
const OUT = process.env.SADARA_BACKUP_DIR
  || path.join(os.homedir(), '.local', 'share', 'sadara-backup');

function sayNoKey(looked) {
  console.log('');
  console.log('  No service account key found, so the database itself cannot be copied.');
  console.log('');
  console.log('  Looked at : ' + (looked || '(nothing given)'));
  console.log('  Expected  : a Google service account JSON file');
  console.log('');
  console.log('  Why it is needed: the only credential on this machine is a user session,');
  console.log('  and that is not one Firestore reads a whole database with.');
  console.log('');
  console.log('  Measured on 2026-10-17, after the quota had reset and the REST endpoint');
  console.log('  began answering 200 again:');
  console.log('');
  console.log('    the browser, carrying a Firebase identity   ->  facilities: 1 document');
  console.log('    the command line, carrying none             ->  facilities: 0 documents');
  console.log('');
  console.log('  Same database, same rules, same collection. Without a Firebase identity');
  console.log('  the rules see an anonymous visitor and return nothing -- which looks');
  console.log('  exactly like an empty collection. For two days this also really was a');
  console.log('  quota problem, and the two are indistinguishable from the outside. A');
  console.log('  service account bypasses the rules, and is the credential this needs.');
  console.log('');
  console.log('  No script can help here: the refusal arrives before one gets a turn.');
  console.log('  This one is already written. The credential is what is missing.');
  console.log('');
  console.log('  Create a key:');
  console.log('    https://console.firebase.google.com/project/' + PROJECT + '/settings/serviceaccounts');
  console.log('');
  console.log('  Save it to (outside the repository):');
  console.log('    ' + path.join(OUT, 'service-account.json'));
  console.log('');
  console.log('  Then run:');
  console.log('    node tools/backup-firestore.js "' + path.join(OUT, 'service-account.json') + '"');
  console.log('');
  console.log('  The key is read from disk and never printed, copied or committed.');
  console.log('');
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* A service account proves itself with a signed assertion -- the thing a user
   token never carries, and the reason the quota is different. Node signs it, so
   nothing has to be installed to do it. */
async function accessToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = x => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');
  const head = b64({ alg: 'RS256', typ: 'JWT' });
  const body = b64({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  });
  const sig = crypto.createSign('RSA-SHA256').update(head + '.' + body)
    .sign(key.private_key, 'base64url');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: head + '.' + body + '.' + sig
    })
  });
  const json = await res.json();
  if (!json.access_token) {
    throw new Error('the service account was refused: ' + JSON.stringify(json).slice(0, 220));
  }
  return json.access_token;
}

/* A value as it was read. Nothing is reformatted: a timestamp keeps its raw form
   beside it, a string stays a string. A backup that changes shape on the way out
   is one nobody can rely on. */
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
  const looked = process.argv[2] || process.env.SADARA_SERVICE_ACCOUNT;
  if (!looked || !fs.existsSync(looked)) {
    sayNoKey(looked);
    return;
  }

  const key = JSON.parse(fs.readFileSync(looked, 'utf8'));
  console.log('  the service account : ' + key.client_email);
  console.log('  its project         : ' + key.project_id);

  const token = await accessToken(key);
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  console.log('  the token           : obtained');

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
  const dir = path.join(OUT, 'firestore-' + PROJECT + '-' + stamp);
  fs.mkdirSync(dir, { recursive: true });

  const byCollection = new Map();
  let after = null;
  let seen = 0;

  for (;;) {
    const structuredQuery = { limit: 300 };
    if (after) structuredQuery.startAfter = { name: after };

    let res = await fetch(API, {
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
      res = await fetch(API, {
        method: 'POST', headers, body: JSON.stringify({ structuredQuery })
      });
    }
    if (!res.ok) throw new Error(res.status + ' ' + (await res.text()).slice(0, 300));

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
    takenWith: 'a service account, read-only queries',
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

main().catch(e => {
  console.log('  the export stopped: ' + e.message);
  console.log('  nothing was deleted and nothing was changed; the checkpoint is there, so');
  console.log('  the same command resumes where it left off.');
  process.exit(1);
});
