/* تنظيف: يحذف الجداول التي أنشأها tools/schema-postgres.sql في مخطط `public`
   ولم تُلمس (كلها صفر صفوف)، ولا يلمس `app_users` ولا مخطط `sadara`.

   الحذر: يرفض أن يحذف أي جدول فيه صفّ واحد. فإن وُجد، يتوقّف ويقول.

   Run: node tools\neon\clean-public.js --check
        node tools\neon\clean-public.js --yes
*/
const url = require('../neon-env').dbUrl();
const CHECK = process.argv.includes('--check');
const YES = process.argv.includes('--yes');

/* ما أنشأه ملفي في public، ولا شيء غيره. */
const MINE = ['swimmers', 'applications', 'guardians', 'attendance', 'groups', 'app_config', 'counters',
  'cards', 'subscription_plans', 'fee_settings', 'facilities', 'schedules', 'notices', 'payments',
  'coach_requirements', 'audit_logs', 'visits', 'claims', 'member_profiles'];

(async () => {
  if (!CHECK && !YES) { console.log('pass --check or --yes'); process.exit(2); }
  const pg = require('pg');
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const existing = (await c.query(
    "select table_name from information_schema.tables where table_schema='public'")).rows.map(r => r.table_name);

  const found = [], busy = [];
  for (const t of MINE) {
    if (!existing.includes(t)) continue;
    const n = await c.query('select count(*)::int n from public."' + t + '"');
    (n.rows[0].n === 0 ? found : busy).push({ t, n: n.rows[0].n });
  }

  if (busy.length) {
    console.log('STOPPING: these tables hold rows and will not be touched:');
    busy.forEach(x => console.log('  - public.' + x.t + ': ' + x.n + ' rows'));
    await c.end();
    process.exit(1);
  }
  if (!found.length) { console.log('nothing to clean: no empty copy-tables in public'); await c.end(); return; }

  console.log((CHECK ? 'would drop' : 'dropping') + ' ' + found.length + ' empty table(s) in public:');
  found.forEach(x => console.log('  - public.' + x.t));
  if (CHECK) { await c.end(); console.log('\n--check: nothing dropped.'); return; }

  await c.query('begin');
  try {
    for (const x of found) await c.query('drop table if exists public."' + x.t + '"');
    await c.query('commit');
  } catch (e) {
    await c.query('rollback');
    console.log('failed, nothing dropped:', e.message);
    await c.end();
    process.exit(1);
  }
  const left = (await c.query(
    "select table_name from information_schema.tables where table_schema='public' order by table_name")).rows.map(r => r.table_name);
  console.log('\npublic now holds: ' + left.join(', '));
  const n = await c.query('select count(*)::int n from app_users');
  console.log('app_users untouched: ' + n.rows[0].n);
  await c.end();
})().catch(e => { console.log('failed:', e.message); process.exit(1); });
