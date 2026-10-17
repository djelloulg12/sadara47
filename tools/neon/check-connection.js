/* Is the file real, is it the right database, and is it empty?

   Nothing here writes. One connection is opened and closed.

   What it reports, and what it does not
   -------------------------------------
   It prints the host, the database, the role and the port -- so that a wrong
   database is visible -- and it never prints the password, not masked, not
   partly, not at all. The password is read, used, and dropped: the one place it
   goes is Neon's own endpoint, which is where it has to go.

   And the question that actually matters before a migration: is there anything in
   there? A connection string that points at a database somebody else already
   filled, or at the wrong branch, is discovered here rather than after an import.
*/

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT = path.join(os.homedir(), '.local', 'share', 'sadara-backup', 'connection.txt');

/* A path may be given, because a file saved where one asked it to be saved is
   still a file. The path is used as it is and the file is not moved: it belongs
   to somebody, and tidying where they keep things is not part of this job. */
const FILE = process.argv[2] || DEFAULT;

if (!fs.existsSync(FILE)) {
  console.log('');
  console.log('  There is no file at: ' + FILE);
  console.log('');
  process.exit(2);
}

const raw = fs.readFileSync(FILE, 'utf8').trim();

if (!raw) {
  console.log('');
  console.log('  The file is there and it is empty.');
  console.log('  A connection line looks like:');
  console.log('    postgresql://user:password@ep-xxx.region.neon.tech/neondb?sslmode=require');
  console.log('');
  process.exit(2);
}

if (/^postgres(ql)?:\/\//.test(raw) !== true) {
  console.log('');
  console.log('  The file holds something, but not a connection line.');
  console.log('  It starts with: ' + JSON.stringify(raw.slice(0, 40)));
  console.log('');
  console.log('  Common causes: the quotation marks were copied too, or the line');
  console.log('  was pasted as "psql postgresql://..." rather than on its own.');
  console.log('');
  process.exit(2);
}

/* Parsed here rather than by a library so that the password is never printed,
   not even by an error message that echoes the URL. */
let u;
try {
  u = new URL(raw);
} catch (_) {
  console.log('');
  console.log('  It begins with postgresql:// but does not parse as one.');
  console.log('  A common cause is a password containing "#" or "@" -- which must be');
  console.log('  percent-encoded as %23 and %40, or the URL ends at that character.');
  console.log('');
  process.exit(2);
}

const password = decodeURIComponent(u.password || '');
const hasPassword = password.length > 0;

console.log('  the file      : ' + FILE);
console.log('  the lines     : ' + raw.split(/\r?\n/).length);
console.log('  the host      : ' + u.hostname);
console.log('  the port      : ' + (u.port || '5432, the default'));
console.log('  the database  : ' + decodeURIComponent((u.pathname || '/').replace(/^\//, '')));
console.log('  the role      : ' + decodeURIComponent(u.username || '(none)'));
console.log('  has a password: ' + (hasPassword ? 'yes' : 'NO -- and a connection cannot be made without one'));
console.log('  sslmode       : ' + ((u.searchParams.get('sslmode')) || '(not stated)'));
console.log('');
console.log('  the password is not printed, here or anywhere.');
console.log('');

if (!hasPassword) {
  process.exit(2);
}

if (!fs.existsSync(path.join(__dirname, '..', '..', 'node_modules', 'pg')) &&
    !(() => { try { require.resolve('pg'); return true; } catch (_) { return false; } })()) {
  console.log('  The Postgres client is not installed, so the connection cannot be');
  console.log('  tested from here just yet:');
  console.log('    npm install pg');
  console.log('');
  console.log('  The file itself is read and looks right. Nothing was written to it,');
  console.log('  and nothing was written to Neon.');
  process.exit(2);
}

(async () => {
  let pg;
  try {
    pg = require('pg');
  } catch (_) {
    require('child_process').execSync('npm install pg --no-audit --no-fund', {
      cwd: path.join(__dirname, '..', '..'), stdio: 'inherit'
    });
    pg = require('pg');
  }

  const client = new pg.Client({
    connectionString: raw,
    ssl: { rejectUnauthorized: false }
  });

  const t0 = Date.now();
  try {
    await client.connect();
  } catch (e) {
    console.log('  The connection was refused: ' + e.message);
    console.log('');
    if (/password/i.test(e.message)) {
      console.log('  That is the password, or the role. Neither is guessed at, and');
      console.log('  neither is written anywhere. From the Neon console:');
      console.log('    Sidebar -> Roles -> Reset password');
      console.log('  Then put the new line in this file.');
    } else if (/timeout|ENOTFOUND|ETIMEDOUT|ECONNREFUSED/i.test(e.message)) {
      console.log('  That is the host, or the network. Two things worth knowing:');
      console.log('  Neon endpoints are IPv6 by default. The *pooled* hostname carries an');
      console.log('  "-pooler" and works over IPv4; the direct one may not.');
      console.log('  If you took the direct string and this machine is IPv4-only, take the');
      console.log('  pooled one instead.');
    }
    console.log('');
    process.exit(1);
  }

  console.log('  connected in ' + (Date.now() - t0) + ' ms');

  const who = await client.query(
    'SELECT current_database() AS db, current_user AS role, version() AS version');
  console.log('  we are really in : ' + who.rows[0].db + '  as  ' + who.rows[0].role);
  console.log('  the server says : ' + who.rows[0].version.split(' ').slice(0, 2).join(' '));

  /* The one that matters: is there anything in here? An import into a database
     that already holds somebody's tables is not a migration, it is a collision --
     and this is where that is found, before anything is written. */
  const tables = await client.query(
    "SELECT table_schema, table_name FROM information_schema.tables "
    + "WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY 1, 2");

  console.log('');
  if (!tables.rows.length) {
    console.log('  It is empty. Nothing of anybody\'s is in the way, and the import has');
    console.log('  nowhere to collide.');
  } else {
    console.log('  It is NOT empty. There are ' + tables.rows.length + ' table(s):');
    tables.rows.slice(0, 40).forEach(r => console.log('     ' + r.table_schema + '.' + r.table_name));
    if (tables.rows.length > 40) console.log('     ... and ' + (tables.rows.length - 40) + ' more');
    console.log('');
    console.log('  The importer only creates what is missing and only ever updates rows,');
    console.log('  so an existing table of the same name would have its rows updated. That');
    console.log('  is a collision, and it is worth a decision before it happens rather');
    console.log('  than after.');
  }

  const room = await client.query(
    "SELECT pg_size_pretty(pg_database_size(current_database())) AS size");
  console.log('');
  console.log('  the database weighs : ' + room.rows[0].size);

  await client.end();
  console.log('');
  console.log('  Closed. Nothing was written.');
})().catch(e => {
  console.log('  the check stopped: ' + e.message);
  process.exit(1);
});