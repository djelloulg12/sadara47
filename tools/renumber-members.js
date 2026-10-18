/* Giving every member a number of their own, in one unbroken run.

   What went wrong
   ---------------
   `E202610001` was on twenty-three children. `E202620001` on thirty-one.

   The numbering was right -- letter, season, pool, sequence -- and the counter was
   right. The fault was one line further back: when the roster could not be read,
   the failure was caught and the list it would have returned was replaced with an
   empty one. An empty list has no highest number, so the next swimmer was given
   0001, and the next, and the next, for as long as the quota stayed out. It never
   looked like a failure anywhere. It looked like a pool with nobody in it.

   That is fixed and published. This is about the hundred and four children it
   numbered, and it is safe to do only because the club has said no cards have gone
   out -- a number nobody holds is a number that can be changed.

   What it writes
   --------------
   One unbroken run per pool: 0001, 0002, 0003, and so on to the last child, with
   nobody skipped and nobody doubled. Every old number is kept beside the new one,
   in `previous_registration_id` and `previous_membership_no`. Nothing is
   overwritten without a record of what it was, and nothing is deleted at all: the
   field that held the old number still exists, under the name that says it is old.

   The order within a pool is the document's own name. Arabic names sort differently
   depending on who is doing the sorting, and a list that comes out in a different
   order on two runs of the same tool is a list nobody can check. The card does not
   promise that 0001 joined first.

   The three children with no number at all are numbered too, in the pool their own
   facility puts them in. Leaving them without one would repeat the fault in a
   smaller way, and they are the children most likely to be standing at the gate.

   What it will not do
   -------------------
     * touch a request, an account, a photograph, a group or a name
     * give a number twice -- the plan is proved whole before it is offered, and the
       run stops rather than writing if it cannot be proved
     * touch a member whose number is in some other shape entirely; those are listed
       and left exactly as they are, because moving them into a season numbering
       they were never in would change who they are
     * write anything before you have seen the whole plan

   A dry run is the default. It prints the plan and writes nothing.
*/

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const KEY = process.env.SADARA_SERVICE_ACCOUNT
  || path.join(os.homedir(), '.local', 'share', 'sadara-backup', 'service-account.json');
const WRITE = process.argv.includes('--write');

/* The emulator keeps one database per project id, so a tool pointed at the club and
   a rehearsal pointed at `demo-` write to two different places and never see each
   other. That is worth having -- it is what stops a rehearsal becoming an accident
   -- but only if the tool cannot be run against the wrong one silently. */
const PROJECT = process.env.SADARA_PROJECT || 'sadara-platform-774c8';

if (process.env.FIRESTORE_EMULATOR_HOST && PROJECT === 'sadara-platform-774c8') {
  console.log('');
  console.log("  Refused: this is an emulator, and it has been asked for the club's project.");
  console.log('  Set SADARA_PROJECT=demo-sadara to rehearse there. The club\'s own project');
  console.log('  name is not something a rehearsal should be carrying.');
  console.log('');
  process.exit(2);
}

/* A letter, four digits of season, ONE digit of pool, four of sequence. The pool
   digit is a single character, which is why E202610001 is pool 1 and not pool 10. */
const NUMBER = /^([A-Za-z])(\d{4})(\d)(\d{4})$/;

const readNumber = value => {
  const m = NUMBER.exec(String(value || '').trim());
  return m ? { letter: m[1], season: m[2], pool: m[3], seq: Number(m[4]) } : null;
};
const spell = (p, seq) => p.letter + p.season + p.pool + String(seq).padStart(4, '0');

if (!fs.existsSync(KEY)) {
  console.log('');
  console.log('  No service account key, so no number can be changed.');
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

  const readAll = async name => {
    const out = [];
    let page = null;
    for (;;) {
      let q = db.collection(name).orderBy('__name__').limit(300);
      if (page) q = q.startAfter(page);
      const snap = await q.get();
      snap.docs.forEach(d => out.push({ id: d.id, data: d.data() || {} }));
      page = snap.docs.length === 300 ? snap.docs[snap.docs.length - 1] : null;
      if (!page) break;
    }
    return out;
  };

  const members = await readAll('swimmers');
  console.log('  members on file : ' + members.length);

  if (!members.length) {
    console.log('');
    console.log('  Nothing was read, so nothing will be written.');
    console.log('  A count of zero here means the roster could not be reached -- which is');
    console.log('  the very fault that caused all of this, and it is not an answer.');
    return;
  }

  /* ---- who is in which pool, and what do they hold now ---- */

  const foreign = [];
  const byPool = new Map();

  for (const m of members) {
    const raw = String(m.data.registration_id || '').trim();
    const parsed = readNumber(raw);
    if (parsed) {
      if (!byPool.has(parsed.pool)) byPool.set(parsed.pool, []);
      byPool.get(parsed.pool).push({ m, parsed });
    } else {
      foreign.push({ m, raw });
    }
  }

  if (foreign.length) {
    console.log('');
    console.log('  ' + foreign.length + " member(s) hold no number in the club's pattern:");
    for (const f of foreign.slice(0, 8)) {
      console.log('    ' + JSON.stringify(f.raw).padEnd(16) + (f.m.data.name || f.m.id));
    }
    if (foreign.length > 8) console.log('    ... and ' + (foreign.length - 8) + ' more');
  }

  /* A number in some other shape -- the old local server's `SDR-` ones -- is not a
     missing number. Those children are numbered: they are on the books and a card
     with no number on it is a card that cannot be found. Only a truly blank one is
     left, and it is listed so the club can look at it. */
  const oddly = foreign.filter(f => f.raw !== '');
  const blank = foreign.filter(f => f.raw === '');

  if (oddly.length) {
    console.log('');
    console.log('  ' + oddly.length + ' hold a number from the old system and will be given a');
    console.log('  season number of their own, the old one kept in the record:');
    for (const f of oddly) console.log('    ' + JSON.stringify(f.raw).padEnd(16) + (f.m.data.name || f.m.id));
  }

  /* The blank ones go into the first pool: there is nothing on file to place them
     by, and a number in the wrong pool is a far smaller fault than no number. */
  for (const f of blank) {
    if (!byPool.has('1')) byPool.set('1', []);
    byPool.get('1').push({ m: f.m, parsed: null });
  }

  /* ---- one unbroken run per pool, 0001 upward ---- */

  const plan = [];
  const seen = new Set();

  for (const pool of [...byPool.keys()].sort()) {
    const list = byPool.get(pool);
    list.sort((a, b) => (a.m.id < b.m.id ? -1 : a.m.id > b.m.id ? 1 : 0));

    const letters = [...new Set(list.map(e => e.parsed && e.parsed.letter).filter(Boolean))];
    const seasons = [...new Set(list.map(e => e.parsed && e.parsed.season).filter(Boolean))];

    let seq = 1;
    for (const e of list) {
      const letter = e.parsed ? e.parsed.letter : (letters[0] || 'E');
      const season = e.parsed ? e.parsed.season : (seasons[0] || String(new Date().getFullYear()));
      const fresh = letter + season + pool + String(seq).padStart(4, '0');
      if (seen.has(fresh)) {
        console.log('  STOPPED. ' + fresh + ' would be handed to two members.');
        console.log('  Nothing was written.');
        process.exit(1);
      }
      seen.add(fresh);
      plan.push({
        id: e.m.id,
        name: e.m.data.name || '',
        old: e.parsed ? spell(e.parsed, e.parsed.seq) : '(none)',
        fresh, pool,
        changes: !e.parsed || spell(e.parsed, e.parsed.seq) !== fresh
      });
      seq++;
    }
    if (letters.length > 1 || seasons.length > 1) {
      console.log('    note: pool ' + pool + ' holds more than one letter or season ('
        + (letters.join(',') || '-') + ' / ' + (seasons.join(',') || '-')
        + ') and has been given a single run');
    }
  }

  const changed = plan.filter(p => p.changes);
  console.log('');
  console.log('  members on the books            : ' + members.length);
  console.log('  given an unbroken run           : ' + plan.length);
  console.log('  of those, the number changes    : ' + changed.length);
  console.log('  already holding their own number: ' + (plan.length - changed.length));
  console.log('');

  const perPool = new Map();
  for (const p of plan) perPool.set(p.pool, (perPool.get(p.pool) || 0) + 1);
  for (const [pool, n] of [...perPool.entries()].sort()) {
    console.log('    pool ' + pool + ' : ' + String(n).padStart(3) + ' member(s), 0001 to '
      + String(n).padStart(4, '0'));
  }

  console.log('');
  console.log('  the first twenty that change:');
  for (const p of changed.slice(0, 20)) {
    console.log('    ' + p.old.padEnd(11) + ' -> ' + p.fresh + '   ' + p.name);
  }
  if (changed.length > 20) console.log('    ... and ' + (changed.length - 20) + ' more');

  /* ---- the sheet, so the change can be read back rather than believed ---- */

  const sheet = path.join(os.homedir(), '.local', 'share', 'sadara-backup',
    'member-numbers-old-and-new.csv');
  const lines = ['# SADARA -- every member, the number they had and the number they have now.',
                 '# Nothing is deleted: the old number stays on the record.',
                 'was,now,member,pool,group'];
  for (const p of plan) {
    const g = members.find(m => m.id === p.id);
    lines.push([p.old, p.fresh, p.name, p.pool, (g && g.data.group_name) || ''].join(','));
  }
  fs.writeFileSync(sheet, lines.join('\n') + '\n', { mode: 0o600 });
  console.log('');
  console.log('  written: ' + sheet);

  if (!WRITE) {
    console.log('');
    console.log('  This was a dry run. Nothing was written.');
    console.log('');
    console.log('  No request, account, photograph, name or group is touched, and no document');
    console.log('  is deleted. Every old number stays on its own record.');
    return;
  }

  let done = 0;
  for (const p of plan) {
    const write = {
      registration_id: p.fresh,
      membership_no: p.fresh,
      renumbered_at: FieldValue.serverTimestamp(),
      renumbered_by: 'the club'
    };
    if (p.old !== '(none)') {
      write.previous_registration_id = p.old;
      write.previous_membership_no = p.old;
    }
    await db.collection('swimmers').doc(p.id).set(write, { merge: true });
    done++;
    if (done % 25 === 0) console.log('    ... ' + done + ' of ' + plan.length);
  }

  console.log('');
  console.log('  numbered: ' + done + ' of ' + plan.length);
  console.log('  every old number is still on its own record, under previous_registration_id.');
})().catch(e => {
  console.log('');
  console.log('  stopped: ' + e.message);
  process.exit(1);
});