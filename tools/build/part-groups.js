/* قائمة واحدة للأفواج، ومصدر واحد لها.

   كانت قائمتين، تُقارَنان بالاسم.

   `state.groups` كانت قائمة المتصفح: ثلاثة أسماء في الصفحة، محفوظة في
   localStorage، تحفظها صفحة الأفواج ولا شيء غيرها. والسجلات كانت القائمة
   الثانية: الأسماء المكتوبة فعلًا على السباحين. ولا شيء كان يقارن بينهما،
   فافترقتا -- أغلب سباحي النادي يحملون `مبتدئ` و`متوسط` و`متقدم`، وقائمة
   الصفحة تقول `المبتدئون` و`المتوسطون` و`المتقدمون`. فكانت صفحة الأفواج
   ترسم بطاقات وعددُ سباحيها صفر، وكانت استمارة السباح تعرض قائمة لا تحمل
   أكثر الأسماء التي على السجلات، وكان المسيّر الذي يفتح ملفّ سباح ليصحّح
   رقم هاتفه قادرًا على وضعه في فوج لا وجود له في أي مكان آخر.

   هذه الطبقة تجعل من القائمتين قائمة واحدة، ومن مكان واحد:

     * أفواج النادي تُقرأ من `config/groups` بعد تسجيل الدخول، وتُكتب حين
       تحفظ صفحة الأفواج، فيراهما كل حساب؛
     * وكل اسم يحمله سجل يُضاف إلى ما تعرضه الصفحة، فيصحّ العدد وتحتوي
       القائمة على الاسم الذي على السباح؛
     * والاسم الذي لا يحمله إلا سجل يُعلَّم بأنه كذلك، ولا تعرض الصفحة
       حذفه -- حذف الفوج لا يُخرج الأطفال منه، فتعود البطاقة في التحميل
       التالي؛
     * والمعرّف المعروض هو المعرّف المحفوظ: حفظ السباح يكتب `group_id`
       بجانب `group_name`، فيكون الجواب عن فوج الطفل واحدًا من أي طريق
       سُئل.

   ولا شيء هنا يمسّ سجلًا: القراءة قراءة، والكتابة الوحيدة تكتب قائمة
   الأفواج نفسها. */

/* ---------------- المعرّفات والأسماء ---------------- */

/* فوج لا يعرّفه النادي وإنما يحمله سجل. معرّفه اسمه: لا شيء خارج هذه
   الصفحة يحتاج أن يعرفه، والاسم هو الشيء الوحيد المتطابق فعلًا على كل
   جهاز فيه السجل. */
function derivedGroupId_(name) {
  return 'derived:' + String(name == null ? '' : name).trim();
}

/* حالة قراءة الأفواج: هل قُرئت، وهل نجحت القراءة، وهل صارت مشتركة بعد. */
const groupSync_ = { tried: false, readable: null, shared: false };

/* الأفواج التي عرّفها النادي وحدها، دون الأسماء التي يحملها السباحون. */
function managerGroups_() {
  return (state.groups || []).filter(g => g && g.source !== 'derived');
}

/* قائمة الأفواج كما تُكتب على الخادم: أربعة حقول، لا أكثر ولافتة داخلها. */
function cleanGroups_(list) {
  return (list || []).map(g => ({
    id: String((g && g.id) || ''),
    name: String((g && g.name) || ''),
    coach: String((g && g.coach) || ''),
    schedule: String((g && g.schedule) || '')
  }));
}

/* معرّف فوج باسمه، من الأفواج المعرَّفة وحدها: اسم يحمله سجل ليس له معرّف
   يُكتب، وكتابة معرّف مخترع له اختلاق جواب. */
function groupIdFor_(name) {
  const want = String(name == null ? '' : name).trim();
  if (!want) return '';
  const g = managerGroups_().find(x => String(x.name || '').trim() === want);
  return g ? String(g.id || '') : '';
}

/* أسماء الأفواج التي فيها سباح واحد على الأقل، بترتيب النادي.

   واسم التصفية الحالي يبقى في القائمة حتى لو خرج آخر سباح منه: قائمة
   تصفية تختفي من تحت الاختيار هي قائمة تتوقف عن العمل في صمت. والخيار
   الأول -- جميع الأفواج -- يُبنى في الصفحة نفسها. */
function filterGroupNames(selected) {
  const out = [];
  const seen = new Set();
  const swimmers = state.swimmers || [];
  for (const g of groups() || []) {
    const name = String((g && g.name) || '').trim();
    if (!name || seen.has(name)) continue;
    if (!swimmers.some(s => String(s.group || '').trim() === name)) continue;
    seen.add(name); out.push(name);
  }
  const want = String(selected == null ? '' : selected).trim();
  if (want && want !== 'all' && !seen.has(want)) { seen.add(want); out.push(want); }
  return out;
}

/* ---------------- القراءة ---------------- */

/* ما يعرضه الجدول في خانة الفوج: اختيار واحد يُغيَّر في مكانه.

   تقييده بالدور من نفس القائمة التي يستمع لها الخادم، فلا يظهر لعضوٍ
   سيرفضه الخادم: زر يعرض ما يرفضه الخادم زر يكذب. ومن لا يملك التغيير
   يقرأ الاسم نصًّا، وهو كل ما كان يفعله هذا العمود قبل اليوم. */
function inlineGroupCell(s) {
  const now = String((s && s.group) || '').trim();
  if (!canSetGroup()) return '<span class="group-cell">' + esc(now || '—') + '</span>';
  const names = groupChoices_().slice();
  if (now && names.indexOf(now) === -1) names.unshift(now);
  return '<select class="group-inline" data-inline-group="' + esc(s.id) + '"'
    + ' aria-label="فوج ' + esc((s && s.name) || 'السباح') + '">'
    + '<option value=""' + (now ? '' : ' selected') + '>— بلا فوج —</option>'
    + names.map(n => '<option' + (n === now ? ' selected' : '') + '>' + esc(n) + '</option>').join('')
    + '</select>';
}

/* إعادة بناء قائمة الصفحة من القائمة المشتركة، ثم إضافة الأسماء التي
   تحملها السجلات. تُنادى بعد كل تحميل، فيكون النصف المشتق مشتقًّا من
   السباحين الذين قُرئوا للتو، ولا يُحفظ. */
function adoptGroups_(served) {
  const manager = [];
  const seen = new Set();
  (Array.isArray(served) ? served : []).forEach((item, i) => {
    const name = String((item && item.name) || '').trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    manager.push({
      id: String((item && item.id) || '') || ('gshared' + i),
      name: name,
      coach: String((item && item.coach) || ''),
      schedule: String((item && item.schedule) || ''),
      source: 'manager'
    });
  });
  const derived = [];
  (state.swimmers || []).forEach(s => {
    const name = String((s && s.group) || '').trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    derived.push({ id: derivedGroupId_(name), name: name, coach: '', schedule: '', source: 'derived' });
  });
  state.groups = manager.concat(derived);
}

/* قراءة القائمة المشتركة. لا تكتب شيئًا إلا إذا كانت اللائحة لم تُنشأ بعد،
   وحينها تكتبها من لائحة النادي نفسها بدل أن تعرض ناديًا بلا أفواج. */
async function loadGroups_() {
  let served = null;
  let readable = false;
  try {
    const res = await fetch('/api/groups', { credentials: 'same-origin' });
    if (res.ok) {
      let data = {};
      try { data = await res.json(); } catch (_) { /* a body we cannot read is not an answer */ }
      served = data ? data.groups : null;
      readable = !data || data.readable !== false;
    }
  } catch (_) { readable = false; }

  groupSync_.tried = true;
  groupSync_.readable = readable;

  if (readable && Array.isArray(served)) {
    /* The club's own list, on every account. The names only records carry are
       added to what the page shows and are never written back. */
    adoptGroups_(served);
    groupSync_.shared = true;
    save();
    return;
  }

  if (readable) {
    /* اللائحة غير موجودة بعد: أفواج النادي في هذا المتصفح وحده. نُبقيها
       وننشرها بدل أن نعرض ناديًا بلا أفواج. وكتابة تفشل تترك اللائحة كما
       هي بالحرف. */
    const local = managerGroups_();
    adoptGroups_(local);
    if (canSetGroup() && local.length) {
      try {
        await api('/api/groups', 'PUT', { groups: cleanGroups_(local) });
        groupSync_.shared = true;
        save();
      } catch (_) {
        groupSync_.shared = false;
      }
    }
    return;
  }

  /* القراءة فشلت. اللائحة التي في الصفحة تبقى -- قراءة فاشلة ليست ناديًا
     بلا أفواج -- والصفحة تقول ذلك حيث تُعرض الأفواج. */
  adoptGroups_(managerGroups_());
  groupSync_.shared = false;
}

/* كتابة قائمة الأفواج على الخادم بعد كل تغيير. الفشل يُقال ولا يُسكت عنه:
   قائمة تبدو محفوظة للجميع وهي على جهاز واحد قائمة تكذب. */
async function pushGroups_(list) {
  if (!canSetGroup()) return false;
  try {
    await api('/api/groups', 'PUT', { groups: cleanGroups_(list) });
    groupSync_.shared = true;
    return true;
  } catch (err) {
    groupSync_.shared = false;
    showToast('لم تُحفظ قائمة الأفواج على الخادم — '
      + ((err && err.message) ? err.message : 'تعذّر الاتصال')
      + '. الأفواج محفوظة على هذا الجهاز فقط.', 'error');
    return false;
  }
}

/* ملاحظة أعلى صفحة الأفواج: أفواج مشتركة، أم على هذا الجهاز وحده.

   لا تُكتب إلا إذا كان في الكلام فائدة: صفحة صامتة حين يكون كل شيء على ما
   يرام، وجملة صريحة حين لا تكون القائمة مشتركة -- قائمة تُعرض على أنها
   أفواج النادي وهي على جهاز واحد قائمة تكذب. */
function groupsSourceNote() {
  if (groupSync_.readable === false) {
    return '<p class="groups-note warn" role="status">تعذّرت قراءة قائمة الأفواج من الخادم — '
      + 'المعروض هنا هو ما على هذا الجهاز، وهو ليس بالضرورة ما يراه غيرك.</p>';
  }
  if (groupSync_.tried && !groupSync_.shared) {
    return '<p class="groups-note" role="status">قائمة الأفواج لم تُحفظ على الخادم بعد — '
      + 'تُحفظ عند أول تعديل، فتصير هي نفسها على كل حساب.</p>';
  }
  return '';
}

/* ---------------- ربط الطبقة ---------------- */

/* كل حفظ لسباح يحمل معرّف فوجه معه. الاسم وحده لا يكفي: الاسم يُكتب
   ويُصحّح ويتغيّر، والمعرّف هو ما يُسأل عنه في مكان آخر. */
const coreApiGroups = api;
api = async function (path, method, body) {
  if (path === '/api/swimmers' && body && typeof body === 'object' && !Array.isArray(body)
    && Object.prototype.hasOwnProperty.call(body, 'group_name')) {
    return coreApiGroups.call(this, path, method,
      Object.assign({}, body, { group_id: groupIdFor_(body.group_name) }));
  }
  return coreApiGroups.apply(this, arguments);
};

/* بعد كل تزامن: السباحون قُرئوا، فتقرأ الأفواج عليهم. */
const coreSyncApiGroups = syncApi;
syncApi = async function () {
  const out = await coreSyncApiGroups.apply(this, arguments);
  try { await loadGroups_(); } catch (_) { /* the page keeps the list it had */ }
  return out;
};

/* ---------------- الأفعال ---------------- */

/* قائمة الفوج كما تُطبع: ورقة A4 يقف عليها المدرب في المسبح.
   أعمدة الحصص الأربع فارغة لتُعلَّم بالقلم: الحضور في قاعدة البيانات
   مرتبط بتاريخ وحصة، ولا شيء فيه يقول أي حصة من حصص اليوم هذه. وورقة
   تُعلَّم بخط اليد صحيحة؛ ورقة تُخمّن أرقامها كاذبة. */
const GROUP_ROSTER_SESSIONS = ['حصة 1', 'حصة 2', 'حصة 3', 'حصة 4'];

function groupRosterDoc_(g) {
  const list = swimmersOf(g.name);
  const box = document.createElement('section');
  box.className = 'roster group-roster';
  box.setAttribute('data-roster-group', String(g.id || ''));
  box.innerHTML = '<div class="roster-head"><div><h3>قائمة فوج ' + esc(g.name) + '</h3>'
    + '<p>المدرب المشرف: ' + esc(g.coach || '—') + ' · البرنامج الأسبوعي: ' + esc(g.schedule || '—') + '</p></div>'
    + '<div class="roster-count"><b>' + clubDigits(list.length) + '</b><small>سباح</small></div></div>'
    + '<table class="print-table roster-table"><thead><tr>'
    + '<th class="col-i">#</th><th>الاسم واللقب</th><th>رقم الانخراط</th>'
    + GROUP_ROSTER_SESSIONS.map(s => '<th class="col-mark">' + esc(s) + '</th>').join('')
    + '<th class="col-note">ملاحظات المدرب</th></tr></thead><tbody>'
    + (list.length
      ? list.map((s, i) => '<tr><td class="col-i">' + clubDigits(i + 1) + '</td>'
        + '<td><b>' + esc(s.name || '') + '</b></td>'
        + '<td dir="ltr">' + esc(clubDigits(s.id || '')) + '</td>'
        + GROUP_ROSTER_SESSIONS.map(() => '<td class="mark-cell"></td>').join('')
        + '<td class="note-cell"></td></tr>').join('')
      : emptyRow(3 + GROUP_ROSTER_SESSIONS.length + 1, 'لا يوجد سباحون في هذا الفوج.'))
    + '</tbody></table>'
    + '<div class="roster-sign">'
    + '<div class="sign-slot"><span>توقيع المدرب</span><i></i></div>'
    + '<div class="sign-slot"><span>ختم الإدارة</span><i></i></div>'
    + '</div>';
  return box;
}

/* المعاينة قبل الطباعة: الورقة كما ستخرج، بتاريخ استخراجها. */
function openGroupRoster_(groupId) {
  const g = (groups() || []).find(x => String(x.id) === String(groupId));
  if (!g) { showToast('تعذّر العثور على بيانات الفوج.', 'error'); return; }
  const today = clubDigits(slashDate(longDate()));
  openModal('<div class="modal-backdrop"><div class="modal roster-modal">'
    + '<button class="close" data-action="close" aria-label="إغلاق">×</button>'
    + '<div class="roster-modal-head"><b>' + esc(CLUB.name) + ' — ' + esc(CLUB.unit) + '</b>'
    + '<span>قائمة الفوج: ' + esc(g.name) + '</span>'
    + '<span>المدرب: ' + esc(g.coach || '—') + ' · البرنامج: ' + esc(g.schedule || '—') + '</span>'
    + '<span>تاريخ الاستخراج: ' + today + ' · الموسم ' + esc(clubDigits(CLUB.season)) + '</span></div>'
    + '<div class="roster-sheet">' + groupRosterDoc_(g).outerHTML + '</div>'
    + '<div class="roster-modal-actions">'
    + '<button class="btn btn-primary" data-action="print-group-roster" data-group="' + esc(g.id) + '">🖨 طباعة A4</button>'
    + '<button class="btn btn-outline" data-action="close">إغلاق</button>'
    + '</div></div></div>');
}

function printGroupRosterA4_(groupId) {
  const g = (groups() || []).find(x => String(x.id) === String(groupId));
  if (!g) { showToast('تعذّر العثور على بيانات الفوج.', 'error'); return; }
  document.querySelector('.modal-backdrop')?.remove();
  printArea(groupRosterDoc_(g), { title: 'قائمة الفوج', sub: g.name, variant: 'roster', date: longDate() });
}

/* ملاحظة على فوج يحمله سباحون ولا يعرّفه النادي، وزرّ الحذف يُمنع له. */
function groupSourceNote(g) {
  return g && g.source === 'derived'
    ? '<p class="group-source">اسم يحمله سباحون · غير معرَّف في قائمة الأفواج</p>'
    : '';
}

function groupDeleteButton(g) {
  if (g && g.source === 'derived') return '';
  return '<button class="check-btn no" data-action="delete-group" data-group="' + esc(g.id) + '">حذف</button>';
}

const coreActionGroups = action;
action = async function (a, el) {
  const dataset = (el && el.dataset) || {};

  if (a === 'reset-swimmer-filters') {
    /* A way of looking, not a setting about the club: nothing is saved. */
    state.userQuery = '';
    state.groupFilter = 'all';
    renderPageOnly();
    return;
  }

  if (a === 'group-roster') { openGroupRoster_(dataset.group); return; }
  if (a === 'print-group-roster') { printGroupRosterA4_(dataset.group); return; }

  if (a === 'save-group' || a === 'delete-group') {
    /* تعديل الصفحة يبقى كما هو؛ هذه الطبقة تحمل نتيجته إلى الخادم بعده،
       فتكون قائمة الاستمارة وقائمة صفحة الأفواج قائمة واحدة على كل جهاز. */
    const before = JSON.stringify(cleanGroups_(managerGroups_()));
    const out = await coreActionGroups.apply(this, arguments);
    if (a === 'save-group' && dataset.group) {
      /* النادي تبنّى اسمًا كان يحمله سباحون: يُكتب فيصير من أفواج النادي. */
      const g = (state.groups || []).find(x => String(x.id) === String(dataset.group));
      if (g) g.source = 'manager';
    }
    const changed = JSON.stringify(cleanGroups_(managerGroups_())) !== before;
    if (changed || !groupSync_.shared) await pushGroups_(managerGroups_());
    return out;
  }

  return coreActionGroups.apply(this, arguments);
};

/* ---------------- التغيير من داخل الجدول ---------------- */

/* مستمع واحد على المستند: الجدول يُعاد رسمه مع كل حرف في مربع البحث،
   ومستمع يُربط بالعنصر نفسه يصبح مستمعًا على عقدة لم تعد موجودة. */
document.addEventListener('change', (e) => {
  const target = e.target;
  const sel = (target && target.closest) ? target.closest('select[data-inline-group]') : null;
  if (!sel) return;
  const id = sel.getAttribute('data-inline-group');
  const s = (state.swimmers || []).find(x => String(x.id) === String(id));
  if (!s) return;
  const group = String(sel.value || '').trim();
  const before = String(s.group || '');
  if (group === before) return;

  sel.disabled = true;
  api('/api/swimmers', 'PUT', { id: id, group_name: group }).then(() => {
    s.group = group;
    s.group_name = group;
    s.group_id = groupIdFor_(group);
    save();
    showToast(group ? 'نُقل إلى فوج ' + group + '.' : 'أُخرج من الفوج.');
    render();
    /* الفوج يقرّر كل عدد في صفحة الأفواج وكل سطر في قائمة الطباعة،
       فتُقرأ القائمة من جديد ولا يُخمَّن فيها. */
    loadGroups_();
  }).catch((err) => {
    sel.disabled = false;
    sel.value = before;
    showToast((err && err.message) ? err.message : 'تعذّر تغيير الفوج — لم يتغيّر شيء.', 'error');
  });
});
