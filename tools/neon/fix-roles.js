/* تصحيح أدوار public.app_users من المصدر الحقيقي: مستندات sadara.users.
   ----------------------------------------------------------------------------
   المشكلة: عند رفع الحسابات إلى app_users، أُعطي **83 حسابًا** الدور 'coach'
   افتراضيًا. والدور 'coach' ليس زينة: يفتح شاشة الحضور ويكتب على سجلّ
   الأطفال. و83 منهم لم يملأ دورًا في حياتهم -- رُفعوا ثم نُسيوا.

   والقاعدة هنا: دور الحساب هو ما يقوله مستند المستخدم في `sadara.users`.
   ومن لا مستند له (لم يكمل التسجيل) دوره 'member' -- لا 'coach'.

   وهذا السكربت **يُصلح الدور فقط**. لا يمسّ كلمة مرور، ولا صفًّا ليس فيه
   خلل، ولا يحذف حسابًا واحدًا.

   Run:  node tools\neon\fix-roles.js           (يعرض ما سيفعله)
         node tools\neon\fix-roles.js --write   (يُصلح فعلًا)
*/
'use strict';
const url = require('../neon-env').dbUrl();
const WRITE = process.argv.includes('--write');

/* الأدوار التي تمنح كتابة على سجلّ الأطفال. `coach` أخطرها هنا. */
const STAFF = ['owner', 'admin', 'president', 'manager', 'coach'];

(async () => {
  const pg = require('pg');
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  /* الدور الصحيح لكل بريد: من sadara.users (uid) أولًا، ثم من firestore_path. */
  const sad = (await c.query(
    'select uid, email, role, raw->>\'role\' raw_role from sadara.users')).rows;
  const byEmail = new Map();
  for (const r of sad) {
    if (!r.email) continue;
    /* العمود أولًا، ثم raw احتياطًا؛ ولا قيمة افتراضية تُخترع هنا. */
    byEmail.set(r.email.toLowerCase(), r.role || r.raw_role || null);
  }

  const app = (await c.query('select id, email, role from public.app_users')).rows;
  const plan = [];
  for (const u of app) {
    if (!u.email) continue;
    const key = u.email.toLowerCase();
    const truth = byEmail.has(key) ? byEmail.get(key) : null;
    /* لا مستند مستخدم = لم يكمل التسجيل = ولي/عضو، لا مدرب. */
    const want = truth || 'member';
    if (want !== u.role) plan.push({ email: u.email, from: u.role, to: want });
  }

  console.log('accounts in app_users : ' + app.length);
  console.log('accounts in sadara     : ' + sad.length);
  console.log('roles to correct       : ' + plan.length);
  console.log('');
  const summary = {};
  plan.forEach(p => { const k = (p.from || '(null)') + ' -> ' + p.to; summary[k] = (summary[k] || 0) + 1; });
  Object.entries(summary).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('  ' + k + ': ' + v));
  console.log('');
  const losing = plan.filter(p => STAFF.indexOf(p.from) !== -1 && STAFF.indexOf(p.to) === -1);
  if (losing.length) {
    console.log('accounts that LOSE staff rights (this is the safety fix): ' + losing.length);
    losing.slice(0, 20).forEach(p => console.log('   ' + p.email + '  ' + p.from + ' -> ' + p.to));
    if (losing.length > 20) console.log('   ... and ' + (losing.length - 20) + ' more');
  }
  const gaining = plan.filter(p => STAFF.indexOf(p.to) !== -1 && STAFF.indexOf(p.from) === -1);
  if (gaining.length) {
    console.log('accounts that GAIN staff rights (check these by hand): ' + gaining.length);
    gaining.forEach(p => console.log('   ' + p.email + '  ' + p.from + ' -> ' + p.to));
  }

  if (!WRITE) {
    await c.end();
    console.log('\nDry run only. Re-run with --write to apply the role corrections.');
    return;
  }

  await c.query('begin');
  try {
    let n = 0;
    for (const p of plan) {
      await c.query('update public.app_users set role=$1 where lower(email)=$2', [p.to, p.email.toLowerCase()]);
      n++;
    }
    await c.query('commit');
    console.log('\ncorrected ' + n + ' role(s). Nothing else was touched.');
  } catch (e) {
    await c.query('rollback');
    console.log('failed, nothing changed:', e.message);
    await c.end();
    process.exit(1);
  }
  const after = await c.query("select role, count(*)::int n from public.app_users group by role order by n desc");
  console.log('app_users roles now: ' + after.rows.map(r => r.role + '=' + r.n).join(', '));
  const total = await c.query('select count(*)::int n from public.app_users');
  console.log('app_users rows: ' + total.rows[0].n + ' (nothing deleted)');
  await c.end();
})().catch(e => { console.log('failed:', e.message); process.exit(1); });
