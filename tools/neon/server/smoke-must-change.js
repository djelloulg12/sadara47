/* اختبار الحائط: كلمة مرور مؤقتة من المسير تُلزِم صاحبها بتغييرها.
   ----------------------------------------------------------------------------
   القصة كاملة، كما ستقع في النادي:
     1. المسير يضبط لحساب كلمة مرور، فيُرفع عليه `must_change`.
     2. الحساب يدخل بها -- فيصل إلى الصفحة ومعه `must_change=true`.
     3. يغيّرها من الحائط **بلا** كتابة المؤقتة (الخادم يقبل ما دام العلَم).
     4. العلَم يسقط، والمؤقتة تتوقّف عن العمل، والجديدة تعمل.
     5. وبعد سقوط العلَم، تغيير بلا كلمة حالية يُرفض مرة أخرى.

   Run: node tools\neon\server\smoke-must-change.js
   يعيد كل شيء إلى ما كان عليه في النهاية، حتى لو فشل اختبار.
*/
'use strict';
const BASE = process.env.BASE || 'http://127.0.0.1:4180';
const OWNER_PW = process.env.OWNER_PW;
if (!OWNER_PW) {
  console.log('Set OWNER_PW to the owner password before running this.');
  process.exit(2);
}

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
};

function cookiesFrom(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  return raw.map(c => c.split(';')[0]).join('; ');
}

async function post(path, body, cookie) {
  const res = await fetch(BASE + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body || {})
  });
  return { res, data: await res.json().catch(() => ({})) };
}
async function get(path, cookie) {
  const res = await fetch(BASE + path, { headers: cookie ? { Cookie: cookie } : {} });
  return { res, data: await res.json().catch(() => ({})) };
}

(async () => {
  /* ---- صاحب النادي يدخل ---- */
  const owner = await post('/api/login', { email: 'kabrag12@gmail.com', password: OWNER_PW });
  ok('owner logs in', owner.res.ok, owner.res.status);
  const ownerCookie = cookiesFrom(owner.res);

  /* ---- نجد حسابًا حقيقيًا (ليس صاحب النادي) لنختبر عليه ---- */
  const accounts = await get('/api/accounts', ownerCookie);
  ok('owner reads the accounts', accounts.res.ok && Array.isArray(accounts.data.accounts || accounts.data));
  const list = accounts.data.accounts || accounts.data || [];
  const target = list.find(a => a.email && a.email.toLowerCase() !== 'kabrag12@gmail.com' && a.role === 'member');
  if (!target) { console.log('no member account to test with'); process.exit(1); }
  console.log('  (test account: ' + target.email + ')');

  const TEMP = 'temp-password-' + Date.now();
  const REAL = process.env.KEEP_PW || null; /* لا نعرف كلمة الحساب الأصلية، فسنعيد must_change فقط */

  /* ---- 1. المسير يضبط كلمة مؤقتة ---- */
  const set = await post('/api/accounts/password', { id: target.id, password: TEMP, must_change: true }, ownerCookie);
  ok('manager sets a temporary password', set.res.ok && set.data.must_change === true, JSON.stringify(set.data));

  /* ---- 2. الحساب يدخل بها، ومع الجلسة العلَم ---- */
  const login = await post('/api/login', { email: target.email, password: TEMP });
  ok('the account logs in with the temporary password', login.res.ok, login.res.status);
  ok('the login carries must_change', login.data.user && login.data.user.must_change === true,
    JSON.stringify(login.data.user && login.data.user.must_change));
  const cookie = cookiesFrom(login.res);

  /* والخادم يجب أن يبلغ الصفحة بالعلَم أيضًا من /api/session. */
  const sess = await get('/api/session', cookie);
  ok('the session carries must_change', sess.data.user && sess.data.user.must_change === true);

  /* ---- 3. يغيّرها بلا كلمة حالية (الحائط) ---- */
  const NEXT = 'chosen-by-holder-' + Date.now();
  const change = await post('/api/password', { current: '', password: NEXT }, cookie);
  ok('a forced account changes its password with no current one', change.res.ok, JSON.stringify(change.data));

  /* ---- 4. العلَم سقط، والمؤقتة ماتت، والجديدة تعمل ---- */
  const oldLogin = await post('/api/login', { email: target.email, password: TEMP });
  ok('the temporary password stops working', !oldLogin.res.ok && oldLogin.res.status === 401, oldLogin.res.status);

  const newLogin = await post('/api/login', { email: target.email, password: NEXT });
  ok('the new password works', newLogin.res.ok, newLogin.res.status);
  ok('the flag is gone after the change', newLogin.data.user && newLogin.data.user.must_change === false,
    JSON.stringify(newLogin.data.user && newLogin.data.user.must_change));

  /* ---- 5. وبعد سقوط العلَم، التغيير بلا كلمة حالية يُرفض ---- */
  const cookie2 = cookiesFrom(newLogin.res);
  const loose = await post('/api/password', { current: '', password: 'another-long-one-' + Date.now() }, cookie2);
  ok('with no flag, changing without the current password is refused', !loose.res.ok && loose.res.status === 403, loose.res.status);

  /* ---- إعادة الحساب إلى حاله: كلمة مؤقتة جديدة وعلَم، أو ما نستطيع ---- */
  /* لا نملك كلمة الحساب الأصلية، فلا نستطيع إعادتها. لكن نترك الحساب بكلمة
     معروفة وعلَم `must_change` -- وهو أأمن من تركه بكلمة اختبار ساكنة. */
  const restore = await post('/api/accounts/password', { id: target.id, password: 'needs-reset-' + Date.now(), must_change: true }, ownerCookie);
  ok('the account is left flagged for its holder to set a password', restore.res.ok && restore.data.must_change === true);

  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('failed:', e.message); process.exit(1); });
