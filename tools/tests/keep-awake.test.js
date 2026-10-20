/* إبقاء الخدمة مستيقظة: النبضة، وحساب الساعات، والرمز.

   الخطأ الذي يمنعه هذا الفحص ليس تباطؤًا بل توقّفًا كاملًا:

   Render يمنح 750 ساعة تشغيل شهريًا، ويوقف كل الخدمات المجانية حتى أول الشهر
   التالي إن استُهلكت. والشهر 744 ساعة -- أي أن الفارق 6 ساعات فقط. فنبضة
   تعمل 24 ساعة بلا توقّف تستهلك 744 ساعة وتترك هامشًا لا يحتمل أي إعادة نشر:
   Render يحتسب الساعات ما دامت الخدمة تعمل، وإعادة النشر تُشغّلها.

   فالنافذة 06:00–22:59 (17 ساعة/يوم) ليست اختيارًا جماليًا: 17 × 31 = 527،
   والهامش 223 ساعة. لو وُسّعت إلى 24 ساعة، ظهر هنا.

   والثاني: الرمز. نبضة بلا رمز تُستنزف بطلب من أي عابر، فيُستهلك الرصيد
   بلا استعمال حقيقي. فالمسار يرفض بلا رمز، والرمز يُمرَّر من البيئة ولا
   يُكتب في الملف.
*/

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const errors = [];

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const server = read('tools/neon/server/server.js');
const workflow = read('.github/workflows/keep-awake.yml');
const renderYaml = read('render.yaml');

/* ---- ١. المسار يرفض بلا رمز، ولا يلمس القاعدة ---- */

{
  /* مقتطف المسار وحده: من اسمه حتى أول تعريف مسار تالٍ. */
  const start = server.indexOf("ROUTES['GET /api/wake']");
  if (start === -1) {
    errors.push('GET /api/wake is gone, so nothing can keep the service awake '
      + 'and every morning visit waits a minute for a cold start');
  } else {
    const rest = server.slice(start + 10);
    const next = rest.indexOf("ROUTES['");
    const block = next === -1 ? rest : rest.slice(0, next);

    if (!/SADARA_WAKE_TOKEN/.test(block)) {
      errors.push('the wake route does not read a token, so any passer-by can hit '
        + 'it and burn the workspace hours');
    }
    if (!/404/.test(block)) {
      errors.push('the wake route does not answer 404 on a wrong token, so it '
        + 'reveals that the path exists');
    }
    /* الأهم: لا `D.` ولا `db(` -- نبضة تقرأ من Neon توقظه كل 14 دقيقة بلا
       سبب، والنبضة وظيفتها منع نوم الخادم لا استعمال القاعدة. */
    if (/\bD\.(one|all|run|tx)\b|withTx\(|await db\(/.test(block)) {
      errors.push('the wake route touches the database, so it would wake Neon every '
        + '14 minutes for no reason: the ping says the server is up, it is not a query');
    }
  }
}

/* ---- ٢. حساب الساعات: النافذة ليست يومًا كاملًا ---- */

{
  const cron = (workflow.match(/-\s*cron:\s*'([^']+)'/) || [])[1];
  if (!cron) {
    errors.push('the workflow has no cron schedule, so nothing pings and the service '
      + 'sleeps as before');
  } else {
    /* الشكل: minute hour day month weekday. نقرأ ساعة البداية والنهاية. */
    const parts = cron.split(/\s+/);
    const hourField = parts[1] || '';
    const m = hourField.match(/^(\d+)-(\d+)$/);
    if (!m) {
      errors.push("the cron hour field is '" + hourField + "', not a range like 6-22. "
        + 'A bare * means all 24 hours, which at ~744h/month leaves no room under '
        + "Render's 750h cap before services are suspended");
    } else {
      const from = Number(m[1]);
      const to = Number(m[2]);
      const hoursPerDay = to - from + 1;
      const monthly = hoursPerDay * 31;
      if (monthly > 750) {
        errors.push('the window is ' + hoursPerDay + 'h/day, which is about ' + monthly
          + "h over a 31-day month -- over Render's 750h cap. Exceeding it suspends "
          + 'every free service until the next month');
      }
      if (hoursPerDay >= 24) {
        errors.push('the window covers the whole day, so there is no margin at all '
          + "under Render's 750h cap: a redeploy or a month with busier traffic "
          + 'suspends the service');
      }
    }
    /* والفاصل يجب أن يسبق مهلة النوم: 15 دقيقة هي مهلة Render. */
    const every = Number((parts[0] || '').replace('*/', ''));
    if (!Number.isFinite(every) || every <= 0) {
      errors.push('could not read the ping interval from the cron minute field');
    } else if (every > 15) {
      errors.push('the ping runs every ' + every + ' minutes, but Render sleeps after '
        + '15 without traffic: the service would sleep between pings');
    }
  }
}

/* ---- ٣. الرمز يعبر من Render إلى النبضة، وإلا رفض المسار النبضة ---- */

{
  if (!/^\s*-\s*key:\s*SADARA_WAKE_TOKEN\s*$/m.test(renderYaml)) {
    errors.push('the deploy config does not set SADARA_WAKE_TOKEN, so every ping is '
      + 'refused with 404 and the service sleeps anyway');
  }
  if (!/secrets\.SADARA_WAKE_TOKEN/.test(workflow)) {
    errors.push('the workflow does not read SADARA_WAKE_TOKEN, so it would ping '
      + 'without the token the server demands');
  }
  /* والعنوان المتغيّر: لا يُكتب عنوان الخدمة في الملف، إذ يتغيّر مع الاسم. */
  if (!/vars\.SADARA_PLATFORM_URL/.test(workflow)) {
    errors.push('the workflow does not read SADARA_PLATFORM_URL, so the address '
      + 'cannot be set without editing the file');
  }
  /* ولا يُطبع العنوان مع الرمز في أي سجل: الرمز في العنوان نفسه. */
  if (/echo[^\n]*\$url\b/.test(workflow)) {
    errors.push('the workflow echoes the full ping URL, which carries the token, '
      + 'so the secret would land in the run log');
  }
}

/* ---- ٤. النبضة تفشل بصوت عالٍ، فلا تنام الخدمة في صمت ---- */

{
  if (!/exit 1/.test(workflow)) {
    errors.push('the workflow never fails, so a service that has stopped answering '
      + 'would look the same as one that is fine');
  }
  /* والحالة 404 وحدها: الخطأ الشائع أن يُكتب الرمز في مكان ومختلفًا في الآخر. */
  if (!/404/.test(workflow)) {
    errors.push('the workflow does not call out a 404, which is what a token mismatch '
      + 'looks like, and the value then has to be found in two places anyway');
  }
}

/* ---- ٥. النبضة تُقاس بالنشاط: تتخطّى حين يكون الخادم مستيقظًا من الاستعمال ---- */

{
  /* الحالة التي يمنعها هذا الفحص: نبضة تردّ دائمًا بلا نظر إلى النشاط.
     تكلفتها 527 ساعة شهريًا حتى والساعة فارغة، والرصيد يُدفع بلا مقابل.
     والصواب أن تقرأ آخر نشاط وتقول `skipped` إن كان حديثًا. */
  const start = server.indexOf("ROUTES['GET /api/wake']");
  const rest = start === -1 ? '' : server.slice(start + 10);
  const next = rest.indexOf("ROUTES['");
  const block = next === -1 ? rest : rest.slice(0, next);

  if (!/lastRequestAt_/.test(server)) {
    errors.push('the server never records incoming requests, so the wake route cannot '
      + 'know whether the service is already awake from real use, and every pulse '
      + 'spends an hour of the free cap for nothing');
  }
  if (!/skipped/.test(block)) {
    errors.push('the wake route never reports a skipped pulse, so a busy hour costs '
      + 'as much as an idle one: the cap is spent on hours nobody was away for');
  }
  /* ولا يكفي أن تُذكر الكلمة: يجب أن تُعاد عندما يكون هناك نشاط حديث، وإلا
     كان الردّ ثابتًا لا يقرأ النشاط أصلًا. */
  if (!/quietFor\s*<\s*WAKE_QUIET_MS[\s\S]{0,400}?skipped:\s*true/.test(block)) {
    errors.push('the wake route does not skip the pulse when there was recent '
      + 'activity, so it answers the same way whether the service is busy or idle '
      + 'and the saving never happens');
  }
  /* والعتبة أقلّ من مهلة نوم Render (15 دقيقة)، وإلا فاتت النبضةُ النوم. */
  const qm = server.match(/WAKE_QUIET_MS\s*=\s*Number\([^)]*\)\s*\|\|\s*(\d+)\s*\*\s*60\s*\*\s*1000/);
  if (!qm) {
    errors.push('the quiet threshold is not expressed in minutes, so it cannot be '
      + "checked against Render's 15-minute sleep timeout");
  } else if (Number(qm[1]) >= 15) {
    errors.push('the quiet threshold is ' + qm[1] + ' minutes, but Render sleeps after '
      + '15 without traffic: a pulse that waits that long finds the service asleep');
  }
  /* والنشاط لا يُحتسب من `/api/*` وحده: زائر يفتح الصفحة يجلب HTML وJS وCSS
     بلا أن يلمس مسارًا منها، فلو غاب احتساب الملفات الثابتة لظنّت النبضة أن
     الصفحة المفتوحة سكون. */
  const createStart = server.indexOf('http.createServer');
  const createBlock = createStart === -1 ? '' : server.slice(createStart, createStart + 1400);
  if (!/lastRequestAt_/.test(createBlock)) {
    errors.push('serving a static file does not count as activity, so a visitor '
      + 'reading a page that makes no /api call looks like an idle server');
  }
  /* والنبضة نفسها لا تُحتسب نشاطًا، وإلا أبقَت نفسها حيّة وأبطلت معنى التخطّي. */
  if (!/pathname\s*!==\s*'\/api\/wake'/.test(server)) {
    errors.push('the wake route counts itself as activity, so each pulse keeps the '
      + 'next one skipped and the skip means nothing');
  }
}

/* ---- ٦. الـworkflow يفهم `skipped` ويميّزه عن الفشل ---- */

{
  if (!/skipped/.test(workflow)) {
    errors.push('the workflow does not read the skipped flag, so it cannot tell a '
      + 'pulse that spent nothing from one that woke a sleeping service');
  }
  /* الأهم: التخطّي نجاح لا فشل. عملٌ يخرج بـ`exit 1` على `skipped` يُظهر كل
     ساعة مزدحمة كعطل، فيُطفأ التنبيه أو يُهمَل. */
  if (/grep -q[^\n]*skipped[\s\S]{0,200}?exit 1/.test(workflow)) {
    errors.push('the workflow treats a skipped pulse as a failure, so every busy '
      + 'hour shows up as a red run until nobody reads the alerts');
  }
}

console.log('');
if (errors.length) {
  console.log('KEEP-AWAKE PROBLEMS (' + errors.length + '):');
  errors.forEach(e => console.log('  - ' + e));
  process.exit(1);
}
console.log('The wake route refuses without its token and never touches the database; '
  + 'the ping runs every ' + 14 + ' minutes inside a window that stays well under '
  + "Render's 750 free hours, and it fails loudly rather than letting the service "
  + 'sleep in silence.');
process.exit(0);
