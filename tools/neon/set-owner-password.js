/* كلمة مرور لصاحب النادي: تُطبع مرة واحدة، ولا تُكتب في ملف.
   ----------------------------------------------------------------------------
   `kabrag12@gmail.com` هو المالك (config/owners)، وهو الحساب الإداري الوحيد.
   ولا كلمة مرور له في login-details.csv. فإن دخلت المنصة على Neon بلا كلمة
   مرور له، أُغلق صاحب النادي خارج منصته -- وهذا أسوأ من أي خلل آخر.

   فتُولَّد كلمة مرور عشوائية، تُخزَّن تجزئتها فقط، وتُطبع هنا مرة واحدة.
   انسخها الآن؛ لن تُعرض ثانية ولن تُكتب في أي ملف.

   Run: node tools\neon\set-owner-password.js --write
*/
'use strict';
const crypto = require('crypto');
const url = require('../neon-env').dbUrl();

const WRITE = process.argv.includes('--write');
const OWNER = 'kabrag12@gmail.com';
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function hashPassword(password, saltB64) {
  return crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), SCRYPT.keylen,
    { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 128 * SCRYPT.N * SCRYPT.r * 2 }).toString('base64');
}

/* 16 حرفًا من أبجدية بلا حروف متشابهة (O/0، l/1) -- تُقرأ في الهاتف بلا خطأ. */
function newPassword() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 16; i++) out += abc[crypto.randomInt(abc.length)];
  return out;
}

(async () => {
  const pg = require('pg');
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const who = await c.query('select id, role from public.app_users where lower(email)=$1', [OWNER]);
  if (!who.rows.length) { console.log('no such account: ' + OWNER); await c.end(); process.exit(1); }
  console.log('account : ' + OWNER + '  (' + who.rows[0].role + ')');

  const password = newPassword();
  const salt = crypto.randomBytes(16).toString('base64');
  const hash = hashPassword(password, salt);

  /* التحقّق أولًا: لا نكتب تجزئة لا نستطيع التحقّق منها. */
  const check = hashPassword(password, salt);
  if (check !== hash) { console.log('the hash does not verify against itself; nothing written'); await c.end(); process.exit(1); }

  if (!WRITE) { console.log('dry run: a password would be generated. Re-run with --write.'); await c.end(); return; }

  await c.query(`update public.app_users set local_hash=$1, local_salt=$2, hash_params=$3,
      must_change=true, password_set_at=now(), role='admin' where lower(email)=$4`,
    [hash, salt, JSON.stringify(SCRYPT), OWNER]);
  await c.end();

  console.log('');
  console.log('  ==================================================');
  console.log('   كلمة مرور صاحب النادي — تُقرأ الآن ولا تُعرض ثانية');
  console.log('   ' + OWNER);
  console.log('   ' + password);
  console.log('  ==================================================');
  console.log('');
  console.log('Only the scrypt hash was stored. Nothing was written to a file.');
})().catch(e => { console.log('failed:', e.message); process.exit(1); });
