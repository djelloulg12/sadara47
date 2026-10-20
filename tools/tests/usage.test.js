/* حساب الاستخدام الحقيقي: النافذة تُشتقّ من السلوك، والحساب لا يخطئ.

   الخطأ الذي يمنعه هذا الفحص رقميّ، لا شكليّ:

   Render يمنح 750 ساعة شهريًا ويوقف كل خدمة مجانية إن استُهلكت. ونافذة النبضة
   تُترجم مباشرة إلى ساعات: (عدد الساعات × 31). فساعة زائدة في النافذة =
   31 ساعة شهريًا. ولو حسبت الأداة خطأً، أو اقترحت نافذة تتجاوز السقف، لأوقفت
   المنصة -- لا أبطأتها.

   ويفحص أيضًا القاعدة التي تجعل "الاستخدام الحقيقي" ذا معنى: حدث شاذ واحد
   لا يجوز أن يمدّ النافذة. حدث في الرابعة فجرًا يمثّل 0.5% من النشاط، وتمديد
   النافذة لأجله ثلاث ساعات = 93 ساعة شهريًا من رصيد لا يُستعاد.
*/

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const errors = [];

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const usage = read('tools/neon/usage.js');
const workflow = read('.github/workflows/keep-awake.yml');

/* ---- ١. السقف معلن ورقم الشهر صحيح ---- */

{
  if (!/CAP_HOURS\s*=\s*750/.test(usage)) {
    errors.push("the free-hour cap is not 750 in the tool, so its arithmetic is "
      + "built on a number that is not Render's");
  }
  /* الشهر 31 يومًا هو أسوأ حالة: أي نافذة آمنة على 31 آمنة على 30.
     نفحص سطر الحساب الأساسي (`perDay * 31`) تحديدًا، لا أي `* 31` في الملف:
     `curMonthly` في المقارنة يُحسب بـ31 أيضًا، فمطابقته تُخفي أنّ الحساب
     الأساسي صار 30. */
  if (!/const monthly = perDay \* 31;/.test(usage)) {
    errors.push('the tool does not compute the month as 31 days, so it would '
      + 'under-count the worst case and recommend a window that overshoots in a '
      + '31-day month');
  }
  if (!/DZ_OFFSET_HOURS\s*=\s*1/.test(usage)) {
    errors.push('Algeria is UTC+1, and the tool does not carry that offset: every '
      + 'hour it reads would be an hour off, and the window would miss the morning '
      + 'peak it exists to cover');
  }
}

/* ---- ٢. الشواذ لا تمدّ النافذة ---- */

{
  if (!/Math\.round\(total\s*\*\s*0\.0\d+\)/.test(usage)) {
    errors.push('the tool has no percentage threshold for rare hours, so a single '
      + 'event at 4am would stretch the window and spend hours covering an empty '
      + 'period');
  }
  /* والحكم يجب أن يُقارَن بالعامل، لا أن يُطبع اقتراح أوسع بلا تنبيه. */
  if (!/العامل أضيق/.test(usage)) {
    errors.push('the tool does not compare its suggestion against the running '
      + 'window, so it could recommend a wider one and silently cost hours');
  }
}

/* ---- ٣. الـcron العامل داخل السقف، والأداة تعرف نافذته ---- */

{
  const m = workflow.match(/cron:\s*'\*\/14\s+(\d+)-(\d+)\s/);
  if (!m) {
    errors.push('could not read the running window from the workflow cron');
  } else {
    const perDay = Number(m[2]) - Number(m[1]) + 1;
    const monthly = perDay * 31;
    if (monthly > 750) {
      errors.push('the running window is ' + perDay + 'h/day = ' + monthly + 'h a '
        + 'month, over the 750h cap: Render would suspend the service');
    }
    /* وما دام الـcron موجودًا، فالأداة يجب أن تقرأه: اقتراح لا يعرف العامل
       يقترح ما هو أسوأ بلا علم. */
    if (!/keep-awake\.yml/.test(usage)) {
      errors.push('the tool does not read the workflow, so its suggestion is made '
        + 'without knowing the window already running');
    }
  }
}

/* ---- ٤. لا أسرار ولا أرقام مخترعة ---- */

{
  if (/postgres(ql)?:\/\/[^'"\s]*:[^'"\s]*@/.test(usage)) {
    errors.push('the tool contains a database URL with a password in it');
  }
  /* الأرقام تُقرأ من القاعدة، لا تُكتب في الملف. */
  if (/byHour\s*=\s*\[/.test(usage)) {
    errors.push('the tool carries a hardcoded hour histogram, so it would report '
      + 'yesterday\'s usage as if it were the live pattern');
  }
  if (!/from\s+sadara\.audit_logs/.test(usage)) {
    errors.push('the tool no longer reads the audit log, which is the only record '
      + 'of when the club actually uses the platform');
  }
}

console.log('');
if (errors.length) {
  console.log('USAGE PROBLEMS (' + errors.length + '):');
  errors.forEach(e => console.log('  - ' + e));
  process.exit(1);
}
console.log('The usage tool derives the window from real activity, discounts rare '
  + 'hours so one event cannot spend a month of hours, and compares its suggestion '
  + 'against the running window instead of silently widening it.');
process.exit(0);
