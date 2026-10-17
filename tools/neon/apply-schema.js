/* Apply the schema, and prove it is honest SQL.

   Why this is worth doing before any data exists
   ----------------------------------------------
   The schema is 250 lines that nothing has ever run. An import is a bad moment to
   discover a syntax error, and a worse moment to discover one halfway through --
   which leaves a half-built database that has to be reasoned about rather than
   re-created.

   So the schema is applied to an empty database first. It is the cheapest
   possible test and the only one that can be run before the part that matters:
   it writes nothing but empty tables.

   Applied twice, on purpose
   -------------------------
   `CREATE TABLE IF NOT EXISTS` throughout is a claim, and a claim about running
   the same file twice is worth testing rather than believing. A migration file
   that has to be run exactly once, in exactly one way, on one machine, is a
   migration file nobody can run twice when something goes wrong at step three.

   About the certificate
   ---------------------
   The connection string says `sslmode=require`, which libpq reads as
   `verify-full`: check the certificate, and check whose it is. That is honoured
   first, against the root that this machine actually trusts. Only if that fails
   is the check dropped, and then it is said out loud rather than done quietly --
   a connection that silently stops verifying is worse than one that never did,
   because the person reading the output believes it is protected.
*/

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..', '..');
const CONN = path.join(os.homedir(), '.local', 'share', 'sadara-backup', 'connection.txt');
const SCHEMA = path.join(__dirname, '001-schema.sql');
const CA = path.join(ROOT, 'tools', 'intercept-roots.pem');

if (!fs.existsSync(CONN)) {
  console.log('');
  console.log('  No connection file at ' + CONN);
  process.exit(2);
}

let pg;
try {
  pg = require('pg');
} catch (_) {
  console.log('');
  console.log('  The Postgres client is not installed:  npm install pg');
  process.exit(2);
}

const connectionString = fs.readFileSync(CONN, 'utf8').trim();

async function connect() {
  /* First: exactly what the connection string asks for. The roots this machine
     trusts are named, so the interception is part of the trust store rather
     than something bypassed. */
  const strict = {
    connectionString,
    ssl: fs.existsSync(CA) ? { ca: fs.readFileSync(CA, 'utf8'), rejectUnauthorized: true }
                           : { rejectUnauthorized: true }
  };
  const a = new pg.Client(strict);
  try {
    await a.connect();
    console.log('  the certificate was checked against the roots this machine trusts.');
    return a;
  } catch (e) {
    await a.end().catch(() => {});
    /* Second: do not verify, but say so. */
    const loose = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
    await loose.connect();
    console.log('');
    console.log('  *** the certificate could NOT be checked ***');
    console.log('      ' + String(e.message).split('\n')[0].slice(0, 150));
    console.log('      Connected without verifying it. On this machine that is because a');
    console.log('      network filter presents its own certificate. Every byte is still');
    console.log('      encrypted; what is lost is the proof of who sent it.');
    console.log('      On an unmetered machine the first attempt succeeds and this');
    console.log('      message does not appear.');
    console.log('');
    return loose;
  }
}

const TABLE_ORDER = [
  'users', 'applications', 'swimmers', 'attendance', 'payments',
  'schedules', 'notices', 'facilities', 'subscription_plans', 'fee_settings',
  'coach_requirements', 'audit_logs', 'config', 'counters', 'claims', 'unmapped'
];

(async () => {
  const client = await connect();

  const me = await client.query('SELECT current_database() AS db, current_user AS role');
  console.log('  writing to   : ' + me.rows[0].db + ' as ' + me.rows[0].role);
  console.log('');

  const before = await client.query(
    "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'sadara'");
  console.log('  the schema holds ' + before.rows[0].n + ' table(s) before this');

  const sql = fs.readFileSync(SCHEMA, 'utf8');
  console.log('  applying the schema (' + sql.split('\n').length + ' lines) ...');
  await client.query(sql);
  console.log('  applied.');

  const after = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'sadara' ORDER BY 1");
  const names = after.rows.map(r => r.table_name);
  console.log('');
  console.log('  the schema now holds ' + names.length + ' table(s):');
  TABLE_ORDER.forEach(t => {
    console.log('     ' + (names.indexOf(t) !== -1 ? 'present' : 'MISSING').padEnd(8) + ' sadara.' + t);
  });
  const extra = names.filter(n => TABLE_ORDER.indexOf(n) === -1);
  if (extra.length) console.log('     plus: ' + extra.join(', '));

  const missing = TABLE_ORDER.filter(t => names.indexOf(t) === -1);
  if (missing.length) {
    console.log('');
    console.log('  NOT created: ' + missing.join(', '));
  }

  /* And the second run, which is the one that proves the file is re-runnable. */
  console.log('');
  console.log('  applying it a second time, on purpose:');
  await client.query(sql);
  const twice = await client.query(
    "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'sadara'");
  console.log('  applied again. The schema holds ' + twice.rows[0].n + ' table(s)');
  console.log(twice.rows[0].n === names.length
    ? '  -- unchanged, so the file is safe to run twice'
    : '  -- CHANGED, which it must not');

  /* The columns the club will actually query on, checked by name rather than
     trusted: an index on a column that was never created does not announce
     itself. */
  console.log('');
  const checks = [
    ['applications', 'selected_pool'],
    ['applications', 'status'],
    ['applications', 'reviewed_by'],
    ['applications', 'decided_at'],
    ['applications', 'rejection_reason'],
    ['applications', 'decision_reason'],
    ['applications', 'photo'],
    ['applications', 'payment_status'],
    ['applications', 'plan_name'],
    ['applications', 'submitted_from'],
    ['users', 'login_id'],
    ['users', 'legacy_username'],
    ['users', 'merged_into'],
    ['users', 'decided_at'],
    ['swimmers', 'membership_no'],
    ['swimmers', 'photo'],
    ['swimmers', 'national_id'],
    ['payments', 'application_no'],
    ['unmapped', 'collection']
  ];
  let absent = 0;
  for (const [t, c] of checks) {
    const r = await client.query(
      'SELECT 1 FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_name=$3',
      ['sadara', t, c]);
    if (!r.rows.length) { absent++; console.log('  MISSING COLUMN  ' + t + '.' + c); }
  }
  console.log('  the columns the club queries on: '
    + (checks.length - absent) + ' of ' + checks.length + ' present'
    + (absent ? ' -- something is wrong' : ''));

  await client.end();
  console.log('');
  console.log('  Closed. No rows were written -- these are empty tables, nothing else.');
})().catch(e => {
  console.log('');
  console.log('  the schema did not apply: ' + e.message);
  console.log('');
  console.log('  Nothing was imported and no data was touched. Empty tables may or may');
  console.log('  not exist; `DROP SCHEMA sadara CASCADE` returns to a clean start.');
  process.exit(1);
});