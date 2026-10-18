/* Asking the question afterwards, rather than trusting the tool that answered it.

   The renumbering says it wrote a number to everybody. This asks the database
   whether that is true -- separately, with its own read, in its own words -- and
   answers in a form that can be read by somebody who has no reason to believe
   anything.

   It also asks the second question, which is the one the first one makes easy to
   forget: is the run actually a run. A book where every number is different but
   they run 0001, 0003, 0007 and 0900 is not a numbered book; it is a book with
   holes in it, and the holes are what the next child falls into.

   Exits non-zero if anything is wrong, so it can be the last thing a change runs.
*/

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const KEY = process.env.SADARA_SERVICE_ACCOUNT
  || path.join(os.homedir(), '.local', 'share', 'sadara-backup', 'service-account.json');
const PROJECT = process.env.SADARA_PROJECT || 'sadara-platform-774c8';

if (process.env.FIRESTORE_EMULATOR_HOST && PROJECT === 'sadara-platform-774c8') {
  console.log('');
  console.log("  Refused: an emulator cannot be asked about the club's own book.");
  console.log('');
  process.exit(2);
}

const NUMBER = /^([A-Za-z])(\d{4})(\d)(\d{4})$/;
const readNumber = value => {
  const m = NUMBER.exec(String(value || '').trim());
  return m ? { letter: m[1], season: m[2], pool: m[3], seq: Number(m[4]) } : null;
};

if (!fs.existsSync(KEY)) {
  console.log('');
  console.log('  No service account key, so nothing can be checked.');
  console.log('  Expected: ' + KEY);
  console.log('');
  process.exit(2);
}

(async () => {
  initializeApp({
    credential: cert(JSON.parse(fs.readFileSync(KEY, 'utf8'))),
    projectId: PROJECT
  });
  const db = getFirestore();

  const members = [];
  let page = null;
  for (;;) {
    let q = db.collection('swimmers').orderBy('__name__').limit(300);
    if (page) q = q.startAfter(page);
    const snap = await q.get();
    snap.docs.forEach(d => members.push({ id: d.id, data: d.data() || {} }));
    page = snap.docs.length === 300 ? snap.docs[snap.docs.length - 1] : null;
    if (!page) break;
  }

  if (!members.length) {
    console.log('');
    console.log('  Nothing was read. That is not a clean book, it is an unreachable one.');
    console.log('');
    process.exit(1);
  }

  const holders = new Map();
  const unnumbered = [];
  const otherShape = [];
  const byPool = new Map();

  for (const m of members) {
    const raw = String(m.data.registration_id || '').trim();
    const parsed = readNumber(raw);
    if (!parsed) {
      (raw ? otherShape : unnumbered).push(m);
      continue;
    }
    const key = raw.toUpperCase();
    if (!holders.has(key)) holders.set(key, []);
    holders.get(key).push(m);
    if (!byPool.has(parsed.pool)) byPool.set(parsed.pool, []);
    byPool.get(parsed.pool).push(parsed.seq);
  }

  const shared = [...holders.entries()].filter(([, v]) => v.length > 1);

  console.log('');
  console.log('  members on the books                 : ' + members.length);
  console.log('  carrying a number                    : '
    + (members.length - unnumbered.length - otherShape.length));
  console.log('  carrying no number at all            : ' + unnumbered.length);
  console.log('  carrying a number of another shape   : ' + otherShape.length);
  console.log('  distinct numbers in use              : ' + holders.size);
  console.log('  numbers held by more than one member : ' + shared.length);
  console.log('');

  for (const [key, v] of shared.slice(0, 12)) {
    console.log('    ' + key + ' is on ' + v.length + ': '
      + v.slice(0, 5).map(m => m.data.name || m.id).join(' / '));
  }
  if (shared.length > 12) console.log('    ... and ' + (shared.length - 12) + ' more');
  for (const m of unnumbered.slice(0, 8)) {
    console.log('    no number: ' + (m.data.name || m.id));
  }

  console.log('');
  console.log('  each pool, and whether its run has any hole in it:');
  let holes = 0;
  for (const pool of [...byPool.keys()].sort()) {
    const seqs = byPool.get(pool);
    const uniq = [...new Set(seqs)].sort((a, b) => a - b);
    const highest = uniq[uniq.length - 1];
    const missing = [];
    for (let i = 1; i <= highest; i++) if (uniq.indexOf(i) === -1) missing.push(i);
    holes += missing.length;
    console.log('    pool ' + pool + ' : ' + String(uniq.length).padStart(3)
      + ' members, 0001 to ' + String(highest).padStart(4, '0')
      + (missing.length ? '   GAPS at ' + missing.slice(0, 8).map(n => String(n).padStart(4, '0')).join(' ')
                         + (missing.length > 8 ? ' ...' : '')
                         + ' (' + missing.length + ')' : '   no gaps'));
  }

  const bad = shared.length || unnumbered.length || otherShape.length || holes;
  console.log('');
  if (bad) {
    console.log('  NOT CLEAN. ' + shared.length + ' shared, ' + unnumbered.length
      + ' with no number, ' + otherShape.length + ' of another shape, ' + holes + ' gaps.');
    process.exit(1);
  }
  console.log('  CLEAN. Every member has a number of their own, and every pool runs without');
  console.log('  a gap from 0001 to the last child.');
})().catch(e => {
  console.log('');
  console.log('  stopped: ' + e.message);
  process.exit(1);
});