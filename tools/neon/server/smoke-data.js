/* اختبار قراءة البيانات من الخادم: هل تعود سجلات حقيقية بالشكل الصحيح؟
   Run: node tools\neon\server\smoke-data.js
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
  .map(p => ({ email: p[2].toLowerCase(), password: p[4] }));

async function login(email, password) {
  const res = await fetch(BASE + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  return { status: res.status, cookie };
}

async function get(url, cookie) {
  const res = await fetch(BASE + url, { headers: { Cookie: cookie } });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

(async () => {
  let pass = 0, fail = 0;
  const check = (label, ok, detail) => {
    console.log((ok ? 'PASS  ' : 'FAIL  ') + label + (detail ? '  ' + detail : ''));
    ok ? pass++ : fail++;
  };

  const ownerPw = process.env.OWNER_PW;
  if (!ownerPw) {
    console.log('Set OWNER_PW to the owner password before running this.');
    process.exit(2);
  }
  const owner = await login('kabrag12@gmail.com', ownerPw);
  check('owner can sign in', owner.status === 200);

  const sw = await get('/api/swimmers', owner.cookie);
  check('GET /api/swimmers returns data', sw.status === 200 && Array.isArray(sw.json) && sw.json.length > 0,
    sw.json.length ? '(' + sw.json.length + ' swimmers)' : ('status ' + sw.status));
  if (Array.isArray(sw.json) && sw.json[0]) {
    const s = sw.json[0];
    check('  a swimmer has id + name', !!(s.id && (s.name || s.first_name_ar)),
      'id=' + s.id + ' name=' + (s.name || s.first_name_ar || '?'));
  }

  const att = await get('/api/attendance', owner.cookie);
  check('GET /api/attendance works', att.status === 200 && Array.isArray(att.json),
    '(' + (att.json.length || 0) + ' rows)');

  const reg = await get('/api/registration', owner.cookie);
  check('GET /api/registration works (public read)',
    reg.status === 200 && typeof reg.json.open === 'boolean',
    'open=' + reg.json.open);

  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('failed:', e.message); process.exit(1); });
