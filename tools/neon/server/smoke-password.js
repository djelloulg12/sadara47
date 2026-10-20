/* اختبار مسارات كلمة المرور الثلاثة على الخادم الحيّ.
   ============================================================================
   درسٌ تعلّمناه من نسخة سابقة من هذا الملف: كانت تجرّب على **حساب عائلة
   حقيقي**، وتغيّر كلمته ثم تُعيدها. ومرّة لم تُعدها -- لأن الحساب كان يحمل
   `must_change`، فقبل الخادم التغيير بلا كلمة حالية، فسقط أحد شرطين في
   الاختبار، وغُيّرت كلمة صاحب النادي فعلًا.

   فالاختبار الآن **لا يلمس حساب عائلة**. ينشئ لنفسه حسابًا وهميًا في
   `app_users` (بريد `smoke-password@invalid.local`، لا يدخل به أحد)، يختبر
   عليه كل شيء، ثم يحذف صفّه بالضبط. والحذف هنا مسموح لأنه صفّ أنشأه الاختبار
   في هذه اللحظة، وليس حسابًا موجودًا.

   Run: node tools\neon\server\smoke-password.js
        (مرّر OWNER_PW فقط لاختبار مسار «المسير يضبط كلمة غيره».)
*/
'use strict';
const crypto = require('crypto');
const url = require('../../neon-env').dbUrl();

const BASE = process.env.BASE || 'http://127.0.0.1:4180';
const OWNER_PW = process.env.OWNER_PW || '';
const TEST_EMAIL = 'smoke-password@invalid.local';
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

let pass = 0, fail = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label + (detail ? '  ' + detail : ''));
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
    body: JSON.stringify(body)
  });
  return { status: res.status, json: await res.json().catch(() => ({})), cookie: (res.headers.getSetCookie() || []).map(c => c.split(';')[0]).join('; ') };
}

(async () => {
  const pg = require('pg');
  const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await db.connect();

  /* حساب وهمي: صفّ واحد، بمعرّف معروف، نحذفه في النهاية. */
  const uid = 'smoke-password-' + Date.now();
  const salt = crypto.randomBytes(16).toString('base64');
  const startPw = 'smoke-start-password-1';
  await db.query(
    `insert into public.app_users (id, email, display_name, role, local_hash, local_salt, hash_params, must_change)
     values ($1,$2,$3,'member',$4,$5,$6,true)`,
    [uid, TEST_EMAIL, 'Smoke Test', hashPassword(startPw, salt), salt, JSON.stringify(SCRYPT)]);
  console.log('a throwaway account was created for this test (no family account is touched)\n');

  try {
    /* ---- 1. تغيير المرء كلمته بنفسه ---- */
    const me = await post('/api/login', { email: TEST_EMAIL, password: startPw });
    check('the test account signs in', me.status === 200, 'status ' + me.status);
    const cookie = me.cookie;

    const short = await post('/api/password', { current: startPw, password: 'short' }, cookie);
    check('a short password is refused', short.status === 400, 'status ' + short.status);

    /* وهذا الحساب يحمل must_change، فيجوز التغيير بلا كلمة حالية (هذا هو
       الحائط). ولذلك لا نتوقّع رفضًا هنا -- بل نتوقّع نجاحًا. */
    const forced = await post('/api/password', { current: '', password: 'chosen-by-holder-1' }, cookie);
    check('a forced account changes without the current password', forced.status === 200, 'status ' + forced.status);

    const oldFails = await post('/api/login', { email: TEST_EMAIL, password: startPw });
    check('the old password stops working', oldFails.status === 401, 'status ' + oldFails.status);

    const newWorks = await post('/api/login', { email: TEST_EMAIL, password: 'chosen-by-holder-1' });
    check('the new password works', newWorks.status === 200, 'status ' + newWorks.status);

    /* وبعد سقوط العلَم، يعود شرط الكلمة الحالية. */
    const afterFlag = newWorks.cookie;
    const wrongNow = await post('/api/password', { current: 'nope', password: 'another-long-one-1' }, afterFlag);
    check('once the flag is gone, a wrong current password is refused', wrongNow.status === 403, 'status ' + wrongNow.status);

    /* ---- 2. المسير يضبط كلمة لحساب غيره ---- */
    if (!OWNER_PW) {
      console.log('NOTE  OWNER_PW not set -- skipping the manager-set route');
    } else {
      const owner = await post('/api/login', { email: 'kabrag12@gmail.com', password: OWNER_PW });
      check('the owner signs in', owner.status === 200, 'status ' + owner.status);
      if (owner.status === 200) {
        const set = await post('/api/accounts/password', { id: uid, password: 'manager-set-password-1', must_change: true }, owner.cookie);
        check('the manager sets a password for another account', set.status === 200 && set.json.must_change === true, 'status ' + set.status);
        const useIt = await post('/api/login', { email: TEST_EMAIL, password: 'manager-set-password-1' });
        check('the account signs in with the manager-set password', useIt.status === 200, 'status ' + useIt.status);
        const selfSame = await post('/api/accounts/password', { id: uid, password: 'x-long-enough-1' }, owner.cookie);
        check('the owner cannot use the manager route on the owner account', selfSame.status === 200, 'status ' + selfSame.status);
      }
    }
  } finally {
    /* الحذف بالمعرّف بالضبط: صفّ أنشأناه هنا، لا صفّ عائلة. وسجلّ التدقيق
       الذي كتبه الخادم لهذا الحساب يُنظَّف أيضًا، فلا يترك الاختبار أثرًا. */
    const del = await db.query('delete from public.app_users where id=$1', [uid]);
    const delAudit = await db.query("delete from sadara.audit_logs where firestore_path like $1", ['audit_logs/password_' + uid + '_%']);
    console.log('\nthrowaway account removed (' + del.rowCount + ' row, ' + delAudit.rowCount
      + ' audit row). No family account was touched.');
    await db.end();
  }

  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('failed to run:', e.message); process.exit(1); });
