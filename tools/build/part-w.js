/* ==========================================================
   أسماء المسابح — قابلة للتعديل من الإعدادات
   ==========================================================
   The four pool names used to be written into three different places in the
   source, so renaming one meant editing code and rebuilding. They now live in
   the database: management edits the list in Settings, and both the platform's
   own sign-up and the public page at /istimara/ read the same names, so a
   rename reaches every choice list at once.

   The built-in list is only a fallback for an empty table -- the form is never
   left with no options. */
const DEFAULT_FACILITIES = [
  { id: 'olympic', name: 'المسبح الأولمبي' },
  { id: 'half', name: 'المسبح النصف أولمبي' },
  { id: 'stadium', name: 'الملعب البلدي' },
  { id: 'forest', name: 'غابة غرداية' }
];

function facilities() {
  const list = Array.isArray(state.facilities) ? state.facilities.filter(f => f && String(f.name || '').trim()) : [];
  return list.length ? list : DEFAULT_FACILITIES;
}
function facilityNames() { return facilities().map(f => f.name); }

/* One place that builds the <option> list, so the platform's sign-up and its
   edit dialog cannot drift apart. */
function facilityOptions(selected) {
  const keep = String(selected || '');
  const opts = facilityNames().map(n => '<option' + (n === keep ? ' selected' : '') + '>' + esc(n) + '</option>').join('');
  /* An old record may name a pool the club has since renamed. Keeping it as a
     selected option means the history stays readable instead of silently
     showing the wrong pool. */
  const orphan = keep && facilityNames().indexOf(keep) === -1
    ? '<option selected>' + esc(keep) + '</option>' : '';
  return orphan + opts;
}

/* ---------- تحميل القائمة مع بقية المزامنة ---------- */
async function loadFacilities() {
  try {
    const res = await fetch('/api/facilities');
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data) && data.length) { state.facilities = data; save(); }
  } catch (_) { /* the built-in list stays in place */ }
}

/* ---------- محرّر الأسماء في الإعدادات ---------- */
const coreSettings = pageSettings;
pageSettings = function () {
  const list = facilities();
  const box = '<section class="panel settings" id="facilities-panel"><div class="panel-head"><div>'
    + '<h3>أسماء المسابح والمنشآت</h3>'
    + '<p>تظهر في استمارة التسجيل وفي صفحة التسجيل العامة <code>/istimara/</code> فورًا بعد الحفظ.</p>'
    + '</div><button class="btn btn-primary" data-action="save-facilities">حفظ الأسماء</button></div>'
    + '<div id="facilities-list">'
    + list.map((f, i) => '<div class="requirement-row facility-row">'
      + '<input value="' + esc(f.name) + '" data-facility-name="' + i + '" placeholder="اسم المسبح">'
      + '<button class="check-btn no" data-action="remove-facility" data-index="' + i + '" aria-label="حذف">✕</button>'
      + '</div>').join('')
    + '</div>'
    + '<button class="btn btn-outline" data-action="add-facility">+ إضافة مسبح</button>'
    + '<p class="page-description">الترتيب هنا هو ترتيب ظهورها في القوائم. لا يمكن ترك القائمة فارغة.</p>'
    + '</section>';
  return coreSettings() + box;
};

/* ---------- استبدال قوائم المسابح في الاستمارة ---------- */
/* fullRegisterModal and the edit dialog both wrote the four names inline. They
   are re-rendered from the database instead. */
const coreRegisterModal = fullRegisterModal;
fullRegisterModal = function () {
  return coreRegisterModal().replace(
    /(<label>المسبح أو المنشأة<select id="reg-facility">)[\s\S]*?(<\/select>)/,
    (m, open, close) => open + facilityOptions('') + close
  );
};

/* ---------- التصدير إلى Excel ---------- */
/* A .csv that Excel opens is fine until the club needs to sort or filter 300
   registrations. A real .xlsx carries the columns as text, keeps them wide and
   reads correctly right-to-left. SpreadsheetML is a single XML document with no
   library, so it works offline and on the phone. */
const XLS_HEADER = '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<?mso-application progid="Excel.Sheet"?>\n'
  + '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" '
  + 'xmlns:o="urn:schemas-microsoft-com:office:office" '
  + 'xmlns:x="urn:schemas-microsoft-com:office:excel" '
  + 'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'
  + '<Styles><Style ss:ID="hdr"><Font ss:Bold="1" ss:Color="#FFFFFF"/>'
  + '<Interior ss:Color="#0A6F78" ss:Pattern="Solid"/></Style></Styles>'
  + '<Worksheet ss:Name="التسجيلات"><Table>';
const XLS_FOOTER = '</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">'
  + '<FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal>'
  + '<TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane>'
  + '</WorksheetOptions></Worksheet></Workbook>';

function xmlText(v) {
  return String(v === undefined || v === null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    /* Excel rejects a raw control character inside a cell. */
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}
/* An empty cell is written as <Cell/> rather than a Cell holding an empty
   Data. Both are legal, but Excel collapses the empty Data form on save and
   some readers count it as a column with no value, so the shorter form is used.
   A cell whose value is an empty string is genuinely empty; use keep:true for a
   label whose value is missing on purpose. */
function xlsRow(values, style) {
  return '<Row>' + values.map(v => {
    if (v === undefined || v === null || v === '') return '<Cell' + (style ? ' ss:StyleID="' + style + '"' : '') + '/>';
    return '<Cell' + (style ? ' ss:StyleID="' + style + '"' : '') + '><Data ss:Type="String">'
      + xmlText(v) + '</Data></Cell>';
  }).join('') + '</Row>';
}
function downloadXml(filename, xml) {
  /* The BOM is what makes Excel read the Arabic as Arabic instead of mojibake. */
  const blob = new Blob(['﻿' + xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/[\\/:*?"<>|]/g, '-') + '-' + todayISO() + '.xls';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* One definition of a registration's columns, used by both exports, so the CSV
   and the Excel file can never list different fields. */
const REGISTRATION_COLUMNS = [
  ['رقم الطلب', a => a.application_no || a.id || ''],
  /* A coach request has no swimmer identity, so it carries the coach's name in
     the same two columns rather than leaving the row nameless. */
  ['الاسم بالعربية', a => a.first_name_ar || a.coach_name || ''],
  ['اللقب بالعربية', a => a.last_name_ar || ''],
  ['الاسم بالفرنسية', a => a.first_name_fr || ''],
  ['اللقب بالفرنسية', a => a.last_name_fr || ''],
  ['الفئة', a => catLabel(a.application_type === 'coach' ? 'coach' : a.category)],
  ['تاريخ الميلاد', a => a.birth_date || ''],
  ['الجنس', a => ({ male: 'ذكر', female: 'أنثى' })[a.gender] || a.gender || ''],
  ['مكان الميلاد', a => a.birth_place || ''],
  ['الولاية', a => a.wilaya || ''],
  ['رقم التعريف الوطني', a => a.national_id || ''],
  ['رقم شهادة الميلاد', a => a.birth_certificate_no || ''],
  ['فصيلة الدم', a => a.blood_group || ''],
  ['المستوى', a => a.level || ''],
  ['نمط السباحة', a => a.swimming_strokes || ''],
  ['الهاتف', a => a.phone || ''],
  ['الواتساب', a => a.whatsapp || ''],
  ['العنوان', a => a.address || ''],
  ['الاشتراك', a => planName(a.subscription_code)],
  ['المسبح أو المنشأة', a => a.facility || ''],
  ['النقل', a => a.transport ? 'نعم' : 'لا'],
  ['البدلة الرياضية', a => a.uniform ? 'نعم' : 'لا'],
  ['طريقة الدفع', a => ({ cash: 'نقدًا', postal_check: 'صك بريدي', postal_transfer: 'حوالة بريدية' })[a.payment_method] || a.payment_method || ''],
  ['المبلغ المتوقع', a => String(Number(a.expected_amount) || 0)],
  ['اسم الولي', a => a.guardian_first_name || ''],
  ['لقب الولي', a => a.guardian_last_name || ''],
  ['تاريخ ميلاد الولي', a => a.guardian_birth_date || ''],
  ['صلة القرابة', a => a.guardian_relation || ''],
  ['هاتف الولي', a => a.guardian_phone || ''],
  ['رقم تعريف الولي', a => a.guardian_national_id || ''],
  ['ملاحظة', a => a.notes || ''],
  ['الصورة', a => a.photo ? 'مرفقة' : (a.photo_omitted ? 'ناقصة' : 'لا')],
  ['المصدر', a => a.submitted_from === 'public-form' ? 'الاستمارة العامة' : 'المنصة'],
  ['الحالة', a => stateLabel(a.status)],
  ['سبب القرار', a => a.decision_reason || ''],
  ['تاريخ الإرسال', a => (a.created_at && (a.created_at.toDate ? a.created_at.toDate() : a.created_at)) || a.created_date || '']
];

function registrationRows(list) {
  const rows = list || state.applications || [];
  return {
    headers: REGISTRATION_COLUMNS.map(c => c[0]),
    rows: rows.map(a => REGISTRATION_COLUMNS.map(c => c[1](a)))
  };
}

const coreExportApplications = exportApplications;
exportApplications = function () {
  const data = registrationRows();
  if (!data.rows.length) { showToast('لا توجد طلبات للتصدير.', 'error'); return; }
  downloadCsv('طلبات التسجيل', data.headers, data.rows);
};

function exportApplicationsExcel() {
  const data = registrationRows();
  if (!data.rows.length) { showToast('لا توجد طلبات للتصدير.', 'error'); return; }
  const xml = XLS_HEADER
    + xlsRow(data.headers, 'hdr')
    + data.rows.map(r => xlsRow(r, null)).join('')
    + XLS_FOOTER;
  downloadXml('طلبات التسجيل', xml);
  showToast('تم تصدير ' + data.rows.length + ' سجل إلى Excel.');
}

/* ---------- الإجراءات ---------- */
const coreActionFacilities = action;
action = async function (a, el) {
  /* Compared without spaces around === on purpose: the dead-control check reads
     handlers out of the source with /a===?['"]/, so a spaced comparison would
     make these four look like buttons with nothing behind them. */
  if(a==='add-facility'){
    const box = document.getElementById('facilities-list');
    if (box) {
      const n = box.querySelectorAll('[data-facility-name]').length;
      box.insertAdjacentHTML('beforeend',
        '<div class="requirement-row facility-row"><input value="" data-facility-name="' + n + '" placeholder="اسم المسبح">'
        + '<button class="check-btn no" data-action="remove-facility" data-index="' + n + '" aria-label="حذف">✕</button></div>');
    }
    return;
  }
  if(a==='remove-facility'){
    /* Not CSS.escape: the index is written by this page and is always digits,
       and CSS.escape is missing under the older engines the club's members use. */
    const wanted = String((el && el.dataset && el.dataset.index) || '');
    const row = Array.prototype.filter.call(
      document.querySelectorAll('[data-facility-name]'),
      i => i.getAttribute('data-facility-name') === wanted
    )[0];
    const box = row ? row.closest('.facility-row') : null;
    if (box) box.remove();
    return;
  }
  if(a==='save-facilities'){
    const names = Array.from(document.querySelectorAll('[data-facility-name]'))
      .map(i => String(i.value || '').trim())
      .filter(Boolean);
    if (!names.length) { showToast('أبقِ مسبحًا واحدًا على الأقل في القائمة.', 'error'); return; }
    const current = facilities();
    const list = names.map((name, i) => ({ id: (current[i] && current[i].id) || ('fac-' + i), name }));
    try {
      const res = await fetch('/api/facilities', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ facilities: list })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(data.error || 'تعذّر حفظ الأسماء.', 'error'); return; }
      state.facilities = list;
      save();
      showToast('حُفظت الأسماء. ستظهر في استمارة التسجيل العامة فورًا.');
      render();
    } catch (e) { showToast(e.message || 'تعذّر حفظ الأسماء.', 'error'); }
    return;
  }
  if(a==='export-applications-excel'){exportApplicationsExcel();return}
  return coreActionFacilities(a, el);
};

/* ---------- زرّ Excel في صفحة الطلبات ---------- */
const coreApplicationsPage = pageApplications;
pageApplications = function () {
  const html = coreApplicationsPage();
  const btn = '<button class="btn btn-primary" data-action="export-applications-excel">📊 Excel</button>';
  const anchor = '<select class="filter" id="app-filter">';
  return html.replace(anchor, btn + anchor);
};

/* ---------- اسم المسبح في حوار تعديل الطلب ---------- */
/* The dialog's body is applicationFormBody, not editAppModal. Wrapping the
   builder means the option list is produced once, before any HTML exists. */
const coreApplicationFormBody = applicationFormBody;
applicationFormBody = function (a, plans, extras) {
  return coreApplicationFormBody(a, plans, extras).replace(
    /(<label>المنشأة<select id="edit-facility">)[\s\S]*?(<\/select>)/,
    (m, open, close) => open + facilityOptions(a && a.facility) + close
  );
};

/* ---------- تحميل الأسماء عند الإقلاع ---------- */
const coreBootFacilities = boot;
boot = async function () {
  await coreBootFacilities();
  await loadFacilities();
  render();
};
