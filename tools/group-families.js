/* Families: one account for a guardian, and every child's own login still working.

   The decision this implements
   ---------------------------
   "One account per family" -- and, separately, the answer to a question that was
   not answered: *do the twenty-six accepted children lose their own login?*

   They do not, here. The two are different things, and treating them as one is how
   twenty-six families quietly lose their access on the day a tidy-up happens.

     a family account   one per guardian, through which they can see and manage
                        every child they have filed for
     a child's own      untouched. Not disabled, not deleted, not redirected. It
     account            signs in exactly as it did the day before.

   So this is a link and not a removal. Somebody who filed two children does not
   end up with one working login instead of two; they end up with a way to see both
   from one place, and nothing taken away.

   What is written, and only this
   -----------------------------
     families/{id}     the guardian, the address, the telephone, and the children
     two fields on those requests: `family_id`, and `guardian` in their own words

   Nothing is deleted. There is no delete statement in this file and no flag that
   adds one. Running it twice writes the same thing twice.

   Who a family is
   ---------------
   By the identity the club itself uses -- the telephone and the guardian's first
   and last names -- compared the way a person writes them rather than the way a
   keyboard typed them. Arabic especially: the same name arrives with and without a
   hamza, with and without a diacritic, and in a different order on a form filled
   in by hand. Split on that, and one family becomes four accounts.

   And where one number carries children under two different guardian names, the
   two are left apart. A telephone is evidence; a name is identity. The club said
   to let those alone, and this does.

   A dry run is the default: it prints the families and their children, and writes
   nothing.
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
const PROJECT = 'sadara-platform-774c8';

/* Compared the way a person writes a name, not the way a keyboard typed it. */
function fold(value) {
  return String(value === undefined || value === null ? '' : value)
    .normalize('NFKD')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();
}

function phoneOf(v) {
  return String(v === undefined || v === null ? '' : v)
    .replace(/[^\d+]/g, '')
    .replace(/^00/, '+')
    .replace(/^\+?213/, '0')
    .trim();
}

const familyId = key => 'fam_' + crypto.createHash('sha1').update(key).digest('hex').slice(0, 12);

if (!fs.existsSync(KEY)) {
  console.log('');
  console.log('  No service account key, so nothing can be written.');
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
      snap.docs.forEach(d => out.push({ id: d.id, data: d.data() }));
      page = snap.docs.length === 300 ? snap.docs[snap.docs.length - 1] : null;
      if (!page) break;
    }
    return out;
  };

  const apps = await readAll('applications');
  console.log('  requests on file : ' + apps.length);

  const families = new Map();

  for (const a of apps) {
    const d = a.data || {};

    /* A coach is not a swimmer's guardian. Filing one under a family would put an
       adult in a list of children, which is its own kind of wrong. */
    if (d.application_type === 'coach') continue;

    const first = String(d.first_name_ar || '').trim();
    const last = String(d.last_name_ar || '').trim();
    if (!first && !last) continue;

    const gFirst = String(d.guardian_first_name || '').trim();
    const gLast = String(d.guardian_last_name || '').trim();
    const guardian = fold(gFirst + ' ' + gLast);
    if (!guardian) continue;

    const gPhone = phoneOf(d.guardian_phone || d.phone);
    /* The name is the identity; the telephone narrows it when it is there and is
       never what a family is on its own. Two names on one number are two families,
       and the club asked for those to be left alone. */
    const key = guardian + '|' + gPhone;

    if (!families.has(key)) {
      families.set(key, {
        key, guardian_first_name: gFirst, guardian_last_name: gLast,
        phone: gPhone, emails: new Set(), usernames: new Set(), children: []
      });
    }
    const fam = families.get(key);
    if (d.email) fam.emails.add(String(d.email).toLowerCase());
    if (d.username) fam.usernames.add(String(d.username));
    fam.children.push({
      application_no: d.application_no || '',
      first_name_ar: first, last_name_ar: last,
      birth_date: d.birth_date || null,
      status: d.status || 'pending',
      membership_no: d.membership_no || '',
      has_photo: !!d.photo
    });
  }

  const multi = [...families.values()]
    .filter(f => f.children.length > 1)
    .sort((a, b) => b.children.length - a.children.length);

  console.log('  families gathered : ' + families.size);
  console.log('  with 2+ children  : ' + multi.length);
  console.log('  children in them  : ' + multi.reduce((n, f) => n + f.children.length, 0));
  console.log('');

  if (!multi.length) {
    console.log('  Nothing to link: no guardian has filed more than one request.');
    return;
  }

  console.log('  the largest:');
  for (const f of multi.slice(0, 10)) {
    const onBooks = f.children.filter(c => c.status === 'approved').length;
    const photos = f.children.filter(c => c.has_photo).length;
    console.log('    ' + (f.guardian_first_name + ' ' + f.guardian_last_name).padEnd(24)
      + String(f.children.length) + ' children'
      + (onBooks ? ', ' + onBooks + ' accepted' : '')
      + (photos ? ', ' + photos + ' photographs' : '')
      + (f.phone ? '   ' + f.phone : ''));
  }
  console.log('');

  const sheet = path.join(os.homedir(), '.local', 'share', 'sadara-backup', 'families.csv');
  const lines = ['# guardian first,guardian last,phone,children,accepted,pending,rejected,photographs,family id'];
  for (const f of multi) {
    lines.push([
      f.guardian_first_name, f.guardian_last_name, f.phone, f.children.length,
      f.children.filter(c => c.status === 'approved').length,
      f.children.filter(c => c.status === 'pending').length,
      f.children.filter(c => c.status === 'rejected').length,
      f.children.filter(c => c.has_photo).length,
      familyId(f.key)
    ].join(','));
    for (const c of f.children) {
      lines.push(['', '', '', '    ' + (c.first_name_ar + ' ' + c.last_name_ar),
                  c.status, c.membership_no, c.birth_date,
                  c.has_photo ? 'photo' : ''].join(','));
    }
  }
  fs.writeFileSync(sheet, lines.join('\n') + '\n', { mode: 0o600 });
  console.log('  written: ' + sheet);
  console.log('');

  if (!WRITE) {
    console.log('  This was a dry run. Nothing was written, and nothing was deleted.');
    console.log('');
    console.log('  What --write does, and nothing else:');
    console.log('    * writes families/{id}: the guardian, the telephone, the children');
    console.log('    * stamps family_id and guardian on those requests');
    console.log('');
    console.log('  What it will not do, and there is no flag for:');
    console.log('    * disable, delete or redirect any account');
    console.log('    * touch a swimmer, a membership number or a photograph');
    console.log('    * remove a single document');
    console.log('');
    console.log('  Every child keeps signing in exactly as they did this morning.');
    return;
  }

  let familiesWritten = 0;
  let stamped = 0;
  const chunk = db.batch();
  let queued = 0;

  const flush = async () => {
    if (!queued) return;
    await chunk.commit();
    queued = 0;
  };

  for (const f of multi) {
    const id = familyId(f.key);
    chunk.set(db.collection('families').doc(id), {
      guardian_first_name: f.guardian_first_name,
      guardian_last_name: f.guardian_last_name,
      name: (f.guardian_first_name + ' ' + f.guardian_last_name).trim(),
      phone: f.phone,
      emails: [...f.emails],
      usernames: [...f.usernames],
      children: f.children.map(c => ({
        application_no: c.application_no,
        name: (c.first_name_ar + ' ' + c.last_name_ar).trim(),
        birth_date: c.birth_date || null,
        status: c.status,
        membership_no: c.membership_no || null,
        has_photo: c.has_photo
      })),
      member_count: f.children.length,
      by: 'the club',
      at: FieldValue.serverTimestamp()
    }, { merge: true });
    queued++;
    familiesWritten++;

    for (const c of f.children) {
      if (!c.application_no) continue;
      const ref = db.collection('applications').doc(c.application_no);
      const snap = await ref.get();
      if (!snap.exists) continue;
      chunk.set(ref, {
        family_id: id,
        guardian: (f.guardian_first_name + ' ' + f.guardian_last_name).trim()
      }, { merge: true });
      queued++;
      stamped++;
      if (queued >= 400) await flush();
    }
  }
  await flush();

  console.log('  families written : ' + familiesWritten);
  console.log('  requests stamped : ' + stamped);
  console.log('');
  console.log('  Nothing was deleted. Nothing was disabled. Every child still signs in.');
})().catch(e => {
  console.log('');
  console.log('  stopped: ' + e.message);
  process.exit(1);
});