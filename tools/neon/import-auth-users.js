/* Move the Firebase Authentication accounts into Neon's app_users table.

   Why it is written this way
   --------------------------
   One INSERT per user inside one transaction already works, but it sends one
   round trip per account and Neon counts latency, not statements. So the
   values are gathered into multi-row statements -- a batch of up to 100
   accounts per statement -- inside a single BEGIN/COMMIT. The whole import is
   still all-or-nothing: any failure rolls back every row, because a table
   half-filled with accounts is worse than an empty one, and the export file
   is always there to run again.

   Upsert, not insert
   ------------------
   Running this twice must be safe, so each row is `ON CONFLICT (id) DO
   UPDATE`. A re-run refreshes emails, names, roles and password material; a
   first run simply fills the table.

   Where the connection comes from
   -------------------------------
   Same place as every other tool in this folder: DATABASE_URL if it is set,
   otherwise the saved connection line. The password is used and never
   printed.

   What it does NOT do
   -------------------
   It does not re-hash anything. passwordHash and salt are copied verbatim,
   and hash_algorithm records 'firebase-scrypt' so that login knows which
   verifier to build. Verifying a login must reproduce Firebase's parameters
   for this project (signer_key, salt_separator, rounds, mem_cost -- the
   project's hash_config) or no migrated password will ever match.

   Usage:
     node tools/neon/import-auth-users.js [path/to/auth_export.json]
*/

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

/* dotenv is optional: the connection file already carries what is needed.
   If a .env with DATABASE_URL exists, it is honoured; if it does not, one
   fewer dependency is one fewer thing that can break at 2 a.m. */
try { require('dotenv').config(); } catch (_) { /* not installed, not needed */ }

const CONN = path.join(os.homedir(), '.local', 'share', 'sadara-backup', 'connection.txt');
const SCHEMA = path.join(__dirname, '002-app-users.sql');
const CA = path.join(__dirname, '..', 'intercept-roots.pem');

const EXPORT_FILE = process.argv[2] || path.join(__dirname, '..', '..', 'auth_export.json');
const BATCH = 100; /* rows per INSERT statement; well under Postgres' 65535
                      parameter limit and large enough to matter */

function connection() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (fs.existsSync(CONN)) return fs.readFileSync(CONN, 'utf8').trim();
  console.log('');
  console.log('  No connection: DATABASE_URL is not set and there is no file at');
  console.log('    ' + CONN);
  console.log('');
  process.exit(2);
}

let pg;
try {
  pg = require('pg');
} catch (_) {
  console.log('');
  console.log('  The Postgres client is not installed:  npm install pg');
  console.log('');
  process.exit(2);
}

async function connect(connectionString) {
  /* Exactly what the connection string asks for first, verified against the
     roots this machine trusts. Only if that fails is verification dropped --
     and then it is said out loud rather than done quietly. */
  const strict = {
    connectionString,
    ssl: fs.existsSync(CA) ? { ca: fs.readFileSync(CA, 'utf8'), rejectUnauthorized: true }
                           : { rejectUnauthorized: true }
  };
  const a = new pg.Client(strict);
  try {
    await a.connect();
    return a;
  } catch (e) {
    await a.end().catch(() => {});
    const loose = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
    await loose.connect();
    console.log('');
    console.log('  *** the certificate could NOT be checked: '
      + String(e.message).split('\n')[0].slice(0, 120));
    console.log('      Connected without verifying it. Every byte is still encrypted;');
    console.log('      what is lost is the proof of who sent it.');
    console.log('');
    return loose;
  }
}

/* The role lives in customAttributes, which Firebase stores as a JSON string
   built for the SDK. Anything unreadable falls through to the database
   lookup, and then to the default, rather than failing the import over a
   label. */
function claimRole(user) {
  if (!user.customAttributes) return null;
  try {
    const attrs = typeof user.customAttributes === 'string'
      ? JSON.parse(user.customAttributes)
      : user.customAttributes;
    return (attrs && attrs.role) ? String(attrs.role) : null;
  } catch (_) {
    return null;
  }
}

/* In this project the claims are empty objects -- the roles were kept in the
   Firestore users collection, which the earlier migration put in
   sadara.users. Reading them from there is the difference between members
   arriving as members and every one of them arriving as a coach. */
async function loadRoles(client) {
  const map = Object.create(null);
  try {
    const r = await client.query(
      'SELECT email, role FROM sadara.users WHERE role IS NOT NULL');
    for (const row of r.rows) map[String(row.email).toLowerCase()] = row.role;
    console.log('  roles known from sadara.users: ' + r.rows.length);
  } catch (_) {
    console.log('  sadara.users is not there; the default role will be used.');
  }
  return map;
}

async function main() {
  if (!fs.existsSync(EXPORT_FILE)) {
    console.log('');
    console.log('  The export file is not there: ' + EXPORT_FILE);
    console.log('  Produce it with:');
    console.log('    firebase auth:export auth_export.json --project sadara-platform-774c8');
    console.log('');
    process.exit(2);
  }

  console.log('  reading ' + EXPORT_FILE);
  let exportData;
  try {
    exportData = JSON.parse(fs.readFileSync(EXPORT_FILE, 'utf8'));
  } catch (e) {
    console.log('');
    console.log('  The file is not valid JSON: ' + e.message.split('\n')[0]);
    console.log('');
    process.exit(2);
  }

  /* Both shapes of export are accepted: a bare array, or the object the CLI
     and Admin SDK wrap it in. */
  const users = Array.isArray(exportData) ? exportData : (exportData.users || []);
  console.log('  accounts found: ' + users.length);

  if (users.length === 0) {
    console.log('  Nothing to import. The table was left untouched.');
    return;
  }

  /* Email is UNIQUE as well as the id being the primary key: two accounts
     sharing an email would fail mid-import, so they are found here instead,
     where the message can name them. */
  const byEmail = Object.create(null);
  for (const u of users) {
    if (!u.localId || !u.email) {
      console.log('');
      console.log('  A record has no localId or no email and cannot be imported.');
      console.log('  First fields: ' + JSON.stringify(Object.keys(u)));
      process.exit(2);
    }
    const key = String(u.email).toLowerCase();
    if (byEmail[key]) {
      console.log('');
      console.log('  Two accounts share the email ' + u.email + ' ('
        + byEmail[key] + ' and ' + u.localId + '). Firebase allows this across');
      console.log('  providers; app_users cannot. Nothing was written.');
      process.exit(2);
    }
    byEmail[key] = u.localId;
  }

  const client = await connect(connection());

  try {
    const me = await client.query(
      'SELECT current_database() AS db, current_user AS role');
    console.log('  writing to   : ' + me.rows[0].db + ' as ' + me.rows[0].role);

    /* The table is created here rather than assumed: an import that fails on
       a missing table after ten minutes of reading is a poor way to learn it. */
    await client.query(fs.readFileSync(SCHEMA, 'utf8'));
    console.log('  table app_users: present');

    const roles = await loadRoles(client);

    await client.query('BEGIN');

    let inserted = 0;
    const counts = Object.create(null);

    for (let i = 0; i < users.length; i += BATCH) {
      const chunk = users.slice(i, i + BATCH);
      const values = [];
      const params = [];
      chunk.forEach((u, j) => {
        const base = j * 7;
        values.push('($' + (base + 1) + ', $' + (base + 2) + ', $' + (base + 3)
          + ', $' + (base + 4) + ', $' + (base + 5) + ', $' + (base + 6)
          + ', $' + (base + 7) + ')');
        const role = claimRole(u) || roles[String(u.email).toLowerCase()] || 'coach';
        counts[role] = (counts[role] || 0) + 1;
        params.push(
          u.localId,
          u.email,
          u.displayName || null,
          role,
          u.passwordHash || null,
          u.salt || null,
          'firebase-scrypt'
        );
      });

      await client.query(
        'INSERT INTO app_users (id, email, display_name, role, password_hash, password_salt, hash_algorithm) '
        + 'VALUES ' + values.join(', ')
        + ' ON CONFLICT (id) DO UPDATE SET '
        + 'email = EXCLUDED.email, '
        + 'display_name = COALESCE(EXCLUDED.display_name, app_users.display_name), '
        + 'role = EXCLUDED.role, '
        + 'password_hash = EXCLUDED.password_hash, '
        + 'password_salt = EXCLUDED.password_salt',
        params);
      inserted += chunk.length;
      if (i + BATCH < users.length) {
        process.stdout.write('  ' + inserted + ' of ' + users.length + ' ...\r');
      }
    }

    await client.query('COMMIT');
    console.log('  committed: ' + inserted + ' account(s) in batches of ' + BATCH);

    /* The proof, not the promise: the counts as the table now holds them. */
    const byRole = await client.query(
      'SELECT role, count(*)::int AS total FROM app_users GROUP BY role ORDER BY role');
    console.log('');
    console.log('  app_users by role:');
    for (const r of byRole.rows) {
      console.log('    ' + String(r.role).padEnd(12) + r.total);
    }
    const total = await client.query('SELECT count(*)::int AS n FROM app_users');
    console.log('    ' + 'total'.padEnd(12) + total.rows[0].n);

    /* And a small sample, so a glance can catch a column written sideways. */
    const sample = await client.query(
      'SELECT id, email, role, hash_algorithm, created_at FROM app_users ORDER BY created_at LIMIT 5');
    console.log('');
    console.log('  sample rows:');
    for (const s of sample.rows) {
      console.log('    ' + s.email + '  [' + s.role + ']  ' + s.hash_algorithm);
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.log('');
    console.log('  Import failed, every change was rolled back:');
    console.log('    ' + String(error.message).split('\n')[0].slice(0, 200));
    console.log('  app_users is exactly as it was before this run.');
    await client.end().catch(() => {});
    process.exit(1);
  }

  await client.end();
  console.log('');
  console.log('  Closed.');
}

main().catch(e => {
  console.log('');
  console.log('  ' + String(e.message).split('\n')[0]);
  process.exit(1);
});
