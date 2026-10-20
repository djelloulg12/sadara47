/* الاستخدام الحقيقي للمنصة: نافذة النبضة تُشتقّ من السلوك، لا من التخمين.
   ----------------------------------------------------------------------------
   Render يمنح 750 ساعة شهريًا ويُوقف كل خدمة مجانية إن استُهلكت. فنافذة النبضة
   قرار يُبنى على سؤال: متى يستعمل النادي المنصة فعلًا؟

   وهذا السؤال له جواب في قاعدة البيانات، لا في الرأس: كل تعديل يُسجَّل في
   `sadara.audit_logs` بوقته. فتوزيع تلك الأوقات على ساعات اليوم هو الاستخدام
   الحقيقي. والنافذة تُضبط لتشمله، لا لتغطّي يومًا كاملًا احتياطًا.

   طريقة الاستعمال:
     node tools\neon\usage.js

   تُقرأ الأوقات من `raw->'created_at'->>'__timestamp'`، وتُحوَّل إلى توقيت
   الجزائر (UTC+1)، ويُطبع توزيع الساعات والنافذة المقترحة وما تستهلكه.
*/
'use strict';
const { dbUrl } = require('../neon-env');

/* سقف Render المجاني: 750 ساعة لكل مساحة عمل شهريًا. */
const CAP_HOURS = 750;
const DZ_OFFSET_HOURS = 1;

async function main() {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });

  const rows = (await pool.query(`
    select (raw->'created_at'->>'__timestamp')::timestamptz as ts
    from sadara.audit_logs
    where raw->'created_at'->>'__timestamp' is not null
    order by ts
  `)).rows;

  /* والحضور أيضًا: تسجيل الحضور نشاط حقيقي، وقد يكون في ساعة لا تعديل فيها. */
  const att = (await pool.query(`
    select marked_at as ts from sadara.attendance where marked_at is not null
    union all
    select created_at as ts from sadara.attendance where created_at is not null
  `).catch(() => ({ rows: [] }))).rows;

  await pool.end();

  const stamps = rows.map(r => r.ts).concat(att.map(r => r.ts)).filter(Boolean);
  if (!stamps.length) {
    console.log('لا نشاط مسجَّل بعد. النافذة المقترحة افتراضية: 06:00-22:59 UTC.');
    return;
  }

  const byHour = new Array(24).fill(0);
  let first = null, last = null;
  for (const ts of stamps) {
    const t = new Date(ts);
    const dz = new Date(t.getTime() + DZ_OFFSET_HOURS * 3600 * 1000);
    byHour[dz.getUTCHours()]++;
    if (!first || t < first) first = t;
    if (!last || t > last) last = t;
  }
  const total = stamps.length;
  const spanDays = Math.max(1, Math.round((last - first) / 86400000));

  console.log('=== الاستخدام الحقيقي (بتوقيت الجزائر) ===');
  console.log('الأحداث:', total, '· المدة:', spanDays, 'يومًا · من',
    first.toISOString().slice(0,10), 'إلى', last.toISOString().slice(0,10));
  console.log('');
  const peak = Math.max(...byHour);
  for (let h = 0; h < 24; h++) {
    const bar = '#'.repeat(Math.round(byHour[h] / Math.max(1, peak) * 40));
    console.log(String(h).padStart(2, '0') + ':00  ' + String(byHour[h]).padStart(4) + '  ' + bar);
  }

  const active = byHour.map((n, h) => ({ n, h })).filter(x => x.n > 0);
  const lo = active[0].h;
  const hi = active[active.length - 1].h;

  /* الحَدّ الذي يمنع حدثًا شاذًا واحدًا من تمديد النافذة ساعات.
     حدثٌ واحد في الرابعة فجرًا (خطأ إدخال، أو استثناء) هو 0.5% من النشاط،
     فلا يجوز أن يكلّف 3 ساعات يوميًا = 93 ساعة شهريًا من رصيد Render.
     فالساعات "الحقيقية" هي التي تحمل 2% من النشاط على الأقل. */
  const floor = Math.max(1, Math.round(total * 0.02));
  const solid = byHour.map((n, h) => ({ n, h })).filter(x => x.n >= floor);
  const loSolid = solid.length ? solid[0].h : lo;
  const hiSolid = solid.length ? solid[solid.length - 1].h : hi;

  console.log('');
  console.log('=== النافذة المقترحة من النشاط ===');
  console.log('أول نشاط:', lo + ':00 · آخر نشاط:', hi + ':59  (جزائر)');
  console.log('الساعات المعتبرة (≥' + floor + ' حدث):', loSolid + ':00 - ' + hiSolid + ':59  (جزائر)');
  console.log('الشواذ المستثناة:', active.filter(x => x.n < floor).map(x => x.h + ':00(' + x.n + ')').join(', ') || 'لا شيء');
  console.log('الموافق UTC: ' + (loSolid - DZ_OFFSET_HOURS) + ':00 - ' + (hiSolid - DZ_OFFSET_HOURS) + ':59');

  /* هامش أمان: ساعة قبل أول نشاط معتبر وبعده، فلا يضيع حدث يقع على الحافة.
     Render يُنيم بعد 15 دقيقة، وساعة تغطّي التأخّر الطبيعي وبداية النشاط. */
  const fromUtc = Math.max(0, loSolid - DZ_OFFSET_HOURS - 1);
  const toUtc = Math.min(23, hiSolid - DZ_OFFSET_HOURS + 1);
  const perDay = toUtc - fromUtc + 1;
  const monthly = perDay * 31;
  const margin = CAP_HOURS - monthly;

  let covered = 0;
  for (let h = loSolid; h <= hiSolid; h++) covered += byHour[h];
  const pct = Math.round(covered / total * 100);

  console.log('');
  console.log('=== الحساب ===');
  console.log('النافذة المقترحة:', fromUtc + ':00-' + toUtc + ':59 UTC  =  ' + perDay + ' ساعة/يوم');
  console.log('شهريًا (31 يومًا):', monthly, 'ساعة  من', CAP_HOURS);
  console.log('الهامش الباقي:', margin, 'ساعة');
  console.log('النشاط المشمول:', pct + '%');

  /* المقارنة بالنافذة العاملة: الأضيق التي تشمل النشاط هي الأفضل.
     الهدف ليس "تغطية كل شيء" بل "عدم دفع ساعات لفترة فارغة". فلو كان
     المقترح أوسع من العامل بلا زيادة في التغطية، فالعامل أفضل. */
  const cron = require('fs').readFileSync(
    require('path').join(__dirname, '..', '..', '.github', 'workflows', 'keep-awake.yml'), 'utf8');
  const m = cron.match(/cron:\s*'\*\/14\s+(\d+)-(\d+)\s/);
  if (m) {
    const curFrom = Number(m[1]), curTo = Number(m[2]);
    const curPerDay = curTo - curFrom + 1;
    const curMonthly = curPerDay * 31;
    let curCovered = 0;
    for (let h = curFrom + DZ_OFFSET_HOURS; h <= curTo + DZ_OFFSET_HOURS; h++) curCovered += byHour[h % 24] || 0;
    const curPct = Math.round(curCovered / total * 100);
    console.log('');
    console.log('=== العامل الآن مقابل المقترح ===');
    console.log('العامل:   ' + curFrom + '-' + curTo + ' UTC  =  ' + curMonthly + 'h/شهر  ·  تغطية ' + curPct + '%  ·  هامش ' + (CAP_HOURS - curMonthly));
    console.log('المقترح:  ' + fromUtc + '-' + toUtc + ' UTC  =  ' + monthly + 'h/شهر  ·  تغطية ' + pct + '%  ·  هامش ' + margin);
    console.log('');
    if (monthly < curMonthly && pct >= curPct) {
      console.log('→ المقترح أضيق وبنفس التغطية أو أفضل: اعتمده.');
    } else if (monthly === curMonthly) {
      console.log('→ مساوٍ في الساعات: أبقِ العامل.');
    } else if (monthly > curMonthly && pct > curPct) {
      console.log('→ المقترح أوسع مقابل تغطية أعلى: القرار لك. الفرق ' + (monthly - curMonthly) + ' ساعة/شهر.');
    } else {
      console.log('→ العامل أضيق: أبقِه.');
    }
  }

  console.log('');
  console.log('=== الاستهلاك الفعلي مع النبض الواعي بالنشاط ===');
  /* النبض لا يُنفق شيئًا في الساعة المزدحمة: كل نبضة فيها تُتخطّى لأن هناك
     نشاطًا قبلها بأقل من 14 دقيقة. والساعة تُكلّف فقط إذا مرّ فيها فراغ أطول
     من 14 دقيقة -- أي إذا كان الخادم سيبدو نائمًا فعلًا.

     فنقيس: لكل ساعة، هل فيها فجوة بين حدثين (أو من بدايتها) تزيد على 14 دقيقة؟
     وحتى في الساعة الفارغة تمامًا، الرصيد يُنفق فعلًا لكنه أنفع: النبض يُبقي
     الخدمة مستيقظة لزائر لم يُسجَّل له حدث بعد. فالأرقام هنا حدّ أدنى للاستهلاك
     الحقيقي، لا ادّعاء بأنه صفر. */
  const QUIET = 14 * 60 * 1000;
  const busyHours = new Set();
  const hourFirstLast = {};
  for (const ts of stamps) {
    const dz = new Date(new Date(ts).getTime() + DZ_OFFSET_HOURS * 3600 * 1000);
    const h = dz.getUTCHours();
    (hourFirstLast[h] = hourFirstLast[h] || []).push(new Date(ts).getTime());
  }
  for (const h of Object.keys(hourFirstLast)) {
    const ts = hourFirstLast[h].sort((a, b) => a - b);
    let busy = false;
    for (let i = 1; i < ts.length; i++) if (ts[i] - ts[i - 1] <= QUIET) busy = true;
    if (busy) busyHours.add(Number(h));
  }
  const inWindow = [];
  for (let h = fromUtc + DZ_OFFSET_HOURS; h <= toUtc + DZ_OFFSET_HOURS; h++) inWindow.push(h % 24);
  const quietInWindow = inWindow.filter(h => !busyHours.has(h));
  const busyInWindow = inWindow.filter(h => busyHours.has(h));
  console.log('ساعات النافذة:', inWindow.length, '· منها مزدحمة (نبضها يُتخطّى):', busyInWindow.length,
    '· ساكنة (تُنفق):', quietInWindow.length);
  console.log('  المزدحمة:', busyInWindow.map(h => h + ':00').join(', ') || 'لا شيء');
  console.log('  الساكنة:', quietInWindow.map(h => h + ':00').join(', ') || 'لا شيء');
  console.log('  الاستهلاك المتوقّع شهريًا ≈ ' + quietInWindow.length * 31 + 'h (سقف ' + CAP_HOURS + 'h)');
  console.log('  أي نحو ' + Math.round((1 - quietInWindow.length * 31 / CAP_HOURS) * 100) + '% من السقف موفَّر.');

  console.log('');
  if (monthly > CAP_HOURS) {
    console.log('!! النافذة تتجاوز السقف: Render سيوقف الخدمة. ضيّقها.');
    process.exitCode = 1;
  } else if (margin < 60) {
    console.log('!! الهامش ضيّق: إعادة نشر أو شهر مزدحم قد يوقف الخدمة.');
    process.exitCode = 1;
  } else {
    console.log('آمن: ' + monthly + 'h من ' + CAP_HOURS + '، والهامش ' + margin + 'h.');
    console.log('سطر الـcron المطابق للمقترح:');
    console.log("  cron: '*/14 " + fromUtc + '-' + toUtc + " * * *'");
    if (m) {
      const curMonthly = (Number(m[2]) - Number(m[1]) + 1) * 31;
      if (curMonthly <= monthly) {
        console.log('والعامل الآن أضيق أو مساوٍ: أبقِ الملف كما هو.');
      }
    }
  }
}

main().catch(e => { console.error('FAIL', e.message); process.exit(1); });
