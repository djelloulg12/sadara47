/* تحميل البرنامج الأسبوعي الحقيقي إلى المنصة الحيّة — بلا مساس بأي منخرط.
   -------------------------------------------------------------------------
   القاعدة: القائمة الجديدة = الأفواج الأربعة القائمة كما هي + أربعة عشر فوجًا
   من البرنامج. لماذا الإضافة لا الاستبدال؟ لأن `PUT /api/groups` يستبدل القائمة
   كاملة، ومن يُحذف فوجه يُنقل إلى «غير مفرز». والأفواج الأربعة تحمل اليوم 115
   منخرطًا (57 + 40 + 16 + 2)؛ فاستبدالها كان سيُفرغها جميعًا. فالإضافة تحفظ
   التوزيع القائم و تضيف البرنامج فوقه.

   التشغيل:
     node tools/neon/load-programme.js           # قراءة وطباعة فقط
     node tools/neon/load-programme.js --apply   # كتابة فعلية

   ولا يُعاد تشغيله بـ--apply إلا بعد مراجعة SESSIONS: التشغيل مرّتين لا يضرّ
   (الأفواج تُطابَق بالمعرّف، فلا يتغيّر أحد)، لكن قائمة البرنامج المصدرية هنا
   تبقى هي المرجع، فلا تُحدَّث من الواجهة ثم تُدهس بها. */

'use strict';
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'https://sadara-platform.onrender.com';
const EMAIL = 'kabrag12@gmail.com';
const PASSWORD = '123456';
const APPLY = process.argv.includes('--apply');

const POOL = { n: 'مسبح النوميرات', b: 'مسبح بوهراوة', w: 'مسبح واد نشو' };

/* البرنامج كما وصل، صفًّا صفًّا. الحقول: اليوم، البداية، النهاية، المسبح،
   الصنف، الجنس، المدرب، الملاحظة. والصنف الفارغ يبقى فارغًا: البرنامج نفسه
   يضع «—» في عمود الصنف لصفّين، ولا يصحّ أن أخترع لهما صنفًا. */
const SESSIONS = [
  { day: 'السبت',   start: '14:00', end: '15:30', pool: POOL.n, category: 'minnows', label: 'أصاغر إناث',  coach: 'عمر صيتي',        note: '' },
  { day: 'السبت',   start: '16:00', end: '17:30', pool: POOL.n, category: '',        label: 'ذكور',        coach: 'يوسف بوستة',      note: '' },
  { day: 'السبت',   start: '18:00', end: '19:30', pool: POOL.n, category: 'adults',  label: 'أكابر ذكور',  coach: 'عبد الحميد حيحة', note: '' },
  { day: 'الأحد',   start: '13:00', end: '14:30', pool: POOL.n, category: 'adults',  label: 'أكابر إناث',  coach: 'حفصة قسوم',       note: '' },
  { day: 'الأحد',   start: '18:00', end: '19:30', pool: POOL.b, category: 'adults',  label: 'أكابر ذكور',  coach: 'خالد خميلي',      note: '' },
  { day: 'الثلاثاء', start: '16:00', end: '17:30', pool: POOL.n, category: '',        label: 'ذكور',        coach: 'يوسف بوستة',      note: '' },
  { day: 'الثلاثاء', start: '16:00', end: '17:30', pool: POOL.w, category: 'minnows', label: 'أصاغر إناث',  coach: 'عز الدين دوادي',  note: '' },
  { day: 'الثلاثاء', start: '18:00', end: '19:30', pool: POOL.w, category: 'adults',  label: 'أكابر ذكور',  coach: '',                note: '' },
  { day: 'الثلاثاء', start: '18:00', end: '19:30', pool: POOL.b, category: 'adults',  label: 'أكابر ذكور',  coach: 'خالد خميلي',      note: '' },
  { day: 'الأربعاء', start: '13:00', end: '14:30', pool: POOL.n, category: 'adults',  label: 'أكابر إناث',  coach: 'حفصة قسوم',       note: '' },
  { day: 'الأربعاء', start: '18:00', end: '19:30', pool: POOL.n, category: 'adults',  label: 'أكابر ذكور',  coach: 'عبد الحميد حيحة', note: '' },
  { day: 'الخميس',  start: '18:00', end: '19:30', pool: POOL.w, category: 'adults',  label: 'أكابر ذكور',  coach: '',                note: '' },
  { day: 'الخميس',  start: '',      end: '',      pool: POOL.w, category: 'minnows', label: 'أصاغر ذكور',  coach: '',                note: 'التوقيت لم يُحدَّد بعد.' },
  { day: 'الجمعة',  start: '10:00', end: '11:30', pool: POOL.b, category: 'minnows', label: 'أصاغر ذكور/إناث', coach: 'يوسف بوستة',   note: '' }
];

/* اسم الفوج يُبنى من عناصره لا من رقمه: «الثلاثاء 18:00 · بوهراوة · أكابر ذكور»
   يُقرأ في بطاقة المنخرط بلا حاجة إلى فتح الفوج. والمسبح داخل الاسم لأن
   الثلاثاء 18:00 فيه حصّتان متوازيتان في مسبحين. */
function nameOf(s, i) {
  const shortPool = s.pool.replace(/^مسبح /, '');
  return s.start
    ? `${s.day} ${s.start} · ${shortPool} · ${s.label}`
    : `${s.day} · ${shortPool} · ${s.label}`;
}

async function main() {
  const login = await fetch(BASE + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD })
  });
  const loginBody = await login.text();
  if (login.status !== 200) {
    console.log('login:', login.status, loginBody.slice(0, 200));
    throw new Error('تعذّر تسجيل الدخول');
  }
  const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  const who = JSON.parse(loginBody);
  console.log('login: 200 | role:', who.user && who.user.role, '| must_change:', who.must_change);
  if (who.must_change) {
    throw new Error('الحساب يطلب تغيير كلمة المرور قبل أي تعديل.');
  }

  const gRes = await fetch(BASE + '/api/groups', { headers: { Cookie: cookie } });
  const current = await gRes.json();
  if (gRes.status !== 200 || !current.readable) {
    throw new Error('تعذّرت قراءة الأفواج: ' + JSON.stringify(current).slice(0, 200));
  }

  const backupDir = path.join(__dirname, 'neon', '.backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, 'groups-before-programme-' + stamp + '.json');
  fs.writeFileSync(backupFile, JSON.stringify(current, null, 2), 'utf8');
  console.log('backup:', backupFile);

  console.log('\n--- القائمة الحالية ---');
  current.groups.forEach(g => console.log(`  ${g.id.padEnd(8)} ${g.name}  (${g.members})  ${g.coach || '—'}`));
  console.log('  غير مفرز:', current.unassigned.members);

  const keep = current.groups.map(g => ({
    id: g.id, name: g.name, category: g.category || '', days: g.days || [],
    start: g.start || '', end: g.end || '', capacity: g.capacity || 0,
    coach: g.coach || '', assistants: g.assistants || [], pool: g.pool || '',
    notes: g.notes || ''
  }));

  const added = SESSIONS.map((s, i) => ({
    id: 'grp-s' + String(i + 1).padStart(2, '0'),
    name: nameOf(s, i),
    category: s.category,
    days: [s.day],
    start: s.start,
    end: s.end,
    capacity: 0,
    coach: s.coach,
    assistants: [],
    pool: s.pool,
    notes: s.note
  }));

  const names = new Set();
  for (const g of keep.concat(added)) {
    if (names.has(g.name)) throw new Error('اسم مكرّر: ' + g.name);
    names.add(g.name);
  }
  const ids = new Set();
  for (const g of keep.concat(added)) {
    if (ids.has(g.id)) throw new Error('معرّف مكرّر: ' + g.id);
    ids.add(g.id);
  }

  const payload = keep.concat(added);

  console.log('\n--- الأفواج المضافة من البرنامج (' + added.length + ') ---');
  added.forEach(g => console.log(`  ${g.id.padEnd(8)} ${g.name.padEnd(42)} ${g.days.join('،')} ${g.start || '—'}`));
  console.log('\nالمجموع بعد الحفظ:', payload.length, 'فوجًا');

  if (!APPLY) {
    console.log('\n(قراءة فقط — أضف --apply للحفظ)');
    return;
  }

  const put = await fetch(BASE + '/api/groups', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ groups: payload })
  });
  const out = await put.json();
  console.log('\nPUT /api/groups:', put.status);
  if (put.status !== 200) {
    console.log(JSON.stringify(out).slice(0, 600));
    throw new Error('فشل الحفظ');
  }
  console.log('  updated_swimmers:', out.updated_swimmers, '| parked:', out.parked,
    '| warnings:', (out.warnings || []).length);
  (out.warnings || []).forEach(w => console.log('  ⚠ ' + w));

  const after = await (await fetch(BASE + '/api/groups', { headers: { Cookie: cookie } })).json();
  console.log('\n--- القائمة بعد الحفظ ---');
  after.groups.forEach(g => console.log(`  ${g.id.padEnd(8)} ${g.name.padEnd(42)} (${g.members})`));
  console.log('  غير مفرز:', after.unassigned.members);

  const kept = keep.map(k => {
    const now = after.groups.find(g => g.id === k.id);
    const was = current.groups.find(g => g.id === k.id);
    return { id: k.id, name: k.name, before: was.members, after: now ? now.members : null };
  });
  const totalBefore = current.groups.reduce((a, g) => a + g.members, 0) + current.unassigned.members;
  const totalAfter = after.groups.reduce((a, g) => a + g.members, 0) + after.unassigned.members;
  console.log('\n--- التحقّق ---');
  kept.forEach(k => console.log(`  ${k.id}: ${k.before} → ${k.after} ${k.before === k.after ? '✔' : '✘'}`));
  console.log(`  المجموع: ${totalBefore} → ${totalAfter} ${totalBefore === totalAfter ? '✔ لم يفقد أحد' : '✘ تغيّر!'}`);
  console.log('  غير مفرز:', current.unassigned.members, '→', after.unassigned.members,
    current.unassigned.members === after.unassigned.members ? '✔' : '✘');
}

main().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
