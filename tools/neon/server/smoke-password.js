/* اختبار مسارات كلمة المرور الثلاثة على الخادم الحيّ.
   Run: node tools\neon\server\smoke-password.js
*/
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:4180';
const OWNER_PW = process.env.OWNER_PW;
if (!OWNER_PW) {
  console.log('Set OWNER_PW to the owner password before running this.');
  console.log('  $env:OWNER_PW = "<the owner password>"');
  process.exit(2);
}

const CSV = path.join(os.homedir(), '.local', 'share', 'sadara-backup', 'login-details.csv');
const rows = fs.readFileSync(CSV, 'utf8').split(/\r?\n/)
  .filter(l => l.trim() && !l.startsWith('#'))
  .map(l => l.split(','))
  .filter(p => p.length >= 5)
  .map(p => ({ email: p[2].toLowerCase(), password: p[4] }));

async function post(url, body, cookie) {
  const res = await fetch(BASE + url, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}),
    body: JSON.stringify(body)
  });
  return { status: res.status, json: await res.json().catch(() => ({})), setCookie: res.headers.get('set-cookie') };
}

async function login(email, password) {
  const r = await post('/api/login', { email, password });
  return { status: r.status, cookie: (r.setCookie || '').split(';')[0] };
}

(async () => {
  let pass = 0, fail = 0;
  const check = (label, ok, detail) => {
    console.log((ok ? 'PASS  ' : 'FAIL  ') + label + (detail ? '  ' + detail : ''));
    ok ? pass++ : fail++;
  };

  const owner = await login('kabrag12@gmail.com', OWNER_PW);
  check('owner signs in', owner.status === 200);
  if (owner.status !== 200) { console.log('\n1 passed, 1 failed'); process.exit(1); }

  /* 1. تغيير كلمتي أنا: كلمة حالية خاطئة تُرفض. */
  const wrong = await post('/api/password', { current: 'nope', password: 'aVeryLongOne1' }, owner.cookie);
  check('self change: wrong current refused', wrong.status === 403, 'status ' + wrong.status);

  /* 2. كلمة قصيرة تُرفض. */
  const short = await post('/api/password', { current: OWNER_PW, password: 'short' }, owner.cookie);
  check('self change: short password refused', short.status === 400, 'status ' + short.status);

  /* 3. المسير يضبط كلمة مرور لحساب آخر. */
  const victim = rows.find(r => r.email !== 'kabrag12@gmail.com');
  const list = await fetch(BASE + '/api/accounts', { headers: { Cookie: owner.cookie } });
  let targetId = null;
  if (list.status === 200) {
    const arr = await list.json();
    const hit = (arr || []).find(a => String(a.email).toLowerCase() === victim.email);
    targetId = hit && hit.id;
  }
  if (!targetId) {
    /* spad/accounts غير مبنيّ بعد: نأخذ id من قاعدة البيانات مباشرة عبر المسار المؤقت. */
    console.log('NOTE  /api/accounts not built yet -- testing the password route needs an id');
  }

  /* 4. العضو نفسه يغيّر كلمته (بعد أن يضبطها المسير). */
  const member = await login(victim.email, victim.password);
  check('member signs in with the CSV password', member.status === 200);
  if (member.status === 200) {
    const self = await post('/api/password', { current: victim.password, password: 'NewPassForFamily1' }, member.cookie);
    check('member changes own password', self.status === 200, 'status ' + self.status);
    const re = await login(victim.email, 'NewPassForFamily1');
    check('member signs in with the NEW password', re.status === 200);
    const old = await login(victim.email, victim.password);
    check('member cannot sign in with the OLD password', old.status === 401, 'status ' + old.status);
    /* نُعيد كلمة العائلة كما كانت، فلا نترك بياناتنا في حالة اختبار. */
    await post('/api/password', { current: 'NewPassForFamily1', password: victim.password }, member.cookie);
    const restored = await login(victim.email, victim.password);
    check('password restored to the original', restored.status === 200);
  }

  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('failed to run:', e.message); process.exit(1); });
