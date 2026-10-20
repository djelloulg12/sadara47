/* لوحة الأفواج: تعريف كامل، ومصدر واحد، ونشر لحظيّ على المنخرطين.

   ---------------------------------------------------------------------------
   ما كانت عليه هذه الطبقة، وما صارت إليه.

   كانت القائمة أربعة حقول -- اسم ومدرب وجدول نصّيّ -- لأن الغرض كان أن
   تتفق صفحة الأفواج واستمارة السباح على اسم واحد. وكان ذلك يكفي يوم كان
   النادي صغيرًا وفوجًا واحدًا لكل مستوى.

   ثم صار للنادي فئات: أصاغر وبراعم، وأكابر وكهول، وفئة نسوية بتوقيت مستقلّ،
   وفرق نخبة تتحضّر للبطولات. والفوج الذي لا يُعرف فيه يومه ولا ساعته ولا
   سعته ولا من يعاونه في التدريب لا يكفي لجدول أسبوعي ولا لقاعة حوض.

   والفوج الآن عشرة حقول:
     الاسم · الفئة · أيام التدريب · ساعة الدخول والخروج · الطاقة الاستيعابية
     · المدرب الرئيسي · المساعدون · المسبح · ملاحظات

   ---------------------------------------------------------------------------
   والمبدأ الذي يحكم كل شيء هنا: **المعرّف هو الفوج، والاسم عنوانه.**

   وهذا ليس تفصيلًا. لو كان الاسم هو الرابط، لكانت إعادة تسمية فوج («فوج 1»
   → «أكابر - تدريب متقدم») تُخرج كل أعضائه منه دفعة واحدة، لأن الاسمين لا
   يتشابهان في حرف. وقد حدث هذا فعلًا في أول اختبار: 57 سباحًا نُقلوا إلى
   «غير مفرز» وهم في فوجهم. فالمعرّف يُقرأ أولًا، ثم الاسم، ثم جذره، ولا
   يُترك سباح في اسم لم يعد في القائمة.

   ---------------------------------------------------------------------------
   ومن حُذف فوجه لا يُحذف هو:

   ينقله الخادم إلى «غير مفرز» -- وهو فوج نظاميّ بمعرّف ثابت لا يُحذف -- ويقول
   للصفحة كم صار فيه، فتظهر قائمة انتظار التوزيع بدل أن يختفي الأطفال من
   التقارير بلا أثر.

   ---------------------------------------------------------------------------
   والكتابة كلها في نداء واحد: الخادم يكتب القائمة والسباحين في معاملة واحدة،
   فإما أن يتغيّر الاثنان أو لا يتغيّر شيء. فلا تُرى بطاقة باسم جديد وسباح
   باسم قديم. */

/* ---------------- الفئات والأيام ---------------- */

/* الفئة تسمية عربية للعرض ومفتاح ثابت في البيانات. والمفتاح ثابت لأن التسمية
   العربية قد تُصقل غدًا؛ ولو كانت هي المخزَّنة لتغيّرت البيانات بمجرّد تحسين
   كلمة. والقائمة تُقرأ من الخادم وتُسقط إلى هذه إن غابت. */
const GROUP_CATEGORY_FALLBACK = {
  minnows: 'الأصاغر والبراعم',
  juniors: 'الصغار',
  adults: 'الأكابر والكهول',
  women: 'الفئة النسوية',
  elite: 'فرق النخبة والمنافسة',
  fitness: 'اللياقة وتحسين الأداء'
};
const GROUP_DAYS_FALLBACK = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function groupCategories_() {
  const served = state.groupCategories;
  return (served && typeof served === 'object' && Object.keys(served).length)
    ? served : GROUP_CATEGORY_FALLBACK;
}
function groupDays_() {
  const served = state.weekdays;
  return Array.isArray(served) && served.length ? served : GROUP_DAYS_FALLBACK;
}
function categoryLabel_(key) {
  return groupCategories_()[String(key || '')] || '';
}

/* ---------------- الشكل والحفظ ---------------- */

/* الفوج كما يكتبه الخادم: عشرة حقول، لا لافتة داخلها.
   و`source` علامة على الشاشة وحدها (اسم يحمله سباح ولا يعرّفه النادي)،
   ولا تُكتب. */
function cleanGroups_(list) {
  return (list || []).map(g => ({
    id: String((g && g.id) || ''),
    name: String((g && g.name) || ''),
    category: String((g && g.category) || ''),
    days: Array.isArray(g && g.days) ? g.days.slice() : [],
    start: String((g && g.start) || ''),
    end: String((g && g.end) || ''),
    capacity: Number((g && g.capacity) || 0) || 0,
    coach: String((g && g.coach) || ''),
    assistants: Array.isArray(g && g.assistants) ? g.assistants.slice() : [],
    pool: String((g && g.pool) || ''),
    notes: String((g && g.notes) || '')
  }));
}

/* فوج فارغ جديد، بمعرّف يُشتقّ من الوقت: بطاقتان جديدتان في الثانية نفسها
   لا تتصادمان. */
function blankGroup_() {
  return {
    id: 'grp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
    name: '', category: '', days: [], start: '', end: '',
    capacity: 0, coach: '', assistants: [], pool: '', notes: '', source: 'manager'
  };
}

/* ---------------- الحالة ---------------- */

const groupSync_ = { tried: false, readable: null, shared: false };
const UNASSIGNED_ID = 'grp-unassigned';
const UNASSIGNED_NAME = 'غير مفرز';

/* أفواج النادي وحدها: اسم يحمله سباحون ولا يعرّفه النادي ليس فوجًا يُكتب. */
function managerGroups_() {
  return (state.groups || []).filter(g => g && g.source !== 'derived');
}
function unassignedCount_() {
  return Number(state.groupUnassigned || 0) || 0;
}

/* اسم الفوج من معرّفه. كل ما يعرض فوجًا يسأل بهذه، لا يمشي على القائمة
   بنفسه فيطّلع كل موضع على نسخة مختلفة. */
function groupById_(id) {
  const want = String(id == null ? '' : id).trim();
  if (!want) return null;
  if (want === UNASSIGNED_ID) return { id: UNASSIGNED_ID, name: UNASSIGNED_NAME, members: unassignedCount_() };
  return (groups() || []).find(x => String((x && x.id) || '') === want) || null;
}
function groupByName_(name) {
  const want = String(name == null ? '' : name).trim();
  if (!want) return null;
  return managerGroups_().find(x => String(x.name || '').trim() === want) || null;
}

/* معرّف فوج باسمه، من الأفواج المعرَّفة وحدها: اسم يحمله سجل ليس له معرّف
   يُكتب، وكتابة معرّف مخترع له اختلاق جواب. */
function groupIdFor_(name) {
  const g = groupByName_(name);
  return g ? String(g.id || '') : '';
}

/* أسماء الأفواج التي فيها سباح واحد على الأقل، بترتيب النادي.
   واسم التصفية الحالي يبقى في القائمة حتى لو خرج آخر سباح منه: قائمة تصفية
   تختفي من تحت الاختيار قائمة تتوقف عن العمل في صمت. */
function filterGroupNames(selected) {
  const out = [];
  const seen = new Set();
  const swimmers = state.swimmers || [];
  /* الأفواج المعرَّفة، ثم الأسماء التي تحملها السجلات. والثاني ليس فوجًا:
     هو عنوان مؤقّت لطفل ينتظر التوزيع، ووجوده في التصفية يجعله يُوجد. */
  const names = [UNASSIGNED_NAME].concat(managerGroups_().map(g => String((g && g.name) || '').trim()));
  swimmers.forEach(s => names.push(String((s && s.group) || '').trim()));
  for (const name of names) {
    if (!name || seen.has(name)) continue;
    if (!swimmers.some(s => String(s.group || '').trim() === name)) continue;
    seen.add(name); out.push(name);
  }
  const want = String(selected == null ? '' : selected).trim();
  if (want && want !== 'all' && !seen.has(want)) { seen.add(want); out.push(want); }
  return out;
}

/* ---------------- القراءة ---------------- */

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

/* إعادة بناء قائمة الصفحة من القائمة المشتركة وحدها.

   وكانت تُضاف إليها أسماء يحملها السباحون ولا يعرّفها النادي، فتعود الأفواج
   المحذوفة بعد كل قراءة: يحذف المسير «المبتدئون»، فتعود لأن سباحًا واحدًا
   ما زال يحمل الاسم على بطاقته. وهذا قلبٌ للقاعدة: القائمة قائمة النادي،
   ومن ليس في فوج معرَّف ينتظر في «غير مفرز» حتى يوزّعه المسير.

   فلا اسم يدخل القائمة إلا من `config/groups`. والاسم الذي على السجل يبقى
   على السجل، ويُعرض في الاستمارة وفي التصفية، ولا يصير فوجًا من تلقاء نفسه. */
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
      category: String((item && item.category) || ''),
      days: Array.isArray(item && item.days) ? item.days.slice() : [],
      start: String((item && item.start) || ''),
      end: String((item && item.end) || ''),
      capacity: Number((item && item.capacity) || 0) || 0,
      coach: String((item && item.coach) || ''),
      assistants: Array.isArray(item && item.assistants) ? item.assistants.slice() : [],
      pool: String((item && item.pool) || ''),
      notes: String((item && item.notes) || ''),
      members: Number((item && item.members) || 0) || 0,
      source: 'manager'
    });
  });
  state.groups = manager;
}

/* مركز الأفواج كاملًا: القائمة والفئات والأيام وعدد غير المفرزين.
   كلها من نداء واحد -- نداءان يعرضان قائمة فئات من قراءة وفوج من قراءة
   أخرى، فيُختار فئة لا يعرفها الخادم. */
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
      if (data && data.categories) state.groupCategories = data.categories;
      if (data && Array.isArray(data.weekdays)) state.weekdays = data.weekdays;
      if (data && data.unassigned) state.groupUnassigned = Number(data.unassigned.members) || 0;
    }
  } catch (_) { readable = false; }

  groupSync_.tried = true;
  groupSync_.readable = readable;

  if (readable && Array.isArray(served)) {
    adoptGroups_(served);
    groupSync_.shared = true;
    save();
    return;
  }

  if (readable) {
    /* اللائحة غير موجودة بعد: أفواج النادي في هذا المتصفح وحده. نُبقيها
       وننشرها بدل أن نعرض ناديًا بلا أفواج. */
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

  adoptGroups_(managerGroups_());
  groupSync_.shared = false;
}

/* حفظ القائمة على الخادم. الفشل يُقال ولا يُسكت عنه: قائمة تبدو محفوظة
   للجميع وهي على جهاز واحد قائمة تكذب.

   والردّ يحمل ما فعله الخادم بالسباحين -- كم انتقل فوجه وكم صار غير مفرز --
   فتقوله الصفحة، لأن أثر التعديل على الأطفال هو ما يهمّ المدير، لا نجاح
   الطلب. */
async function pushGroups_(list) {
  if (!canSetGroup()) return false;
  try {
    const out = await api('/api/groups', 'PUT', { groups: cleanGroups_(list) });
    groupSync_.shared = true;
    if (out && Array.isArray(out.warnings) && out.warnings.length) {
      showToast('حُفظت الأفواج. تنبيه: ' + out.warnings.join(' '), 'warn');
    }
    if (out && Number(out.updated_swimmers)) {
      showToast('حُدّث ' + clubDigits(out.updated_swimmers) + ' منخرطًا إلى بيانات الأفواج الجديدة.'
        + (Number(out.parked) ? ' منهم ' + clubDigits(out.parked) + ' إلى «غير مفرز».' : ''), 'success');
    }
    return true;
  } catch (err) {
    groupSync_.shared = false;
    showToast('لم تُحفظ قائمة الأفواج على الخادم — '
      + ((err && err.message) ? err.message : 'تعذّر الاتصال')
      + '. الأفواج محفوظة على هذا الجهاز فقط.', 'error');
    return false;
  }
}

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

/* شريط «غير مفرز»: قائمة انتظار التوزيع.
   لا يظهر إلا إذا كان فيه أحد -- شريط يقول «صفر» في كل تحميل يُقرأ بلا أن
   يُقرأ. وحين يظهر فهو أوّل ما تقع عليه العين، لأن فيه أطفالًا بلا فوج. */
function unassignedBanner_() {
  const n = unassignedCount_();
  if (!n || !canSetGroup()) return '';
  return '<div class="unassigned-banner" role="status">'
    + '<span class="unassigned-icon" aria-hidden="true">⚑</span>'
    + '<div><b>' + clubDigits(n) + ' منخرطًا بلا فوج</b>'
    + '<p>حُذف فوجهم، أو لم يُوزَّعوا بعد. المنخرط لا يُحذف بحذف الفوج —'
    + ' انقلهم إلى فوج قائم أو أنشئ لهم فوجًا.</p></div>'
    + '<button class="btn btn-outline" data-action="assign-unassigned">توزيعهم</button>'
    + '</div>';
}

/* ---------------- ربط الطبقة ---------------- */

/* كل حفظ لسباح يحمل معرّف فوجه معه. الاسم وحده لا يكفي. */
const coreApiGroups = api;
api = async function (path, method, body) {
  if (path === '/api/swimmers' && body && typeof body === 'object' && !Array.isArray(body)
    && Object.prototype.hasOwnProperty.call(body, 'group_name')) {
    return coreApiGroups.call(this, path, method,
      Object.assign({}, body, { group_id: groupIdFor_(body.group_name) }));
  }
  return coreApiGroups.apply(this, arguments);
};

const coreSyncApiGroups = syncApi;
syncApi = async function () {
  const out = await coreSyncApiGroups.apply(this, arguments);
  try { await loadGroups_(); } catch (_) { /* the page keeps the list it had */ }
  return out;
};

/* ---------------- الأفعال ---------------- */

const GROUP_ROSTER_SESSIONS = ['حصة 1', 'حصة 2', 'حصة 3', 'حصة 4'];

function groupRosterRecorders_() {
  const out = {};
  try {
    (state.swimmers || []).forEach(s => {
      const a = attendanceOf(s.id);
      if (a && a.recorder) out[String(s.id)] = a;
    });
  } catch (_) { /* a roster is a paper, not a place to fail */ }
  return out;
}

/* سطر البرنامج: الأيام والتوقيت كما تُطبع على الورقة. */
function groupScheduleLine_(g) {
  const days = Array.isArray(g && g.days) ? g.days : [];
  const time = (g && g.start && g.end) ? (g.start + ' – ' + g.end) : '';
  const parts = [];
  if (days.length) parts.push(days.join(' · '));
  if (time) parts.push(time);
  if (g && g.pool) parts.push(g.pool);
  return parts.join('  ·  ') || (g && g.schedule) || '—';
}
function groupCoachesLine_(g) {
  const main = String((g && g.coach) || '').trim();
  const helpers = Array.isArray(g && g.assistants) ? g.assistants.filter(Boolean) : [];
  if (!main && !helpers.length) return '—';
  return [main].concat(helpers.map(h => h + ' (مساعد)')).join(' · ');
}

function groupRosterDoc_(g) {
  const list = swimmersOf(g.name);
  const recorders = groupRosterRecorders_();
  const anyRecorder = Object.keys(recorders).length > 0;
  const box = document.createElement('section');
  box.className = 'roster group-roster';
  box.setAttribute('data-roster-group', String(g.id || ''));
  box.innerHTML = '<div class="roster-head"><div><h3>قائمة فوج ' + esc(g.name) + '</h3>'
    + (g.category ? '<p>الفئة: ' + esc(categoryLabel_(g.category)) + '</p>' : '')
    + '<p>الطاقم التدريبي: ' + esc(groupCoachesLine_(g)) + ' · البرنامج: ' + esc(groupScheduleLine_(g)) + '</p></div>'
    + '<div class="roster-count"><b>' + clubDigits(list.length) + '</b><small>سباح</small></div></div>'
    + '<table class="print-table roster-table"><thead><tr>'
    + '<th class="col-i">#</th><th>الاسم واللقب</th><th>رقم الانخراط</th>'
    + GROUP_ROSTER_SESSIONS.map(s => '<th class="col-mark">' + esc(s) + '</th>').join('')
    + '<th class="col-recorder">سجّله</th>'
    + '<th class="col-note">ملاحظات المدرب</th></tr></thead><tbody>'
    + (list.length
      ? list.map((s, i) => '<tr><td class="col-i">' + clubDigits(i + 1) + '</td>'
        + '<td><b>' + esc(s.name || '') + '</b></td>'
        + '<td dir="ltr">' + esc(clubDigits(s.id || '')) + '</td>'
        + GROUP_ROSTER_SESSIONS.map(() => '<td class="mark-cell"></td>').join('')
        + '<td class="recorder-cell">' + (anyRecorder ? recorderTag(recorders[String(s.id)] || null) : '') + '</td>'
        + '<td class="note-cell"></td></tr>').join('')
      : emptyRow(3 + GROUP_ROSTER_SESSIONS.length + 2, 'لا يوجد سباحون في هذا الفوج.'))
    + '</tbody></table>'
    + '<div class="roster-sign">'
    + '<div class="sign-slot"><span>توقيع المدرب</span><i></i></div>'
    + '<div class="sign-slot"><span>ختم الإدارة</span><i></i></div>'
    + '</div>';
  return box;
}

function openGroupRoster_(groupId) {
  const g = groupById_(groupId);
  if (!g) { showToast('تعذّر العثور على بيانات الفوج.', 'error'); return; }
  const today = clubDigits(slashDate(longDate()));
  openModal('<div class="modal-backdrop"><div class="modal roster-modal">'
    + '<button class="close" data-action="close" aria-label="إغلاق">×</button>'
    + '<div class="roster-modal-head"><b>' + esc(CLUB.name) + ' — ' + esc(CLUB.unit) + '</b>'
    + '<span>قائمة الفوج: ' + esc(g.name) + '</span>'
    + '<span>الطاقم: ' + esc(groupCoachesLine_(g)) + ' · البرنامج: ' + esc(groupScheduleLine_(g)) + '</span>'
    + '<span>تاريخ الاستخراج: ' + today + ' · الموسم ' + esc(clubDigits(CLUB.season)) + '</span></div>'
    + '<div class="roster-sheet">' + groupRosterDoc_(g).outerHTML + '</div>'
    + '<div class="roster-modal-actions">'
    + '<button class="btn btn-primary" data-action="print-group-roster" data-group="' + esc(g.id) + '">🖨 طباعة A4</button>'
    + '<button class="btn btn-outline" data-action="close">إغلاق</button>'
    + '</div></div></div>');
}

function printGroupRosterA4_(groupId) {
  const g = groupById_(groupId);
  if (!g) { showToast('تعذّر العثور على بيانات الفوج.', 'error'); return; }
  document.querySelector('.modal-backdrop')?.remove();
  printArea(groupRosterDoc_(g), { title: 'قائمة الفوج', sub: g.name, variant: 'roster', date: longDate() });
}

/* ---------------- محرّر الفوج ----------------
   حوار واحد لكل الحقول: التعريف والتعديل بالحوار نفسه، فلا يختلف ما يُملأ
   أول مرة عمّا يُعدَّل به بعد سنة.

   والتحذيرات تُعرض قبل الحفظ لا بعده: تعارض المسبح أو المدرب أو تجاوز السعة
   يُقال والنموذج مفتوح، حتى يُصلَح أو يُتجاوز عن علم. */
let groupDraft_ = null;

function dayCheckboxes_(selected) {
  const on = new Set(Array.isArray(selected) ? selected : []);
  return '<div class="day-grid">' + groupDays_().map(d =>
    '<label class="day-chip"><input type="checkbox" data-group-day="' + esc(d) + '"'
    + (on.has(d) ? ' checked' : '') + '><span>' + esc(d) + '</span></label>').join('') + '</div>';
}

function groupEditorHtml_(g) {
  const isNew = !g.id || !(managerGroups_().some(x => String(x.id) === String(g.id)));
  const cats = groupCategories_();
  return '<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="بيانات الفوج">'
    + '<div class="modal group-modal">'
    + '<button class="close" data-action="close" aria-label="إغلاق">×</button>'
    + '<h3>' + (isNew ? 'فوج جديد' : 'تعديل فوج') + '</h3>'
    + '<div class="group-form">'
    + '<label class="field wide"><span>اسم الفوج</span>'
    + '<input id="g-name" maxlength="80" value="' + esc(g.name || '') + '" placeholder="مثال: أكابر - تدريب متقدم"></label>'
    + '<label class="field"><span>الفئة</span><select id="g-category">'
    + '<option value="">— بلا فئة —</option>'
    + Object.keys(cats).map(k => '<option value="' + esc(k) + '"'
      + (g.category === k ? ' selected' : '') + '>' + esc(cats[k]) + '</option>').join('')
    + '</select></label>'
    + '<label class="field"><span>الطاقة الاستيعابية</span>'
    + '<input id="g-capacity" type="number" min="0" max="500" value="'
    + esc(String(g.capacity || '')) + '" placeholder="اتركه فارغًا إن لم تُحدَّد"></label>'
    + '<div class="field wide"><span>أيام التدريب</span>' + dayCheckboxes_(g.days) + '</div>'
    + '<label class="field"><span>من</span><input id="g-start" type="time" value="' + esc(g.start || '') + '"></label>'
    + '<label class="field"><span>إلى</span><input id="g-end" type="time" value="' + esc(g.end || '') + '"></label>'
    + '<label class="field"><span>المدرب الرئيسي</span>'
    + '<input id="g-coach" maxlength="120" value="' + esc(g.coach || '') + '"></label>'
    + '<label class="field"><span>المساعدون</span>'
    + '<input id="g-assistants" maxlength="240" value="' + esc((g.assistants || []).join('، ')) + '" placeholder="يفصل بينهم فاصلة"></label>'
    + '<label class="field wide"><span>المسبح</span>'
    + '<input id="g-pool" maxlength="120" value="' + esc(g.pool || '') + '"></label>'
    + '<label class="field wide"><span>ملاحظات</span>'
    + '<input id="g-notes" maxlength="300" value="' + esc(g.notes || '') + '"></label>'
    + '</div>'
    + '<div id="g-warn" class="group-warn" role="status"></div>'
    + '<div class="group-form-actions">'
    + '<button class="btn btn-primary" data-action="save-group" data-group="' + esc(g.id || '') + '">حفظ</button>'
    + '<button class="btn btn-outline" data-action="close">إلغاء</button>'
    + (isNew ? '' : '<button class="check-btn no" data-action="delete-group" data-group="' + esc(g.id) + '">حذف الفوج</button>')
    + '</div></div></div>';
}

function openGroupEditor_(id) {
  const g = id ? groupById_(id) : blankGroup_();
  if (!g) { showToast('تعذّر العثور على بيانات الفوج.', 'error'); return; }
  groupDraft_ = Object.assign({}, g);
  openModal(groupEditorHtml_(g));
}

/* قراءة النموذج كما هو على الشاشة. */
function readGroupForm_() {
  const val = sel => { const el = document.querySelector(sel); return el ? String(el.value || '').trim() : ''; };
  const days = Array.from(document.querySelectorAll('[data-group-day]'))
    .filter(el => el.checked).map(el => el.dataset.groupDay);
  return {
    id: groupDraft_ ? groupDraft_.id : '',
    name: val('#g-name'),
    category: val('#g-category'),
    days: days,
    start: val('#g-start'),
    end: val('#g-end'),
    capacity: Number(val('#g-capacity')) || 0,
    coach: val('#g-coach'),
    assistants: val('#g-assistants').split(/[،,]/).map(s => s.trim()).filter(Boolean),
    pool: val('#g-pool'),
    notes: val('#g-notes'),
    source: 'manager'
  };
}

/* تحذيرات تُعرض داخل النموذج قبل الحفظ: النادي يعرف مسبحه، والمنصة تنبّه
   ولا تمنع. ووقتان يتقاطعان في اليوم نفسه وفي المسبح نفسه إنذار حقيقي
   يُدار عليه الحوض. */
function groupDraftWarnings_(g) {
  const out = [];
  if (!String(g.name || '').trim()) out.push('اكتب اسم الفوج.');
  if (g.start && g.end && g.start >= g.end) out.push('ساعة الخروج قبل ساعة الدخول.');
  if (g.days.length && g.start && g.end) {
    for (const other of managerGroups_()) {
      if (String(other.id) === String(g.id)) continue;
      const days = Array.isArray(other.days) ? other.days : [];
      if (!other.start || !other.end || !days.some(d => g.days.includes(d))) continue;
      if (g.start < other.end && other.start < g.end) {
        if (g.coach && other.coach && g.coach === other.coach) {
          out.push('المدرب ' + g.coach + ' مشغول في «' + other.name + '» في وقت متقاطع.');
        }
        if (g.pool && other.pool && g.pool === other.pool) {
          out.push('«' + g.pool + '» محجوز لـ«' + other.name + '» في وقت متقاطع.');
        }
      }
    }
  }
  const g0 = managerGroups_().find(x => String(x.id) === String(g.id));
  const members = g0 ? Number(g0.members || swimmersOf(g0.name).length) : 0;
  if (g.capacity && members > g.capacity) {
    out.push('الفوج يحمل ' + clubDigits(members) + ' منخرطًا وسعته ' + clubDigits(g.capacity) + '.');
  }
  return out;
}

function refreshDraftWarnings_() {
  const box = document.querySelector('#g-warn');
  if (!box) return;
  const g = readGroupForm_();
  const warn = groupDraftWarnings_(g);
  box.innerHTML = warn.length
    ? '<b>تنبيه</b><ul>' + warn.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul>'
    : '';
  box.classList.toggle('has-warn', warn.length > 0);
}

/* حفظ الفوج من النموذج: قائمة الصفحة أولًا، ثم الخادم، والخادم ينشر على
   السباحين. وترتيب النداءين مقصود: لو نُشر قبل أن تُعرف القائمة لَبقي
   النموذج مفتوحًا على حالة لم تُحفظ. */
async function saveGroupFromForm_() {
  const g = readGroupForm_();
  if (!String(g.name || '').trim()) { showToast('اكتب اسم الفوج أولًا.', 'error'); return; }
  const dup = managerGroups_().find(x =>
    String(x.id) !== String(g.id) && String(x.name || '').trim() === g.name);
  if (dup) { showToast('اسم الفوج «' + g.name + '» مستعمل. لكل فوج اسم واحد.', 'error'); return; }

  const list = managerGroups_().filter(x => String(x.id) !== String(g.id)).concat([g]);
  state.groups = list;
  save();
  if (document.querySelector('.modal-backdrop')) document.querySelector('.modal-backdrop').remove();
  renderPageOnly();
  await pushGroups_(managerGroups_());
  try { await loadGroups_(); renderPageOnly(); } catch (_) { /* the list just written stands */ }
}

/* حذف الفوج: تأكيد صريح، ثم الحذف. والمنخرطون لا يُحذفون -- الخادم ينقلهم
   إلى «غير مفرز»، ويقول كم صاروا، فتعرضهم الصفحة في قائمة انتظار التوزيع. */
async function deleteGroup_(id) {
  const g = groupById_(id);
  if (!g) return;
  const members = Number(g.members || swimmersOf(g.name).length) || 0;
  const ok = confirm('حذف فوج «' + g.name + '»؟\n\n'
    + (members
      ? 'لن يُحذف أي منخرط. سيُنقل ' + clubDigits(members) + ' إلى «غير مفرز» '
        + 'حتى توزيعهم على فوج آخر.'
      : 'لا منخرطين في هذا الفوج.')
    + '\n\nلا يمكن التراجع عن حذف الفوج نفسه.');
  if (!ok) return;
  const list = managerGroups_().filter(x => String(x.id) !== String(id));
  state.groups = list;
  save();
  if (document.querySelector('.modal-backdrop')) document.querySelector('.modal-backdrop').remove();
  renderPageOnly();
  await pushGroups_(managerGroups_());
  try { await loadGroups_(); renderPageOnly(); } catch (_) { /* the list just written stands */ }
}

/* توزيع من لا فوج له: يفتح صفحة السباحين مصفّاة على «غير مفرز»، ومن هناك
   يُختار الفوج من الخانة المنسدلة في الجدول -- خانة موجودة أصلًا. */
function assignUnassigned_() {
  state.groupFilter = UNASSIGNED_NAME;
  state.userQuery = '';
  state.page = 'swimmers';
  renderPageOnly();
  showToast('اختر الفوج الجديد من خانة الفوج في الجدول.', 'info');
}

/* ملاحظة على فوج: لم تعد هناك أفواج مشتقّة من السجلات، فكل بطاقة فوج
   يعرّفه النادي. تُبقي الدالة شكل النداء لمن قد يقرأها. */
function groupSourceNote() {
  return '';
}

/* زرّا التعديل والحذف على البطاقة. الحذف لصاحب النادي وحده، والحذف على فوج
   مشتقّ لا معنى له: ليس في القائمة أصلًا. */
function groupDeleteButton(g) {
  if (!canSetGroup()) return '';
  return '<button class="check-btn" data-action="edit-group" data-group="' + esc(g.id) + '">تعديل</button>'
    + '<button class="check-btn no" data-action="delete-group" data-group="' + esc(g.id) + '">حذف</button>';
}

/* ---------------- صفحة الأفواج ----------------
   البطاقة القديمة كانت أربعة سطور: الاسم والمدرب والبرنامج والعدد. والفوج
   اليوم له فئة وأيام وتوقيت وسعة ومساعدون، فلا بدّ أن تُرى على البطاقة قبل
   أن يُفتح النموذج: المدير يقرأ الأسبوع من الصفحة لا من حوار. */

/* سطر برنامج الفوج كما يُقرأ: الأيام ثم الوقت. وإن غابا معًا، فرجع إلى
   الجدول النصّي القديم حتى لا تظهر بطاقة فارغة لفوج لم يُملأ بعد. */
function groupDaysLine_(g) {
  const days = Array.isArray(g && g.days) ? g.days : [];
  if (!days.length) return '';
  return days.join(' · ');
}

function groupCard_(g) {
  const members = Number(g.members || 0);
  const capacity = Number(g.capacity || 0);
  const full = capacity && members > capacity;
  const bits = [];
  if (g.category) bits.push('<span class="group-badge">' + esc(categoryLabel_(g.category)) + '</span>');
  if (g.start && g.end) bits.push('<span class="group-badge time">🕒 ' + esc(g.start + ' – ' + g.end) + '</span>');
  if (g.pool) bits.push('<span class="group-badge pool">🏊 ' + esc(g.pool) + '</span>');

  const helpers = Array.isArray(g.assistants) ? g.assistants.filter(Boolean) : [];
  const days = groupDaysLine_(g);

  return '<article class="group-card" data-group="' + esc(g.id) + '">'
    + '<div class="group-card-head"><span class="stat-icon blue">♟</span>'
    + '<span class="status success">نشط</span>'
    + '</div>'
    + '<h3>' + esc(g.name) + '</h3>'
    + (bits.length ? '<div class="group-badges">' + bits.join('') + '</div>' : '')
    + (days ? '<p><b>أيام التدريب:</b> ' + esc(days) + '</p>' : (g.schedule ? '<p><b>البرنامج:</b> ' + esc(g.schedule) + '</p>' : ''))
    + '<p><b>المدرب الرئيسي:</b> ' + esc(g.coach || '—')
    + (helpers.length ? ' <span class="group-helpers">· مساعدون: ' + esc(helpers.join('، ')) + '</span>' : '')
    + '</p>'
    + '<p><b>عدد المنخرطين:</b> ' + clubDigits(members)
    + (capacity ? ' <span class="' + (full ? 'group-over' : 'group-cap') + '">/ السعة ' + clubDigits(capacity) + (full ? ' · تجاوز' : '') + '</span>' : '')
    + '</p>'
    + (g.notes ? '<p class="group-notes">' + esc(g.notes) + '</p>' : '')
    + '<div class="group-card-actions">'
    + '<button class="check-btn" data-action="group-roster" data-group="' + esc(g.id) + '">🖨 معاينة وطباعة القائمة</button>'
    + groupDeleteButton(g)
    + '</div></article>';
}

/* الصفحة كاملة: الشريط، وقائمة الانتظار، والبطاقات، وجدول A4.

   والترتيب مقصود: شريط «غير مفرز» يعلو البطاقات، لأن فيه أطفالًا بلا فوج
   ينتظرون قرارًا؛ وما تحته جدول منظّم للطباعة. */
pageGroups = function () {
  const all = managerGroups_();

  return '<div class="toolbar"><span class="page-description">عرّف الأفواج بفئاتها وأيامها وتوقيتها وطاقمها — وينتشر التعديل على بطاقات المنخرطين فورًا.</span>'
    + '<div class="toolbar-group">' + printBtn('print-groups', 'طباعة قائمة الأفواج A4')
    + '<button class="btn btn-primary" data-action="new-group">+ إضافة فوج</button></div></div>'
    + groupsSourceNote()
    + unassignedBanner_()
    + '<section class="group-grid">'
    + (all.length ? all.map(groupCard_).join('') : '<p class="empty-cell">لا توجد أفواج. أضف فوجًا للبدء.</p>')
    + '</section>'
    + '<section class="panel print-a4"><div class="panel-head"><div><h3>قائمة الأفواج والمدربين</h3><p>نسخة منظمة للطباعة على ورق A4</p></div>'
    + printBtn('print-groups', 'طباعة A4') + '</div>'
    + '<div class="table-scroll"><table><thead><tr>'
    + '<th>الفوج</th><th>الفئة</th><th>الأيام والتوقيت</th><th>الطاقم التدريبي</th><th>المسبح</th><th>العدد</th>'
    + '</tr></thead><tbody>'
    + (all.length
      ? all.map(g => '<tr><td><b>' + esc(g.name) + '</b></td>'
        + '<td>' + esc(categoryLabel_(g.category) || '—') + '</td>'
        + '<td>' + esc(groupScheduleLine_(g)) + '</td>'
        + '<td>' + esc(groupCoachesLine_(g)) + '</td>'
        + '<td>' + esc(g.pool || '—') + '</td>'
        + '<td>' + clubDigits(Number(g.members || 0)) + '</td></tr>').join('')
      : emptyRow(6, 'لا توجد أفواج.'))
    + (unassignedCount_()
      ? '<tr class="row-warn"><td><b>' + UNASSIGNED_NAME + '</b></td><td>—</td><td>—</td><td>—</td><td>—</td>'
        + '<td>' + clubDigits(unassignedCount_()) + '</td></tr>'
      : '')
    + '</tbody></table></div></section>';
};

const coreActionGroups = action;
action = async function (a, el) {
  const dataset = (el && el.dataset) || {};

  if (a === 'add-group') { openGroupEditor_(''); return; }

  if (a === 'reset-swimmer-filters') {
    state.userQuery = '';
    state.groupFilter = 'all';
    renderPageOnly();
    return;
  }

  if (a === 'group-roster') { openGroupRoster_(dataset.group); return; }
  if (a === 'print-group-roster') { printGroupRosterA4_(dataset.group); return; }
  if (a === 'new-group') { openGroupEditor_(''); return; }
  if (a === 'edit-group') { openGroupEditor_(dataset.group); return; }
  if (a === 'assign-unassigned') { assignUnassigned_(); return; }

  if (a === 'save-group') {
    /* النموذج الكامل إن كان مفتوحًا -- هو الطريق الوحيد اليوم، والاحتفاظ
       بالمسار القديم حتى لا تُعطَّل بطاقة قديمة لم تُحدَّث. */
    if (document.querySelector('#g-name')) { await saveGroupFromForm_(); return; }
    const before = JSON.stringify(cleanGroups_(managerGroups_()));
    const out = await coreActionGroups.apply(this, arguments);
    if (dataset.group) {
      const g = (state.groups || []).find(x => String(x.id) === String(dataset.group));
      if (g) g.source = 'manager';
    }
    const changed = JSON.stringify(cleanGroups_(managerGroups_())) !== before;
    if (changed || !groupSync_.shared) await pushGroups_(managerGroups_());
    return out;
  }

  if (a === 'delete-group') { await deleteGroup_(dataset.group); return; }

  return coreActionGroups.apply(this, arguments);
};

/* ---------------- التغيير من داخل الجدول ---------------- */

/* نقل سباح من خانة الفوج المنسدلة في جدول السباحين.

   مستمع واحد على المستند: الجدول يُعاد رسمه مع كل حرف في مربع البحث، ومستمع
   يُربط بالعنصر نفسه يصبح مستمعًا على عقدة لم تعد موجودة.

   والمعرّف يسافر مع الاسم: `group_name` وحده لا يكفي، فالفوج يُقرأ بمعرّفه.
   و`api` في هذه الطبقة يضيف `group_id` من الاسم تلقائيًا، فلا يُنسى. */
document.addEventListener('change', (e) => {
  const target = e.target;

  /* حقول محرّر الفوج تُعيد حساب التنبيهات قبل الحفظ، لا بعده. */
  if (target && /^g-/.test(target.id || '')) { refreshDraftWarnings_(); return; }
  if (target && target.dataset && target.dataset.groupDay) { refreshDraftWarnings_(); return; }

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
document.addEventListener('input', (e) => {
  if (e.target && /^g-/.test(e.target.id || '')) refreshDraftWarnings_();
  if (e.target && e.target.dataset && e.target.dataset.groupDay) refreshDraftWarnings_();
});
