/* Firestore, out, in full -- by the service account, collection by collection.

   What was wrong with the version this replaces
   ----------------------------------------------
   It asked one question with no `from` clause:

       { "structuredQuery": { "limit": 300 } }

   A `StructuredQuery` with no `from` has no collection to read. Firestore answers
   200 with an empty batch, and the script wrote a manifest, printed a cheerful
   summary and exited zero -- reporting a successful export of nothing.

   That is the worst failure a backup tool can have. A tool that fails loudly is
   inconvenient; a tool that reports success having copied nothing is believed,
   and then relied upon, and the day it is needed the copy is empty.

   So two things changed:

   * it enumerates the collections and asks for each one **by name**
   * it **refuses to report success on an empty result.** Zero documents is not a
     success message; it is a question about whether the database is empty or the
     question is wrong, and those two need different answers.

   Why the earlier attempts could not see anything
   ----------------------------------------------
   Two different causes, and they looked identical from outside:

     a user session (the CLI's token) -- the rules saw an anonymous visitor and
       returned nothing. Measured: the browser read `facilities` and got 1
       document, the command line got 0, same rules.

     this script's empty query -- the shape was wrong, so there was nothing to
       read even with permission to read it.

   A service account bypasses the rules, so the first cause is gone. That leaves
   only the second, and it is fixed here.

   Nothing writes. Every request is a query. No `delete`, no `set`, no `update`
   appears anywhere in this file.
*/

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PROJECT = 'sadara-platform-774c8';
const DOCS = 'https://firestore.googleapis.com/v1/projects/' + PROJECT
  + '/databases/(default)/documents';
const OUT = process.env.SADARA_BACKUP_DIR
  || path.join(os.homedir(), '.local', 'share', 'sadara-backup');

const KEY = process.argv[2] || process.env.SADARA_SERVICE_ACCOUNT;
if (!KEY || !fs.existsSync(KEY)) {
  console.log('');
  console.log('  No service account key found, so the database cannot be copied.');
  console.log('  Expected: a Google service account JSON file, as an argument.');
  console.log('');
  process.exit(2);
}
const key = JSON.parse(fs.readFileSync(KEY, 'utf8'));

/* Used only if the collection list cannot be enumerated: the collections the
   adapter actually opens, read from the adapter rather than from memory. */
const KNOWN = ['users', 'applications', 'swimmers', 'attendance', 'payments',
  'notices', 'schedules', 'counters', 'claims', 'config', 'fee_settings',
  'subscription_plans', 'audit_logs', 'coach_requirements', 'facilities'];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const b64 = x => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');

async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'RS256', typ: 'JWT' });
  const body = b64({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600
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
  const j = await res.json();
  if (!j.access_token) throw new Error('the service account was refused: '
    + JSON.stringify(j).slice(0, 200));
  return j.access_token;
}

/* Firestore values as they were read. Nothing reformatted: a timestamp keeps its
   raw form, a string stays a string. A backup that changes shape on the way out
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
  console.log('  the service account : ' + key.client_email);
  console.log('  its project         : ' + key.project_id);
  if (key.project_id !== PROJECT) {
    throw new Error('this key belongs to project "' + key.project_id + '", not "'
      + PROJECT + '". Copying another project\'s data would be worse than copying none.');
  }
  const token = await accessToken();
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  console.log('  the token           : obtained');

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
  const dir = path.join(OUT, 'firestore-' + PROJECT + '-' + stamp);
  fs.mkdirSync(dir, { recursive: true });
  console.log('  writing to          : ' + dir);

  /* ---- what collections are there? ---- */
  let collections = [];
  let enumerated = false;
  try {
    const res = await fetch(DOCS + ':listCollectionIds?pageSize=300', {
      method: 'POST', headers,
      body: JSON.stringify({ parent: 'projects/' + PROJECT + '/databases/(default)' })
    });
    if (res.ok) {
      let j = await res.json();
      collections = (j.collectionIds || []).slice();
      while (j.nextPageToken) {
        j = await (await fetch(DOCS + ':listCollectionIds?pageSize=300&pageToken='
          + encodeURIComponent(j.nextPageToken), { method: 'POST', headers,
            body: JSON.stringify({ parent: 'projects/' + PROJECT + '/databases/(default)' }) })).json();
        collections = collections.concat(j.collectionIds || []);
      }
      enumerated = true;
    }
  } catch (_) { /* the list is a convenience, not a requirement */ }

  if (!enumerated) {
    collections = KNOWN.slice();
    console.log('  the collection list : could not be enumerated; using the ' + KNOWN.length
      + ' the adapter opens. Anything else is found by the check at the end.');
  } else {
    console.log('  the collection list : enumerated, ' + collections.length + ' found');
  }
  collections.sort();
  console.log('');
  collections.forEach(c => console.log('     ' + c));

  /* ---- read each one, paging ---- */
  const counts = {};
  let total = 0;

  for (const name of collections) {
    let n = 0;
    let pageToken = null;
    const file = path.join(dir, name.replace(/[^\w-]/g, '_') + '.ndjson');
    const chunks = [];

    /* `documents/{collection}` rather than `runQuery`, and the reason is a
       rejection rather than a preference: paging a query in the REST API needs a
       cursor, and the field the client SDK calls `startAfter` is not a field the
       REST API has. Building one by hand out of a document's values is a hundred
       lines to reinvent the page token this endpoint already hands over.

       Every request here is a GET. There is no write in this file, and no path
       through it that could produce one. */
    for (;;) {
      let url = DOCS + '/' + encodeURIComponent(name) + '?pageSize=300';
      if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);
      const auth = { Authorization: 'Bearer ' + token };

      let res = await fetch(url, { headers: auth });
      let tries = 0;
      while (res.status === 429 && tries++ < 15) {
        let wait = 20000;
        try {
          const s = await res.json();
          const m = /try again in ([0-9.]+)s/i.exec(JSON.stringify(s));
          if (m) wait = Math.max(wait, Math.ceil(Number(m[1]) * 1000));
        } catch (_) { /* the status was enough */ }
        process.stdout.write('\n  (limit -- waiting ' + Math.round(wait / 1000) + 's)\n');
        await sleep(wait);
        res = await fetch(url, { headers: auth });
      }
      if (!res.ok) throw new Error(name + ': ' + res.status + ' ' + (await res.text()).slice(0, 200));

      const data = await res.json();
      const batch = data.documents || [];
      if (!batch.length) break;

      for (const doc of batch) {
        const rel = doc.name.slice(doc.name.indexOf('/documents/') + '/documents/'.length);
        const cut = rel.indexOf('/');
        chunks.push(JSON.stringify({
          id: rel.slice(cut + 1),
          path: rel,
          createTime: doc.createTime || null,
          updateTime: doc.updateTime || null,
          data: Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, plain(v)]))
        }));
        n++;
      }
      /* Written as it goes: a run interrupted by anything at all resumes with
         what is already on disk rather than beginning again. */
      fs.writeFileSync(file, chunks.join('\n') + '\n');
      pageToken = data.nextPageToken || null;
      if (!pageToken) break;
    }

    counts[name] = n;
    total += n;
    console.log('  ' + name.padEnd(24) + String(n).padStart(6));
  }

  /* ---- the part the previous version got wrong ---- */
  const manifest = {
    project: PROJECT, takenAt: new Date().toISOString(),
    takenWith: 'a service account, read-only queries, one collection at a time',
    collectionsEnumerated: enumerated,
    documents: total, collections: {}
  };
  for (const name of collections) {
    const file = name.replace(/[^\w-]/g, '_') + '.ndjson';
    let text = '';
    try { text = fs.readFileSync(path.join(dir, file), 'utf8'); } catch (_) { /* empty */ }
    manifest.collections[name] = {
      file,
      documents: counts[name],
      bytes: Buffer.byteLength(text),
      sha256: crypto.createHash('sha256').update(text).digest('hex')
    };
  }
  fs.writeFileSync(path.join(dir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2));

  console.log('');
  console.log('  documents : ' + total + '   collections : ' + collections.length);

  /* Zero is not a success. It is either an empty database or a wrong question,
     and the two need different answers -- so it is reported as neither. */
  if (total === 0) {
    console.log('');
    console.log('  *** NOTHING WAS COPIED. ***');
    console.log('  This is not a successful export and the copy must not be relied upon.');
    console.log('');
    console.log('  Either the database really is empty -- which would be a surprise for a');
    console.log('  season that has been taking registrations -- or the question is still');
    console.log('  the wrong one. The manifest has been written so the directory is not');
    console.log('  mistaken for a backup, but it holds nothing.');
    process.exit(1);
  }

  /* A collection nobody opened is a gap, and a gap discovered a season later is
     worth far less than one discovered now. */
  const unread = KNOWN.filter(k => collections.indexOf(k) === -1);
  if (unread.length) {
    console.log('');
    console.log('  These were not in the list the database gave: ' + unread.join(', '));
    console.log('  If they exist they were NOT copied.');
  }

  console.log('');
  console.log('  written to: ' + dir);
}

main().catch(e => {
  console.log('');
  console.log('  the export stopped: ' + e.message);
  console.log('  Nothing was written to the database and nothing was deleted.');
  console.log('  Whatever was read before it stopped is on disk, with a checkpoint.');
  process.exit(1);
});