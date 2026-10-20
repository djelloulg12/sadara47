/* حذف الأفواج الأربعة القديمة من قائمة النادي، ونقل من كان فيها إلى «غير مفرز».
   ----------------------------------------------------------------------------
   «المبتدئون» و«المتوسطون» و«متقدم» و«محترف» أفواجٌ ورثها النادي من أول
   استيراد، ولم يعد يريدها. وكانت تعود بعد كل حذف لسببين، وكلاهما أُصلح:
   معالج قديم يحفظ محليًّا ولا يكتب على الخادم، واشتقاقٌ للأفواج من أسماء
   السباحين. فالقائمة اليوم هي `config/groups` وحدها.

   وهذا السكربت يفعل ما يفعله `PUT /api/groups` حين تُحذف الأفواج من الصفحة،
   بالحرف نفسه:
     ١. يكتب القائمة بلا الأربعة، ويُبقي كل فوج آخر كما هو.
     ٢. يطابق كل سباح بفوجه: المعرّف، ثم الاسم، ثم جذر الاسم.
     ٣. من لم يجد فوجه صار «غير مفرز» (`grp-unassigned`).
     ٤. لا يُحذف سباح ولا صفّ: التعديل على `group_name` و`group_id` وحده.

   والنسخة الاحتياطية تُكتب قبل أي تغيير.

   الاستعمال:
     node tools\neon\remove-legacy-groups.js            معاينة (لا يكتب)
     node tools\neon\remove-legacy-groups.js --write    ينفّذ
*/
'use strict';
const fs = require('fs');
const path = require('path');
const { dbUrl } = require('../neon-env');

const WRITE = process.argv.includes('--write');
const LEGACY = ['المبتدئون', 'المتوسطون', 'متقدم', 'محترف'];
const UNASSIGNED = { id: 'grp-unassigned', name: 'غير مفرز' };

const nameRoot = s => String(s || '').replace(/^ال/, '').replace(/(ون|ين)$/, '').trim();

function rehome(swimmer, byId, byName, byRoot) {
  const id = String(swimmer.group_id || '').trim();
  if (id && byId.has(id)) return byId.get(id);
  const n = String(swimmer.group_name || '').trim();
  if (!n) return UNASSIGNED;
  if (byName.has(n)) return byName.get(n);
  const root = nameRoot(n);
  if (root && byRoot.has(root)) return byRoot.get(root);
  return UNASSIGNED;
}

(async () => {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });

  const cfg = await pool.query("select raw from sadara.config where firestore_path='config/groups'");
  if (!cfg.rowCount || !cfg.rows[0].raw || !Array.isArray(cfg.rows[0].raw.groups)) {
    console.log('refused: config/groups carries no list; nothing to do');
    await pool.end(); process.exit(1);
  }
  const original = cfg.rows[0].raw;
  const groups = original.groups;
  const removed = groups.filter(g => LEGACY.includes(String(g.name || '').trim()));
  const keep = groups.filter(g => !LEGACY.includes(String(g.name || '').trim()));

  const swimmers = (await pool.query(
    'select firestore_path, name, group_name, group_id from sadara.swimmers')).rows;

  const counts = {};
  for (const s of swimmers) counts[String(s.group_name || '').trim()] = (counts[String(s.group_name || '').trim()] || 0) + 1;

  console.log('=== الأفواج التي ستُحذف ===');
  if (!removed.length) console.log('  لا شيء: الأربعة ليست في القائمة أصلًا.');
  for (const g of removed) {
    const held = swimmers.filter(s => String(s.group_id || '') === String(g.id)).length;
    console.log('  • ' + g.name + '  (' + g.id + ')  يحمله بالمعرّف: ' + held
      + '  وبالاسم: ' + (counts[String(g.name).trim()] || 0));
  }

  /* المطابقة بالقائمة الباقية، كما في الخادم تمامًا. */
  const byId = new Map(keep.map(g => [String(g.id), g]));
  const byName = new Map(keep.map(g => [String(g.name), g]));
  const byRoot = new Map();
  for (const g of keep) {
    const r = nameRoot(g.name);
    if (r && !byRoot.has(r)) byRoot.set(r, g);
  }

  const moves = [];
  let parked = 0;
  for (const s of swimmers) {
    const target = rehome(s, byId, byName, byRoot);
    const sameName = String(s.group_name || '').trim() === target.name;
    const sameId = String(s.group_id || '').trim() === target.id;
    if (sameName && sameId) continue;
    if (target.id === UNASSIGNED.id) parked++;
    moves.push({ path: s.firestore_path, name: s.name, from: s.group_name || '', from_id: s.group_id || '', to: target.name, to_id: target.id });
  }

  console.log('\n=== الأثر على السباحين ===');
  console.log('  الباقون كما هم: ' + (swimmers.length - moves.length));
  console.log('  ينتقلون إلى «غير مفرز»: ' + parked);
  console.log('  مجموع السباحين قبل: ' + swimmers.length + '  بعد: ' + swimmers.length + '  (لا سباح يُفقد)');
  const byFrom = {};
  moves.forEach(m => { byFrom[m.from || '(بلا فوج)'] = (byFrom[m.from || '(بلا فوج)'] || 0) + 1; });
  Object.entries(byFrom).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log('    ' + k.padEnd(24) + n));

  console.log('\n=== القائمة بعد الحذف ===');
  for (const g of keep) console.log('  • ' + g.name);

  if (!WRITE) {
    console.log('\n--- معاينة فقط. للتنفيذ أضف --write ---');
    await pool.end();
    return;
  }

  /* ---- التنفيذ ---- */
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(__dirname, '..', 'tests', 'out');
  fs.mkdirSync(dir, { recursive: true });
  const backup = path.join(dir, 'legacy-groups-backup-' + stamp + '.json');
  fs.writeFileSync(backup, JSON.stringify({
    at: new Date().toISOString(),
    config: original,
    swimmers: swimmers.filter(s => moves.some(m => m.path === s.firestore_path))
  }, null, 1));

  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`
      insert into sadara.config (firestore_path, raw)
      values ('config/groups', $1::jsonb)
      on conflict (firestore_path) do update set raw = excluded.raw`,
      [JSON.stringify({
        groups: keep,
        updated_by: 'remove-legacy-groups',
        updated_at: new Date().toISOString()
      })]);

    for (const m of moves) {
      await client.query(`
        update sadara.swimmers
           set group_name = $1, group_id = $2,
               raw = jsonb_set(jsonb_set(raw, '{group_name}', to_jsonb($1::text), true),
                               '{group_id}', to_jsonb($2::text), true),
               updated_at = now()
         where firestore_path = $3`, [m.to, m.to_id, m.path]);
    }

    await client.query(
      `insert into sadara.audit_logs (firestore_path, raw) values ($1, $2::jsonb)`,
      ['audit/remove-legacy-groups-' + stamp, JSON.stringify({
        action: 'remove-legacy-groups',
        by: 'remove-legacy-groups',
        removed: removed.map(g => ({ id: g.id, name: g.name })),
        moved: moves.length,
        parked: parked,
        at: new Date().toISOString()
      })]);

    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }

  const after = await pool.query("select raw from sadara.config where firestore_path='config/groups'");
  const left = (after.rows[0].raw.groups || []).map(g => g.name);
  const leftLegacy = LEGACY.filter(n => left.includes(n));
  console.log('\n=== بعد ===');
  console.log('  أفواج القائمة: ' + left.length);
  console.log('  الأربعة موجودة؟ ' + (leftLegacy.length ? leftLegacy.join(', ') : 'لا'));
  console.log('  نقل إلى «غير مفرز»: ' + parked + ' سباحًا.');
  console.log('  نسخة احتياطية: ' + backup);
  await pool.end();
})().catch(e => { console.log('failed:', e.message); process.exit(1); });
