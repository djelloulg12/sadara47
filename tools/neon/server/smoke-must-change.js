/* الحائط: كلمة مرور مؤقتة من المسير تُلزِم صاحبها بتغييرها.
   ============================================================================
   القصة كاملة، كما ستقع في النادي:
     1. المسير يضبط لحساب كلمة مرور، فيُرفع عليه `must_change`.
     2. الحساب يدخل بها -- فيصل إلى الصفحة ومعه `must_change=true`.
     3. يغيّرها من الحائط **بلا** كتابة المؤقتة (الخادم يقبل ما دام العلَم).
     4. العلَم يسقط، والمؤقتة تتوقّف عن العمل، والجديدة تعمل.
     5. وبعد سقوط العلَم، تغيير بلا كلمة حالية يُرفض مرة أخرى.

   وهذا الاختبار **لا يلمس حساب عائلة**: ينشئ حارسًا وهميًا (`must-change`
   مؤقتًا)، يجري عليه القصة، ثم يحذف صفّه بالضبط. النسخة السابقة كانت تجرّب
   على حساب حقيقي وتتركه بكلمة لا يعرفها صاحبه -- وهو خطأ لا يُصلحه إلّا
   استرجاع يدوي. فالحساب الآن ملكُ الاختبار وحده.

   Run: node tools\neon\server\smoke-must-change.js
*/
'use strict';
const crypto = require('crypto');
const url = require('../../neon-env').dbUrl();

const BASE = process.env.BASE || 'http://127.0.0.1:4180';
const OWNER_PW = process.env.OWNER_PW;
if (!OWNER_PW) {
  console.log('Set OWNER_PW to the owner password before running this.');
  process.exit(2);
}
const TEST_EMAIL = 'smoke-must-change@invalid.local';
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

let pass = 0, fail = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label + (detail ? '  -> ' + detail : ''));
  ok ? pass++ : fail++;
};

function hashPassword(password, saltB64) {
  const salt = Buffer.from(saltB64, 'base64');
  return crypto.scryptSync(password, salt, SCRYPT.keylen,
    { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 128 * SCRYPT.N * SCRYPT.r * 2 })
    .toString('base64');
}

async function post(path, body, cookie) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}),
    body: JSON.stringify(body || {})
  });
  return { res, data: await res.json().catch(() => ({})), cookie: (res.headers.getSetCookie() || []).map(c => c.split(';')[0]).join('; ') };
}
async function get(path, cookie) {
  const res = await fetch(BASE + path, { headers: cookie ? { Cookie: cookie } : {} });
  return { res, data: await res.json().catch(() => ({})) };
}

(async () => {
  const pg = require('pg');
  const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await db.connect();

  const uid = 'smoke-must-change-' + Date.now();
  const salt = crypto.randomBytes(16).toString('base64');
  const TEMP0 = 'temp-throwaway-' + Date.now();
  await db.query(
    `insert into public.app_users (id, email, display_name, role, local_hash, local_salt, hash_params, must_change)
     values ($1,$2,$3,'member',$4,$5,$6,true)`,
    [uid, TEST_EMAIL, 'Must Change Test', hashPassword(TEMP0, salt), salt, JSON.stringify(SCRYPT)]);
  console.log('a throwaway account was created for this test (no family account is touched)\n');

  try {
    const owner = await post('/api/login', { email: 'kabrag12@gmail.com', password: OWNER_PW });
    check('owner logs in', owner.res.ok, owner.res.status);
    if (!owner.res.ok) throw new Error('owner could not sign in');
    const ownerCookie = owner.cookie;

    /* ---- 1. المسير يضبط كلمة مؤقتة ---- */
    const TEMP = 'temp-password-' + Date.now();
    const set = await post('/api/accounts/password', { id: uid, password: TEMP, must_change: true }, ownerCookie);
    check('manager sets a temporary password', set.res.ok && set.data.must_change === true, JSON.stringify(set.data));

    /* ---- 2. الحساب يدخل بها، ومع الجلسة العلَم ---- */
    const login = await post('/api/login', { email: TEST_EMAIL, password: TEMP });
    check('the account logs in with the temporary password', login.res.ok, login.res.status);
    check('the login carries must_change', login.data.user && login.data.user.must_change === true,
      JSON.stringify(login.data.user && login.data.user.must_change));
    const cookie = login.cookie;

    const sess = await get('/api/session', cookie);
    check('the session carries must_change', sess.data.user && sess.data.user.must_change === true);

    /* ---- 3. يغيّرها بلا كلمة حالية (الحائط) ---- */
    const NEXT = 'chosen-by-holder-' + Date.now();
    const change = await post('/api/password', { current: '', password: NEXT }, cookie);
    check('a forced account changes its password with no current one', change.res.ok, JSON.stringify(change.data));

    /* ---- 4. العلَم سقط، والمؤقتة ماتت، والجديدة تعمل ---- */
    const oldLogin = await post('/api/login', { email: TEST_EMAIL, password: TEMP });
    check('the temporary password stops working', !oldLogin.res.ok && oldLogin.res.status === 401, oldLogin.res.status);

    const newLogin = await post('/api/login', { email: TEST_EMAIL, password: NEXT });
    check('the new password works', newLogin.res.ok, newLogin.res.status);
    check('the flag is gone after the change', newLogin.data.user && newLogin.data.user.must_change === false,
      JSON.stringify(newLogin.data.user && newLogin.data.user.must_change));

    /* ---- 5. وبعد سقوط العلَم، التغيير بلا كلمة حالية يُرفض ---- */
    const cookie2 = newLogin.cookie;
    const loose = await post('/api/password', { current: '', password: 'another-long-one-' + Date.now() }, cookie2);
    check('with no flag, changing without the current password is refused', !loose.res.ok && loose.res.status === 403, loose.res.status);
  } finally {
    const del = await db.query('delete from public.app_users where id=$1', [uid]);
    const delAudit = await db.query("delete from sadara.audit_logs where firestore_path like $1", ['audit_logs/password_' + uid + '_%']);
    console.log('\nthrowaway account removed (' + del.rowCount + ' row, ' + delAudit.rowCount
      + ' audit row). No family account was touched.');
    await db.end();
  }

  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('failed:', e.message); process.exit(1); });
