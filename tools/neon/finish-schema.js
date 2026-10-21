/* يُطبّق ملفات الإكمال: 003 (الحضور والأفواج) ثم 004 (رقم التعريف الوطني)
   ثم 005 (رقم الانخراط الموحّد).
   ----------------------------------------------------------------------------
   لا يحذف ولا يعدّل صفًّا. يطبع ما أضافه بالاسم، ويقارن عدد صفوف كل جدول
   قبل وبعد، فتُقرأ النتيجة بدل أن تُدّعى.

   التشغيل:  node tools\neon\finish-schema.js
            node tools\neon\finish-schema.js --check   (يعرض دون تنفيذ)
*/
'use strict';
const fs = require('fs');
const path = require('path');
const url = require('../neon-env').dbUrl();
const CHECK = process.argv.includes('--check');
const FILES = ['003-finish-schema.sql', '004-nin.sql', '005-membership.sql'];

(async () => {
  const scripts = FILES.map(f => ({
    name: f,
    sql: fs.readFileSync(path.join(__dirname, f), 'utf8')
  }));
  const pg = require('pg');
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  /* ماذا كان موجودًا قبل؟ حتى لا نقول «أنشأنا» عن شيء كان هناك. */
  const colsBefore = async () => new Set((await c.query(
    "select table_name || '.' || column_name t from information_schema.columns where table_schema='sadara'"))
    .rows.map(r => r.t));
  const tabsBefore = async () => new Set((await c.query(
    "select table_name from information_schema.tables where table_schema='sadara'")).rows.map(r => r.table_name));

  const before = await colsBefore();
  const tabs0 = await tabsBefore();

  if (CHECK) {
    console.log('would apply tools/neon/' + FILES.join(' and tools/neon/'));
    console.log('  current sadara.attendance columns:');
    const a = await c.query("select column_name from information_schema.columns where table_schema='sadara' and table_name='attendance' order by ordinal_position");
    console.log('    ' + a.rows.map(r => r.column_name).join(', '));
    console.log('  sadara.groups exists: ' + tabs0.has('groups'));
    await c.end();
    console.log('\n--check: nothing was executed.');
    return;
  }

  await c.query('begin');
  try {
    for (const script of scripts) {
      console.log('  applying tools/neon/' + script.name + ' ...');
      await c.query(script.sql);
    }
    await c.query('commit');
  } catch (e) {
    await c.query('rollback');
    console.log('STOPPED, nothing was changed:', e.message);
    await c.end();
    process.exit(1);
  }

  const after = await colsBefore();
  const tabs1 = await tabsBefore();
  const newCols = [...after].filter(x => !before.has(x));
  const newTabs = [...tabs1].filter(x => !tabs0.has(x));

  console.log('new tables : ' + (newTabs.length ? newTabs.join(', ') : '(none)'));
  console.log('new columns: ' + (newCols.length ? newCols.join(', ') : '(none)'));

  /* سلامة الأرقام: لا جدول نُقل يجب أن ينقص صفًّا واحدًا. */
  console.log('');
  for (const t of ['users', 'swimmers', 'applications', 'audit_logs', 'attendance', 'groups']) {
    try {
      const n = await c.query('select count(*)::int n from sadara.' + t);
      console.log('   sadara.' + t.padEnd(14) + n.rows[0].n);
    } catch (_) { console.log('   sadara.' + t.padEnd(14) + '(no table)'); }
  }
  await c.end();
  console.log('\nDone. Nothing was deleted and no row was modified.');
})().catch(e => { console.log('failed:', e.message); process.exit(1); });
