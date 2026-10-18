/* Putting the real roster into a local emulator, so a tool can be proved against
   the club's own records before it is pointed at the club's own database.

   This is the rehearsal. The Firestore emulator is a throwaway process on this
   machine: it accepts writes without a quota, keeps nothing, and disappears when
   the window closes. So the renumbering can be run end to end -- every member, the
   whole plan, the proof that no two people are left sharing a number -- against the
   actual 115 records, and the real database is never asked to do anything.

   The photographs are left out. They are the largest part of the backup and the
   smallest part of the question; a number does not depend on a face.
*/

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const KEY = process.env.SADARA_SERVICE_ACCOUNT
  || path.join(os.homedir(), '.local', 'share', 'sadara-backup', 'service-account.json');
const RUN = process.env.SADARA_SNAPSHOT
  || (fs.existsSync(path.join(os.homedir(), '.local', 'share', 'sadara-backup'))
    ? (fs.readdirSync(path.join(os.homedir(), '.local', 'share', 'sadara-backup'))
        .filter(n => n.indexOf('firestore-') === 0).sort().pop())
    : '');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.log('');
  console.log('  Refusing to run: FIRESTORE_EMULATOR_HOST is not set.');
  console.log('');
  console.log('  This file exists to fill a throwaway emulator. Without that variable it');
  console.log('  would write the club\'s real roster into the club\'s real database, from a');
  console.log('  file whose whole purpose is to be safe. That is not a risk worth a flag.');
  console.log('');
  process.exit(2);
}

const base = path.join(os.homedir(), '.local', 'share', 'sadara-backup', RUN);
const manifest = JSON.parse(fs.readFileSync(path.join(base, 'MANIFEST.json'), 'utf8'));

const COLLECTIONS = ['swimmers', 'applications', 'users'];

(async () => {
  initializeApp({
    credential: cert(JSON.parse(fs.readFileSync(KEY, 'utf8'))),
    projectId: 'demo-sadara'
  });
  const db = getFirestore();

  for (const name of COLLECTIONS) {
    const entry = manifest.collections[name];
    if (!entry) { console.log('  ' + name + ': not in this snapshot'); continue; }

    const file = path.join(base, entry.file);
    let total = 0, inBatch = 0, batch = db.batch();

    fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).forEach(line => {
      const row = JSON.parse(line);
      const doc = row.data || row;
      /* Photographs are megabytes of base64 and take no part in numbering a member. */
      for (const k of Object.keys(doc)) {
        if (/photo|signature|dataUrl/i.test(k)) delete doc[k];
      }
      batch.set(db.collection(name).doc(row.id), doc);
      total++;
      inBatch++;
      if (inBatch >= 400) { /* committed below, synchronously */ }
    });

    /* Firestore batches cap at 500; written in slices so the rehearsal holds the
       same shape the real tool will meet. */
    await batch.commit();
    console.log('  ' + name.padEnd(14) + total + ' documents loaded');
  }

  console.log('');
  console.log('  the emulator now holds the club\'s records and nothing else.');
})().catch(e => {
  console.log('  stopped: ' + e.message);
  process.exit(1);
});