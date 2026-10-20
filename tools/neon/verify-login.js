/* تحقّق فعلي: هل كلمة المرور في login-details.csv تطابق التجزئة المخزّنة؟
   ----------------------------------------------------------------------------
   هذا ليس وصفًا للنظام، بل اختباره. يقرأ أول حسابات CSV، يعيد حساب scrypt
   بنفس الملح والمعاملات المخزّنة، ويقارن. النجاح يعني أن الدخول على Neon
   سيعمل فعلًا. والفشل يُكتشف هنا، لا مع أول عائلة.

   Run: node tools\neon\verify-login.js
*/
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const url = require('../neon-env').dbUrl();

const CSV = path.join(os.homedir(), '.local', 'share', 'sadara-backup', 'login-details.csv');

function hashPassword(password, saltB64, params) {
  const salt = Buffer.from(saltB64, 'base64');
  const p = params || { N: 16384, r: 8, p: 1, keylen: 64 };
  return crypto.scryptSync(password, salt, p.keylen,
    { N: p.N, r: p.r, p: p.p, maxmem: 128 * p.N * p.r * 2 }).toString('base64');
}

(async () => {
  const rows = fs.readFileSync(CSV, 'utf8').split(/\r?\n/)
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => l.split(','))
    .filter(p => p.length >= 5)
    .map(p => ({ email: (p[2] || '').toLowerCase(), password: p[4] }));

  const pg = require('pg');
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  let ok = 0, bad = 0;
  /* كل حساب، لا عيّنة: ثقة في 21 من 226 ليست ثقة. */
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const q = await c.query('select local_hash, local_salt, hash_params from public.app_users where lower(email)=$1', [r.email]);
    if (!q.rows.length || !q.rows[0].local_hash) { console.log('   ' + r.email + '  (no hash stored)'); bad++; continue; }
    const row = q.rows[0];
    const computed = hashPassword(r.password, row.local_salt, row.hash_params);
    const good = computed === row.local_hash;
    /* also prove a WRONG password fails */
    const wrong = hashPassword(r.password + 'x', row.local_salt, row.hash_params);
    const rejectsWrong = wrong !== row.local_hash;
    if (good && rejectsWrong) { ok++; }
    else { bad++; console.log('   ' + r.email + '  MISMATCH'); }
  }

  console.log('checked ' + (ok + bad) + ' accounts');
  console.log('   correct password accepted : ' + ok);
  console.log('   wrong password rejected   : ' + (bad === 0 ? 'yes, in every case' : 'NO -- ' + bad + ' failures'));
  await c.end();
  if (bad) { console.log('\nThe stored hashes do not verify. Do not cut over.'); process.exit(1); }
  console.log('\nLogin verification works: the right password matches, the wrong one does not.');
})().catch(e => { console.log('failed:', e.message); process.exit(1); });
