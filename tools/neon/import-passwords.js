/* تجهيز كلمات المرور في Neon: تجزئة scrypt لكلمات login-details.csv.
   ----------------------------------------------------------------------------
   لماذا لا تُخزَّن كلمة المرور كما هي:
   كلمة المرور نصّ صريح، وملف `login-details.csv` يحملها لأن أحدًا يجب أن
   يقرأها في الهاتف. أما قاعدة البيانات فيجب ألّا تحملها: تسريب نسخة احتياطية
   واحدة يعني 226 حسابًا مكشوفًا. فتُخزَّن تجزئة scrypt بملح لكل حساب، ويبقى
   التحقّق ممكنًا والاسترجاع مستحيلًا -- كما يجب.

   ولماذا scrypt وليس sha256:
   التجربة الواحدة مقصود أن تكون مكلفة (N=16384)، فتخمين 226 كلمة مرور
   بمليارات المحاولات يصبح غير عملي. sha256 وحدها سريعة، والسريع هنا عيب.

   وعلامة `must_change` تُوضع لكل حساب: كلمة مرور قرأها المسير من ورقة
   ليست سرًّا يعرفه صاحبها وحده بعد.

   التشغيل:
     node tools\neon\import-passwords.js --check     (يعرض ما سيفعله)
     node tools\neon\import-passwords.js --write     (يُخزّن التجزئة فعلًا)
*/
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const url = require('../neon-env').dbUrl();

const CHECK = process.argv.includes('--check');
const WRITE = process.argv.includes('--write');
const CSV = path.join(os.homedir(), '.local', 'share', 'sadara-backup', 'login-details.csv');

/* المعاملات تُحفظ مع كل صفّ، فلو تغيّرت لاحقًا تبقى القديمة قابلة للتحقّق. */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function hashPassword(password, saltB64) {
  const salt = Buffer.from(saltB64, 'base64');
  return crypto.scryptSync(password, salt, SCRYPT.keylen,
    { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 128 * SCRYPT.N * SCRYPT.r * 2 })
    .toString('base64');
}

function parseCsv(text) {
  return text.split(/\r?\n/)
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => l.split(','))
    .filter(p => p.length >= 5)
    .map(p => ({ name: p[0], phone: p[1], email: (p[2] || '').toLowerCase(), uid: p[3], password: p[4] }));
}

(async () => {
  if (!CHECK && !WRITE) { console.log('pass --check or --write'); process.exit(2); }
  if (!fs.existsSync(CSV)) { console.log('no login-details.csv at ' + CSV); process.exit(1); }

  const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));
  console.log('accounts with a known password : ' + rows.length);

  const pg = require('pg');
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  /* أعمدة جديدة للتجزئة، إضافية فقط. */
  if (WRITE) {
    await c.query('begin');
    try {
      await c.query(`
        ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS local_hash text;
        ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS local_salt text;
        ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS hash_params jsonb;
        ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS must_change boolean DEFAULT true;
        ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS password_set_at timestamptz;
      `);
      await c.query('commit');
      console.log('password columns are in place (additive)');
    } catch (e) { await c.query('rollback'); console.log('could not add columns:', e.message); await c.end(); process.exit(1); }
  }

  /* من ملف CSV: هل لكل حساب صفّ في app_users؟ */
  const app = (await c.query('select id, email from public.app_users')).rows;
  const appEmails = new Set(app.filter(x => x.email).map(x => x.email.toLowerCase()));
  const missing = rows.filter(r => !appEmails.has(r.email));
  if (missing.length) {
    console.log('in the CSV but not in app_users (' + missing.length + '):');
    missing.slice(0, 10).forEach(r => console.log('   ' + r.email));
  }

  if (CHECK) {
    console.log('would set a scrypt hash for ' + (CHECK ? rows.length : 0) + ' accounts');
    console.log('   (owner kabrag12@gmail.com has no password in the CSV -- handle separately)');
    await c.end();
    console.log('\n--check: nothing was written.');
    return;
  }

  await c.query('begin');
  let n = 0;
  try {
    for (const r of rows) {
      const saltB64 = crypto.randomBytes(16).toString('base64');
      const hash = hashPassword(r.password, saltB64);
      const res = await c.query(
        `update public.app_users set local_hash=$1, local_salt=$2, hash_params=$3,
           must_change=true, password_set_at=now()
         where lower(email)=$4`,
        [hash, saltB64, JSON.stringify(SCRYPT), r.email]);
      n += res.rowCount;
    }
    await c.query('commit');
  } catch (e) {
    await c.query('rollback');
    console.log('failed, nothing written:', e.message);
    await c.end();
    process.exit(1);
  }

  console.log('hashed and stored : ' + n + ' account(s)');
  const withHash = await c.query('select count(*)::int n from public.app_users where local_hash is not null');
  const total = await c.query('select count(*)::int n from public.app_users');
  console.log('app_users with a verifiable password : ' + withHash.rows[0].n + ' / ' + total.rows[0].n);
  await c.end();
  console.log('\nNo plaintext password was written to the database.');
})().catch(e => { console.log('failed:', e.message); process.exit(1); });
