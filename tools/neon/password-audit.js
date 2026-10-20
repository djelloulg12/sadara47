/* هل كلمات المرور المنقولة تطابق الحسابات؟ قراءة فقط.
   ----------------------------------------------------------------------------
   login-details.csv يحمل 226 حسابًا بكلمة مرور نصّية (أُعيد تعيينها 2026-10-17).
   والسؤال: هل كل حساب يستطيع الدخول له كلمة مرور في هذا الملف؟ ومن ينقص؟

   Run: node tools\neon\password-audit.js
*/
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const url = require('../neon-env').dbUrl();

const CSV = path.join(os.homedir(), '.local', 'share', 'sadara-backup', 'login-details.csv');

function parseCsv(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    /* بسيط: لا فواصل داخل الحقول هنا (اسم/هاتف/بريد/معرّف/كلمة). */
    const p = line.split(',');
    if (p.length < 5) continue;
    out.push({ name: p[0], phone: p[1], email: p[2], uid: p[3], password: p[4] });
  }
  return out;
}

(async () => {
  const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));
  console.log('login-details.csv accounts : ' + rows.length);

  const pg = require('pg');
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const app = (await c.query('select id, email, role, password_hash from public.app_users')).rows;
  const sad = (await c.query('select uid, email, role from sadara.users')).rows;
  console.log('public.app_users accounts : ' + app.length);
  console.log('sadara.users accounts     : ' + sad.length);

  const csvByEmail = new Map(rows.filter(r => r.email).map(r => [r.email.toLowerCase(), r]));
  const csvById = new Map(rows.filter(r => r.uid).map(r => [r.uid, r]));

  /* 1. الحسابات التي لها كلمة مرور معروفة؟ */
  const appWithPwd = app.filter(u => u.email && csvByEmail.has(u.email.toLowerCase()));
  console.log('');
  console.log('app_users with a known password : ' + appWithPwd.length + ' / ' + app.length);
  const noPwd = app.filter(u => !u.email || !csvByEmail.has(u.email.toLowerCase()));
  if (noPwd.length) {
    console.log('app_users WITHOUT a password (' + noPwd.length + '):');
    noPwd.slice(0, 15).forEach(u => console.log('   ' + (u.email || '(no email)') + '  role=' + u.role));
    if (noPwd.length > 15) console.log('   ... and ' + (noPwd.length - 15) + ' more');
  }

  /* 2. هل كلمة المرور النصّية تُخزَّن في app_users أم لا؟ */
  const withHash = app.filter(u => u.password_hash).length;
  console.log('');
  console.log('app_users rows carrying a password_hash : ' + withHash);

  /* 3. أدوار الحسابات التي لها كلمة مرور. */
  const byRole = {};
  appWithPwd.forEach(u => { byRole[u.role] = (byRole[u.role] || 0) + 1; });
  console.log('roles of accounts with a password: '
    + Object.entries(byRole).map(([k, v]) => k + '=' + v).join(', '));

  await c.end();
})().catch(e => { console.log('failed:', e.message); process.exit(1); });
