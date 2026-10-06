/* ==========================================================
   تعديلات 2: البطاقات الفنية = بطاقات الانخراط الرسمية
   تعديل 3: ورقة A4 بعشر بطاقات
   تعديل 4: الجدول الأسبوعي بطباعة إبداعية
   تعديل 1: الملف الشخصي الكامل مع تفاصيل مخصصة
   ========================================================== */
const CARD_W = 85;
const CARD_H = 52;
const PER_SHEET = 10;

/* ---------- 2) البطاقة الفنية: الرقم تحت الصورة ---------- */function cardSheet(list, kind){
  const items = (Array.isArray(list) ? list : [list]).filter(Boolean);
  if (!items.length) { showToast('لا توجد بطاقات للطباعة.', 'error'); return; }
  const box = document.createElement('div');
  box.className = 'lux-sheet';
  let html = '';
  items.forEach(p => { html += luxuryCard(p, kind); });
  box.innerHTML = html;
  const host = printArea(box, { variant: 'sheet10', bare: true });
  if (host) buildQRCodes();
  return host;
}
function chunkTen(list){
  const out = [];
  for (let i = 0; i < list.length; i += PER_SHEET) out.push(list.slice(i, i + PER_SHEET));
  return out.length ? out : [[]];
}
function printCardSheets(list, kind){
  const items = (Array.isArray(list) ? list : [list]).filter(Boolean);
  if (!items.length) { showToast('لا توجد بطاقات للطباعة.', 'error'); return; }
  const pages = chunkTen(items);
  const box = document.createElement('div');
  pages.forEach(chunk => {
    const page = document.createElement('div');
    page.className = 'lux-page';
    chunk.forEach(p => page.insertAdjacentHTML('beforeend', luxuryCard(p, kind)));
    for (let i = chunk.length; i < PER_SHEET; i++) page.insertAdjacentHTML('beforeend', '<i class="lux-slot"></i>');
    box.appendChild(page);
  });
  const host = printArea(box, { variant: 'sheet10', bare: true });
  if (host) buildQRCodes();
}

/* ---------- 4) الجدول الأسبوعي بطباعة إبداعية ---------- */
const SLOT_KEYS = [
  { id: 'morning', label: 'الصباح', from: '08:00', to: '12:00', tone: 'dawn' },
  { id: 'midday', label: 'الظهر', from: '12:00', to: '16:00', tone: 'noon' },
  { id: 'evening', label: 'المساء', from: '16:00', to: '20:00', tone: 'dusk' }
];
function slotOf(timeRange){
  const t = String(timeRange || '').trim();
  const start = (t.match(/(\d{1,2})\s*[:：hH]/) || [])[1];
  const h = start === undefined ? null : Number(start);
  if (h === null) return SLOT_KEYS[2];
  if (h < 12) return SLOT_KEYS[0];
  if (h < 16) return SLOT_KEYS[1];
  return SLOT_KEYS[2];
}
function scheduleSheet(){
  const sessions = state.schedules || [];
  const range = weekRange(state.weekOffset || 0);
  const byDay = {};
  WEEK_DAYS.forEach(d => { byDay[d] = { morning: [], midday: [], evening: [] }; });
  sessions.forEach(s => {
    const day = String(s.day_name || '').trim();
    const target = byDay[day] || byDay[day.replace('الإثنين', 'الاثنين')] || byDay[day.replace('الأثنين', 'الاثنين')];
    if (!target) return;
    target[slotOf(s.time_range).id].push(s);
  });
  const head = '' +
    '<header class="sch-head">' +
      '<div class="sch-brand"><img src="assets/logo.png" alt=""><div><b>' + CLUB_AR + '</b><small dir="ltr">' + CLUB_FR + '</small></div></div>' +
      '<div class="sch-title"><span class="sch-eyebrow">البرنامج الرسمي</span><h1>الجدول الأسبوعي للحصص</h1><p>' + esc(range.label) + ' · الموسم ' + esc(CLUB.season) + '</p></div>' +
      '<div class="sch-counts">' +
        '<div><b>' + sessions.length + '</b><small>حصة</small></div>' +
        '<div><b>' + new Set(sessions.map(s => String(s.coach || '').trim()).filter(Boolean)).size + '</b><small>مدرب</small></div>' +
        '<div><b>' + new Set(sessions.map(s => String(s.pool || '').trim()).filter(Boolean)).size + '</b><small>منشأة</small></div>' +
      '</div>' +
    '</header>';

  const grid = '<div class="sch-grid">' +
    WEEK_DAYS.map((day, i) => {
      const d = new Date(range.start);
      d.setDate(range.start.getDate() + i);
      const cells = SLOT_KEYS.map(slot => {
        const list = byDay[day][slot.id];
        return '<div class="sch-slot tone-' + slot.tone + '">' +
          '<span class="sch-slot-label">' + esc(slot.label) + ' <i>' + esc(slot.from + '–' + slot.to) + '</i></span>' +
          (list.length
            ? list.map(s => '<article class="sch-card g-' + (String(s.group_name || '').trim() || 'x').slice(0, 6).replace(/\s/g, '') + '">' +
                '<b>' + esc(s.time_range || '') + '</b>' +
                '<strong>' + esc(s.group_name || '—') + '</strong>' +
                '<small>' + esc(s.coach || '') + '</small>' +
                (s.pool ? '<em>📍 ' + esc(s.pool) + '</em>' : '') +
              '</article>').join('')
            : '<span class="sch-rest">راحة</span>') +
        '</div>';
      }).join('');
      const total = SLOT_KEYS.reduce((n, s) => n + byDay[day][s.id].length, 0);
      return '<section class="sch-day' + (total ? '' : ' is-off') + '">' +
        '<header class="sch-day-head"><b>' + esc(day) + '</b><small>' + pad2(d.getDate()) + ' ' + esc(AR_MONTHS[d.getMonth()]) + '</small>' +
        '<span class="sch-badge">' + (total || '—') + '</span></header>' +
        cells + '</section>';
    }).join('') + '</div>';

  const legend = '<div class="sch-legend"><span class="sch-legend-t">الفوج:</span>' +
    [...new Set(sessions.map(s => String(s.group_name || '').trim()).filter(Boolean))].map(g =>
      '<span class="sch-chip g-' + g.slice(0, 6).replace(/\s/g, '') + '">' + esc(g) + '</span>').join('') +
    (sessions.some(s => String(s.pool || '').trim()) ? '<span class="sch-legend-p">📍 موقع المسبح</span>' : '') +
    '</div>';

  const notes = '<div class="sch-notes">' +
    '<div><b>ملاحظات المديرية</b><span>الحضور قبل الموعد بـ 15 دقيقة · وغطاء الرأس إجباري' +
    '<div class="sch-sign"><span>مدير الفوج</span><span>رئيس النادي</span></div>' +
    '</div>';

  const box = document.createElement('section');
  box.className = 'schedule-doc';
  box.innerHTML = head + grid + legend + notes;
  return box;
}
function printScheduleDoc(){
  // printArea consumes the children of the node it is given, so the styled
  // document is wrapped first and the wrapper is what reaches the sheet.
  const wrap=document.createElement('div');
  wrap.className='sch-wrap';
  wrap.appendChild(scheduleSheet());
  printArea(wrap, { variant: 'schedule', title: 'الجدول الأسبوعي', sub: weekRange(state.weekOffset || 0).label });
}

/* ---------- 1) الملف الشخصي الكامل ---------- */
const PROFILE_FIELDS = [
  { k: 'name', label: 'الاسم واللقب', type: 'text' },
  { k: 'first_name_fr', label: 'الاسم بالفرنسية', type: 'text' },
  { k: 'birth_date', label: 'تاريخ الميلاد', type: 'date' },
  { k: 'birth_place', label: 'محل الميلاد', type: 'text' },
  { k: 'wilaya', label: 'الولاية', type: 'text' },
  { k: 'address', label: 'العنوان', type: 'text' },
  { k: 'phone', label: 'رقم الهاتف', type: 'tel' },
  { k: 'whatsapp', label: 'WhatsApp', type: 'tel' },
  { k: 'blood_group', label: 'فصيلة الدم', type: 'select', options: ['', 'O+', 'O−', 'A+', 'A−', 'B+', 'B−', 'AB+', 'AB−'] },
  { k: 'gender', label: 'الجنس', type: 'select', options: ['', 'm', 'f'] },
  { k: 'national_id', label: 'رقم التعريف الوطني', type: 'text' },
  { k: 'height', label: 'الطول (سم)', type: 'number' },
  { k: 'weight', label: 'الوزن (كغ)', type: 'number' },
  { k: 'emergency_name', label: 'اسم شخص للطوارئ', type: 'text' },
  { k: 'emergency_phone', label: 'هاتف الطوارئ', type: 'tel' },
  { k: 'medical_notes', label: 'ملاحظات طبية', type: 'area' },
  { k: 'notes', label: 'ملاحظات النادي', type: 'area' }
];
function myProfile(){
  const u = state.user || {};
  state.profile = state.profile || {};
  const me = mySwimmer();
  const p = state.profile;
  p.name = p.name || me?.name || u.name || '';
  p.phone = p.phone || me?.phone || u.phone || '';
  p.member_no = p.member_no || u.member_no || me?.id || '';
  p.group_name = p.group_name || me?.group || u.group_name || '';
  p.role = p.role || u.role || '';
  p.extras = p.extras || [];
  return p;
}
function profileInput(f){
  const p = myProfile();
  const val = p[f.k] === undefined || p[f.k] === null ? '' : p[f.k];
  const id = 'pf-' + f.k;
  if (f.type === 'select') {
    const opts = f.options.map(o => '<option value="' + esc(o) + '"' + (String(val) === o ? ' selected' : '') + '>' +
      esc({ m: 'ذكر', f: 'أنثى' }[o] || (o || '—')) + '</option>').join('');
    return '<label class="pf-label">' + esc(f.label) + '<select id="' + id + '" data-pf="' + f.k + '">' + opts + '</select></label>';
  }
  if (f.type === 'area') {
    return '<label class="pf-label pf-wide">' + esc(f.label) + '<textarea id="' + id + '" data-pf="' + f.k + '" rows="2">' + esc(val) + '</textarea></label>';
  }
  return '<label class="pf-label">' + esc(f.label) + '<input id="' + id + '" data-pf="' + f.k + '" type="' + f.type + '" value="' + esc(val) + '"></label>';
}
function profilePage(){
  const p = myProfile();
  const readOnly = ['member_no', 'group_name', 'role'];
  const rows = PROFILE_FIELDS.map(profileInput).join('');
  const extras = (p.extras || []).map((x, i) =>
    '<div class="pf-extra"><input data-pfx-label="' + i + '" value="' + esc(x.label || '') + '" placeholder="اسم التفصيل">' +
    '<input data-pfx-value="' + i + '" value="' + esc(x.value || '') + '" placeholder="القيمة">' +
    '<button class="check-btn no" data-action="remove-profile-extra" data-index="' + i + '">حذف</button></div>').join('');
  return '<div class="toolbar"><span class="page-description">بياناتك كاملة كما تظهر للإدارة — عدّلها أو أضف تفصيلًا جديدًا.</span>' +
    '<div class="toolbar-group">' + printBtn('print-profile', 'طباعة ملفي') +
    '<button class="btn btn-primary" data-action="save-profile">حفظ البيانات</button></div></div>' +
    '<section class="panel pf-panel"><div class="panel-head"><div><h3>البيانات الأساسية</h3><p>الحقول المرتبطة بالبطاقة official لا تُعدَّل من هنا</p></div></div>' +
      '<div class="pf-readonly">' +
        '<div><i>رقم الانخراط</i><b dir="ltr">' + esc(p.member_no || '—') + '</b></div>' +
        '<div><i>الفوج</i><b>' + esc(p.group_name || '—') + '</b></div>' +
        '<div><i>الدور</i><b>' + esc(({ admin: 'مدير', president: 'رئيس النادي', coach: 'مدرب', parent: 'ولي أمر', member: 'عضو', swimmer_adult: 'سباح', swimmer_minor: 'سباح قاصر' })[p.role] || p.role || '—') + '</b></div>' +
        '<div><i>الموسم</i><b>' + esc(CLUB.season) + '</b></div>' +
      '</div>' +
      '<div class="pf-grid">' + rows + '</div></section>' +
    '<section class="panel pf-panel"><div class="panel-head"><div><h3>تفاصيل إضافية</h3><p>أضف أي معلومة تريد منFCs مثل:Puede</p></div>' +
      '<button class="btn btn-outline" data-action="add-profile-extra">+ إضافة تفصيل</button></div>' +
      '<div id="pf-extras">' + (extras || '<p class="empty-cell">لا توجد تفاصيل مضافة.</p>') + '</div></section>';
}
async function saveProfile(){
  const data = {};
  PROFILE_FIELDS.forEach(f => {
    const el = document.querySelector('[data-pf="' + f.k + '"]');
    if (el) data[f.k] = el.value.trim();
  });
  const labels = [...document.querySelectorAll('[data-pfx-label]')];
  const values = [...document.querySelectorAll('[data-pfx-value]')];
  data.extras = labels.map((el, i) => ({ label: el.value.trim(), value: (values[i]?.value || '').trim() }))
    .filter(x => x.label || x.value);
  try {
    await api('/api/profile', 'PUT', data);
    Object.assign(state.profile, data);
    save(); render(); showToast('تم حفظ بياناتك.');
  } catch (e) { showToast(e.message || 'تعذر حفظ البيانات.', 'error'); }
}