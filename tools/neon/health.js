/* سلامةُ قاعدة البيانات بعد اختبارات المسارات. قراءة فقط.
   ----------------------------------------------------------------------------
   السؤال: هل عادت كل الجداول إلى أعدادها الأصلية بعد اختبارات الكتابة؟
   الأعداد المعروفة (الـsnapshot 2026-10-17 + ما أُضيف شرعًا):
     users 247 · swimmers 115 · applications 574 · audit_logs 182
     notices 3 · schedules 12 · coach_requirements 5 · subscription_plans 3
     fee_settings 2 · facilities 1 · config 1 · counters 3 · payments 1
     attendance 0 · groups 0
   أي رقم أعلى يعني صفًّا تركه اختبار. وأي رقم أدنى يعني صفًّا فُقد -- وهو الأخطر.

   Run: node tools\neon\health.js
*/
'use strict';
const url = require('../neon-env').dbUrl();

const EXPECT = {
  users: 247, swimmers: 115, applications: 574, audit_logs: 182,
  notices: 3, schedules: 12, coach_requirements: 5, subscription_plans: 3,
  fee_settings: 2, facilities: 1, config: 1, counters: 3, payments: 1,
  attendance: 0, groups: 0
};

(async () => {
  const pg = require('pg');
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  let bad = 0;
  console.log('sadara table                now   expected   verdict');
  console.log('------------------------------------------------------');
  for (const [t, want] of Object.entries(EXPECT)) {
    let n;
    try { n = (await c.query('select count(*)::int n from sadara.' + t)).rows[0].n; }
    catch (_) { console.log('  ' + t.padEnd(26) + '  --    (no table)  MISSING'); bad++; continue; }
    const verdict = n === want ? 'ok' : (n > want ? 'EXTRA ROWS' : 'ROWS LOST');
    if (n !== want) bad++;
    console.log('  ' + t.padEnd(26) + String(n).padStart(4) + String(want).padStart(10) + '   ' + verdict);
  }
  const app = (await c.query('select count(*)::int n from public.app_users')).rows[0].n;
  console.log('  ' + 'public.app_users'.padEnd(26) + String(app).padStart(4) + String(310).padStart(10)
    + '   ' + (app === 310 ? 'ok' : 'CHANGED'));
  if (app !== 310) bad++;

  /* ولا حساب بلا كلمة مرور قابلة للتحقّق إلا غير المفعلين. */
  const withPw = (await c.query('select count(*)::int n from public.app_users where local_hash is not null')).rows[0].n;
  console.log('');
  console.log('accounts with a verifiable password : ' + withPw + ' (expected 227: the 226 + the owner)');
  if (withPw !== 227) bad++;

  await c.end();
  console.log('');
  console.log(bad ? bad + ' table(s) are not as they should be.' : 'Every table holds exactly what it should. Nothing lost, nothing extra.');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('failed:', e.message); process.exit(1); });
