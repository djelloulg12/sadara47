/* مخطط Neon: كل حقل تكتبه المنصة له عمود، وكل مجموعة لها جدول.
   ----------------------------------------------------------------------------
   هذا فحص **ساكن**: لا يتّصل بقاعدة، ولا يحتاج مفتاحًا. يقرأ ملفات المخطط
   الحقيقية -- المخطط `sadara` والمخطط `public` -- ويقارنها بما تكتبه
   `firebase-adapter.js` فعلًا. والغرض سؤال واحد: هل يمكن نقل البيانات دون
   أن يسقط حقل؟

   والحقل الذي يسقط يمرّ صامتًا: الصفحة تحفظ، والقاعدة تقبل، والبيانات
   لا تصل -- ويُكتشف بعد أسبوعين. فالسؤال يُجاب هنا، لا عند النقل.

   ولماذا ثلاثة ملفات لا ملف:
     001-schema.sql        مخطط `sadara` (جداول النادي).
     002-app-users.sql     مخطط `public` -- جدول الحسابات، بصيغة Firebase.
     003-finish-schema.sql الإكمال: حقول الماسح على الحضور، وجدول الأفواج.

   وهذا الملف يقرأ الثلاثة معًا، فهي مخطط واحد في النهاية. */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SCHEMA_FILES = ['001-schema.sql', '002-app-users.sql', '003-finish-schema.sql',
  '004-nin.sql', '005-membership.sql'];
const SQL = SCHEMA_FILES
  .map(f => fs.readFileSync(path.join(ROOT, 'tools', 'neon', f), 'utf8'))
  .join('\n');
const ADAPTER = fs.readFileSync(path.join(ROOT, 'firebase-adapter.js'), 'utf8');
const RULES = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
/* وشيفرة الخادم: هي التي تُجيب على «من يحقّ له» بعد النقل، فيجب أن تُفحص. */
const SERVER = path.join(ROOT, 'tools', 'neon', 'server');
const SERVER_SRC = fs.existsSync(SERVER)
  ? fs.readdirSync(SERVER).filter(f => f.endsWith('.js'))
    .map(f => fs.readFileSync(path.join(SERVER, f), 'utf8')).join('\n')
  : '';
const errors = [];

/* ---- 1. الجداول: كل مجموعة في المنصة لها جدول ---- */

const collectedTables = new Set();
let m;
/* الاسم قد يكون مؤهّلًا بالمخطط (`sadara.groups`)، فنأخذ الجزء الأخير. */
const tre = /create table if not exists\s+(?:(\w+)\.)?(\w+)/gi;
while ((m = tre.exec(SQL))) collectedTables.add((m[2] || m[1]).toLowerCase());

/* كل مجموعة → الجدول المقابل. */
const MAP = {
  users: ['app_users', 'users'],
  swimmers: ['swimmers'],
  applications: ['applications'],
  attendance: ['attendance'],
  groups: ['groups'],
  notices: ['notices'],
  schedules: ['schedules'],
  payments: ['payments'],
  subscription_plans: ['subscription_plans'],
  facilities: ['facilities'],
  coach_requirements: ['coach_requirements'],
  fee_settings: ['fee_settings'],
  audit_logs: ['audit_logs'],
  config: ['config'],
  counters: ['counters']
};

/* `cards` ليست مجموعة: البطاقة تُبنى من السباح لحظة العرض، ولا مستند لها.
   وهو أمر مقصود -- البطاقة صورة مشتقّة، لا سجلّ مستقل. */
const DERIVED = new Set(['cards']);

{
  const collections = new Set();
  const c1 = /collection\(['"]([^'"]+)['"]\)/g;
  while ((m = c1.exec(ADAPTER))) collections.add(m[1]);
  const c2 = /rows\(['"]([^'"]+)['"]\)/g;
  while ((m = c2.exec(ADAPTER))) collections.add(m[1]);

  for (const c of collections) {
    if (DERIVED.has(c)) continue;
    const want = MAP[c];
    if (!want) { errors.push('[1] the platform uses a collection nobody mapped to a table: ' + c); continue; }
    if (!want.some(t => collectedTables.has(t))) {
      errors.push('[1] nothing creates a table for the "' + c + '" collection (' + want.join('/') + ')');
    }
  }
}

/* ---- 2. الحقول: كل حقل تكتبه المنصة له عمود ---- */

function tableColumns(table) {
  /* الجدول قد يُنشأ في ملف، وتُضاف له أعمدة في ملف آخر. فنجمع كل ما ورد
     باسمه -- في `create table` وفي `alter table ... add column`. والاسم
     قد يكون مؤهّلًا بالمخطط (`sadara.groups`). */
  const cols = new Set();
  const body = SQL.match(new RegExp('create table if not exists\\s+(?:\\w+\\.)?' + table + '\\s*\\(([\\s\\S]*?)\\n\\);', 'i'));
  if (body) {
    body[1].split(/\n/).forEach(line => {
      const mm = line.trim().match(/^(?:"?)([a-z_][a-z0-9_]*)(?:"?)\s+(text|integer|bigint|boolean|timestamptz|timestamp|jsonb|numeric|bigserial|serial|date|varchar)/i);
      if (mm) cols.add(mm[1].toLowerCase());
    });
  }
  const are = new RegExp('alter table (?:sadara\\.|public\\.)?' + table + '\\s+([\\s\\S]*?);', 'gi');
  let a;
  while ((a = are.exec(SQL))) {
    let f;
    const fre = /add column if not exists\s+([a-z_][a-z0-9_]*)/gi;
    while ((f = fre.exec(a[1]))) cols.add(f[1].toLowerCase());
  }
  return cols.size ? cols : null;
}

/* حقول السباح التي يكتبها المحوّل مباشرة (`const EDITABLE` في PUT). */
{
  const editable = ADAPTER.match(/const EDITABLE = \{([\s\S]*?)\};/);
  if (!editable) {
    errors.push('[2] the swimmer edit whitelist could not be found, so its fields cannot be checked');
  } else {
    const cols = tableColumns('swimmers');
    if (!cols) {
      errors.push('[2] there is no swimmers table');
    } else {
      const re = /([a-z_][a-z0-9_]*)\s*:\s*'([a-z_][a-z0-9_]*)'/g;
      let f;
      while ((f = re.exec(editable[1]))) {
        if (!cols.has(f[1])) {
          errors.push('[2] the swimmer edit writes "' + f[1] + '" and the swimmers table has no such column');
        }
      }
    }
  }
}

/* حقول الحضور السبعة من جولة الماسح، إضافة إلى أعمدة ما قبلها. */
{
  const cols = tableColumns('attendance');
  if (!cols) {
    errors.push('[2] there is no attendance table');
  } else {
    for (const f of ['member_id', 'session_date', 'status', 'marked_by', 'marked_at',
      'marked_by_name', 'marked_by_role', 'recorded_by_uid', 'recorded_by_name', 'recorded_by_role']) {
      if (!cols.has(f)) {
        errors.push('[2] the attendance table has no column for "' + f
          + '", so a scan loses who made it or when');
      }
    }
  }
}

/* جدول الأفواج: أضفناه في جولة الأفواج ولا مستند له في الـsnapshot.
   وقد صار له جدول. */
{
  const cols = tableColumns('groups');
  if (!cols) errors.push('[2] there is no groups table, so a group ruled by the manager has nowhere to live');
  else if (!cols.has('name')) errors.push('[2] the groups table has no name column');
}

/* حقول الطلب التي يقرؤها قرار القبول ويكتبها في السباح. */
{
  const cols = tableColumns('applications');
  if (!cols) {
    errors.push('[2] there is no applications table');
  } else {
    for (const f of ['application_no', 'applicant_uid', 'registration_id', 'pool_number',
      'membership_no', 'transferred_to', 'transferred_at', 'first_name_ar', 'last_name_ar',
      'birth_date', 'blood_group', 'facility', 'expected_amount', 'payment_method',
      'account_removed_at', 'account_removed_by', 'account_removed_reason', 'duplicate_key']) {
      if (!cols.has(f)) errors.push('[2] the applications table has no column for "' + f + '"');
    }
  }
}

/* رقم التعريف الوطني للولي: عمود على الحساب والسباح والطلب، وفهرس فريد
   على الأرقام البيومترية وحدها. */
{
  const accountCols = tableColumns('app_users');
  const swimmerCols = tableColumns('swimmers');
  const applicationCols = tableColumns('applications');
  if (!accountCols || !accountCols.has('national_id')) {
    errors.push('[2] app_users has no national_id, so a guardian cannot be found by their NIN');
  }
  if (!swimmerCols || !swimmerCols.has('guardian_national_id')) {
    errors.push('[2] swimmers has no guardian_national_id, so the family dashboard cannot group children');
  }
  if (!applicationCols || !applicationCols.has('guardian_national_id')) {
    errors.push('[2] applications has no guardian_national_id, so a new request cannot link to its family');
  }
  if (!applicationCols || !applicationCols.has('family_national_id')) {
    errors.push('[2] applications has no family_national_id, so a linked request has no family reference');
  }
  if (!/create\s+unique\s+index\s+if\s+not\s+exists\s+app_users_national_id_uniq/i.test(SQL)) {
    errors.push('[2] the guardian NIN is not declared unique on app_users');
  }
}

/* رقم الانخراط الموحّد: الموسم والرقم القديم على السباح والطلب والحساب،
   وفهارس البحث. والترقيم نفسه يُكتب بسكربت مستقل، لا في المخطط. */
{
  const swimmerCols = tableColumns('swimmers');
  const applicationCols = tableColumns('applications');
  const accountCols = tableColumns('app_users');
  for (const [table, cols] of [['swimmers', swimmerCols], ['applications', applicationCols],
    ['app_users', accountCols]]) {
    if (!cols) { errors.push('[2] there is no ' + table + ' table for membership numbering'); continue; }
    if (!cols.has('membership_season')) {
      errors.push('[2] ' + table + ' has no membership_season, so a number cannot be audited by season');
    }
  }
  if (!swimmerCols || !swimmerCols.has('legacy_membership_no')) {
    errors.push('[2] swimmers has no legacy_membership_no, so renumbering loses the old number');
  }
  if (!applicationCols || !applicationCols.has('legacy_membership_no')) {
    errors.push('[2] applications has no legacy_membership_no, so renumbering loses the old number');
  }
  if (!accountCols || !accountCols.has('legacy_member_no')) {
    errors.push('[2] app_users has no legacy_member_no, so renumbering loses the old staff number');
  }
  for (const index of ['swimmers_membership_no_idx', 'applications_membership_no_idx',
    'app_users_member_no_idx']) {
    if (!new RegExp('create\\s+index\\s+if\\s+not\\s+exists\\s+' + index, 'i').test(SQL)) {
      errors.push('[2] the membership index ' + index + ' is missing');
    }
  }
}

/* ---- 3. الأمان: لا شيء يحذف ولا يعدّل صفًا موجودًا ---- */

{
  const forbidden = /\b(drop|truncate|delete\s+from|update\s+\w+\s+set)\b/i;
  if (forbidden.test(SQL)) {
    /* الاستثناء الوحيد: إسقاط قيد أو فهرس كان خطأً مُعلنًا، وهو ليس صفًّا. */
    const bad = SQL.match(/\b(truncate|delete\s+from|update\s+\w+\s+set)\b/i);
    if (bad) {
      errors.push('[3] the schema file contains a statement that destroys data: ' + bad[0]);
    }
  }
  /* وكل عبارة إنشاء idempotent. التعليقات تُنزع أولًا: جملة إنجليزية في
     شرحٍ ليست جملة SQL، وذكرُ `CREATE INDEX IF NOT EXISTS` في سطر يشرح
     لماذا لا يُعاد الفهرس هو نصّ، لا أمر. */
  const CODE = SQL.replace(/--[^\n]*/g, '');
  const creates = CODE.match(/create\s+(unique\s+)?(table|index|schema)\s+(?!if\s+not\s+exists)/gi) || [];
  if (creates.length) {
    errors.push('[3] ' + creates.length + ' create statement(s) are not "if not exists", '
      + 'so running the migration twice would fail');
  }
  /* وكل `drop` إسقاط قيد أو فهرس فقط -- لا جدول ولا عمود. */
  const drops = CODE.match(/drop\s+(table|column)\s+/gi) || [];
  if (drops.length) errors.push('[3] the schema drops a table or a column: ' + drops.join(', '));
}

/* ---- 4. الأدوار: لا يُمنح دور موظّف افتراضيًا ---- */

{
  /* الثغرة التي أُغلقت: الدور الافتراضي 'coach' في app_users معناه أن كل
     حساب يُدرج بلا دور يصبح مدربًا -- ويكتب على سجلّ الأطفال. فنتحقّق أن
     الشيفرة الحالية (ملف 002 والترحيل) لا تُنتجه. */
  const defaults = [...SQL.matchAll(/\brole\s+(varchar|text)\s+default\s+'([^']+)'/gi)].map(x => x[2]);
  for (const d of defaults) {
    if (['coach', 'admin', 'president', 'manager', 'owner'].indexOf(d) !== -1) {
      errors.push('[4] a table grants the role "' + d
        + '" by default, so an account inserted without a role would hold staff rights');
    }
  }
  /* والمُصلح يجب أن يكون موجودًا، لأنه هو ما يصحّح الأدوار الخاطئة. */
  if (!fs.existsSync(path.join(ROOT, 'tools', 'neon', 'fix-roles.js'))) {
    errors.push('[4] the role-correction tool is missing, so the 83 wrongly-granted coach roles cannot be put right');
  }
  /* وأدوار المنصة كلها ما زالت معروفة للقاعدة أو للمحوّل. */
  for (const role of ['admin', 'president', 'coach', 'member', 'parent', 'swimmer_adult', 'swimmer_minor']) {
    if (RULES.indexOf("'" + role + "'") === -1 && ADAPTER.indexOf("'" + role + "'") === -1) {
      errors.push('[4] the role "' + role + '" vanished from both the rules and the adapter');
    }
  }
}

/* ---- 5. الخادم: من يحقّ له ماذا، ومطابقة أدوار الماسح ---- */

if (SERVER_SRC) {
  /* أدوار الماسح يجب أن تكون هي نفسها في الصفحة والشيفرة. */
  const pageRoles = (ADAPTER.match(/const SCANNER_ROLES\s*=\s*\[([^\]]*)\]/) || [])[1];
  const srvRoles = (SERVER_SRC.match(/const SCANNER_ROLES\s*=\s*\[([^\]]*)\]/) || [])[1];
  if (!pageRoles) errors.push('[5] the adapter no longer names the scanner roles');
  if (!srvRoles) errors.push('[5] the server no longer names the scanner roles');
  if (pageRoles && srvRoles) {
    const norm = s => s.split(',').map(x => x.replace(/['"\s]/g, '')).filter(Boolean).sort().join(',');
    if (norm(pageRoles) !== norm(srvRoles)) {
      errors.push('[5] the server and the adapter disagree on who may scan:\n'
        + '        adapter: ' + norm(pageRoles) + '\n        server : ' + norm(srvRoles));
    }
  }
  /* وكلمة المرور: لا نصّ صريح في الشيفرة. */
  if (/password\s*===\s*['"]/.test(SERVER_SRC)) {
    errors.push('[5] the server compares a password literally, so it does not read the stored hash');
  }
  /* والمقارنة بزمن ثابت، لا `===` على التجزئة. */
  if (!/timingSafeEqual/.test(SERVER_SRC)) {
    errors.push('[5] the server does not compare password hashes in constant time');
  }
  /* والتجزئة scrypt، لا sha256 وحدها. */
  if (!/scryptSync/.test(SERVER_SRC)) {
    errors.push('[5] the server does not use scrypt for passwords');
  }
  /* ولا كلمة مرور قاعدة بيانات مكتوبة في الشيفرة. */
  if (/postgres(ql)?:\/\/[^\s'"]*:[^\s'"]*@/i.test(SERVER_SRC)) {
    errors.push('[5] the server source contains a database connection string with a password');
  }
}

if (errors.length) {
  console.log('SCHEMA PROBLEMS (' + errors.length + '):');
  for (const e of [...new Set(errors)]) console.log('  - ' + e);
  process.exit(1);
}
console.log('The Neon schema has a table for every collection the platform uses, a column for every field it writes, and it destroys nothing.');
process.exit(0);
