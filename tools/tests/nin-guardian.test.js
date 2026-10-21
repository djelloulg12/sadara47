/* ============================================================================
   رقم التعريف الوطني للولي (NIN): مرجع العائلة الواحد
   ============================================================================

   ما يقيسه هذا الملف، وكلّه أشياء تُكسر بصمت:

   ١. الدخول يقبل رقم التعريف الوطني (18 رقمًا) بجانب البريد، ولا يخلط
      رقمًا قديمًا من تسعة أرقام برقم بيومتري.
   ٢. صاحب الحساب بلا رقم يرى حائط الإكمال، ولا يُقبل منه نصف رقم،
      ثم يُحفظ الرقم ويختفي الحائط.
   ٣. لوحة العائلة تجمع أبناء الولي وطلباتهم تحت رقم واحد.
   ٤. من بلغ 18 سنة لا تُعرض له بيانات وليّ في أي مكان: لا لوحة عائلة،
      ولا اسم وليّ، ولا هاتف وليّ.
   ٥. طلب القاصر لا يُقبل بلا رقم وليّ، والطلب الجديد يُربط بالعائلة نفسها
      ويحمل `family_national_id`.
   ٦. المخطط يفرض تفرّد الرقم على الأرقام ذات 18 رقمًا وحدها، فلا يمنع
      الأرقام القديمة من البقاء.

   والفحصان معًا: صفحة حقيقية في jsdom، وخادم حقيقي في مصدره.
   ========================================================================= */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'firebase-public');
const APP = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');
const INDEX = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
const SERVER = fs.readFileSync(path.join(ROOT, 'tools', 'neon', 'server', 'server.js'), 'utf8');
const SERVER_MODULE = require(path.join(ROOT, 'tools', 'neon', 'server', 'server'));
const SQL = fs.readFileSync(path.join(ROOT, 'tools', 'neon', '004-nin.sql'), 'utf8');
const errors = [];

function check(ok, message) {
  if (!ok) errors.push(message);
}

/* ---------------------------------------------------------------------------
   صفحة حقيقية: نحمّل `app.js` المبني في jsdom، ونضع حالة العائلة.
   ------------------------------------------------------------------------- */
function boot(seed) {
  const html = INDEX.replace(/<script[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, {
    url: 'http://127.0.0.1:4173/',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const w = dom.window;
  w.localStorage.setItem('sadara-state', JSON.stringify(seed));
  w.alert = () => {};
  w.confirm = () => true;
  w.prompt = () => '';
  w.scrollTo = () => {};
  w.print = () => {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  try {
    w.eval(APP + `
      ;window.__t = {
        get state(){ return state; },
        render: render,
        action: action,
        memberSpace: memberSpace,
        fullRegisterModal: fullRegisterModal,
        loginModal: loginModal,
        swimmerIsAdult_: swimmerIsAdult_
      };`);
  } catch (e) {
    errors.push('load: ' + e.message);
  }
  /* jsdom may keep its own copy of the seed; the page's `state` is the one
     that matters, so the test writes the fixture into it explicitly. */
  if (w.__t) Object.assign(w.__t.state, seed);
  return w;
}

const json = value => ({ ok: true, json: async () => value });
const baseSeed = user => ({
  user,
  page: 'home',
  swimmers: [],
  attendance: {},
  attendanceByDay: {},
  applications: [],
  subscriptions: [],
  notices: [],
  groups: [],
  extras: {},
  family: { complete: false, national_id: '', guardian: {}, swimmers: [], pending: [] }
});

(async () => {
  /* ---- ١. الدخول: الحقل واحد، ويقبل الرقم كما يُقرأ من البطاقة ---- */
  {
    const w = boot(baseSeed(null));
    const html = w.__t.loginModal();
    check(/البريد الإلكتروني أو رقم التعريف الوطني/.test(html),
      '[1] the sign-in field still says email only');
    check(/id="email"[^>]*type="text"/.test(html),
      '[1] the sign-in field is still type=email, so a NIN cannot be typed');
    check(/placeholder="name@example\.com أو 18 رقمًا"/.test(html),
      '[1] the sign-in field does not say that a NIN is accepted');
  }

  /* ---- ٢. التسجيل: رقم الولي إلزامي 18 رقمًا ---- */
  {
    const w = boot(baseSeed(null));
    const html = w.__t.fullRegisterModal();
    check(/id="reg-guardian-nin"[^>]*maxlength="18"/.test(html),
      '[2] the guardian NIN field has no 18-digit limit');
    check(/id="reg-guardian-nin"[^>]*pattern="\[0-9\]\{18\}"/.test(html),
      '[2] the guardian NIN field has no 18-digit pattern');
    check(/رقم تعريف الولي \(18 رقمًا\) \*/.test(html),
      '[2] the guardian NIN field is not marked as required');

    w.document.body.insertAdjacentHTML('beforeend',
      '<input id="reg-category" value="minor">'
      + '<input id="reg-nin" value="109831491005910208">'
      + '<input id="reg-guardian-nin" value="123">');
    await w.__t.action('send-full-request', null);
    const toast = w.document.querySelector('.toast-message');
    check(toast && toast.classList.contains('error') && toast.textContent.includes('18'),
      '[2] a minor request with a short guardian NIN was not refused');
  }

  /* ---- ٣. حائط الإكمال: لا يُقبل نصف رقم، ويُحفظ الرقم كاملًا ---- */
  {
    const nin = '109831491005910208';
    const parent = {
      id: 7, name: 'أب العائلة', email: 'parent@example.dz', role: 'parent',
      national_id: '', must_change: false
    };
    const w = boot(baseSeed(parent));
    const posted = [];
    w.fetch = async (url, opts) => {
      if (url === '/api/accounts/national-id') {
        posted.push(JSON.parse(opts.body));
        return json({ ok: true, national_id: nin });
      }
      if (url === '/api/family') {
        return json({ complete: true, national_id: nin, guardian: parent, swimmers: [], pending: [] });
      }
      if (url === '/api/swimmers') return json([]);
      if (url === '/api/subscription-plans') return json({ extras: {} });
      return json([]);
    };

    w.__t.render();
    const wall = w.document.querySelector('#nin-wall');
    check(!!wall, '[3] an account without a NIN did not get the completion wall');
    check(wall && /18 رقمًا/.test(wall.textContent),
      '[3] the wall does not explain that the number is 18 digits');

    const input = w.document.querySelector('#nin-wall-input');
    input.value = '12345';
    await w.__t.action('save-nin', w.document.querySelector('[data-action="save-nin"]'));
    check(posted.length === 0,
      '[3] a short NIN was sent to the server');
    check(/18 رقمًا/.test(w.document.querySelector('#nin-wall-message').textContent),
      '[3] a short NIN did not produce an Arabic error');

    input.value = nin;
    await w.__t.action('save-nin', w.document.querySelector('[data-action="save-nin"]'));
    check(posted.length === 1 && posted[0].national_id === nin,
      '[3] the complete NIN was not posted exactly once');
    check(w.__t.state.user.national_id === nin,
      '[3] the saved NIN did not reach the account state');
    check(!w.document.querySelector('#nin-wall'),
      '[3] the wall stayed after the NIN was saved');
  }

  /* ---- ٤. لوحة العائلة: الأبناء والطلبات تحت الرقم نفسه ---- */
  const nin = '109831491005910208';
  const minorA = { id: 'S202620001', name: 'ابن صغير', birth_date: '2015-05-01', group: 'أصاغر' };
  const minorB = { id: 'S202620002', name: 'ابنة صغيرة', birth_date: '2017-09-01', group: 'أصاغر' };
  const adult = { id: 'S202610001', name: 'ابن بالغ', birth_date: '2000-01-01', group: 'أكابر' };
  /* بلغ 18 بعد بداية الموسم: يبقى بالغًا في الخصوصية، وإن كان رقم انخراطه
     محسوبًا على فئة الموسم. */
  const adultNew = { id: 'S202610002', name: 'بالغ جديد', birth_date: '2008-10-20', group: 'أكابر' };
  const parent = {
    id: 7, name: 'أب العائلة', email: 'parent@example.dz', role: 'parent',
    national_id: nin, must_change: false
  };
  {
    const w = boot(Object.assign(baseSeed(parent), {
      swimmers: [minorA, minorB, adult],
      family: {
        complete: true, national_id: nin, guardian: parent,
        swimmers: [minorA, minorB, adult],
        pending: [{ application_no: 'APP-1', first_name_ar: 'مولود', last_name_ar: 'جديد', category: 'minor' }]
      }
    }));
    const familyHtml = w.__t.memberSpace(minorA, [minorA, minorB, adult], [], 'parent');
    check(/id="family-panel"/.test(familyHtml),
      '[4] the family panel is missing for a parent');
    check(familyHtml.includes('ابن صغير') && familyHtml.includes('ابنة صغيرة'),
      '[4] the family panel does not gather the children');
    check(familyHtml.includes('APP-1') && familyHtml.includes('مولود جديد'),
      '[4] the family panel does not show the pending request');
    check(familyHtml.includes(nin),
      '[4] the family panel does not show the guardian NIN');
    check(/ملف غير مكتمل/.test(w.__t.memberSpace(minorA, [minorA], [], 'parent')) === false,
      '[4] a complete guardian profile is still labelled incomplete');
  }

  /* ---- ٥. البالغ: لا لوحة عائلة ولا بيانات وليّ ---- */
  {
    const w = boot(Object.assign(baseSeed(parent), { swimmers: [adult] }));
    const adultHtml = w.__t.memberSpace(adult, [adult], [], 'swimmer_adult');
    check(!/id="family-panel"/.test(adultHtml),
      '[5] an adult swimmer still gets a guardian panel');
    check(!/ولي الأمر|guardian|هاتف الولي|اسم الولي/.test(adultHtml),
      '[5] an adult swimmer still sees guardian fields');
    check(w.__t.swimmerIsAdult_(adult) === true,
      '[5] the adult age check does not recognise a 2000 birth date');
    check(w.__t.swimmerIsAdult_(minorA) === false,
      '[5] the adult age check treats a child as an adult');
    check(!/id="family-panel"/.test(w.__t.memberSpace(adultNew, [adultNew], [], 'swimmer_adult')),
      '[5] a swimmer who turned 18 after the season start still gets a guardian panel');
  }

  /* ---- ٦. الخادم: الدخول بالرقم، وربط الطلب، وتنقية البالغ ---- */
  /* تاريخ الميلاد يصل من pg كائن `Date`؛ وقراءته كسلسلة تقتلع اسم وليّ الطفل. */
  const childDate = new Date('2015-05-01T00:00:00.000Z');
  check(SERVER_MODULE.ageOnDate(childDate, '2026-10-21') === 11,
    '[6] a Date birth date is not read as the child’s real age');
  check(SERVER_MODULE.ageOnDate('2015-05-01', '2026-10-21') === 11,
    '[6] a plain date birth date is not read as the child’s real age');
  check(SERVER_MODULE.isAdultPerson({ birth_date: childDate }) === false,
    '[6] a child with a Date birth date is treated as an adult');
  const keptChild = SERVER_MODULE.withoutGuardian({
    birth_date: childDate, guardian_first_name: 'ولي', guardian_phone: '0660000000'
  });
  check(keptChild.guardian_first_name === 'ولي' && keptChild.guardian_phone === '0660000000',
    '[6] a child loses the guardian fields when birth_date is a Date');
  const strippedAdult = SERVER_MODULE.withoutGuardian({
    birth_date: new Date('2000-01-01T00:00:00.000Z'),
    guardian_first_name: 'يجب ألا يظهر', guardian_phone: '0777777777'
  });
  check(!strippedAdult.guardian_first_name && !strippedAdult.guardian_phone
    && strippedAdult.is_adult === true,
    '[6] an adult keeps guardian fields when birth_date is a Date');
  check(SERVER_MODULE.normalizeNIN('١٠٩٨ ٣١٤٩-١٠٠٥.٩١٠٢٠٨') === '109831491005910208',
    '[6] Arabic digits and separators are not normalised into a NIN');
  check(SERVER_MODULE.normalizeNIN('109831491') === '',
    '[6] a legacy nine-digit number is treated as a complete NIN');

  /* قرار المدير على الطلب: المسار موجود، ويقرأ جسم PATCH، ويصنع السباح. */
  check(/ROUTES\['PATCH \/api\/applications\/:id'\]/.test(SERVER),
    '[6] the manager decision route PATCH /api/applications/:id is missing');
  check(/req\.method === 'PATCH'/.test(SERVER),
    '[6] PATCH bodies are never read by the server');
  check(/from_application: id/.test(SERVER) && /nextSwimmerNumber\(src\.birth_date/.test(SERVER),
    '[6] approving an application does not create the swimmer and its number');
  check(/اكتب سبب الرفض/.test(SERVER),
    '[6] a request can be rejected without a reason');

  check(/const nin = normalizeNIN\(typed\)/.test(SERVER),
    '[6] sign-in does not normalise the typed identifier as a NIN');
  check(/where national_id=\$1/.test(SERVER),
    '[6] sign-in has no lookup by national_id');
  check(/ROUTES\['POST \/api\/accounts\/national-id'\]/.test(SERVER),
    '[6] the route that completes a guardian NIN is gone');
  check(/ROUTES\['GET \/api\/family'\]/.test(SERVER),
    '[6] the family route is gone');
  check(/normalizeNIN\(a\.guardian_national_id \|\| a\.family_national_id\) === nin/.test(SERVER),
    '[6] the family route does not filter by the guardian NIN');
  check(/guardian_linked: linked/.test(SERVER) && /family_national_id: guardianNin/.test(SERVER),
    '[6] a new application is not linked to an existing family');
  check(/category === 'minor' \? statedGuardianNin/.test(SERVER),
    '[6] a minor application no longer requires the guardian NIN');
  check(/'guardian_first_name', 'guardian_last_name', 'guardian_relation'/.test(SERVER)
    && /delete copy\[k\]/.test(SERVER),
    '[6] an adult swimmer is not stripped of guardian fields');
  check(/\.map\(withoutGuardian\)/.test(SERVER)
    && /\.map\(withoutGuardianApplication\)/.test(SERVER),
    '[6] the family and application routes still return guardian fields for adults');
  check(/const guardianNin = category === 'minor' \? statedGuardianNin : ownNin;/.test(SERVER),
    '[6] an adult application can still name someone else as guardian');
  check(/const current = normalizeNIN\(target\.national_id\)/.test(SERVER)
    && /if \(opts\.self && current && current !== nin\)/.test(SERVER),
    '[6] a legacy nine-digit NIN blocks the owner from completing the profile');
  check(/create unique index if not exists app_users_national_id_uniq/i.test(SQL)
    && /where national_id ~ '\^\[0-9\]\{18\}\$'/i.test(SQL),
    '[6] the unique NIN index is gone or no longer partial');

  if (errors.length) {
    console.log('NIN and family — problems:');
    for (const e of errors) console.log('  - ' + e);
    process.exit(1);
  }
  console.log('NIN and family: all checks passed');
})().catch(e => {
  console.log('NIN and family — problems:');
  console.log('  - ' + (e && e.stack || e));
  process.exit(1);
});
