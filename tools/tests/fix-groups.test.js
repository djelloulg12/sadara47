/* إصلاح التفويج: توحيد الاسم بالمعنى، ولا طفل يُفقد، ولا شيء يُحذف.

   الخلل الذي وُجد في البيانات الحيّة كان رقمًا لا رأيًا:

     الجدول الزمني يعرّف فوجين رسميًّا -- «المبتدئون» و«المتوسطون» -- والسباحون
     يحملون «مبتدئ» (54) و«متوسط» (39). فالمسيّر يفتح فوج «المبتدئون» فيجد
     3 أطفال، و54 طفلاً مفقودين في فوج لا مدرب له ولا جدول. و111 من 115 (97%)
     في فوج غير معرَّف. و`group_id` فارغ في 115 صفًّا.

   وهذا الفحص يحمي الخصائص التي جعلت الإصلاح آمنًا على أطفال حقيقيين، وكلها
   تخصّ أداةً كُتبت لتعديل سجلات قائمة:

     ١. لا حذف ولا إدماج قسري: الاسم الموحَّد يُشتقّ بالمعنى، وما لا مقابل رسمي
        له يبقى. «متقدم» و«محترف» ليس لهما فوج في الجدول، فلا يجوز أن يُدخلا
        في «المتوسطون» بدعوى التقارب -- الدمج يغيّر حقيقة تدريب الطفل.

     ٢. عدد الصفوف ثابت: التوحيد يغيّر قيمة، لا يُنشئ صفًّا ولا يُسقطه. أي
        دالة تشتقّ اسمًا لصفّين مختلفين تُفقد أحد الطفلين.

     ٣. الكتابة تحت طلب صريح: بلا `--write` لا يُمَس شيء، ونسخة احتياطية
        تُكتب قبل أول تغيير. أداة تعدّل 115 سجلًا بلا نسخة خطأٌ لا يُصلَح.

     ٤. `group_id` يُكتب مع الاسم، فالسؤال عن فوج الطفل لا يعتمد على نصّ
        يُصحَّح ويتغيّر.
*/

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const errors = [];

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const fix = read('tools/neon/fix-groups.js');

/* ---- ١. لا حذف، ولا دمج لاسم لا مقابل رسمي له ---- */

{
  /* أي عبارة تحذف صفًّا أو جدولًا: ممنوعة في أداة تعمل على سجلات قائمة. */
  if (/\bdelete\s+from\b|\btruncate\b|\bdrop\s+table\b/i.test(fix)) {
    errors.push('the group fixer contains a delete, truncate or drop: it runs against '
      + 'live records of real children and must never destroy anything');
  }
  /* والاسم الذي لا مقابل رسمي له يبقى. لو أُعيد اسم آخر بدلًا منه، لدُمج
     «متقدم» في فوج لم يُدرَّب فيه. فنفحص أنّ دالة الاشتقاق **تُرجع الاسم
     نفسه** في فرع «لا مقابل» -- لا وجود كلمة `return n` في الملف فقط. */
  const stem = fix.indexOf('function canonicalName');
  const canon = stem === -1 ? '' : fix.slice(stem, fix.indexOf('\n}', stem) + 2);
  if (!/return n;/.test(canon)) {
    errors.push('the canonical-name function has no path that keeps a name with no '
      + 'official counterpart, so "متقدم" and "محترف" would be forced into a group '
      + 'the child was not actually training in');
  }
  /* والأخطر: الدالة يجب أن تنتهي بإرجاع الاسم الأصلي، فـ«متقدم» لا يُردّ إلى
     أول فوج رسمي في القائمة. والمقارنة بعدم وجود `r` لا تكفي: الفرع الذي
     يُرجع أول فوج هو ما نبحث عنه. */
  if (!/for \(const off of official\)[\s\S]{0,200}?\}\s*\/\*[^]*?\*\/\s*return n;/.test(canon)) {
    errors.push('the canonical-name function does not end by keeping the original '
      + 'name when no official group matches, so an unrecognised name such as '
      + '"متقدم" would be rewritten as some other group');
  }
  /* والتوحيد بالمعنى لا بالنصّ: الصيغة المفردة تُردّ إلى الجمع الرسمي بالجذر. */
  if (!/replace\(\/\^ال\/[^)]*\)/.test(fix)) {
    errors.push('the fixer does not strip the definite article when comparing roots, '
      + 'so "مبتدئ" would not be recognised as the official "المبتدئون" and the '
      + '54 missing children would stay missing');
  }
  if (!/\(ون\|ين\)\$/.test(fix)) {
    errors.push('the fixer does not strip the plural ending, so the singular and '
      + 'plural forms of the same group would not be matched');
  }
}

/* ---- ٢. عدد الصفوف ثابت: لا صفّ يُضاف ولا يُسقط ---- */

{
  /* التوحيد تغيير قيمة على صفّ قائم. أي `insert into sadara.swimmers` يُنشئ
     صفًّا لطفل لا وجود له. */
  if (/insert\s+into\s+sadara\.swimmers/i.test(fix)) {
    errors.push('the fixer inserts swimmer rows, so a child would be duplicated '
      + 'rather than the existing row corrected');
  }
  /* والفحص قبل الكتابة يجب أن يُقارن العدد قبل وبعد، وأن تكون نتيجة المقارنة
     **مستعملة** لا محسوبة ثم مُهمَلة. */
  if (!/const sameCount = swimmers\.length === Object\.values\(finalCounts\)/.test(fix)) {
    errors.push('the fixer does not assert that the swimmer count is the same before '
      + 'and after, so a name that collapses two children into one would go unseen');
  }
  /* وينبغي أن يمنع الكتابة إن اختلف العدد: قياسٌ بلا فعل ليس حماية. */
  if (!/const sameCount[\s\S]{0,600}?if \(!sameCount && WRITE\)/.test(fix)) {
    errors.push('the fixer measures a lost swimmer but does not stop when it happens, '
      + 'so a collapse would be written to the live records anyway');
  }
}

/* ---- ٣. الكتابة تحت طلب صريح، وبنسخة احتياطية ---- */

{
  if (!/--write/.test(fix)) {
    errors.push('the fixer has no --write gate, so running it to inspect the data '
      + 'would change the data');
  }
  if (!/WRITE\)/.test(fix)) {
    errors.push('the --write flag is declared but never checked');
  }
  /* والنسخة قبل التغيير، لا بعده -- وبلا تعطيل. فنتحقّق من ثلاثة: أنّ النداء
     موجود بصورته المنفَّذة (لا ملفوفًا في `void` أو `false &&`)، وأنه يأتي قبل
     أول `update`، وأنه يكتب فعليًا. */
  const backupCall = fix.match(/^\s*fs\.writeFileSync\(backup,\s*JSON\.stringify\(/m);
  const firstUpdate = fix.search(/update\s+sadara\.swimmers/i);
  if (!backupCall) {
    errors.push('the fixer writes no backup (or writes it behind a disabled branch), '
      + 'so a wrong unification could not be reversed on 115 real records');
  } else if (firstUpdate !== -1 && backupCall.index > firstUpdate) {
    errors.push('the fixer writes its backup after it has already changed rows, so '
      + 'the backup would hold the damage instead of the original');
  }
}

/* ---- ٤. `group_id` يُكتب مع الاسم، والقائمة المشتركة تُكتب بـupsert ---- */

{
  if (!/group_id/.test(fix)) {
    errors.push('the fixer does not write group_id, so asking which group a child '
      + 'belongs to still depends on a name that gets corrected and changes');
  }
  if (!/on conflict \(firestore_path\) do update/.test(fix)) {
    errors.push('the shared group list is written without an upsert, so re-running '
      + 'the fixer could fail or clear the list instead of updating it');
  }
  /* والقائمة تُكتب إلى المسار الذي يقرأه الخادم بالحرف. نفحص **هدف الكتابة**
     نفسه، لا مجرّد ورود النصّ في الملف: النصّ يرد في التعليقات أيضًا. */
  const ins = fix.match(/insert\s+into\s+sadara\.config[\s\S]{0,160}/i);
  if (!ins || !/values \(\s*'config\/groups'/.test(ins[0])) {
    errors.push('the fixer does not write the shared list to the exact path '
      + "'config/groups', so the page would read nothing and show no group list");
  }
  const server = read('tools/neon/server/server.js');
  if (!/firestore_path='config\/groups'/.test(server)) {
    errors.push('the server does not read config/groups, so writing the list there '
      + 'would leave the page with no shared group list at all');
  }
}

console.log('');
if (errors.length) {
  console.log('FIX-GROUPS PROBLEMS (' + errors.length + '):');
  errors.forEach(e => console.log('  - ' + e));
  process.exit(1);
}
console.log('The group fixer unifies names by meaning without forcing a child into a '
  + 'group they never trained in, keeps the row count identical, writes group_id '
  + 'alongside the name, backs up before changing anything, and writes the shared '
  + 'list where the server reads it.');
process.exit(0);
