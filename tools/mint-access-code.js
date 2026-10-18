/* A code the club reads out over the telephone, once, and nobody else can use.

   Why this exists at all
   ----------------------
   The club asked for this because a parent forgets a password, and the free path
   that already exists -- "forgot password", a link by email -- needs the parent to
   reach an inbox. Some of them cannot, on the day they need it.

   What it does
   ------------
   The manager picks a member, and this writes one short code into Firestore. The
   member telephones, the manager reads the code out, the member types it into the
   page, the page hands it to the club's own script, and the script hands back a
   sign-in token that lets them choose their own password.

   What it is not
   --------------
   It is not a password. The code never becomes one, is never stored beside one,
   and cannot be turned into one. Whoever holds it can set a password and nothing
   else -- and once used it is dead, so the telephone call has to be the last time
   anyone says it aloud.

   Six characters, and only the ones a person can read out
   -------------------------------------------------------
   No 0 or O, no 1 or l. A code that is misread on the telephone is a code that
   fails, and a family standing in a queue at ten in the morning has been on the
   telephone long enough already. Twelve bits of entropy is enough here precisely
   because a wrong guess changes nothing and a correct one is good for fifteen
   minutes and one use.

   What it will not do
   -------------------
     * mint for the owner, or for anybody holding a staff role
     * live longer than fifteen minutes
     * be usable twice, even by the manager
     * touch an account, a request or a swimmer -- it writes one small document
       into a collection of its own and deletes it when it is spent

   A dry run is the default: it prints the member, the code, and the minute it
   stops working, and writes nothing.
*/

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const KEY = process.env.SADARA_SERVICE_ACCOUNT
  || path.join(os.homedir(), '.local', 'share', 'sadara-backup', 'service-account.json');
const WRITE = process.argv.includes('--write');
const MINUTES = Number((process.argv.find(a => a.startsWith('--minutes=')) || '').split('=')[1]) || 15;
/* The emulator keeps one database per project id, so a tool pointed at the club
   and a rehearsal pointed at `demo-` write to two different places and never see
   each other. That is worth having -- it is what stops a rehearsal becoming an
   accident -- but only if the tool cannot be run against the wrong one silently.
   So the project comes from the environment, and pointing the tool at an emulator
   while still naming the club's project is refused outright. */
const PROJECT = process.env.SADARA_PROJECT || 'sadara-platform-774c8';

if (process.env.FIRESTORE_EMULATOR_HOST && PROJECT === 'sadara-platform-774c8') {
  console.log('');
  console.log('  Refused: this is an emulator, and it is being asked for the club\'s project.');
  console.log('  Set SADARA_PROJECT=demo-sadara to rehearse there. The club\'s own project');
  console.log('  name is not something a rehearsal should carry.');
  console.log('');
  process.exit(2);
}

/* Said over a telephone, by somebody who is not reading carefully. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const STAFF_ROLES = ['admin', 'owner', 'president', 'manager', 'مدير', 'رئيس'];

const arg = name => {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : '';
};
const EMAILS = (arg('--email') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

function sayCode() {
  let out = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function fold(v) {
  return String(v === undefined || v === null ? '' : v)
    .normalize('NFKD')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/[ىي]/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim().toLowerCase();
}

if (!fs.existsSync(KEY)) {
  console.log('');
  console.log('  No service account key, so no code can be minted.');
  console.log('  Expected: ' + KEY);
  console.log('');
  process.exit(2);
}

if (!EMAILS.length) {
  console.log('');
  console.log('  Nobody was named, so no code was made.');
  console.log('');
  console.log('    --email a@b.com,d@e.com   the members to make a code for');
  console.log('    --minutes 15              how long it stays good (default 15)');
  console.log('    --write                   write it (without it, this only plans)');
  console.log('');
  process.exit(2);
}

(async () => {
  initializeApp({
    credential: cert(JSON.parse(fs.readFileSync(KEY, 'utf8'))),
    projectId: PROJECT
  });
  const db = getFirestore();

  let owners = [];
  try {
    const snap = await db.collection('config').doc('owners').get();
    if (snap.exists && Array.isArray(snap.data().emails)) owners = snap.data().emails;
  } catch (_) { /* an unreadable list must not become a permission */ }
  owners = owners.map(x => String(x).toLowerCase());

  console.log('  mode   : ' + (WRITE ? 'WRITE -- codes will be live' : 'dry run'));
  console.log('  good for: ' + MINUTES + ' minutes, one use each');
  console.log('');

  let minted = 0;
  let refused = 0;
  const issued = [];

  for (const email of EMAILS) {
    const live = await db.collection('users').where('email', '==', email).limit(1).get();
    const profile = live.empty ? {} : live.docs[0].data();
    const uid = live.empty ? '' : live.docs[0].id;

    const why = !uid ? 'no account'
      : owners.indexOf(email) !== -1 ? 'owner'
      : STAFF_ROLES.indexOf(fold(profile.role)) !== -1 ? 'staff'
      : !profile.email_verified ? 'email never verified, so recovery cannot be confirmed'
      : '';

    if (why) {
      console.log('  REFUSED (' + why + ')  ' + email);
      refused++;
      continue;
    }

    /* A code that is still good is not replaced. Two live codes for one person
       means one of them has been read out to somebody and the other has not, and
       only one of them can be retired without guessing which. */
    const open = await db.collection('access_codes').where('uid', '==', uid)
      .where('used_at', '==', null).limit(5).get();
    const liveNow = open.docs.filter(d => {
      const at = d.data().expires_at;
      const ms = at && at.toDate ? at.toDate().getTime() : 0;
      return ms > Date.now();
    });
    if (liveNow.length) {
      console.log('  kept     ' + email + '   one is already live until '
        + liveNow[0].data().expires_at.toDate().toLocaleTimeString());
      refused++;
      continue;
    }

    const code = sayCode();
    issued.push({ email, name: profile.name || profile.username || '', code, uid });

    if (!WRITE) {
      console.log('  would mint  ' + email.padEnd(34) + code);
      continue;
    }

    await db.collection('access_codes').add({
      code: fold(code),
      uid,
      email,
      name: profile.name || profile.username || '',
      minutes: MINUTES,
      by: 'the club',
      issued_at: FieldValue.serverTimestamp(),
      expires_at: new Date(Date.now() + MINUTES * 60000),
      used_at: null,
      used_from: null
    });
    console.log('  minted  ' + email.padEnd(34) + code + '   until '
      + new Date(Date.now() + MINUTES * 60000).toLocaleTimeString());
    minted++;
  }

  console.log('');
  console.log('  ' + (WRITE ? minted + ' minted, ' : '') + refused + ' refused');

  if (!WRITE) {
    console.log('  Nothing was written. No code is live.');
    return;
  }

  /* The sheet the manager reads from. On the desk, in the club's file -- never in
     git, never photographed, and thrown away the moment the calls are done. */
  const sheet = path.join(os.homedir(), '.local', 'share', 'sadara-backup', 'access-codes.csv');
  const lines = ['# SADARA -- one-time codes. Destroy this sheet once the calls are done. Do not commit.',
                 'code,member,email,good until'];
  const until = new Date(Date.now() + MINUTES * 60000).toLocaleTimeString();
  for (const r of issued) lines.push([r.code, r.name, r.email, until].join(','));
  fs.writeFileSync(sheet, lines.join('\n') + '\n', { mode: 0o600 });
  console.log('  written: ' + sheet);
  console.log('');
  console.log('  Read the code out, let them choose their own password, and burn this sheet.');
})().catch(e => {
  console.log('');
  console.log('  stopped: ' + e.message);
  process.exit(1);
});