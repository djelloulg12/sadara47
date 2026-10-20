/* عرض صفوف الاختبار التي تركتها فحوصُ هذه الجولة، وحذفها.
   ----------------------------------------------------------------------------
   كل ما هنا كتبته أدوات الاختبار، لا المنصة: صفوف `audit_logs` من ضبط كلمة
   المرور، وصفّ `config` من فحص باب التسجيل. لا نلمس صفًّا كتبته المنصة.
   وشكلُ صفّ الاختبار معروف: `firestore_path` فيه `password_` أو الهدف معرّفه.

   Run: node tools\neon\clean-test-rows.js          (يعرض)
        node tools\neon\clean-test-rows.js --write  (يحذف صفوف الاختبار فقط)
*/
'use strict';
const url = require('../neon-env').dbUrl();
const WRITE = process.argv.includes('--write');

(async () => {
  const pg = require('pg');
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const audit = await c.query(
    "select firestore_path, raw->>'action' as action, raw->>'target' as target, raw->>'at' as at from sadara.audit_logs order by firestore_path");
  /* صفوف الاختبار نوعان معروفان: ضبط كلمة المرور (`password_`)، وحفظ الأفواج
     الذي جرّبه فحص المسارات. كلاهما كتبه الاختبار، لا المنصة. */
  const testAudit = audit.rows.filter(r =>
    String(r.firestore_path).indexOf('audit_logs/password_') === 0
    || String(r.action) === 'groups_saved');
  console.log('audit_logs total: ' + audit.rowCount);
  console.log('  written by password tests: ' + testAudit.length);
  testAudit.forEach(r => console.log('     ' + r.firestore_path + '  target=' + r.target + '  at=' + r.at));

  const cfg = await c.query('select firestore_path, raw from sadara.config order by firestore_path');
  console.log('config rows: ' + cfg.rowCount);
  cfg.rows.forEach(r => console.log('     ' + r.firestore_path));

  const totalAfterAudit = audit.rowCount - testAudit.length;
  console.log('');
  console.log('after cleanup: audit_logs = ' + totalAfterAudit + ' (club wrote 182)');

  if (!WRITE) { await c.end(); console.log('\nDry run. Re-run with --write to remove only the test rows.'); return; }

  await c.query('begin');
  try {
    const delAudit = await c.query("delete from sadara.audit_logs where firestore_path like 'audit_logs/password_%' or raw->>'action' = 'groups_saved'");
    /* و`config/groups` كتبه فحص المسارات بأفواج وهمية. حذفه يُعيد المنصة إلى
       «لا أفواج بعد»، وهو حالها الحقيقي. ولا نلمس `config/owners` ولا
       `config/registration`. */
    const delGroups = await c.query("delete from sadara.config where firestore_path='config/groups' and raw->>'updated_by' is not null");
    await c.query('commit');
    console.log('removed ' + delAudit.rowCount + ' test audit row(s), '
      + delGroups.rowCount + ' test groups config row(s).');
  } catch (e) { await c.query('rollback'); console.log('failed, nothing removed:', e.message); await c.end(); process.exit(1); }

  const after = await c.query('select count(*)::int n from sadara.audit_logs');
  console.log('audit_logs now: ' + after.rows[0].n);
  await c.end();
})().catch(e => { console.log('failed:', e.message); process.exit(1); });
