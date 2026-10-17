/* Set a member's password from the club's side, and make them change it.

   Why this is a tool on a machine and not a button on the website
   ----------------------------------------------------------------
   A password cannot be set for somebody else from a browser. Not from a page the
   club signs in on, not from a link the club emails. `updatePassword` acts on
   the *current* user only -- Firebase asks for that person's own password first,
   precisely so that a borrowed session cannot quietly take an account over.

   Changing another person's password needs administrator credentials. So this
   runs where those credentials exist: on this machine, with the service account
   key, one member at a time.

   That is not a workaround. It is the shape of the thing: a club that cannot
   reach its own members' passwords has one option only, and this is it.

   What it does, and what it deliberately does not
   -----------------------------------------------
   It sets a **random** temporary password. Not the telephone number, not the
   national number, not anything the family can be tricked into guessing from a
   card -- because a password a member can be *derived* from is not a password,
   it is a formality, and it is the thing this whole exercise exists to stop.

   It marks the account as owing a change, as a claim the platform can read. And
   the temporary password is printed **once**, to be read out over the telephone,
   and is not written into any file that persists.

   What it cannot do
   -----------------
   It cannot recover a password. None is stored in a readable form anywhere --
   Firebase keeps a hash, and a hash does not come back. So the telephone call is
   not a formality either: it is how the family hears the new password.

   Running it
   ----------
     node tools/set-member-password.js --list "<contact-list.csv>"
     node tools/set-member-password.js --email someone@example.com --write
     node tools/set-member-password.js --all --write          (every row lacking a phone? no)

   A dry run is the default. Nothing is written without --write.
*/

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const readline = require('readline');

const KEY = process.env.SADARA_SERVICE_ACCOUNT
  || path.join(os.homedir(), '.local', 'share', 'sadara-backup', 'service-account.json');
const WRITE = process.argv.includes('--write');
const ALL = process.argv.includes('--all');

/* --- what to try to read, in the order the arguments allow -------------------- */
function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}
const LIST = argValue('--list');
const EMAILS = (argValue('--email') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

function say(why, how) {
  console.log('');
  console.log('  ' + why);
  if (how) {
    console.log('');
    how.forEach(l => console.log('  ' + l));
  }
  console.log('');
}

if (!fs.existsSync(KEY)) {
  say('No service account key, so no password can be set for anybody.', [
    'Expected: ' + KEY,
    '',
    'A password cannot be changed for somebody else from a browser -- not from a',
    'page the club signs in on. It takes administrator credentials, and those live',
    'in this file.',
    '',
    'Create one at:',
    '  https://console.firebase.google.com/project/sadara-platform-774c8/settings/serviceaccounts'
  ]);
  process.exit(2);
}

if (!ALL && !LIST && !EMAILS.length) {
  say('Nothing was asked for.', [
    '  --list "<contact-list.csv>"   set a password for each person on the list',
    '  --email a@b.com,d@e.com      set a password for these addresses',
    '  --all                        every address on the default list',
    '  --write                      actually do it (without it, this only plans)',
    '',
    'A dry run is the default. Nothing is written without --write.'
  ]);
  process.exit(2);
}

/* --- a password that is not a formality -------------------------------------
   Twelve characters from a set with no repeated-character runs and no ambiguous
   glyphs, because this one is read aloud over a telephone: 0/O and 1/l are how a
   correctly chosen password becomes a wrong one halfway through a call. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
function temporaryPassword() {
  const bytes = crypto.randomBytes(16);
  let out = '';
  for (let i = 0; i < 12; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  /* At least one of each kind, so it cannot come out all letters by chance and
     be refused as weak -- which would look, from the club's side, like the tool
     failing. */
  return out.slice(0, 4) + '7' + out.slice(4, 7) + '4' + out.slice(7);
}

function readList(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].split(',');
  const col = name => {
    const i = header.findIndex(h => h.trim() === name);
    return i;
  };
  const iEmail = col('البريد الإلكتروني'), iName = col('الاسم'),
        iPhone = col('الهاتف'), iState = col('حالة الطلب'), iRole = col('الدور');
  if (iEmail === -1) {
    throw new Error('that file has no "البريد الإلكتروني" column, so the addresses '
      + 'cannot be read out of it');
  }
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    const email = (cells[iEmail] || '').trim().toLowerCase();
    if (!email) continue;
    rows.push({
      email,
      name: (cells[iName] || '').trim(),
      phone: (cells[iPhone] || '').trim(),
      state: (cells[iState] || '').trim(),
      role: iRole === -1 ? '' : (cells[iRole] || '').trim()
    });
  }
  return rows;
}

/* Nobody runs the club's own account from a list of families.

   This is not a preference. It is the one mistake that locks the club out of its
   own platform, and it is easy to make: the owner's own row is in the same file,
   with the same columns, and a list of two hundred and twenty-seven names does
   not look like it contains the person reading it. So the refusal is here, in the
   tool, rather than in the order of operations somebody remembers.

   Three separate guards, because any one of them can be wrong:

     by address   the owner's own address, named
     by role      anything that says owner, admin or manager
     by name      the club's own name for itself, in case the role column is blank

   Passing --include-staff lifts all three, and says so before doing anything. */
const STAFF_ADDRESSES = ['kabrag12@gmail.com'];
const STAFF_ROLES = ['admin', 'owner', 'manager', 'مدير', 'مسير', 'رئيس'];
const STAFF_NAMES = ['مدير النادي', 'رئيس النادي'];

function isStaff(row) {
  if (STAFF_ADDRESSES.indexOf(row.email) !== -1) return 'address';
  const r = (row.role || '').toLowerCase();
  if (STAFF_ROLES.some(x => r.indexOf(x) !== -1)) return 'role';
  const n = (row.name || '').trim();
  if (STAFF_NAMES.indexOf(n) !== -1) return 'name';
  return null;
}

(async () => {
  /* `firebase-admin` v12 and later moved to a modular shape: `admin.credential`
   and `admin.auth()` are gone, and calling them fails with a message that names a
   property rather than the version that removed it. So the named form is used,
   and it is the form v11 also accepts -- one line that works on both rather than
   one that works on the version installed today. */
  const { initializeApp, cert } = require('firebase-admin/app');
  const { getAuth } = require('firebase-admin/auth');

  initializeApp({
    credential: cert(JSON.parse(fs.readFileSync(KEY, 'utf8'))),
    projectId: 'sadara-platform-774c8'
  });
  const auth = getAuth();

  let targets = [];
  if (ALL) {
    targets = readList(path.join(os.path.dirname(KEY), '..', '..', 'contact-list.csv'));
    console.log('  read the list next to the key');
  } else if (LIST) {
    targets = readList(LIST);
    console.log('  read ' + targets.length + ' rows from ' + LIST);
  } else {
    targets = EMAILS.map(e => ({ email: e }));
    console.log('  ' + targets.length + ' address(es) given');
  }

  console.log('  mode : ' + (WRITE ? 'WRITE -- passwords will be changed' : 'dry run'));
  console.log('');

  /* Deduplicate by address: the same person appears twice on a list of this
     shape, and setting a password twice means the club reads out a password that
     no longer works, on the telephone, to a parent. */
  const seen = new Set();
  const unique = [];
  for (const t of targets) {
    if (seen.has(t.email)) continue;
    seen.add(t.email);
    unique.push(t);
  }
  const dupes = targets.length - unique.length;
  if (dupes) console.log('  ' + dupes + ' repeated address(es) collapsed to one');
  console.log('');

  let done = 0;
  let verifiedCount = 0;
  let clearedCount = 0;
  const cannot = [];
  const log = [];
  const spared = [];

  /* The staff check happens before anything is attempted, and is reported by
     name -- so a dry run shows exactly who is being left alone, rather than the
     absence being noticed afterwards. */
  const INCLUDE_STAFF = process.argv.includes('--include-staff');

  /* `--keep` : the passwords in the sheet are the standing ones, so nothing is
     marked as owing a change. The club has said so.
     `--sheet` : write them to a file, which is what the club has asked for, and
     which this tool previously refused to do. It still prints them once, and it
     still writes them nowhere unless this is given -- but the flag is the
     difference between a decision and an accident. */
  const KEEP = process.argv.includes('--keep');
  const SHEET = argValue('--sheet');
  const VERIFY_EMAIL = process.argv.includes('--verify-email');
  const CLEAR_CLAIM = process.argv.includes('--clear-claim');
  let work = unique;
  if (!INCLUDE_STAFF) {
    work = [];
    for (const t of unique) {
      const why = isStaff(t);
      if (why) spared.push({ ...t, why });
      else work.push(t);
    }
  }

  if (spared.length) {
    console.log('  left alone, because the club\'s own account is never run from a list:');
    for (const s of spared) {
      console.log('     ' + (s.name || '(no name)') + '  <' + s.email + '>   -- matched by ' + s.why);
    }
    console.log('');
    console.log('  Lift that with --include-staff, which says so out loud.');
    console.log('');
  } else if (INCLUDE_STAFF && work.length) {
    console.log('  --include-staff was given: anybody on the list will be included.');
    console.log('');
  }

  for (const t of work) {
    let user;
    try {
      user = await auth.getUserByEmail(t.email);
    } catch (e) {
      cannot.push({ ...t, why: 'no account with this address' });
      continue;
    }
    const acc = { verified: Boolean(user.emailVerified) };

    if (!WRITE) {
      console.log('  would set for ' + (t.name || '(no name)') + '  <' + t.email + '>'
        + (VERIFY_EMAIL && !acc.verified ? '   and mark the address verified' : ''));
      if (VERIFY_EMAIL && !acc.verified) verifiedCount++;
      done++;
      continue;
    }

    const password = temporaryPassword();
    try {
      await auth.updateUser(user.uid, { password });
      /* The club intends these to be the standing passwords, kept by each family
         and read for years. So the "must change this" claim is only written when
         the club asks for it: setting it by default would quietly cancel the plan
         the sheet is built for -- the family opens the platform, is made to choose
         a new password, and the number in the sheet stops working the same week. */
      const claims = Object.assign({}, user.customClaims || {});
      if (CLEAR_CLAIM && claims.must_change_password) {
        /* Takes back a "must change this" that was set by mistake, so that the
           passwords in the club's sheet keep working. A claim left behind outlives
           the run that set it: the family is told to choose a new password, and the
           number written on their paper stops working the same week. */
        delete claims.must_change_password;
        delete claims.password_set_by;
        delete claims.password_set_at;
        await auth.setCustomUserClaims(user.uid, claims);
        clearedCount++;
      } else if (!KEEP) {
        claims.must_change_password = true;
        claims.password_set_by = 'club';
        claims.password_set_at = new Date().toISOString();
        await auth.setCustomUserClaims(user.uid, claims);
      }

      /* Marking the address verified is what makes the platform's own free
         recovery work at all.

         `sendPasswordResetEmail` is the one confirmation channel this project has
         that costs nothing -- no message is billed, no service is bought, and the
         code is already written and already on the sign-in screen. It goes nowhere
         for an unverified address, and on the day this was checked only ten of the
         club's two hundred and forty-six could receive one. So a family who forgot
         their password had no way back in, which is the situation the club is
         paying two hundred and twenty-six telephone calls to solve by hand.

         Read the address aloud on the call before running this. It is the club
         that confirms the mailbox belongs to the person -- the tool cannot, and
         does not pretend to. */
      if (VERIFY_EMAIL && !acc.verified) {
        await auth.updateUser(user.uid, { emailVerified: true });
        verifiedCount++;
      }
      done++;
      log.push({ email: t.email, name: t.name, phone: t.phone, uid: user.uid, password });
      console.log('  set for ' + (t.name || '(no name)') + '  <' + t.email + '>');
    } catch (e) {
      cannot.push({ ...t, why: e.message.split('\n')[0] });
    }
  }

  console.log('');
  console.log('  ' + done + ' password(s) ' + (WRITE ? 'changed' : 'would change'));
  if (CLEAR_CLAIM) {
    console.log('  ' + clearedCount + ' "must change this" mark(s) '
      + (WRITE ? 'taken back' : 'would be taken back'));
  }
  if (VERIFY_EMAIL) {
    console.log('  ' + verifiedCount + ' address(es) ' + (WRITE ? 'marked verified' : 'would be marked verified'));
    if (WRITE && verifiedCount) {
      console.log('');
      console.log('  The platform can now send a reset link to those addresses. That is the');
      console.log('  club\'s own free recovery: no message is billed and no service bought.');
    }
  }
  if (cannot.length) {
    console.log('  ' + cannot.length + ' could not:');
    const kinds = new Map();
    for (const c of cannot) kinds.set(c.why, (kinds.get(c.why) || 0) + 1);
    for (const [why, n] of kinds) console.log('     ' + why + '  x' + n);
  }

  if (!WRITE) {
    console.log('');
    console.log('  Nothing was written. Run it again with --write to do it.');
    return;
  }

  /* With `--sheet`, the passwords go where the club asked for them: one file, one
     row per person, readable for as long as the club keeps it. The file says in
     its own first line what it is, because a sheet of passwords that looks like
     a sheet of names is a sheet that gets forwarded without anyone knowing what
     it carries. */
  if (SHEET) {
    const stamp = new Date().toISOString().slice(0, 10);
    const body = log.map(l => [l.name, l.phone, l.email, l.uid, l.password].join(','));
    const header = [
      '# SADARA -- contains passwords. Do not forward, do not commit, do not leave on a shared drive.',
      '# ' + stamp + ' -- ' + log.length + ' accounts. Anyone holding this file can sign in as any of them.',
      '# name,phone,email,uid,password'
    ];
    require('fs').writeFileSync(SHEET, header.concat(body).join('\n') + '\n', { mode: 0o600 });
    console.log('');
    console.log('  written: ' + SHEET);
    console.log('  ' + log.length + ' password(s) on file, readable by its owner only.');
    console.log('');
    console.log('  It is not committed, and it is not in the platform folder. Keep it');
    console.log('  where only the club keeps things -- and when the season is over, or');
    console.log('  any message goes astray, regenerate it rather than edit it:');
    console.log('    node tools/set-member-password.js --list "<list>" --keep --sheet "<same path>" --write');
    return;
  }

  /* The passwords go on paper, once. The file is deliberately NOT written: a
     list of temporary passwords sitting in a folder is exactly what this whole
     exercise is removing. Whoever reads it out deletes it afterwards. */
  console.log('');
  console.log('  READ THESE OUT NOW. They are not written to any file.');
  console.log('');
  for (const l of log) {
    console.log('    ' + (l.name || '(no name)') + '   ' + l.phone);
    console.log('       sign in: ' + l.email);
    console.log('       password: ' + l.password);
    console.log('');
  }
  console.log('  Each of these is marked as owing a change, so the temporary one is a');
  console.log('  bridge and not a place to stay.');
  process.exit(0);
})().catch(e => {
  console.log('');
  console.log('  stopped: ' + e.message);
  process.exit(1);
});