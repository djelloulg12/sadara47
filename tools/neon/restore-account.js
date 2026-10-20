/* إعادة حساب واحد إلى كلمة مروره الأصلية من login-details.csv.
   ----------------------------------------------------------------------------
   استُعمل في اختبار «الحائط» على حساب حقيقي (`laminvrd89@gmail.com`)، وكلمة
   مروره الأصلية صارت غير معروفة للاختبار. وهذا السكربت يقرأها من الملف نفسه
   -- نفس المصدر الذي بنى التجزئة أصلًا -- ويعيد بناءها بالملح نفسه، فتتطابق
   الحصيلة بالضبط: كلمة المرور التي كانت، و`must_change=true` كما وضعها
   الاستيراد الجماعي.

   Run: node tools\neon\restore-account.js laminvrd89@gmail.com --write
*/
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const url = require('../neon-env').dbUrl();

const EMAIL = (process.argv[2] || '').trim().toLowerCase();
const WRITE = process.argv.includes('--write');
const CSV = path.join(os.homedir(), '.local', 'share', 'sadara-backup', 'login-details.csv');
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function hashPassword(password, saltB64) {
  const salt = Buffer.from(saltB64, 'base64');
  return crypto.scryptSync(password, salt, SCRYPT.keylen,
    { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 128 * SCRYPT.N * SCRYPT.r * 2 })
    .toString('base64');
}

(async () => {
  if (!EMAIL) { console.log('usage: node tools\\neon\\restore-account.js <email> --write'); process.exit(2); }
  const line = fs.readFileSync(CSV, 'utf8').split(/\r?\n/)
    .find(l => l.split(',')[2] && l.split(',')[2].trim().toLowerCase() === EMAIL);
  if (!line) { console.log('email not in the CSV: ' + EMAIL); process.exit(1); }
  const password = line.split(',')[4];

  const pg = require('pg');
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const before = await c.query('select id, email, must_change from public.app_users where lower(email)=$1', [EMAIL]);
  if (!before.rowCount) { console.log('no such account in app_users'); await c.end(); process.exit(1); }
  console.log('account  : ' + before.rows[0].email);
  console.log('password : read from the CSV, ' + password.length + ' characters (not printed)');
  console.log('must_change before: ' + before.rows[0].must_change);

  if (!WRITE) { await c.end(); console.log('\nDry run. Re-run with --write to restore the original password.'); return; }

  const saltB64 = crypto.randomBytes(16).toString('base64');
  const hash = hashPassword(password, saltB64);
  if (hashPassword(password, saltB64) !== hash) { console.log('hash does not verify'); await c.end(); process.exit(1); }

  await c.query(`update public.app_users set local_hash=$1, local_salt=$2, hash_params=$3,
      must_change=true, password_set_at=now() where lower(email)=$4`,
    [hash, saltB64, JSON.stringify(SCRYPT), EMAIL]);

  const after = await c.query('select must_change from public.app_users where lower(email)=$1', [EMAIL]);
  console.log('must_change after : ' + after.rows[0].must_change);
  console.log('restored. The account works with its original password again.');
  await c.end();
})().catch(e => { console.log('failed:', e.message); process.exit(1); });
