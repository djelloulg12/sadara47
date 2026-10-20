/* اختبار الدخول على الخادم الحيّ: كلمة مرور صحيحة تُقبل، وخاطئة تُردّ.
   يقرأ كلمة المرور من login-details.csv لثلاثة حسابات حقيقية.
   Run: node tools\neon\server\smoke-login.js
*/
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:4180';
const CSV = path.join(os.homedir(), '.local', 'share', 'sadara-backup', 'login-details.csv');

const rows = fs.readFileSync(CSV, 'utf8').split(/\r?\n/)
  .filter(l => l.trim() && !l.startsWith('#'))
  .map(l => l.split(','))
  .filter(p => p.length >= 5)
  .map(p => ({ name: p[0], email: p[2].toLowerCase(), password: p[4] }));

async function post(url, body, cookie) {
  const res = await fetch(BASE + url, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}),
    body: JSON.stringify(body)
  });
  return { status: res.status, json: await res.json().catch(() => ({})), setCookie: res.headers.get('set-cookie') };
}

(async () => {
  let pass = 0, fail = 0;
  /* ثلاثة حسابات موزّعة. */
  const picks = [rows[0], rows[Math.floor(rows.length / 2)], rows[rows.length - 1]];
  for (const r of picks) {
    const good = await post('/api/login', { email: r.email, password: r.password });
    const okGood = good.status === 200 && good.json.user && good.json.user.id;
    const hasCookie = !!(good.setCookie && good.setCookie.includes('sadara_session'));
    /* ثم الجلسة تُستعمل. */
    let sessionOk = false;
    if (hasCookie) {
      const cookie = good.setCookie.split(';')[0];
      const s = await fetch(BASE + '/api/session', { headers: { Cookie: cookie } });
      const sj = await s.json().catch(() => ({}));
      sessionOk = s.status === 200 && sj.user && sj.user.id === good.json.user.id;
    }
    const bad = await post('/api/login', { email: r.email, password: 'definitely-wrong' });
    const okBad = bad.status === 401;

    const allOk = okGood && hasCookie && sessionOk && okBad;
    console.log((allOk ? 'PASS  ' : 'FAIL  ') + r.email.padEnd(38)
      + ' login=' + (okGood ? 'ok' : 'NO')
      + ' cookie=' + (hasCookie ? 'ok' : 'NO')
      + ' session=' + (sessionOk ? 'ok' : 'NO')
      + ' wrongRefused=' + (okBad ? 'ok' : 'NO'));
    if (allOk) pass++; else fail++;
  }
  /* وجلسة بلا كوكي تُرفض. */
  const noAuth = await fetch(BASE + '/api/session');
  console.log(((noAuth.status === 401) ? 'PASS  ' : 'FAIL  ') + 'no cookie -> 401 (got ' + noAuth.status + ')');
  if (noAuth.status === 401) pass++; else fail++;

  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('smoke test failed to run:', e.message); process.exit(1); });
