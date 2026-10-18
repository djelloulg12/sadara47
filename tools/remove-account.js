/* Removing an account that the page cannot reach.

   What this is, and what it is not
   -------------------------------
   Not "the delete button" -- the button is written, and waits for a server, and
   this is not it. This is the thing the club runs on its own machine, once, for
   the accounts it has decided are finished.

   The page can already delete a `users` document. What it cannot reach is the
   authentication record behind it, and that is the one that lets somebody back in
   after their profile is gone. So this removes both -- the club's record and the
   way in -- and leaves everything else where it is.

   What it will not do, ever
   -------------------------
     a child             a swimmer, a membership number, a photograph. An account is
                         a way in; a child is a person on the register, and the
                         number on their card is read out at the pool.
     a request           the club's record of somebody who applied. It is stamped
                         with why and by whom, and kept.
     the owner           the one account that cannot be recreated from here.
     your own            the person holding the keyboard is holding the thing.
     anything silently  without a reason, which the audit log then carries.

   The one thing it asks first
   ---------------------------
   Before it removes anything it says what is attached to the account: how many
   requests, how many accepted children, how many photographs. Not to refuse --
   to make the number visible while somebody is still able to change their mind. A
   family with three children on the books is a different decision from a dormant
   account nobody has touched in a season, and the tool does not pretend they are
   the same.

   A dry run is the default and prints exactly what would go.
*/

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const KEY = process.env.SADARA_SERVICE_ACCOUNT
  || path.join(os.homedir(), '.local', 'share', 'sadara-backup', 'service-account.json');
const WRITE = process.argv.includes('--write');
const PROJECT = 'sadara-platform-774c8';

const arg = name => {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : '';
};
const EMAILS = (arg('--email') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const REASON = arg('--reason') || '';

/* The owner holds rights by address and may hold no profile at all, so both are
   checked: the flag on the profile, and the club's own list. A guard that reads
   only the flag protects nobody, because the flag is a field on the document
   being deleted. */
const STAFF_ADDRESSES = ['kabrag12@gmail.com'];
const STAFF_ROLES = ['admin', 'owner', 'president', 'مدير', 'رئيس'];

if (!fs.existsSync(KEY)) {
  console.log('');
  console.log('  No service account key, so nothing can be removed.');
  console.log('  Expected: ' + KEY);
  console.log('');
  process.exit(2);
}

if (!EMAILS.length) {
  console.log('');
  console.log('  Nothing was named.');
  console.log('');
  console.log('    --email a@b.com,d@e.com    the accounts to remove');
  console.log('    --reason "..."              what to write in the audit trail');
  console.log('    --write                     do it (without it, this only plans)');
  console.log('');
  process.exit(2);
}

if (!REASON) {
  console.log('');
  console.log('  No reason was given, so nothing will be removed.');
  console.log('');
  console.log('  The audit trail has to say why, not merely that. Six months on, a removal');
  console.log('  nobody can explain is indistinguishable from one nobody should have made.');
  console.log('');
  console.log('    --reason "حساب خامل منذ موسم"');
  console.log('');
  process.exit(2);
}

function say(why, how) {
  console.log('');
  console.log('  ' + why);
  if (how) { console.log(''); how.forEach(l => console.log('  ' + l)); }
  console.log('');
}

(async () => {
  initializeApp({
    credential: cert(JSON.parse(fs.readFileSync(KEY, 'utf8'))),
    projectId: PROJECT
  });
  const db = getFirestore();
  const auth = getAuth();

  let owners = [];
  try {
    const snap = await db.collection('config').doc('owners').get();
    if (snap.exists && Array.isArray(snap.data().emails)) owners = snap.data().emails;
  } catch (_) { /* an unreadable list must not become a permission */ }

  console.log('  mode : ' + (WRITE ? 'WRITE -- accounts will be removed' : 'dry run'));
  console.log('  why  : ' + REASON);
  console.log('');

  let refused = 0;
  let ready = 0;

  for (const email of EMAILS) {
    let user;
    try {
      user = await auth.getUserByEmail(email);
    } catch (_) {
      console.log('  no account        ' + email);
      refused++;
      continue;
    }

    const address = String(user.email || email).toLowerCase();

    /* The three refusals, in the order they matter. */
    if (STAFF_ADDRESSES.indexOf(address) !== -1
      || owners.map(x => String(x).toLowerCase()).indexOf(address) !== -1) {
      console.log('  REFUSED (owner)   ' + address);
      refused++;
      continue;
    }

    let profile = {};
    try {
      const snap = await db.collection('users').doc(user.uid).get();
      profile = snap.exists ? snap.data() : {};
    } catch (_) { /* judged below */ }
    if (STAFF_ROLES.indexOf(String(profile.role || '').toLowerCase()) !== -1) {
      console.log('  REFUSED (staff)   ' + address + '   role: ' + profile.role);
      refused++;
      continue;
    }

    /* What is attached. Reported, not consulted: a family with three children on
       the books is a different decision from a dormant account, and the person
       making it is the one who decides -- not this file. */
    let requests = 0, accepted = 0, children = 0, photos = 0;
    let unreadable = false;
    try {
      const snap = await db.collection('applications').where('applicant_uid', '==', user.uid).get();
      requests = snap.size;
      const theirIds = [];
      for (const d of snap.docs) {
        if (d.data().status === 'approved') accepted++;
        if (d.data().photo) photos++;
        theirIds.push(d.id);
      }

      /* A child is found by the *document* the request became, not by the season
         number on the profile.

         `registration_id` looks like a person's number and is not: E202620001
         sits on thirty-one children who have never heard of each other, because
         it was stamped once when the season opened. Counting by it told a
         decision-maker that one family had twenty-three children on the books
         when it has five. A number that flatters a family's size is the one
         kind of number this file must not print.

         And `application_no` is not the document id either -- for the migrated
         requests they differ -- so the lookup below is by id, one read each.
         A family files a handful of requests; this costs nothing. */
      for (const id of theirIds) {
        const onBooks = await db.collection('swimmers').doc(id).get();
        if (onBooks.exists) children++;
      }
    } catch (_) { unreadable = true; }

    /* A failed read is not an empty account, and this file must never print it as
       one. The quota runs out, a rule denies the read, a network drops -- and
       every one of those used to reach the person holding the keyboard as "0
       requests, nothing attached", which is the exact sentence that makes a family
       with five children on the books look safe to delete.

       So an account whose counts could not be established is refused, not counted.
       It is the only refusal here that is about safety rather than ownership. */
    if (unreadable) {
      console.log('  REFUSED (unreadable) ' + address
        + '   could not read what is attached, so nothing is known about it');
      refused++;
      continue;
    }

    const heavy = accepted > 0 || children > 0;
    console.log('  ' + (heavy ? 'LOOK AT IT  ' : 'ready        ') + address
      + '   requests ' + requests
      + (accepted ? ', ' + accepted + ' accepted' : '')
      + (children ? ', ' + children + ' on the books' : '')
      + (photos ? ', ' + photos + ' photographs' : ''));
    if (heavy) {
      console.log('      ^ this one has children or accepted requests. Still removable, but'
        + ' it is a decision about a family, not about a dormant account.');
    }
    ready++;
  }

  console.log('');
  console.log('  ' + ready + ' to remove, ' + refused + ' refused');

  if (!WRITE) {
    console.log('  Nothing was written. Nothing was deleted.');
    return;
  }

  let removed = 0;
  for (const email of EMAILS) {
    if (owners.map(x => String(x).toLowerCase()).indexOf(email) !== -1) continue;
    if (STAFF_ADDRESSES.indexOf(email) !== -1) continue;

    let uid = null;
    try { uid = (await auth.getUserByEmail(email)).uid; } catch (_) { continue; }

    const snap = await db.collection('users').doc(uid).get();
    const profile = snap.exists ? snap.data() : {};
    if (STAFF_ROLES.indexOf(String(profile.role || '').toLowerCase()) !== -1) continue;

    /* Stamped, not deleted. The club's record of somebody who applied outlives
       their account by a long way. */
    let stamped = 0;
    try {
      const reqs = await db.collection('applications').where('applicant_uid', '==', uid).get();
      for (const d of reqs.docs) {
        await d.ref.set({
          account_removed_at: FieldValue.serverTimestamp(),
          account_removed_reason: REASON,
          account_removed_email: email
        }, { merge: true });
        stamped++;
      }
    } catch (e) {
      /* The same refusal as above, and here it matters most: this is the moment
         the account actually goes. Removing one while unable to stamp its requests
         leaves the club's record saying nothing about why a family vanished, and
         the one safeguard that would have noticed -- the counts -- is exactly the
         thing the quota took away.

         Refused, said, and the next account is still processed. */
      console.log('  REFUSED (unreadable) ' + email
        + '   could not read its requests, so it is still there');
      refused++;
      continue;
    }

    await auth.deleteUser(uid);
    await db.collection('users').doc(uid).delete().catch(() => { /* already gone */ });
    await db.collection('audit_logs').add({
      at: FieldValue.serverTimestamp(),
      action: 'account_removed',
      target: uid, target_email: email, reason: REASON, requests_stamped: stamped
    });
    console.log('  removed  ' + email + '   (' + stamped + ' request(s) kept and stamped)');
    removed++;
  }

  console.log('');
  console.log('  ' + removed + ' removed.');
  console.log('  No swimmer, no membership number and no photograph was touched.');
})().catch(e => {
  console.log('');
  console.log('  stopped: ' + e.message);
  process.exit(1);
});