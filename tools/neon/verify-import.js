/* Neon against the snapshot, row by row. Not a count -- a comparison.

   Why a count is not enough
   ------------------------
   "574 in the database" and "574 in the snapshot" agree on the day the last
   request is written. They also agree when every photograph came out empty, when
   a name lost a diacritic, and when a status quietly became a space instead of
   null. A row count cannot tell those apart, and all three are the kind of loss
   nobody notices until somebody asks for a document that is quietly wrong.

   So this compares the thing that was actually read. `raw` holds each document as
   Firestore returned it -- whole, untyped, untranslated -- and it is hashed per
   row. Two hashes matching means those are the same bytes of the same document,
   which is a different and much stronger claim than "the counts are the same".

   And it goes both ways: documents in the snapshot that are missing from Neon,
   and rows in Neon that the snapshot never had. The second kind is the one that
   matters after an import that never deletes -- an extra row means somebody's
   data is in there that the club has not seen, and that is worth knowing about.

   Read-only throughout. Nothing is written, and nothing is corrected: a mismatch
   is reported, not fixed, because fixing it silently is how a verification
   becomes a repair that nobody asked for.
*/

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const SNAPSHOT = process.argv[2];
const CONN = process.argv[3];

if (!SNAPSHOT || !CONN || !fs.existsSync(SNAPSHOT) || !fs.existsSync(CONN)) {
  console.log('');
  console.log('  Needs two things: the snapshot folder, and the connection file.');
  console.log('    node tools/neon/verify-import.js "<snapshot>" "<connection file>"');
  process.exit(2);
}

const pg = require('pg');

/* Firestore hands back its map keys in whatever order it likes, and JSON.stringify
   keeps that order. So the two sides are sorted into the same shape before being
   hashed -- otherwise a document that changed nothing would compare unequal
   because its keys arrived shuffled, and every row would be reported as
   different, which is a false alarm that trains people to ignore the tool. */
function canonical(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonical);
  const out = {};
  for (const k of Object.keys(value).sort()) out[k] = canonical(value[k]);
  return out;
}

const digest = v => crypto.createHash('sha256')
  .update(JSON.stringify(canonical(v))).digest('hex');

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(SNAPSHOT, 'MANIFEST.json'), 'utf8'));

  const client = new pg.Client({
    connectionString: fs.readFileSync(CONN, 'utf8').trim(),
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const me = await client.query('SELECT current_database() AS db, current_user AS role');
  console.log('  comparing Neon against the snapshot');
  console.log('  database : ' + me.rows[0].db + '  as  ' + me.rows[0].role);
  console.log('  snapshot : ' + manifest.takenAt);
  console.log('');

  let totalSnapshot = 0;
  let totalDatabase = 0;
  const problems = [];

  console.log('  ' + 'collection'.padEnd(22) + 'snapshot'.padStart(9) + 'neon'.padStart(9)
    + '  identical  different');
  console.log('  ' + '-'.repeat(66));

  for (const [name, info] of Object.entries(manifest.collections)) {
    const text = fs.readFileSync(path.join(SNAPSHOT, info.file), 'utf8');
    const want = new Map();
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      const doc = JSON.parse(line);
      want.set(doc.path, digest(doc.data || {}));
    }
    totalSnapshot += want.size;

    let have;
    try {
      have = await client.query(
        'SELECT firestore_path, raw FROM sadara.' + name.replace(/[^\w-]/g, '_'));
    } catch (e) {
      problems.push(name + ': no table, or not readable -- ' + e.message.split('\n')[0]);
      console.log('  ' + name.padEnd(22) + String(want.size).padStart(9) + '     --  not readable');
      continue;
    }

    const got = new Map(have.rows.map(r => [r.firestore_path, digest(r.raw)]));
    totalDatabase += got.size;

    let same = 0;
    const differ = [];
    for (const [k, v] of want) {
      if (!got.has(k)) continue;
      if (got.get(k) === v) same++;
      else differ.push(k);
    }
    const absent = [...want.keys()].filter(k => !got.has(k));
    const extra = [...got.keys()].filter(k => !want.has(k));

    console.log('  ' + name.padEnd(22) + String(want.size).padStart(9) + String(got.size).padStart(9)
      + '  ' + String(same).padStart(9) + '  ' + String(differ.length).padStart(8));

    if (absent.length) problems.push(name + ': ' + absent.length + ' in the snapshot, not in Neon');
    if (extra.length) problems.push(name + ': ' + extra.length + ' in Neon, not in the snapshot');
    if (differ.length) problems.push(name + ': ' + differ.length + ' documents differ (e.g. ' + differ[0] + ')');
  }

  console.log('  ' + '-'.repeat(66));
  console.log('  ' + 'TOTAL'.padEnd(22) + String(totalSnapshot).padStart(9) + String(totalDatabase).padStart(9));

  await client.end();
  console.log('');

  if (!problems.length) {
    console.log('  Every document is present, and every one of them is byte for byte the');
    console.log('  document the snapshot holds. Nothing differs, nothing is missing, and');
    console.log('  nothing is in Neon that the club has not seen.');
  } else {
    console.log('  What does not match:');
    problems.forEach(p => console.log('    - ' + p));
    console.log('');
    console.log('  Nothing was changed to make these agree. A verification that quietly');
    console.log('  repairs is a repair nobody asked for.');
  }
  console.log('');
  console.log('  Read-only. Nothing was written while checking.');
})().catch(e => {
  console.log('');
  console.log('  the check stopped: ' + e.message);
  process.exit(1);
});