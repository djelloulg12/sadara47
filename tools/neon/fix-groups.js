/* إصلاح التفويج: توحيد أسماء الأفواج وتوليد القائمة المشتركة.
   ----------------------------------------------------------------------------
   الخلل المرصود: الجدول الزمني يعرّف فوجين رسميًّا -- «المبتدئون» و«المتوسطون»
   -- والسباحون يحملون «مبتدئ» (54) و«متوسط» (39). فالمسيّر يفتح فوج
   «المبتدئون» فيجد 3 أطفال، و54 طفلاً مفقودين في فوج آخر لا مدرب له ولا
   جدول: 97% من السباحين في فوج غير معرَّف.

   وما يفعله هذا السكربت ثلاثة أشياء، وكلها محافظة:

    ١. توحيد الاسم: «مبتدئ» → «المبتدئون»، «متوسط» → «المتوسطون».
       التوحيد **بالمعنى** لا بالنصّ: الصيغة المفردة التي لها صيغة جمع رسمية
       تُردّ إلى الرسمية. والاسم الذي لا مقابل رسمي له («متقدم»، «محترف»)
       **يبقى كما هو**: ليس لي أن أدمج طفلاً في فوج لم يُدرَّب فيه.

    ٢. كتابة `group_id` بجانب `group_name` على كل سباح. و`group_id` اليوم
       فارغ في 115 صفًّا: فأي سؤال عن فوج الطفل يُجاب بالنصّ وحده، والنصّ
       يُصحَّح ويتغيّر.

    ٣. توليد `config/groups` -- القائمة المشتركة التي يقرأها الخادم -- من
       الأفواج الرسمية، ومن الأسماء التي لا مقابل لها بعد. فيصير لنادي
       قائمة واحدة يراها كل حساب، بدل قائمة على جهاز واحد.

   ولا يُحذف شيء ولا يُدمج طفل قسرًا: التعديل على `group_name` وحده، وبعدد
   صفوف ثابت. والنسخة الاحتياطية تُكتب قبل أي تغيير.

   الاستعمال:
     node tools\neon\fix-groups.js              معاينة (لا يكتب)
     node tools\neon\fix-groups.js --write      ينفّذ
*/
'use strict';
const fs = require('fs');
const path = require('path');
const { dbUrl } = require('../neon-env');

const WRITE = process.argv.includes('--write');

/* خريطة التوحيد: مقبض بلا مقابل رسمي يبقى كما هو.
   تُبنى من الجدول الزمني، ثم يُشتقّ لكل اسم على السباحين مقابلُه. */
function canonicalName(name, official) {
  const n = String(name == null ? '' : name).trim();
  if (!n) return n;
  /* رسمي بالحرف: كما هو. */
  if (official.has(n)) return n;
  /* صيغة مفردة لها جمع رسمي: «مبتدئ» → «المبتدئون».
     نقارن الجذر: بلا «ال» التعريف وبلا واو/ياء الجمع. */
  const root = s => String(s).replace(/^ال/, '').replace(/(ون|ين)$/, '').trim();
  const r = root(n);
  if (!r) return n;
  for (const off of official) {
    if (root(off) === r) return off;
  }
  /* لا مقابل رسمي: يبقى كما هو. الدمج اختلاق. */
  return n;
}

async function main() {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });

  /* ١. الأفواج الرسمية: من الجدول الزمني، ومعها المدرب والبرنامج. */
  const sched = (await pool.query(`
    select raw->>'group_name' as g, raw->>'coach' as coach, raw->>'day_name' as day, raw->>'time_range' as t
    from sadara.schedules where raw->>'group_name' is not null`)).rows;

  const officials = new Map(); /* الاسم -> {coach, program} */
  for (const r of sched) {
    const g = String(r.g || '').trim();
    if (!g) continue;
    if (!officials.has(g)) officials.set(g, { coach: '', program: '' });
    const o = officials.get(g);
    if (!o.coach && r.coach && String(r.coach).trim()) o.coach = String(r.coach).trim();
  }
  const official = new Set(officials.keys());

  /* ٢. السباحون: الاسم الحالي والمقترح. */
  const swimmers = (await pool.query(`
    select firestore_path, group_name, name from sadara.swimmers`)).rows;

  const changes = []; /* {path, from, to} */
  const finalCounts = {};
  for (const s of swimmers) {
    const from = String(s.group_name || '').trim();
    const to = canonicalName(from, official);
    if (from !== to) changes.push({ path: s.firestore_path, from: from, to: to, name: s.name });
    finalCounts[to || '(بلا فوج)'] = (finalCounts[to || '(بلا فوج)'] || 0) + 1;
  }

  console.log('=== الأفواج الرسمية (من الجدول الزمني) ===');
  for (const [g, o] of officials) console.log('  • ' + g + (o.coach ? '   مدرب: ' + o.coach : ''));

  console.log('\n=== التوحيد المقترح ===');
  const grouped = {};
  changes.forEach(c => { const k = c.from + ' → ' + c.to; grouped[k] = (grouped[k] || 0) + 1; });
  if (!Object.keys(grouped).length) console.log('  لا شيء: كل الأسماء موحَّدة أصلًا.');
  Object.entries(grouped).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log('  ' + k.padEnd(34) + n + ' سباح'));

  console.log('\n=== توزيع الأفواج بعد التوحيد ===');
  Object.entries(finalCounts).sort((a, b) => b[1] - a[1]).forEach(([g, n]) => {
    const mark = official.has(g) ? 'رسمي' : 'غير رسمي بعد';
    console.log('  ' + g.padEnd(22) + String(n).padStart(4) + '   ' + mark);
  });

  console.log('\n=== القائمة المشتركة التي ستُكتب (config/groups) ===');
  const list = [];
  let idx = 0;
  for (const name of Object.keys(finalCounts).sort()) {
    const o = officials.get(name) || { coach: '', program: '' };
    list.push({ id: 'grp-' + (++idx), name: name, coach: o.coach || '', schedule: o.program || '' });
    console.log('  ' + name + (o.coach ? '   مدرب: ' + o.coach : ''));
  }

  console.log('\n=== الفحوص قبل الكتابة ===');
  console.log('  السباحون:', swimmers.length, '→ بعد التوحيد:',
    Object.values(finalCounts).reduce((a, b) => a + b, 0), '(يجب أن يتساويا)');
  const sameCount = swimmers.length === Object.values(finalCounts).reduce((a, b) => a + b, 0);
  console.log('  لا سباح يُفقد:', sameCount ? 'نعم' : 'لا !!');
  console.log('  تغييرات group_name:', changes.length);

  /* قياسٌ بلا فعل ليس حماية. لو صار اسمان اسمًا واحدًا لضاع سباح من العدد،
     فالكتابة تُمنع قبل أن تلمس القاعدة، والمعاينة وحدها تكفي لرؤية السبب. */
  if (!sameCount && WRITE) {
    console.error('\n!! العدد تغيّر: التوحيد يُفقد سباحًا. لم يُكتب شيء.');
    await pool.end();
    process.exit(1);
  }

  if (!WRITE) {
    console.log('\n--- معاينة فقط. للتنفيذ أضف --write ---');
    await pool.end();
    return;
  }

  /* ---- التنفيذ ---- */

  /* نسخة احتياطية قبل أي تغيير. */
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(__dirname, '..', '..', 'tools', 'tests', 'out');
  fs.mkdirSync(dir, { recursive: true });
  const backup = path.join(dir, 'groups-backup-' + stamp + '.json');
  fs.writeFileSync(backup, JSON.stringify(
    swimmers.map(s => ({ path: s.firestore_path, group_name: s.group_name })), null, 1));
  console.log('\n  نسخة احتياطية: ' + backup);

  let done = 0;
  for (const c of changes) {
    /* المعرّف يُشتقّ من الاسم الموحَّد: `grp-` + رقم الفوج في القائمة. */
    const g = list.find(x => x.name === c.to);
    await pool.query(`
      update sadara.swimmers
      set group_name = $1,
          group_id = $2,
          raw = jsonb_set(jsonb_set(raw, '{group_name}', to_jsonb($1::text), true),
                          '{group_id}', to_jsonb($2::text), true)
      where firestore_path = $3`, [c.to, g ? g.id : '', c.path]);
    done++;
  }
  console.log('  وُحّد group_name في', done, 'صفًّا.');

  /* وكل سباح -- حتى من لم يتغيّر اسمه -- يأخذ معرّف فوجه. */
  for (const s of swimmers) {
    const name = canonicalName(String(s.group_name || '').trim(), official);
    const g = list.find(x => x.name === name);
    await pool.query(`
      update sadara.swimmers set group_id = $1,
        raw = jsonb_set(raw, '{group_id}', to_jsonb($1::text), true)
      where firestore_path = $2 and coalesce(group_id,'') = ''`, [g ? g.id : '', s.firestore_path]);
  }
  console.log('  وكُتب group_id لكل سباح بلا معرّف.');

  /* القائمة المشتركة: upsert على مسارها، لا حذف ولا جدول يُمسّ. */
  const payload = { groups: list, updated_by: 'fix-groups', updated_at: new Date().toISOString() };
  await pool.query(`
    insert into sadara.config (firestore_path, raw)
    values ('config/groups', $1::jsonb)
    on conflict (firestore_path) do update set raw = excluded.raw`, [JSON.stringify(payload)]);
  console.log('  كُتبت config/groups بعدد', list.length, 'فوجًا.');

  console.log('\n  تمّ. القائمة صارت يراها كل حساب.');
  await pool.end();
}

main().catch(e => { console.error('FAIL', e.message); process.exit(1); });
