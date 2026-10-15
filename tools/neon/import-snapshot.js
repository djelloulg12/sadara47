/* Firestore -> Postgres, from a snapshot, never from the live database.

   Why a snapshot and not the database
   ----------------------------------
   Importing while the database is still being written is two moving things at
   once: a retry re-imports whatever changed in the meantime, and there is no
   single moment the import corresponds to. A snapshot is frozen. It can be
   imported twice and mean the same thing both times -- which is the property
   worth having when the next step is pointing a live club's records at it.

   So this reads the files `tools/backup-firestore.js` wrote and asks Firestore
   for nothing. If the snapshot is a week old the import is a week old, and that
   is visible here rather than discovered later.

   What it guarantees
   ------------------
     * nothing is deleted. Ever. Every write is an upsert keyed on the document's
       own path, so re-running updates rows rather than clearing a table. There is
       no TRUNCATE and no DROP anywhere in this file, and no flag that adds one.
     * nothing is dropped. A collection with no table of its own goes to
       `unmapped`, visibly and counted -- never silently nowhere.
     * `raw` is authoritative. Typed columns are promoted over it, and the
       original document stays whole beside them.
     * the counts are checked against the snapshot's own manifest, and a mismatch
       stops the run before anything is written.

   Running it
   ----------
     node tools/neon/import-snapshot.js "<snapshot folder>" "<connection file>" --write

   It refuses to write without --write. A dry run prints what would be imported,
   the row counts, and the fields this build does not promote to columns.

   The connection string is read from a file, never from an argument and never
   from the environment of whatever shell happens to be open.
*/

'use strict';

const fs = require('fs');
const path = require('path');

const WRITE = process.argv.includes('--write');
const SNAPSHOT = process.argv[2];
const CONNECTION_FILE = process.argv[3];

function stop(why, how) {
  console.log('');
  console.log('  ' + why);
  if (how) {
    console.log('');
    how.forEach(l => console.log('  ' + l));
  }
  console.log('');
  process.exit(2);
}

if (!SNAPSHOT || !CONNECTION_FILE || CONNECTION_FILE === '--write') {
  stop('Two things are needed: which snapshot, and which database.', [
    'The snapshot is the folder tools/backup-firestore.js wrote, holding a MANIFEST.json.',
    '',
    'The connection is a file on disk holding one line:',
    '  postgresql://user:password@host/db?sslmode=require',
    '',
    'Put it at  C:\\Users\\djell\\.local\\share\\sadara-backup\\connection.txt',
    'and run:',
    '  node tools/neon/import-snapshot.js "<snapshot>" "<that file>" --write'
  ]);
}

if (!fs.existsSync(SNAPSHOT) || !fs.existsSync(path.join(SNAPSHOT, 'MANIFEST.json'))) {
  stop('That folder is not a snapshot -- there is no MANIFEST.json in it.', [
    'Looked at: ' + SNAPSHOT,
    'A snapshot is written by:  node tools/backup-firestore.js "<service account key>"'
  ]);
}

if (!fs.existsSync(CONNECTION_FILE)) {
  stop('There is no connection file at that path, so there is nowhere to import to.', [
    'Put one line in it: postgresql://user:password@host/db?sslmode=require',
    'Do not paste it into a conversation, and do not commit it.'
  ]);
}

const connection = fs.readFileSync(CONNECTION_FILE, 'utf8').trim();
if (!/^postgres(ql)?:\/\//.test(connection)) {
  stop('The connection file does not begin with postgresql:// -- so it is empty, or it',
    ['holds something else. A connection line looks like:',
     '  postgresql://sadara:xxxx@ep-xxx-pooler.region.neon.tech/sadara?sslmode=require',
     '',
     'Checked here rather than at connect time, so that an empty file fails with a',
     'sentence somebody can act on instead of a connection error twenty lines later.']);
}

/* Which table each collection belongs to. Anything not listed is still imported
   -- into `unmapped`, where it is visible -- but it is counted and printed here,
   because an unmapped collection is a question, not a detail. */
const TABLES = {
  users: 'users',
  applications: 'applications',
  swimmers: 'swimmers',
  attendance: 'attendance',
  payments: 'payments',
  schedules: 'schedules',
  notices: 'notices',
  facilities: 'facilities',
  subscription_plans: 'subscription_plans',
  fee_settings: 'fee_settings',
  coach_requirements: 'coach_requirements',
  audit_logs: 'audit_logs',
  config: 'config',
  counters: 'counters',
  claims: 'claims'
};

/* Firestore stores a timestamp as an object; its raw form stays in `raw`, and
   the promoted column gets a real timestamp where the value looks like one. A
   value that does not is promoted as null rather than guessed at -- `raw` still
   has it, so nothing is lost, only not indexed. */
const asTimestamp = v => {
  const s = v && typeof v === 'object' && typeof v.__timestamp === 'string' ? v.__timestamp : null;
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

const asDate = v => {
  const ts = asTimestamp(v);
  if (ts) return ts.slice(0, 10);
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return null;
};

const asBool = v => (typeof v === 'boolean' ? v : null);
const asNum = v => (typeof v === 'number' && isFinite(v) ? v : null);
const asStr = v => (typeof v === 'string' && v !== '' ? v : null);

/* The fields worth a column: the ones searched, joined on, or reported on. */
const PROMOTE = {
  users: {
    uid: asStr, email: asStr, display_name: asStr, role: asStr, phone: asStr,
    member_no: asStr, request_status: asStr, request_reason: asStr,
    verified: asBool, created_at: asTimestamp, updated_at: asTimestamp
  },
  applications: {
    application_no: asStr, application_type: asStr, status: asStr, category: asStr,
    applicant_uid: asStr, account_uid: asStr, transferred_to: asStr,
    first_name_ar: asStr, last_name_ar: asStr, first_name_fr: asStr, last_name_fr: asStr,
    birth_date: asDate, birth_place: asStr, gender: asStr, wilaya: asStr,
    national_id: asStr, national_id_expiry: asDate, birth_certificate_no: asStr,
    blood_group: asStr, level: asStr, phone: asStr, whatsapp: asStr, address: asStr,
    guardian_first_name: asStr, guardian_last_name: asStr, guardian_birth_date: asDate,
    guardian_relation: asStr, guardian_phone: asStr, guardian_national_id: asStr,
    guardian_consent: asBool,
    selected_pool: asStr, facility: asStr, pool_number: asNum,
    subscription_code: asStr, transport: asBool, uniform: asBool, payment_method: asStr,
    expected_amount: asNum, registration_id: asStr, membership_no: asStr,
    decision_reason: asStr, rejection_reason: asStr,
    reviewed_by: asStr, decided_at: asTimestamp,
    scan_name: asStr, scan_path: asStr, notes: asStr,
    submitted_at: asTimestamp, created_at: asTimestamp, updated_at: asTimestamp
  },
  swimmers: {
    membership_no: asStr, registration_id: asStr,
    first_name_ar: asStr, last_name_ar: asStr, first_name_fr: asStr, last_name_fr: asStr,
    birth_date: asDate, gender: asStr, blood_group: asStr, level: asStr, phone: asStr,
    photo_path: asStr, facility: asStr, selected_pool: asStr, subscription_code: asStr,
    transport: asBool, uniform: asBool, payment_method: asStr,
    guardian_first_name: asStr, guardian_last_name: asStr, guardian_phone: asStr,
    medical_notes: asStr, from_application: asStr, active: asBool,
    created_at: asTimestamp, updated_at: asTimestamp
  },
  attendance: {
    swimmer_path: asStr, membership_no: asStr, session_date: asDate, present: asBool,
    reason: asStr, recorded_by: asStr, created_at: asTimestamp
  },
  payments: {
    swimmer_path: asStr, membership_no: asStr, amount: asNum, method: asStr,
    paid_at: asDate, payment_status: asStr, recorded_by: asStr, notes: asStr,
    created_at: asTimestamp
  }
};

/* Firestore's documents carry camelCase; the columns are snake_case. Which
   spelling a field has depends on when it was written and by which version of
   the form, so both are tried, and neither is assumed. */
const camel = s => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

function promote(table, data) {
  const map = PROMOTE[table];
  if (!map) return {};
  const out = {};
  for (const [column, fn] of Object.entries(map)) {
    const c = camel(column);
    const v = data[column] !== undefined ? data[column] : data[c];
    out[column] = v === undefined ? null : fn(v);
  }
  return out;
}

function columnsFor(table) {
  if (table === 'unmapped') return ['firestore_path', 'collection', 'raw'];
  return ['firestore_path', 'raw'].concat(PROMOTE[table] ? Object.keys(PROMOTE[table]) : []);
}

function readSnapshot() {
  const manifest = JSON.parse(fs.readFileSync(path.join(SNAPSHOT, 'MANIFEST.json'), 'utf8'));
  const groups = new Map();
  const unseen = new Set();

  for (const [collection, info] of Object.entries(manifest.collections)) {
    const table = TABLES[collection];
    const text = fs.readFileSync(path.join(SNAPSHOT, info.file), 'utf8');
    const lines = text.split('\n').filter(Boolean);

    /* The snapshot is checked against its own manifest before anything is built
       from it. An import of a snapshot that disagrees with itself produces rows
       nobody can account for, and that is far better found here. */
    if (lines.length !== info.documents) {
      throw new Error(collection + ': the file holds ' + lines.length + ' documents but '
        + 'the manifest says ' + info.documents + '. The snapshot disagrees with itself.');
    }

    const target = table || 'unmapped';
    if (!groups.has(target)) groups.set(target, { table: target, source: collection, rows: [] });

    for (const line of lines) {
      const doc = JSON.parse(line);
      groups.get(target).rows.push(table
        ? Object.assign(
            { firestore_path: doc.path, raw: JSON.stringify(doc.data || {}) },
            promote(table, doc.data || {}))
        : {
            firestore_path: doc.path,
            collection: doc.path.split('/')[0],
            raw: JSON.stringify(doc.data || {})
          });
    }

    if (PROMOTE[table]) {
      const known = new Set(Object.keys(PROMOTE[table]).flatMap(k => [k, camel(k)]));
      for (const doc of lines.map(l => JSON.parse(l))) {
        for (const k of Object.keys(doc.data || {})) {
          if (!known.has(k)) unseen.add(collection + '.' + k);
        }
      }
    }

    console.log('  ' + collection.padEnd(20) + String(lines.length).padStart(6) + '  ->  '
      + (table || 'unmapped'));
  }

  return { manifest, groups, unseen };
}

async function main() {
  console.log('  snapshot taken : ' + readStamp());
  const { manifest, groups, unseen } = readSnapshot();

  console.log('');
  console.log('  taken as       : ' + (manifest.takenAs || '(not recorded)'));
  console.log('  mode           : ' + (WRITE ? 'WRITE' : 'dry run -- nothing will be written'));

  const total = [...groups.values()].reduce((n, g) => n + g.rows.length, 0);
  const unmapped = groups.get('unmapped');
  console.log('');
  console.log('  rows to import : ' + total);
  console.log('  not mapped     : ' + (unmapped ? unmapped.rows.length : 0)
    + (unmapped ? '  (' + unmapped.source + ')' : ''));

  if (unseen.size) {
    console.log('');
    console.log('  Fields in the snapshot that get no column of their own. They are in');
    console.log('  `raw` and nothing is lost -- but a field reported on needs one:');
    [...unseen].sort().slice(0, 40).forEach(f => console.log('     ' + f));
    if (unseen.size > 40) console.log('     ... and ' + (unseen.size - 40) + ' more');
  }

  if (!WRITE) {
    console.log('');
    console.log('  This was a dry run. Nothing was written and nothing was deleted.');
    console.log('  When these numbers are what you expect, run the same command with --write.');
    return;
  }

  let pg;
  try {
    pg = require('pg');
  } catch (_) {
    console.log('');
    console.log('  The Postgres client is not installed, so the write cannot start:');
    console.log('    npm install pg');
    console.log('  Nothing was written.');
    process.exit(2);
  }

  const client = new pg.Client({ connectionString: connection, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('');
  console.log('  connected');

  /* The schema is applied here rather than assumed, so a first run cannot fail
     on a table nobody created. It is CREATE TABLE IF NOT EXISTS throughout, so
     applying it twice changes nothing. */
  await client.query(fs.readFileSync(path.join(__dirname, '001-schema.sql'), 'utf8'));
  console.log('  the schema is in place');

  const BATCH = 100;
  for (const { table, rows } of groups.values()) {
    if (!rows.length) continue;
    const cols = columnsFor(table);
    const updates = cols.filter(c => c !== 'firestore_path');
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      const values = [];
      const params = [];
      slice.forEach((r, n) => cols.forEach((c, ci) => {
        values.push('$' + (n * cols.length + ci + 1));
        params.push(r[c] === undefined ? null : r[c]);
      }));
      /* ON CONFLICT ... DO UPDATE, never a delete. Re-running updates rows to
         match the snapshot and cannot remove a row that is only in the database,
         which is what makes going back possible without a second thought. */
      const sql = 'INSERT INTO sadara.' + table + ' (' + cols.join(', ') + ') VALUES ('
        + values.join(', ') + ') ON CONFLICT (firestore_path) DO UPDATE SET '
        + updates.map(c => c + ' = EXCLUDED.' + c).join(', ');
      await client.query(sql, params);
    }
    const got = await client.query('SELECT count(*)::int AS n FROM sadara.' + table);
    const status = got.rows[0].n >= rows.length ? '' : '   <-- fewer than imported; the table holds more';
    console.log('  ' + table.padEnd(20) + String(got.rows[0].n).padStart(6)
      + '  in the database' + status);
  }

  await client.end();
  console.log('');
  console.log('  imported. Verify it against the snapshot before trusting any of it:');
  console.log('    node tools/neon/verify-snapshot.js "<snapshot>" "<connection file>"');
}

function readStamp() {
  const manifest = JSON.parse(fs.readFileSync(path.join(SNAPSHOT, 'MANIFEST.json'), 'utf8'));
  return manifest.takenAt || '(not recorded)';
}

main().catch(e => {
  console.log('');
  console.log('  the import stopped: ' + e.message);
  console.log('  Nothing was deleted. Rows already written stay, and running it again');
  console.log('  updates them to match the snapshot -- it cannot remove anything.');
  process.exit(1);
});